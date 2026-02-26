const mongoose = require('mongoose');
const Review = require('../Models/Review');
const Product = require('../Models/Product');
const Order = require('../Models/Order');
const { getFromCache, setInCache, deleteFromCache } = require('../config/redis');
const { createNotification } = require('./notificationController');

/**
 * Add a review to a product
 */
const addReview = async (req, res) => {
  try {
    const { rating, title, comment, images, product: productId } = req.body;
    const userId = req.user._id;

    if (!rating || !title || !comment) {
      return res.status(400).json({ message: 'Rating, title, and comment are required' });
    }
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }
    if (!productId) {
      return res.status(400).json({ message: 'Product ID is required' });
    }

    // Check if user has already reviewed this product
    const existingReview = await Review.findOne({ product: productId, user: userId });
    if (existingReview) {
      return res.status(400).json({ message: 'You have already reviewed this product' });
    }

    // Check if user has purchased this product
    const order = await Order.findOne({ user: userId, 'items.product': productId });
    const verified = !!order;

    const review = new Review({
      product: productId,
      user: userId,
      rating,
      title,
      comment,
      images: images || [],
      verified,
      status: 'approved', // auto-approve; set to 'pending' to enable moderation
    });

    await review.save();

    // Invalidate caches
    await deleteFromCache(`product:${productId}`);
    await deleteFromCache(`reviews:product:${productId}`);

    res.status(201).json({
      message: verified
        ? 'Review submitted successfully!'
        : 'Review submitted! It will appear after moderation.',
      review,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get reviews for a product with pagination
 */
const getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;
    const { page = 1, limit = 10, sortBy = 'recent' } = req.query;

    const cacheKey = `reviews:product:${productId}:${page}:${limit}:${sortBy}`;
    const cachedReviews = await getFromCache(cacheKey);
    if (cachedReviews) {
      return res.json({ ...cachedReviews, cached: true });
    }

    let sortObj = { createdAt: -1 };
    switch (sortBy) {
      case 'helpful':      sortObj = { helpful: -1 };    break;
      case 'rating-high':  sortObj = { rating: -1 };     break;
      case 'rating-low':   sortObj = { rating: 1 };      break;
      default:             sortObj = { createdAt: -1 };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const productObjId = new mongoose.Types.ObjectId(productId);

    const [reviews, totalReviews, ratingStats] = await Promise.all([
      Review.find({ product: productObjId, status: 'approved' })
        .populate('user', 'name profilePicture')
        .sort(sortObj)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Review.countDocuments({ product: productObjId, status: 'approved' }),
      Review.aggregate([
        { $match: { product: productObjId, status: 'approved' } },
        { $group: { _id: '$rating', count: { $sum: 1 } } },
        { $sort: { _id: -1 } },
      ]),
    ]);

    const totalPages = Math.ceil(totalReviews / parseInt(limit));

    const ratingBreakdown = {};
    for (let i = 1; i <= 5; i++) {
      const stat = ratingStats.find((s) => s._id === i);
      ratingBreakdown[i] = stat ? stat.count : 0;
    }

    // Compute average rating
    const sumRatings = Object.entries(ratingBreakdown).reduce(
      (acc, [k, v]) => acc + parseInt(k) * v, 0
    );
    const averageRating = totalReviews > 0 ? parseFloat((sumRatings / totalReviews).toFixed(1)) : 0;

    const result = {
      reviews,
      ratingBreakdown,
      averageRating,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalReviews,
        totalPages,
      },
    };

    await setInCache(cacheKey, result, 3600);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Update a review
 */
const updateReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { rating, title, comment } = req.body;
    const userId = req.user._id;

    const review = await Review.findById(reviewId);
    if (!review) return res.status(404).json({ message: 'Review not found' });

    if (review.user.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this review' });
    }

    review.rating  = rating  || review.rating;
    review.title   = title   || review.title;
    review.comment = comment || review.comment;
    review.status  = 'approved'; // keep approved after edit

    await review.save();
    await deleteFromCache(`reviews:product:${review.product}`);

    res.json({ message: 'Review updated successfully', review });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Delete a review
 */
const deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = req.user._id;

    const review = await Review.findById(reviewId);
    if (!review) return res.status(404).json({ message: 'Review not found' });

    if (review.user.toString() !== userId.toString() && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Not authorized to delete this review' });
    }

    const productId = review.product;
    await Review.deleteOne({ _id: reviewId });
    await deleteFromCache(`reviews:product:${productId}`);

    res.json({ message: 'Review deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Mark a review as helpful
 */
const markHelpful = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const review = await Review.findByIdAndUpdate(
      reviewId,
      { $inc: { helpful: 1 } },
      { new: true }
    );
    res.json({ message: 'Marked as helpful', helpful: review.helpful });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Mark a review as unhelpful
 */
const markUnhelpful = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const review = await Review.findByIdAndUpdate(
      reviewId,
      { $inc: { unhelpful: 1 } },
      { new: true }
    );
    res.json({ message: 'Marked as unhelpful', unhelpful: review.unhelpful });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get all reviews (admin)
 */
const getUserReviews = async (req, res) => {
  try {
    const { page = 1, limit = 20, status = 'all' } = req.query;
    const filter = status !== 'all' ? { status } : {};
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [reviews, totalReviews] = await Promise.all([
      Review.find(filter)
        .populate('product', 'name image')
        .populate('user', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Review.countDocuments(filter),
    ]);

    res.json({
      reviews,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalReviews,
        totalPages: Math.ceil(totalReviews / parseInt(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get current user's own reviews
 */
const getMyReviews = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [reviews, total] = await Promise.all([
      Review.find({ user: userId })
        .populate('product', 'name image price')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Review.countDocuments({ user: userId }),
    ]);

    res.json({
      reviews,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Approve or reject review (admin)
 */
const moderateReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { status, moderatorNote } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Status must be approved or rejected' });
    }

    const review = await Review.findByIdAndUpdate(
      reviewId,
      { status, moderatorNote },
      { new: true }
    ).populate('user', 'name');

    if (!review) return res.status(404).json({ message: 'Review not found' });

    await deleteFromCache(`reviews:product:${review.product}`);

    // Notify reviewer
    if (status === 'approved') {
      createNotification(review.user._id, {
        type: 'review',
        title: '⭐ Your Review Was Published',
        message: `Your review has been approved and is now visible to other shoppers. Thank you for your feedback!`,
        link: `/product/${review.product}`,
        meta: { reviewId: review._id, productId: review.product },
      }).catch(() => {});
    } else if (status === 'rejected') {
      createNotification(review.user._id, {
        type: 'review',
        title: 'Review Not Approved',
        message: `Your review could not be approved.${moderatorNote ? ` Note: ${moderatorNote}` : ' Please ensure it follows our community guidelines.'}`,
        link: `/product/${review.product}`,
        meta: { reviewId: review._id },
      }).catch(() => {});
    }

    res.json({ message: `Review ${status} successfully`, review });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  addReview,
  getProductReviews,
  updateReview,
  deleteReview,
  markHelpful,
  markUnhelpful,
  getUserReviews,
  getMyReviews,
  moderateReview,
};
