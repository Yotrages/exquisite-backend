const Order = require("../Models/Order");
const Product = require("../Models/Product");
const User = require("../Models/User");
const { sendOrderConfirmationEmail, sendOrderShippedEmail } = require("../utils/emailService");
const { createNotification } = require('./notificationController');

/**
 * Calculate estimated delivery date (5 business days from now)
 */
const getEstimatedDelivery = () => {
  const date = new Date();
  date.setDate(date.getDate() + 5);
  return date;
};

/**
 * Create order (after payment is completed)
 */
const createOrder = async (req, res) => {
  try {
    const { items, shippingAddress, paymentMethod } = req.body;
    const userId = req.user._id;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: "Order must contain items" });
    }

    const itemsPrice = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    const taxPrice = Math.round(itemsPrice * 0.07 * 100) / 100;
    const shippingPrice = itemsPrice > 50000 ? 0 : 1500;
    const totalPrice = itemsPrice + taxPrice + shippingPrice;

    const order = new Order({
      user: userId,
      items,
      shippingAddress,
      paymentMethod,
      itemsPrice,
      shippingPrice,
      taxPrice,
      totalPrice,
      status: "pending",
    });

    await order.save();
    await order.populate("items.product");

    res.status(201).json(order);

    // Background tasks — non-blocking
    const shortId = order._id.toString().slice(-8).toUpperCase();

    // In-app notification
    createNotification(userId, {
      type: 'order',
      title: '🎉 Order Placed Successfully',
      message: `Your order #${shortId} for ₦${totalPrice.toLocaleString()} has been placed. We'll notify you when it's being processed.`,
      link: `/orders`,
      meta: { orderId: order._id },
    }).catch(() => {});

    // Email confirmation
    try {
      await sendOrderConfirmationEmail(req.user.email, {
        orderNumber: order._id,
        items: order.items,
        total: order.totalPrice,
        estimatedDelivery: getEstimatedDelivery(),
      });
    } catch (emailError) {
      console.error("Email notification failed:", emailError.message);
    }

  } catch (error) {
    res.status(500).json({
      error: "Failed to create order",
      details: error.message,
    });
  }
};

/**
 * Get order by ID
 */
const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("user", "name email phone")
      .populate("items.product");

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (
      order.user._id.toString() !== req.user._id.toString() &&
      !req.user.isAdmin
    ) {
      return res.status(403).json({ error: "Not authorized to view this order" });
    }

    res.status(200).json(order);
  } catch (error) {
    res.status(500).json({ error: "Failed to retrieve order", details: error.message });
  }
};

/**
 * Get user's orders
 */
const getUserOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const orders = await Order.find({ user: req.user._id })
      .populate("items.product", "name price image")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await Order.countDocuments({ user: req.user._id });

    res.status(200).json({
      orders,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to retrieve orders", details: error.message });
  }
};

/**
 * Get all orders (admin only)
 */
const getAllOrders = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const query = {};
    if (status) query.status = status;

    const orders = await Order.find(query)
      .populate("user", "name email phone")
      .populate("items.product", "name price")
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Order.countDocuments(query);

    res.status(200).json({
      orders,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to retrieve orders", details: error.message });
  }
};

/**
 * Update order status (admin only)
 */
const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, trackingNumber, notes } = req.body;

    const validStatuses = ["pending", "processing", "shipped", "delivered", "cancelled"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid order status" });
    }

    const order = await Order.findById(id).populate("user", "name email");
    if (!order) return res.status(404).json({ error: "Order not found" });

    const prevStatus = order.status;
    order.status = status;
    if (trackingNumber) order.trackingNumber = trackingNumber;
    if (notes) order.notes = notes;

    if (status === "delivered") {
      order.isDelivered = true;
      order.deliveredAt = new Date();
    }

    await order.save();

    res.status(200).json({ success: true, message: "Order updated successfully", order });

    // ── Background notifications ───────────────────────────────────────────────
    if (prevStatus === status) return; // no change, skip

    const userId = order.user._id || order.user;
    const shortId = order._id.toString().slice(-8).toUpperCase();

    const notifMap = {
      processing: {
        title: '⚙️ Order Being Processed',
        message: `Your order #${shortId} is now being processed. Hang tight!`,
      },
      shipped: {
        title: '🚚 Order Shipped',
        message: `Your order #${shortId} is on its way!${trackingNumber ? ` Tracking: ${trackingNumber}` : ''} Estimated delivery in 2-3 days.`,
      },
      delivered: {
        title: '✅ Order Delivered',
        message: `Your order #${shortId} has been delivered. Enjoy your purchase! Please leave a review.`,
      },
      cancelled: {
        title: '❌ Order Cancelled',
        message: `Your order #${shortId} has been cancelled.${notes ? ` Reason: ${notes}` : ''} Contact support if you have questions.`,
      },
    };

    if (notifMap[status]) {
      createNotification(userId, {
        type: status === 'cancelled' ? 'system' : 'order',
        title: notifMap[status].title,
        message: notifMap[status].message,
        link: `/orders`,
        meta: { orderId: order._id, trackingNumber },
      }).catch(() => {});
    }

    // Send shipped email
    if (status === 'shipped' && order.user?.email) {
      try {
        await sendOrderShippedEmail(order.user.email, order._id, trackingNumber, "DHL");
      } catch (err) {
        console.error("Shipped email failed:", err.message);
      }
    }

  } catch (error) {
    res.status(500).json({ error: "Failed to update order", details: error.message });
  }
};

/**
 * Cancel order (admin or user)
 */
const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ error: "Order not found" });

    if (
      order.user.toString() !== req.user._id.toString() &&
      !req.user.isAdmin
    ) {
      return res.status(403).json({ error: "Not authorized to cancel this order" });
    }

    if (order.status === "delivered" || order.status === "shipped") {
      return res.status(400).json({ error: "Cannot cancel delivered or shipped orders" });
    }

    // Restore inventory
    for (const item of order.items) {
      await Product.findByIdAndUpdate(
        item.product,
        { $inc: { quantity: item.quantity } },
        { new: true }
      );
    }

    order.status = "cancelled";
    order.notes = reason || "Order cancelled by user";
    await order.save();

    res.status(200).json({ success: true, message: "Order cancelled successfully", order });

    // Notify user
    const shortId = order._id.toString().slice(-8).toUpperCase();
    createNotification(order.user, {
      type: 'system',
      title: '❌ Order Cancelled',
      message: `Your order #${shortId} has been cancelled.${reason ? ` Reason: ${reason}` : ''} Any payment will be refunded within 3-5 business days.`,
      link: `/orders`,
      meta: { orderId: order._id },
    }).catch(() => {});

  } catch (error) {
    res.status(500).json({ error: "Failed to cancel order", details: error.message });
  }
};

/**
 * Get order analytics (admin only)
 */
const getOrderAnalytics = async (req, res) => {
  try {
    const totalOrders = await Order.countDocuments();
    const totalRevenue = await Order.aggregate([
      { $match: { isPaid: true } },
      { $group: { _id: null, total: { $sum: "$totalPrice" } } },
    ]);

    const ordersByStatus = await Order.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const recentOrders = await Order.find()
      .populate("user", "name email")
      .sort({ createdAt: -1 })
      .limit(10);

    const monthlyRevenue = await Order.aggregate([
      { $match: { isPaid: true } },
      {
        $group: {
          _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
          total: { $sum: "$totalPrice" },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    res.status(200).json({
      totalOrders,
      totalRevenue: totalRevenue[0]?.total || 0,
      ordersByStatus,
      recentOrders,
      monthlyRevenue,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to retrieve analytics", details: error.message });
  }
};

module.exports = {
  createOrder,
  getOrderById,
  getUserOrders,
  getAllOrders,
  updateOrderStatus,
  cancelOrder,
  getOrderAnalytics,
};
