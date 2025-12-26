const mongoose = require('mongoose');

const notificationPreferencesSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    emailNotifications: {
      orderUpdates: {
        type: Boolean,
        default: true,
      },
      priceDropAlerts: {
        type: Boolean,
        default: true,
      },
      restockNotifications: {
        type: Boolean,
        default: true,
      },
      reviewRequests: {
        type: Boolean,
        default: true,
      },
      promotions: {
        type: Boolean,
        default: true,
      },
      newsletter: {
        type: Boolean,
        default: true,
      },
      productRecommendations: {
        type: Boolean,
        default: true,
      },
    },
    pushNotifications: {
      orderUpdates: {
        type: Boolean,
        default: true,
      },
      priceDropAlerts: {
        type: Boolean,
        default: true,
      },
      restockNotifications: {
        type: Boolean,
        default: true,
      },
      promotions: {
        type: Boolean,
        default: false,
      },
    },
    smsNotifications: {
      enabled: {
        type: Boolean,
        default: false,
      },
      phone: String,
      orderUpdates: {
        type: Boolean,
        default: false,
      },
      priceDropAlerts: {
        type: Boolean,
        default: false,
      },
    },
    notificationFrequency: {
      type: String,
      enum: ['instant', 'daily', 'weekly'],
      default: 'instant',
    },
    doNotDisturbHours: {
      enabled: {
        type: Boolean,
        default: false,
      },
      startHour: {
        type: Number,
        min: 0,
        max: 23,
      },
      endHour: {
        type: Number,
        min: 0,
        max: 23,
      },
    },
    unsubscribedEmails: {
      type: Boolean,
      default: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

const NotificationPreferences = mongoose.model(
  'NotificationPreferences',
  notificationPreferencesSchema
);
module.exports = NotificationPreferences;
