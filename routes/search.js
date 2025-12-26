const express = require('express');
const {
  advancedSearch,
  getFilterOptions,
  getProductStats,
} = require('../controllers/searchController');
const { publicLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

/**
 * Public search routes (high volume, read-only)
 */
// GET /api/search - Advanced product search with filtering
// Query parameters: q (query), category, minPrice, maxPrice, rating, inStock, sort, page, limit
router.get('/', publicLimiter, advancedSearch);

// GET /api/search/filters - Get available filter options (categories, price range, etc.)
router.get('/filters', publicLimiter, getFilterOptions);

// GET /api/search/stats - Get product statistics (total count, price range, etc.)
router.get('/stats', publicLimiter, getProductStats);
/**
 * GET /api/search/suggestions
 * Get search suggestions based on input
 */
router.get('/search/suggestions', async (req, res) => {
  try {
    const { q } = req.query

    if (!q || q.length < 2) {
      return res.json([])
    }

    // Find products matching the query
    const suggestions = await Product.find({
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { category: { $regex: q, $options: 'i' } },
        { tags: { $regex: q, $options: 'i' } }
      ]
    })
      .limit(8)
      .select('name category image')
      .lean()

    // Format suggestions
    const formattedSuggestions = suggestions.map(product => ({
      text: product.name,
      category: product.category,
      image: product.image
    }))

    res.json(formattedSuggestions)
  } catch (error) {
    console.error('Error getting suggestions:', error)
    res.status(500).json({ message: 'Failed to get suggestions' })
  }
})

/**
 * GET /api/search/popular
 * Get popular/trending searches
 */
router.get('/search/popular', async (req, res) => {
  try {
    // In production, you'd track actual search queries
    // For now, return popular categories/products
    const popularSearches = [
      'Laptops',
      'Phones',
      'Fashion',
      'Electronics',
      'Home Appliances',
      'Books',
      'Sports Equipment',
      'Beauty Products'
    ]

    res.json(popularSearches)
  } catch (error) {
    console.error('Error getting popular searches:', error)
    res.status(500).json({ message: 'Failed to get popular searches' })
  }
})

module.exports = router;
