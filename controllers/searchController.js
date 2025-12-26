const Product = require('../Models/Product.js');
const { getFromCache, setInCache } = require('../config/redis.js');

/**
 * Advanced search with multiple filters
 * Supports: text search, price range, categories, rating, in-stock status, sorting
 */
const advancedSearch = async (req, res) => {
  try {
    const {
      query = '',
      categories = [],
      minPrice = 0,
      maxPrice = Infinity,
      minRating = 0,
      maxRating = 5,
      inStockOnly = false,
      sortBy = 'relevance',
      page = 1,
      limit = 12,
    } = req.query;

    // Build cache key
    const cacheKey = `search:advanced:${query}:${categories}:${minPrice}:${maxPrice}:${minRating}:${sortBy}:${page}:${limit}`;

    const cachedResults = await getFromCache(cacheKey);
    if (cachedResults) {
      return res.json({ ...cachedResults, cached: true });
    }

    // Build filter object
    let filter = {};

    // Text search
    if (query && query.length > 1) {
      filter.$text = { $search: query };
    }

    // Category filter
    if (categories && categories.length > 0) {
      const categoryArray = Array.isArray(categories) ? categories : [categories];
      filter.category = { $in: categoryArray };
    }

    // Price range filter
    if (minPrice || maxPrice !== Infinity) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseInt(minPrice);
      if (maxPrice !== Infinity) filter.price.$lte = parseInt(maxPrice);
    }

    // Rating filter
    if (minRating > 0 || maxRating < 5) {
      filter.rating = { $gte: parseFloat(minRating), $lte: parseFloat(maxRating) };
    }

    // Stock filter
    if (inStockOnly === 'true') {
      filter.inStock = true;
    }

    // Build sort object
    let sortObj = {};
    switch (sortBy) {
      case 'price-asc':
        sortObj = { price: 1 };
        break;
      case 'price-desc':
        sortObj = { price: -1 };
        break;
      case 'rating':
        sortObj = { rating: -1 };
        break;
      case 'newest':
        sortObj = { createdAt: -1 };
        break;
      case 'popularity':
        sortObj = { reviewsCount: -1 };
        break;
      case 'relevance':
      default:
        sortObj = query ? { score: { $meta: 'textScore' } } : { createdAt: -1 };
    }

    // Execute query
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [products, totalProducts] = await Promise.all([
      Product.find(
        filter,
        query ? { score: { $meta: 'textScore' } } : {}
      )
        .select('name price category images rating reviewsCount inStock')
        .sort(sortObj)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Product.countDocuments(filter),
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
      filters: {
        query,
        categories,
        priceRange: { min: parseInt(minPrice), max: parseInt(maxPrice) },
        ratingRange: { min: parseFloat(minRating), max: parseFloat(maxRating) },
        inStockOnly,
        sortBy,
      },
    };

    // Cache for 30 minutes
    await setInCache(cacheKey, result, 1800);

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get filter options (categories, price range, ratings)
 */
const getFilterOptions = async (req, res) => {
  try {
    const cacheKey = 'filter:options';

    const cachedOptions = await getFromCache(cacheKey);
    if (cachedOptions) {
      return res.json({ ...cachedOptions, cached: true });
    }

    const [categories, priceStats, ratingStats] = await Promise.all([
      // Get all categories
      Product.distinct('category'),
      // Get price range
      Product.aggregate([
        {
          $group: {
            _id: null,
            minPrice: { $min: '$price' },
            maxPrice: { $max: '$price' },
          },
        },
      ]),
      // Get rating distribution
      Product.aggregate([
        {
          $group: {
            _id: '$rating',
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const filterOptions = {
      categories: categories.sort(),
      priceRange: priceStats[0] || { minPrice: 0, maxPrice: 0 },
      ratingOptions: [
        { value: 4, label: '4 Stars & Up' },
        { value: 3, label: '3 Stars & Up' },
        { value: 2, label: '2 Stars & Up' },
        { value: 1, label: '1 Star & Up' },
      ],
      sortOptions: [
        { value: 'relevance', label: 'Relevance' },
        { value: 'newest', label: 'Newest' },
        { value: 'price-asc', label: 'Price: Low to High' },
        { value: 'price-desc', label: 'Price: High to Low' },
        { value: 'rating', label: 'Highest Rated' },
        { value: 'popularity', label: 'Most Popular' },
      ],
      ratingDistribution: ratingStats,
    };

    // Cache for 24 hours (static data)
    await setInCache(cacheKey, filterOptions, 86400);

    res.json(filterOptions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get product stats for filter display
 */
const getProductStats = async (req, res) => {
  try {
    const cacheKey = 'stats:products';

    const cachedStats = await getFromCache(cacheKey);
    if (cachedStats) {
      return res.json({ ...cachedStats, cached: true });
    }

    const stats = await Product.aggregate([
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          inStockCount: { $sum: { $cond: ['$inStock', 1, 0] } },
          outOfStockCount: { $sum: { $cond: ['$inStock', 0, 1] } },
          avgPrice: { $avg: '$price' },
          minPrice: { $min: '$price' },
          maxPrice: { $max: '$price' },
          avgRating: { $avg: '$rating' },
        },
      },
    ]);

    // Cache for 6 hours
    await setInCache(cacheKey, stats[0], 21600);

    res.json(stats[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  advancedSearch,
  getFilterOptions,
  getProductStats,
};
