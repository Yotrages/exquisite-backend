const express = require("express");
const { protect, admin } = require("../middleware/authMiddleware");
const { migrateProducts } = require('../controllers/migrationController');
const { createNotification } = require('../controllers/notificationController');
const { emitNotification, emitNotificationToAll, emitAdminNotification } = require('../socket');
const User = require('../Models/User');
const {
  getDashboardStats,
  getSalesAnalytics,
  getInventoryAnalytics,
  getCustomerAnalytics,
  getPaymentAnalytics,
  getPerformanceMetrics,
} = require("../controllers/adminController");
const {
  getAllOrders,
  updateOrderStatus,
  getOrderAnalytics,
} = require("../controllers/orderController");
const {
  getAllPayments,
} = require("../controllers/paymentController");

const router = express.Router();

// Analytics and Dashboard
router.get("/dashboard/stats", protect, admin, getDashboardStats);
router.get("/analytics/sales", protect, admin, getSalesAnalytics);
router.get("/analytics/inventory", protect, admin, getInventoryAnalytics);
router.get("/analytics/customers", protect, admin, getCustomerAnalytics);
router.get("/analytics/payments", protect, admin, getPaymentAnalytics);
router.get("/analytics/performance", protect, admin, getPerformanceMetrics);

// Orders Management
router.get("/orders", protect, admin, getAllOrders);
router.put("/orders/:id/status", protect, admin, updateOrderStatus);
router.get("/orders/analytics", protect, admin, getOrderAnalytics);

// Payments Management
router.get("/payments", protect, admin, getAllPayments);

// Migration Route (admin only)
router.post('/migrate/products', protect, admin, migrateProducts);

// Send notification to user(s)
router.post('/notifications/send', protect, admin, async (req, res) => {
  try {
    const { userId, type, title, message, link, broadcast } = req.body;
    if (!title || !message) {
      return res.status(400).json({ error: 'Title and message are required' });
    }
    if (broadcast) {
      // Send to all non-admin users
      const users = await User.find({ isAdmin: false }).select('_id').lean();
      const promises = users.map(u => createNotification(u._id, { type: type || 'promo', title, message, link }));
      await Promise.allSettled(promises);

      // Emit broadcast event for real-time delivery
      const notificationData = {
        type: type || 'promo',
        title,
        message,
        link: link || null,
        read: false,
        createdAt: new Date(),
        meta: {},
        broadcast: true,
      };
      emitNotificationToAll(notificationData);
      emitAdminNotification(notificationData);

      return res.json({ success: true, message: `Notification sent to ${users.length} users` });
    }
    if (!userId) return res.status(400).json({ error: 'userId or broadcast required' });
    const notification = await createNotification(userId, { type: type || 'system', title, message, link });

    // Emit admin notification for tracking
    if (notification) {
      emitAdminNotification({
        type: type || 'system',
        title,
        message,
        link: link || null,
        read: false,
        createdAt: new Date(),
        meta: { userId: userId.toString() },
        broadcast: false,
      });
    }

    res.json({ success: true, message: 'Notification sent' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
