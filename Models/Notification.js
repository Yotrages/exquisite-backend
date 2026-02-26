const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['order', 'promo', 'restock', 'review', 'system', 'price_drop', 'delivery'],
      default: 'system',
    },
    title: {
      type: String,
      required: true,
      maxlength: 120,
    },
    message: {
      type: String,
      required: true,
      maxlength: 500,
    },
    link: {
      type: String, // e.g. /order/123
      default: null,
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    meta: {
      type: mongoose.Schema.Types.Mixed, // extra data (orderId, productId, etc.)
      default: {},
    },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, read: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);
module.exports = Notification;
