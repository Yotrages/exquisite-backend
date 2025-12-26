const Product = require('../Models/Product.js');
const { getFromCache, setInCache, deleteFromCache } = require('../config/redis.js');

/**
 * Get all products with optimized queries
 * Includes: filtering, pagination, sorting, caching
 */
const getOptimizedProducts = async (req, res) => {
  try {
    const { page = 1, limit = 12, category, minPrice, maxPrice, sort = '-createdAt', search } =
      req.query;

    // Build cache key
    const cacheKey = `products:${page}:${limit}:${category}:${minPrice}:${maxPrice}:${sort}:${search}`;

    // Try to get from cache
    const cachedProducts = await getFromCache(cacheKey);
    if (cachedProducts) {
      return res.json({ ...cachedProducts, cached: true });
    }

    // Build query
    let query = {};

    if (search) {
      query.$text = { $search: search };
    }

    if (category) {
      query.category = category;
    }

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseInt(minPrice);
      if (maxPrice) query.price.$lte = parseInt(maxPrice);
    }

    // Execute query with optimization
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [products, totalProducts] = await Promise.all([
      Product.find(query)
        .select('name price category images rating reviewsCount inStock') // Only select needed fields
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(), // Use lean() for read-only queries (faster)
      Product.countDocuments(query),
    ]);

    const totalPages = Math.ceil(totalProducts / parseInt(limit));

    const result = {
      products,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalProducts,
        totalPages,
      },
    };

    // Cache result for 1 hour
    await setInCache(cacheKey, result, 3600);

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get product by ID with caching
 */
const getOptimizedProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const cacheKey = `product:${id}`;

    // Try cache first
    const cachedProduct = await getFromCache(cacheKey);
    if (cachedProduct) {
      return res.json({ ...cachedProduct, cached: true });
    }

    const product = await Product.findById(id)
      .populate('reviews') // Populate reviews if they exist
      .lean();

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Cache for 2 hours
    await setInCache(cacheKey, product, 7200);

    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get category analytics with caching
 */
const getCategoryAnalytics = async (req, res) => {
  try {
    const cacheKey = 'analytics:categories';

    const cachedData = await getFromCache(cacheKey);
    if (cachedData) {
      return res.json({ ...cachedData, cached: true });
    }

    const analytics = await Product.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          avgPrice: { $avg: '$price' },
          minPrice: { $min: '$price' },
          maxPrice: { $max: '$price' },
          totalInStock: { $sum: { $cond: ['$inStock', 1, 0] } },
        },
      },
      { $sort: { count: -1 } },
    ]);

    // Cache for 4 hours (analytics don't change frequently)
    await setInCache(cacheKey, analytics, 14400);

    res.json(analytics);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Search products with full-text search (uses MongoDB text index)
 */
const searchProducts = async (req, res) => {
  try {
    const { query, limit = 20 } = req.query;

    if (!query || query.length < 2) {
      return res.status(400).json({ message: 'Search query must be at least 2 characters' });
    }

    const cacheKey = `search:${query}:${limit}`;

    const cachedResults = await getFromCache(cacheKey);
    if (cachedResults) {
      return res.json({ ...cachedResults, cached: true });
    }

    const results = await Product.find(
      { $text: { $search: query } },
      { score: { $meta: 'textScore' } }
    )
      .select('name price category images rating -_id')
      .sort({ score: { $meta: 'textScore' } })
      .limit(parseInt(limit))
      .lean();

    // Cache for 30 minutes
    await setInCache(cacheKey, { results }, 1800);

    res.json({ results });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get trending products (cached)
 */
const getTrendingProducts = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const cacheKey = `trending:products:${limit}`;

    const cachedTrending = await getFromCache(cacheKey);
    if (cachedTrending) {
      return res.json({ ...cachedTrending, cached: true });
    }

    const trendingProducts = await Product.find({ inStock: true })
      .select('name price category images rating reviewsCount')
      .sort({ reviewsCount: -1, rating: -1 })
      .limit(parseInt(limit))
      .lean();

    // Cache for 3 hours
    await setInCache(cacheKey, { trendingProducts }, 10800);

    res.json({ trendingProducts });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Invalidate all product caches
 */
const invalidateProductCache = async () => {
  try {
    await deleteFromCache('products:*');
    await deleteFromCache('product:*');
    await deleteFromCache('analytics:*');
    await deleteFromCache('search:*');
    await deleteFromCache('trending:*');
  } catch (error) {
    console.error('Cache invalidation error:', error);
  }
};

module.exports = {
  getOptimizedProducts,
  getOptimizedProductById,
  getCategoryAnalytics,
  searchProducts,
  getTrendingProducts,
  invalidateProductCache,
};
