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
  deleteNotification,
} = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');
const { moderateLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

// ── Notification History ──────────────────────────────────────────────────────
// GET  /api/notifications           — Get notification history (paginated)
router.get('/', protect, getNotificationHistory);
// alias
router.get('/history', protect, getNotificationHistory);

// PUT  /api/notifications/all/read  — Mark ALL as read
router.put('/all/read', protect, (req, res) => {
  req.params = { id: 'all' };
  markNotificationAsRead(req, res);
});

// DELETE /api/notifications/all     — Delete all
router.delete('/all', protect, (req, res) => {
  req.params = { id: 'all' };
  deleteNotification(req, res);
});

// ── Preferences (must come BEFORE /:id routes to avoid conflicts) ─────────────
router.get('/preferences', protect, getNotificationPreferences);
router.put('/preferences', protect, moderateLimiter, updateNotificationPreferences);
router.put('/email', protect, moderateLimiter, updateEmailNotifications);
router.put('/push', protect, moderateLimiter, updatePushNotifications);
router.put('/sms', protect, moderateLimiter, updateSMSNotifications);

// ── Email Subscription ────────────────────────────────────────────────────────
router.post('/subscribe-emails', protect, subscribeToEmails);
router.post('/unsubscribe-emails', protect, moderateLimiter, unsubscribeFromEmails);

// ── Do Not Disturb ────────────────────────────────────────────────────────────
router.put('/dnd', protect, moderateLimiter, updateDoNotDisturb);

// ── Single notification actions (keep LAST to avoid shadowing named routes) ───
router.put('/:id/read', protect, markNotificationAsRead);
router.delete('/:id', protect, deleteNotification);

module.exports = router;
