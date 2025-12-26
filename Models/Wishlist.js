const mongoose = require('mongoose');

const wishlistSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
          required: true,
        },
        addedAt: {
          type: Date,
          default: Date.now,
        },
        priceAtAddition: Number, // Track price when added for price drop notifications
        notifyOnPriceDrop: {
          type: Boolean,
          default: false,
        },
        priceDropThreshold: {
          type: Number,
          default: 0, // Percentage drop
        },
      },
    ],
    isPublic: {
      type: Boolean,
      default: false,
    },
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
wishlistSchema.index({ user: 1, 'items.product': 1 });

const Wishlist = mongoose.model('Wishlist', wishlistSchema);
module.exports = Wishlist;
