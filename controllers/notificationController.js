const NotificationPreferences = require('../Models/NotificationPreferences.js');
const Notification = require('../Models/Notification.js');

/**
 * Get user's notification preferences
 */
const getNotificationPreferences = async (req, res) => {
  try {
    const userId = req.user._id;
    let preferences = await NotificationPreferences.findOne({ user: userId });
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
    const preferences = await NotificationPreferences.findOneAndUpdate(
      { user: userId },
      { doNotDisturbHours: { enabled, startHour, endHour } },
      { new: true, upsert: true }
    );
    res.json({ message: 'Do not disturb settings updated', preferences });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get notification history for the user
 */
const getNotificationHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const { limit = 20, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [notifications, total] = await Promise.all([
      Notification.find({ user: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Notification.countDocuments({ user: userId }),
    ]);

    const unreadCount = await Notification.countDocuments({ user: userId, read: false });

    res.json({
      notifications,
      unreadCount,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Mark a notification as read
 */
const markNotificationAsRead = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    if (id === 'all') {
      await Notification.updateMany({ user: userId, read: false }, { read: true });
      return res.json({ message: 'All notifications marked as read' });
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: id, user: userId },
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json({ message: 'Notification marked as read', notification });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Delete a notification
 */
const deleteNotification = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    if (id === 'all') {
      await Notification.deleteMany({ user: userId });
      return res.json({ message: 'All notifications deleted' });
    }

    await Notification.findOneAndDelete({ _id: id, user: userId });
    res.json({ message: 'Notification deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Create a notification for a user (internal use / admin)
 */
const createNotification = async (userId, { type, title, message, link, meta } = {}) => {
  try {
    const notification = new Notification({
      user: userId,
      type: type || 'system',
      title,
      message,
      link: link || null,
      meta: meta || {},
    });
    await notification.save();
    return notification;
  } catch (error) {
    console.error('Failed to create notification:', error.message);
    return null;
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
  deleteNotification,
  createNotification,
};
