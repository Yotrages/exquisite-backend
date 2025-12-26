const Order = require("../Models/Order");
const Product = require("../Models/Product");
const User = require("../Models/User");
const Payment = require("../Models/Payment");

/**
 * Get dashboard statistics
 */
const getDashboardStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalProducts = await Product.countDocuments();
    const totalOrders = await Order.countDocuments();
    const totalRevenue = await Order.aggregate([
      { $match: { isPaid: true } },
      { $group: { _id: null, total: { $sum: "$totalPrice" } } },
    ]);

    const pendingOrders = await Order.countDocuments({ status: "pending" });
    const processingOrders = await Order.countDocuments({ status: "processing" });
    const shippedOrders = await Order.countDocuments({ status: "shipped" });
    const deliveredOrders = await Order.countDocuments({ status: "delivered" });

    const totalInventoryValue = await Product.aggregate([
      { $group: { _id: null, value: { $sum: { $multiply: ["$price", "$quantity"] } } } },
    ]);

    res.status(200).json({
      stats: {
        totalUsers,
        totalProducts,
        totalOrders,
        totalRevenue: totalRevenue[0]?.total || 0,
        totalInventoryValue: totalInventoryValue[0]?.value || 0,
      },
      orders: {
        pending: pendingOrders,
        processing: processingOrders,
        shipped: shippedOrders,
        delivered: deliveredOrders,
      },
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to retrieve dashboard stats",
      details: error.message,
    });
  }
};

/**
 * Get sales analytics
 */
const getSalesAnalytics = async (req, res) => {
  try {
    const days = req.query.days || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const dailySales = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          isPaid: true,
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" },
          },
          sales: { $sum: "$totalPrice" },
          orders: { $sum: 1 },
        },
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 },
      },
    ]);

    const topProducts = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          isPaid: true,
        },
      },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.product",
          sold: { $sum: "$items.quantity" },
          revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
        },
      },
      { $sort: { sold: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
    ]);

    const categoryAnalytics = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          isPaid: true,
        },
      },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "products",
          localField: "items.product",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $group: {
          _id: "$product.category",
          sales: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
          orders: { $sum: 1 },
        },
      },
      { $sort: { sales: -1 } },
    ]);

    res.status(200).json({
      period: days,
      dailySales,
      topProducts,
      categoryAnalytics,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to retrieve sales analytics",
      details: error.message,
    });
  }
};

/**
 * Get inventory analytics
 */
const getInventoryAnalytics = async (req, res) => {
  try {
    const lowStockProducts = await Product.find({ quantity: { $lt: 5 } })
      .select("name category price quantity sku")
      .sort({ quantity: 1 });

    const outOfStockProducts = await Product.find({ quantity: 0 })
      .select("name category sku");

    const inventorySummary = await Product.aggregate([
      {
        $group: {
          _id: "$category",
          totalItems: { $sum: "$quantity" },
          totalValue: { $sum: { $multiply: ["$price", "$quantity"] } },
          products: { $sum: 1 },
        },
      },
      { $sort: { totalValue: -1 } },
    ]);

    const totalInventory = await Product.aggregate([
      {
        $group: {
          _id: null,
          totalItems: { $sum: "$quantity" },
          totalValue: { $sum: { $multiply: ["$price", "$quantity"] } },
          products: { $sum: 1 },
        },
      },
    ]);

    res.status(200).json({
      lowStock: lowStockProducts,
      outOfStock: outOfStockProducts,
      bySummary: inventorySummary,
      total: totalInventory[0] || { totalItems: 0, totalValue: 0, products: 0 },
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to retrieve inventory analytics",
      details: error.message,
    });
  }
};

/**
 * Get customer analytics
 */
const getCustomerAnalytics = async (req, res) => {
  try {
    const totalCustomers = await User.countDocuments({ isAdmin: false });

    const newCustomers = await User.countDocuments({
      isAdmin: false,
      createdAt: {
        $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
      },
    });

    const topCustomers = await Order.aggregate([
      { $match: { isPaid: true } },
      {
        $group: {
          _id: "$user",
          orders: { $sum: 1 },
          totalSpent: { $sum: "$totalPrice" },
        },
      },
      { $sort: { totalSpent: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
    ]);

    const repeatCustomers = await Order.aggregate([
      {
        $group: {
          _id: "$user",
          orderCount: { $sum: 1 },
        },
      },
      { $match: { orderCount: { $gt: 1 } } },
      { $count: "total" },
    ]);

    res.status(200).json({
      totalCustomers,
      newCustomers,
      repeatCustomers: repeatCustomers[0]?.total || 0,
      topCustomers,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to retrieve customer analytics",
      details: error.message,
    });
  }
};

/**
 * Get payment analytics
 */
const getPaymentAnalytics = async (req, res) => {
  try {
    const totalPayments = await Payment.countDocuments();
    const successfulPayments = await Payment.countDocuments({ isPaid: true });
    const failedPayments = await Payment.countDocuments({ isPaid: false });

    const totalPaymentRevenue = await Payment.aggregate([
      { $match: { isPaid: true } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]);

    const paymentMethodStats = await Payment.aggregate([
      {
        $group: {
          _id: "$paymentMethod",
          count: { $sum: 1 },
          successful: {
            $sum: { $cond: ["$isPaid", 1, 0] },
          },
        },
      },
    ]);

    res.status(200).json({
      total: totalPayments,
      successful: successfulPayments,
      failed: failedPayments,
      successRate: ((successfulPayments / totalPayments) * 100).toFixed(2) + "%",
      totalRevenue: totalPaymentRevenue[0]?.total || 0,
      byMethod: paymentMethodStats,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to retrieve payment analytics",
      details: error.message,
    });
  }
};

/**
 * Get performance metrics
 */
const getPerformanceMetrics = async (req, res) => {
  try {
    const avgOrderValue = await Order.aggregate([
      { $match: { isPaid: true } },
      { $group: { _id: null, avgValue: { $avg: "$totalPrice" } } },
    ]);

    const avgOrdersPerDay = await Order.aggregate([
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $group: { _id: null, avgOrders: { $avg: "$count" } } },
    ]);

    const conversionMetrics = await User.aggregate([
      {
        $facet: {
          totalUsers: [{ $count: "count" }],
          customersWithOrders: [
            {
              $lookup: {
                from: "orders",
                localField: "_id",
                foreignField: "user",
                as: "orders",
              },
            },
            { $match: { orders: { $ne: [] } } },
            { $count: "count" },
          ],
        },
      },
    ]);

    const totalUsers = conversionMetrics[0]?.totalUsers[0]?.count || 0;
    const customersWithOrders = conversionMetrics[0]?.customersWithOrders[0]?.count || 0;

    res.status(200).json({
      averageOrderValue: avgOrderValue[0]?.avgValue || 0,
      averageOrdersPerDay: avgOrdersPerDay[0]?.avgOrders || 0,
      conversionRate: totalUsers > 0 ? ((customersWithOrders / totalUsers) * 100).toFixed(2) + "%" : "0%",
      customerAcquisitionRate: "Data pending",
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to retrieve performance metrics",
      details: error.message,
    });
  }
};

module.exports = {
  getDashboardStats,
  getSalesAnalytics,
  getInventoryAnalytics,
  getCustomerAnalytics,
  getPaymentAnalytics,
  getPerformanceMetrics,
};
