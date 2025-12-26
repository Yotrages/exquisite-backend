const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const {
  initializePayment,
  verifyPayment,
  getPaymentById,
  handlePaystackWebhook,
} = require('../controllers/paymentController');

const router = express.Router();

// Paystack payment routes
router.post('/initialize', protect, initializePayment);
router.post('/verify', protect, verifyPayment);
router.get('/:id', protect, getPaymentById);
router.post('/webhook', handlePaystackWebhook);

module.exports = router;
