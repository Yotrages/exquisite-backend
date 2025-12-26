const express = require("express");
const { protect, admin } = require("../middleware/authMiddleware");
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

module.exports = router;
