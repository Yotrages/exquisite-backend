const express = require('express');
const {
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
} = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');
const { moderateLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

/**
 * Protected routes (authenticated users only)
 */
// GET /api/notifications/preferences - Get user's notification preferences
router.get('/preferences', protect, getNotificationPreferences);

// PUT /api/notifications/preferences - Update notification preferences (rate-limited)
router.put('/preferences', protect, moderateLimiter, updateNotificationPreferences);

// PUT /api/notifications/email - Update email notification preferences
router.put('/email', protect, moderateLimiter, updateEmailNotifications);

// PUT /api/notifications/push - Update push notification preferences
router.put('/push', protect, moderateLimiter, updatePushNotifications);

// PUT /api/notifications/sms - Update SMS notification preferences
router.put('/sms', protect, moderateLimiter, updateSMSNotifications);

// GET /api/notifications/history - Get notification history
router.get('/history', protect, getNotificationHistory);

// PUT /api/notifications/:id/read - Mark notification as read
router.put('/:id/read', protect, markNotificationAsRead);

/**
 * Email subscription routes
 */
// POST /api/notifications/subscribe-emails - Subscribe to emails
router.post('/subscribe-emails', protect, subscribeToEmails);

// POST /api/notifications/unsubscribe-emails - Unsubscribe from emails (rate-limited)
router.post('/unsubscribe-emails', protect, moderateLimiter, unsubscribeFromEmails);

/**
 * Do Not Disturb routes
 */
// PUT /api/notifications/dnd - Set do-not-disturb schedule (rate-limited)
router.put('/dnd', protect, moderateLimiter, updateDoNotDisturb);

module.exports = router;
