const express = require('express');
const Payment = require('../Models/User');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/checkout', protect, async (req, res) => {
  const { items, totalAmount, paymentMethod } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'No items in the cart' });
  }

  try {
    const payment = new Payment({
      user: req.user._id,
      items,
      totalAmount,
      paymentMethod,
    });

    const savedPayment = await payment.save();
    res.status(201).json(savedPayment);
  } catch (err) {
    res.status(500).json({ error: 'Failed to process checkout', details: err.message });
  }
});

router.put('/:id/pay', protect, async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);

    if (!payment) return res.status(404).json({ error: 'Payment not found' });

    payment.isPaid = true;
    payment.paidAt = Date.now();
    payment.paymentResult = req.body; 

    const updatedPayment = await payment.save();
    res.status(200).json(updatedPayment);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update payment', details: err.message });
  }
});


router.get('/:id', protect, async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id).populate('items.product');

    if (!payment) return res.status(404).json({ error: 'Payment not found' });

    res.status(200).json(payment);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve payment', details: err.message });
  }
});

module.exports = router;
