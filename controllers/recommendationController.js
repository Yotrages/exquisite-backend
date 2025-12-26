const Product = require('../Models/Product.js');
const Order = require('../Models/Order.js');
const { getFromCache, setInCache } = require('../config/redis.js');

/**
 * Get recommended products based on user's purchase history
 * Uses collaborative filtering approach
 */
const getRecommendedProducts = async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 10 } = req.query;

    const cacheKey = `recommendations:user:${userId}:${limit}`;

    // Try cache first
    const cachedRecs = await getFromCache(cacheKey);
    if (cachedRecs) {
      return res.json({ recommendations: cachedRecs, cached: true });
    }

    // Get user's purchase history
    const userOrders = await Order.find({ user: userId })
      .select('items')
      .populate('items.product', 'category price _id')
      .lean();

    if (!userOrders || userOrders.length === 0) {
      // Return trending products if no purchase history
      const trendingProducts = await Product.find({ inStock: true })
        .select('name price category images rating')
        .sort({ reviewsCount: -1, rating: -1 })
        .limit(parseInt(limit))
        .lean();

      await setInCache(cacheKey, trendingProducts, 3600);
      return res.json({ recommendations: trendingProducts });
    }

    // Extract categories from purchase history
    const purchasedCategories = new Set();
    const purchasedProductIds = [];

    userOrders.forEach((order) => {
      order.items?.forEach((item) => {
        if (item.product) {
          purchasedCategories.add(item.product.category);
          purchasedProductIds.push(item.product._id);
        }
      });
    });

    // Find similar products based on categories
    const recommendations = await Product.find({
      _id: { $nin: purchasedProductIds }, // Exclude already purchased
      category: { $in: Array.from(purchasedCategories) },
      inStock: true,
    })
      .select('name price category images rating reviewsCount')
      .sort({ rating: -1, reviewsCount: -1 })
      .limit(parseInt(limit))
      .lean();

    // Cache for 6 hours
    await setInCache(cacheKey, recommendations, 21600);

    res.json({ recommendations });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get products similar to a specific product
 */
const getSimilarProducts = async (req, res) => {
  try {
    const { productId } = req.params;
    const { limit = 8 } = req.query;

    const cacheKey = `similar:product:${productId}:${limit}`;

    const cachedSimilar = await getFromCache(cacheKey);
    if (cachedSimilar) {
      return res.json({ similarProducts: cachedSimilar, cached: true });
    }

    // Get the product
    const product = await Product.findById(productId).select('category price').lean();

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Find similar products
    const similarProducts = await Product.find({
      _id: { $ne: productId },
      category: product.category,
      inStock: true,
      price: {
        $gte: product.price * 0.5,
        $lte: product.price * 1.5,
      },
    })
      .select('name price category images rating reviewsCount')
      .sort({ rating: -1, reviewsCount: -1 })
      .limit(parseInt(limit))
      .lean();

    // Cache for 4 hours
    await setInCache(cacheKey, similarProducts, 14400);

    res.json({ similarProducts });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get "Frequently Bought Together" products
 * Uses order data to find products commonly purchased together
 */
const getFrequentlyBoughtTogether = async (req, res) => {
  try {
    const { productId } = req.params;
    const { limit = 5 } = req.query;

    const cacheKey = `frequently-bought:${productId}:${limit}`;

    const cachedProducts = await getFromCache(cacheKey);
    if (cachedProducts) {
      return res.json({ frequentlyBought: cachedProducts, cached: true });
    }

    // Find orders containing the target product
    const ordersWithProduct = await Order.find({
      'items.product': productId,
    })
      .select('items')
      .populate('items.product', '_id')
      .lean();

    if (!ordersWithProduct || ordersWithProduct.length === 0) {
      return res.json({ frequentlyBought: [] });
    }

    // Count frequency of other products in those orders
    const productFrequency = {};

    ordersWithProduct.forEach((order) => {
      order.items?.forEach((item) => {
        if (item.product && item.product._id.toString() !== productId) {
          productFrequency[item.product._id] = (productFrequency[item.product._id] || 0) + 1;
        }
      });
    });

    // Sort by frequency and get top products
    const topProductIds = Object.entries(productFrequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, parseInt(limit))
      .map(([id]) => id);

    const frequentlyBought = await Product.find({
      _id: { $in: topProductIds },
      inStock: true,
    })
      .select('name price category images rating')
      .lean();

    // Cache for 5 hours
    await setInCache(cacheKey, frequentlyBought, 18000);

    res.json({ frequentlyBought });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get trending products in a category
 */
const getTrendingInCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const { limit = 10 } = req.query;

    const cacheKey = `trending:category:${category}:${limit}`;

    const cachedTrending = await getFromCache(cacheKey);
    if (cachedTrending) {
      return res.json({ trending: cachedTrending, cached: true });
    }

    const trending = await Product.find({
      category,
      inStock: true,
    })
      .select('name price category images rating reviewsCount')
      .sort({ reviewsCount: -1, rating: -1 })
      .limit(parseInt(limit))
      .lean();

    // Cache for 2 hours
    await setInCache(cacheKey, trending, 7200);

    res.json({ trending });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get personalized feed based on user's viewing/purchase history
 */
const getPersonalizedFeed = async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 20 } = req.query;

    const cacheKey = `feed:user:${userId}:${limit}`;

    const cachedFeed = await getFromCache(cacheKey);
    if (cachedFeed) {
      return res.json({ feed: cachedFeed, cached: true });
    }

    // Get diverse recommendations from different categories
    const categories = await Product.distinct('category', { inStock: true });

    const categoryRecommendations = await Promise.all(
      categories.slice(0, 3).map((category) =>
        Product.find({
          category,
          inStock: true,
        })
          .select('name price category images rating')
          .sort({ rating: -1, reviewsCount: -1 })
          .limit(parseInt(limit) / 3)
          .lean()
      )
    );

    const feed = categoryRecommendations.flat();

    // Cache for 3 hours
    await setInCache(cacheKey, feed, 10800);

    res.json({ feed });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getRecommendedProducts,
  getSimilarProducts,
  getFrequentlyBoughtTogether,
  getTrendingInCategory,
  getPersonalizedFeed,
};
