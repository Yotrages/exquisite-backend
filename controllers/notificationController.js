const NotificationPreferences = require('../Models/NotificationPreferences.js');

/**
 * Get user's notification preferences
 */
const getNotificationPreferences = async (req, res) => {
  try {
    const userId = req.user._id;

    let preferences = await NotificationPreferences.findOne({ user: userId });

    // Create default preferences if doesn't exist
    if (!preferences) {
      preferences = new NotificationPreferences({ user: userId });
      await preferences.save();
    }

    res.json(preferences);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Update notification preferences
 */
const updateNotificationPreferences = async (req, res) => {
  try {
    const userId = req.user._id;
    const updates = req.body;

    const preferences = await NotificationPreferences.findOneAndUpdate(
      { user: userId },
      updates,
      { new: true, upsert: true }
    );

    res.json({ message: 'Preferences updated successfully', preferences });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Update email notification settings
 */
const updateEmailNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    const emailSettings = req.body;

    const preferences = await NotificationPreferences.findOneAndUpdate(
      { user: userId },
      { emailNotifications: emailSettings },
      { new: true, upsert: true }
    );

    res.json({ message: 'Email notifications updated', preferences });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Update push notification settings
 */
const updatePushNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    const pushSettings = req.body;

    const preferences = await NotificationPreferences.findOneAndUpdate(
      { user: userId },
      { pushNotifications: pushSettings },
      { new: true, upsert: true }
    );

    res.json({ message: 'Push notifications updated', preferences });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Update SMS notification settings
 */
const updateSMSNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    const smsSettings = req.body;

    // Validate phone number format
    if (smsSettings.phone && !/^(\+\d{1,3})?[\d\s\-()]{10,}$/.test(smsSettings.phone)) {
      return res.status(400).json({ message: 'Invalid phone number format' });
    }

    const preferences = await NotificationPreferences.findOneAndUpdate(
      { user: userId },
      { smsNotifications: smsSettings },
      { new: true, upsert: true }
    );

    res.json({ message: 'SMS notifications updated', preferences });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Unsubscribe from all emails
 */
const unsubscribeFromEmails = async (req, res) => {
  try {
    const userId = req.user?._id || req.params.userId;

    const preferences = await NotificationPreferences.findOneAndUpdate(
      { user: userId },
      {
        unsubscribedEmails: true,
        emailNotifications: {
          orderUpdates: false,
          priceDropAlerts: false,
          restockNotifications: false,
          reviewRequests: false,
          promotions: false,
          newsletter: false,
          productRecommendations: false,
        },
      },
      { new: true, upsert: true }
    );

    res.json({ message: 'Unsubscribed from all emails', preferences });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Subscribe to emails
 */
const subscribeToEmails = async (req, res) => {
  try {
    const userId = req.user._id;

    const preferences = await NotificationPreferences.findOneAndUpdate(
      { user: userId },
      {
        unsubscribedEmails: false,
        emailNotifications: {
          orderUpdates: true,
          priceDropAlerts: true,
          restockNotifications: true,
          reviewRequests: true,
          promotions: true,
          newsletter: true,
          productRecommendations: true,
        },
      },
      { new: true, upsert: true }
    );

    res.json({ message: 'Subscribed to emails', preferences });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Update do not disturb hours
 */
const updateDoNotDisturb = async (req, res) => {
  try {
    const userId = req.user._id;
    const { enabled, startHour, endHour } = req.body;

    if (enabled && (startHour === undefined || endHour === undefined)) {
      return res.status(400).json({ message: 'Start and end hours are required' });
    }

    if (enabled && startHour >= endHour) {
      return res.status(400).json({ message: 'Start hour must be before end hour' });
    }

    const preferences = await NotificationPreferences.findOneAndUpdate(
      { user: userId },
      {
        doNotDisturbHours: {
          enabled,
          startHour,
          endHour,
        },
      },
      { new: true, upsert: true }
    );

    res.json({ message: 'Do not disturb settings updated', preferences });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get notification history (for notification center)
 */
const getNotificationHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const { limit = 20, page = 1 } = req.query;

    // TODO: Implement notification history model and retrieve here
    // For now, return empty array
    const skip = (parseInt(page) - 1) * parseInt(limit);

    res.json({
      notifications: [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: 0,
        totalPages: 0,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Mark notification as read
 */
const markNotificationAsRead = async (req, res) => {
  try {
    // TODO: Implement when notification history model is created
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getNotificationPreferences,
  updateNotificationPreferences,
  updateEmailNotifications,
  updatePushNotifications,
  updateSMSNotifications,
  unsubscribeFromEmails,
  subscribeToEmails,
  updateDoNotDisturb,
  getNotificationHistory,
  markNotificationAsRead,
};
