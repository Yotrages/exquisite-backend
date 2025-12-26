const Payment = require("../Models/Payment");
const Order = require("../Models/Order");
const Product = require("../Models/Product");
const Cart = require("../Models/Cart");
const { initializeTransaction, verifyTransaction } = require("../config/paystack");

/**
 * Initialize Paystack payment
 */
const initializePayment = async (req, res) => {
  try {
    const { items, shippingAddress } = req.body;
    const userId = req.user._id;
    const userEmail = req.user.email;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: "Cart is empty" });
    }

    if (!shippingAddress) {
      return res.status(400).json({ error: "Shipping address is required" });
    }

    // Calculate totals
    let itemsPrice = 0;
    const orderItems = [];

    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product) {
        return res.status(404).json({ error: `Product ${item.product} not found` });
      }

      if (item.quantity > product.quantity) {
        return res.status(400).json({
          error: `Insufficient stock for ${product.name}. Available: ${product.quantity}`,
        });
      }

      itemsPrice += product.price * item.quantity;
      orderItems.push({
        product: item.product,
        quantity: item.quantity,
        price: product.price,
      });
    }

    const taxPrice = Math.round(itemsPrice * 0.07 * 100) / 100; // 7% tax
    const shippingPrice = itemsPrice > 50000 ? 0 : 1500; // Free shipping over 50k NGN
    const totalPrice = itemsPrice + taxPrice + shippingPrice;

    // Create Paystack transaction
    const paystackPayload = {
      email: userEmail,
      amount: totalPrice * 100, // Paystack expects amount in kobo (divide by 100 to get naira)
      metadata: {
        userId: userId.toString(),
        shippingAddress: shippingAddress,
        items: orderItems,
        itemsPrice,
        taxPrice,
        shippingPrice,
      },
      callback_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/checkout/verify`,
    };

    // Initialize Paystack transaction
    const paystackResponse = await initializeTransaction(paystackPayload);

    if (!paystackResponse.status) {
      return res.status(400).json({ error: paystackResponse.message });
    }

    // Save payment record
    const payment = new Payment({
      user: userId,
      items: orderItems,
      totalAmount: totalPrice,
      paymentMethod: "paystack",
      paymentResult: {
        reference: paystackResponse.data.reference,
        status: "pending",
      },
    });

    await payment.save();

    res.status(201).json({
      success: true,
      paymentId: payment._id,
      reference: paystackResponse.data.reference,
      authorizationUrl: paystackResponse.data.authorization_url,
      accessCode: paystackResponse.data.access_code,
    });
  } catch (error) {
    console.error("Initialize Paystack payment error:", error);
    res.status(500).json({
      error: "Failed to initialize payment",
      details: error.message,
    });
  }
};

/**
 * Verify Paystack payment
 */
const verifyPayment = async (req, res) => {
  try {
    const { reference, paymentId } = req.body;
    const userId = req.user._id;

    if (!reference) {
      return res.status(400).json({ error: "Payment reference is required" });
    }

    // Verify Paystack transaction
    const verifyResponse = await verifyTransaction(reference);

    if (!verifyResponse.status) {
      return res.status(400).json({ error: "Payment verification failed" });
    }

    const paymentData = verifyResponse.data;

    if (paymentData.status !== "success") {
      return res.status(400).json({ error: "Payment was not successful" });
    }

    // Update payment record
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ error: "Payment not found" });
    }

    payment.isPaid = true;
    payment.paidAt = new Date();
    payment.paymentResult = {
      reference: paymentData.reference,
      status: paymentData.status,
      amount: paymentData.amount,
      customer: paymentData.customer,
    };

    await payment.save();

    // Create order
    const shippingAddress = payment.metadata?.shippingAddress || {};
    const orderDoc = new Order({
      user: userId,
      items: payment.items,
      shippingAddress,
      paymentMethod: "paystack",
      payment: payment._id,
      itemsPrice: payment.items.reduce((sum, item) => sum + item.price * item.quantity, 0),
      shippingPrice: payment.totalAmount - payment.items.reduce((sum, item) => sum + item.price * item.quantity, 0) - (Math.round(payment.items.reduce((sum, item) => sum + item.price * item.quantity, 0) * 0.07 * 100) / 100),
      taxPrice: Math.round(payment.items.reduce((sum, item) => sum + item.price * item.quantity, 0) * 0.07 * 100) / 100,
      totalPrice: payment.totalAmount,
      isPaid: true,
      paidAt: new Date(),
      status: "processing",
    });

    await orderDoc.save();

    // Update product inventory
    for (const item of payment.items) {
      await Product.findByIdAndUpdate(
        item.product,
        { $inc: { quantity: -item.quantity } },
        { new: true }
      );
    }

    // Clear user cart
    await Cart.deleteOne({ user: userId });

    res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      order: orderDoc,
      payment: payment,
    });
  } catch (error) {
    console.error("Verify Paystack payment error:", error);
    res.status(500).json({
      error: "Failed to verify payment",
      details: error.message,
    });
  }
};

/**
 * Get payment by ID
 */
const getPaymentById = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id).populate("items.product");

    if (!payment) {
      return res.status(404).json({ error: "Payment not found" });
    }

    // Check authorization
    if (payment.user.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({ error: "Not authorized to view this payment" });
    }

    res.status(200).json(payment);
  } catch (error) {
    res.status(500).json({
      error: "Failed to retrieve payment",
      details: error.message,
    });
  }
};

/**
 * Get all payments (admin only)
 */
const getAllPayments = async (req, res) => {
  try {
    const page = req.query.page || 1;
    const limit = req.query.limit || 20;
    const skip = (page - 1) * limit;

    const payments = await Payment.find()
      .populate("user", "name email")
      .populate("items.product", "name price")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await Payment.countDocuments();

    res.status(200).json({
      payments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to retrieve payments",
      details: error.message,
    });
  }
};

/**
 * Paystack webhook handler
 */
const handlePaystackWebhook = async (req, res) => {
  try {
    const event = req.body;

    // Verify webhook signature (in production, verify the hash)
    if (event.event === "charge.success") {
      const reference = event.data.reference;
      const paymentData = event.data;

      // Find and update payment
      const payment = await Payment.findOne({
        "paymentResult.reference": reference,
      });

      if (payment && !payment.isPaid) {
        payment.isPaid = true;
        payment.paidAt = new Date();
        payment.paymentResult = {
          reference: paymentData.reference,
          status: paymentData.status,
          amount: paymentData.amount,
          customer: paymentData.customer,
        };

        await payment.save();
        console.log("Payment confirmed via webhook:", reference);
      }
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
};

module.exports = {
  initializePayment,
  verifyPayment,
  getPaymentById,
  getAllPayments,
  handlePaystackWebhook,
};
