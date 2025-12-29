const Review = require('../Models/Review');
const Product = require('../Models/Product');
const Order = require('../Models/Order');
const { getFromCache, setInCache, deleteFromCache } = require('../config/redis');

/**
 * Add a review to a product
 */
const addReview = async (req, res) => {
  try {
    const { rating, title, comment, images, product: productId } = req.body;
    const userId = req.user._id;

    // Validate input
    if (!rating || !title || !comment) {
      return res.status(400).json({ message: 'Rating, title, and comment are required' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    // Check if user has already reviewed this product
    const existingReview = await Review.findOne({
      product: productId,
      user: userId,
    });

    if (existingReview) {
      return res.status(400).json({ message: 'You have already reviewed this product' });
    }

    // Check if user has purchased this product (optional verification)
    const order = await Order.findOne({
      user: userId,
      'items.product': productId,
    });

    const verified = !!order;

    // Create review
    const review = new Review({
      product: productId,
      user: userId,
      rating,
      title,
      comment,
      images: images || [],
      verified,
      status: 'pending', // Reviews go into moderation queue
    });

    await review.save();

    // Invalidate product cache
    await deleteFromCache(`product:${productId}`);
    await deleteFromCache(`reviews:product:${productId}`);

    res.status(201).json({
      message: 'Review submitted successfully. It will be published after moderation.',
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
      case 'helpful':
        sortObj = { helpful: -1 };
        break;
      case 'rating-high':
        sortObj = { rating: -1 };
        break;
      case 'rating-low':
        sortObj = { rating: 1 };
        break;
      case 'recent':
      default:
        sortObj = { createdAt: -1 };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [reviews, totalReviews, ratingStats] = await Promise.all([
      Review.find({
        product: productId,
        status: 'approved',
      })
        .populate('user', 'name profilePicture')
        .sort(sortObj)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Review.countDocuments({
        product: productId,
        status: 'approved',
      }),
      Review.aggregate([
        { $match: { product: productId, status: 'approved' } },
        {
          $group: {
            _id: '$rating',
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: -1 } },
      ]),
    ]);

    const totalPages = Math.ceil(totalReviews / parseInt(limit));

    const ratingBreakdown = {};
    for (let i = 1; i <= 5; i++) {
      const stat = ratingStats.find((s) => s._id === i);
      ratingBreakdown[i] = stat ? stat.count : 0;
    }

    const result = {
      reviews,
      ratingBreakdown,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalReviews,
        totalPages,
      },
    };

    // Cache for 1 hour
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

    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    // Check authorization
    if (review.user.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this review' });
    }

    // Update review
    review.rating = rating || review.rating;
    review.title = title || review.title;
    review.comment = comment || review.comment;
    review.status = 'pending'; // Re-queue for moderation

    await review.save();

    // Invalidate cache
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

    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    // Check authorization
    if (review.user.toString() !== userId.toString() && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Not authorized to delete this review' });
    }

    const productId = review.product;

    await Review.deleteOne({ _id: reviewId });

    // Invalidate cache
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

    res.json({ message: 'Marked as helpful', review });
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

    res.json({ message: 'Marked as unhelpful', review });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get user reviews (admin)
 */
const getUserReviews = async (req, res) => {
  try {
    const { page = 1, limit = 20, status = 'all' } = req.query;

    const filter = status !== 'all' ? { status } : {};
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [reviews, totalReviews] = await Promise.all([
      Review.find(filter)
        .populate('product', 'name')
        .populate('user', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Review.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalReviews / parseInt(limit));

    res.json({
      reviews,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalReviews,
        totalPages,
      },
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
      {
        status,
        moderatorNote,
      },
      { new: true }
    );

    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    // Invalidate cache
    await deleteFromCache(`reviews:product:${review.product}`);

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
  moderateReview,
};
