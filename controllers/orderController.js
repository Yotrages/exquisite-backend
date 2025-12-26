const Order = require("../Models/Order");
const Product = require("../Models/Product");
const User = require("../Models/User");
const { sendOrderConfirmationEmail, sendOrderShippedEmail } = require("../utils/emailService");

/**
 * Calculate estimated delivery date (5-7 business days from now)
 */
const getEstimatedDelivery = () => {
  const date = new Date();
  date.setDate(date.getDate() + 5); // Add 5 business days
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
    
    // Send confirmation email in background (non-blocking)
    try {
      await sendOrderConfirmationEmail(req.user.email, {
        orderNumber: order._id,
        items: order.items,
        total: order.totalPrice,
        estimatedDelivery: getEstimatedDelivery(),
      });
    } catch (emailError) {
      console.error("Email notification failed:", emailError);
      // Don't fail order creation if email fails
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

    // Authorization check
    if (
      order.user._id.toString() !== req.user._id.toString() &&
      !req.user.isAdmin
    ) {
      return res
        .status(403)
        .json({ error: "Not authorized to view this order" });
    }

    res.status(200).json(order);
  } catch (error) {
    res.status(500).json({
      error: "Failed to retrieve order",
      details: error.message,
    });
  }
};

/**
 * Get user's orders
 */
const getUserOrders = async (req, res) => {
  try {
    const page = req.query.page || 1;
    const limit = req.query.limit || 10;
    const skip = (page - 1) * limit;

    const orders = await Order.find({ user: req.user._id })
      .populate("items.product", "name price image")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await Order.countDocuments({ user: req.user._id });

    res.status(200).json({
      orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to retrieve orders",
      details: error.message,
    });
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
    if (status) {
      query.status = status;
    }

    const orders = await Order.find(query)
      .populate("user", "name email phone")
      .populate("items.product", "name price")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await Order.countDocuments(query);

    res.status(200).json({
      orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to retrieve orders",
      details: error.message,
    });
  }
};

/**
 * Update order status (admin only)
 */
const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, trackingNumber, notes } = req.body;

    const validStatuses = [
      "pending",
      "processing",
      "shipped",
      "delivered",
      "cancelled",
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid order status" });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    order.status = status;
    if (trackingNumber) order.trackingNumber = trackingNumber;
    if (notes) order.notes = notes;

    if (status === "shipped") {
      await sendOrderShippedEmail(order.user.email, order._id, trackingNumber, "DHL");
    }

    if (status === "delivered") {
      order.isDelivered = true;
      order.deliveredAt = new Date();
      // Schedule review request email
      try {
        // Could implement review request email here
      } catch (err) {
        console.error("Review request failed:", err);
      }
    }

    await order.save();

    res.status(200).json({
      success: true,
      message: "Order updated successfully",
      order,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to update order",
      details: error.message,
    });
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
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Authorization check
    if (
      order.user.toString() !== req.user._id.toString() &&
      !req.user.isAdmin
    ) {
      return res
        .status(403)
        .json({ error: "Not authorized to cancel this order" });
    }

    if (order.status === "delivered" || order.status === "shipped") {
      return res
        .status(400)
        .json({ error: "Cannot cancel delivered or shipped orders" });
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
    order.notes = reason || "Order cancelled";
    await order.save();

    res.status(200).json({
      success: true,
      message: "Order cancelled successfully",
      order,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to cancel order",
      details: error.message,
    });
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
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
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
    res.status(500).json({
      error: "Failed to retrieve analytics",
      details: error.message,
    });
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
