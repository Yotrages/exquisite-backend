const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    title: {
      type: String,
      required: true,
      minlength: 5,
      maxlength: 100,
    },
    comment: {
      type: String,
      required: true,
      minlength: 10,
      maxlength: 1000,
    },
    verified: {
      type: Boolean,
      default: false, // Set to true when user has purchased the product
    },
    helpful: {
      type: Number,
      default: 0,
    },
    unhelpful: {
      type: Number,
      default: 0,
    },
    images: [
      {
        url: String,
        publicId: String,
      },
    ],
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    moderatorNote: String,
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Index for faster queries
reviewSchema.index({ product: 1, rating: 1 });
reviewSchema.index({ user: 1, createdAt: -1 });
reviewSchema.index({ product: 1, status: 1 });

// Calculate product rating and review count when review is saved
reviewSchema.post('save', async function () {
  const Product = mongoose.model('Product');
  const reviews = await this.constructor
    .find({ product: this.product, status: 'approved' })
    .lean();

  if (reviews.length > 0) {
    const avgRating = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
    await Product.findByIdAndUpdate(
      this.product,
      {
        rating: parseFloat(avgRating.toFixed(1)),
        reviewsCount: reviews.length,
      },
      { new: true }
    );
  }
});

// Clean up product stats when review is deleted
reviewSchema.post('deleteOne', async function () {
  const Product = mongoose.model('Product');
  const reviews = await this.constructor
    .find({ product: this.product, status: 'approved' })
    .lean();

  if (reviews.length > 0) {
    const avgRating = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
    await Product.findByIdAndUpdate(
      this.product,
      {
        rating: parseFloat(avgRating.toFixed(1)),
        reviewsCount: reviews.length,
      },
      { new: true }
    );
  } else {
    await Product.findByIdAndUpdate(
      this.product,
      {
        rating: 0,
        reviewsCount: 0,
      },
      { new: true }
    );
  }
});

const Review = mongoose.model('Review', reviewSchema);
module.exports = Review;
