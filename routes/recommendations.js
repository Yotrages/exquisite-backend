const express = require('express');
const {
  getRecommendedProducts,
  getSimilarProducts,
  getFrequentlyBoughtTogether,
  getTrendingInCategory,
  getPersonalizedFeed,
} = require('../controllers/recommendationController');
const { protect } = require('../middleware/authMiddleware');
const { publicLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

/**
 * Public routes (read-only, high volume)
 */
// GET /api/recommendations/similar/:productId - Get products similar to given product
router.get('/similar/:productId', publicLimiter, getSimilarProducts);

// GET /api/recommendations/frequently-bought/:productId - Get products frequently bought together
router.get('/frequently-bought/:productId', publicLimiter, getFrequentlyBoughtTogether);

// GET /api/recommendations/trending-in/:category - Get trending in category
router.get('/trending-in/:category', publicLimiter, getTrendingInCategory);

/**
 * Protected routes (authenticated users)
 */
// GET /api/recommendations/for-you - Get personalized recommendations for authenticated user
router.get('/for-you', protect, publicLimiter, getRecommendedProducts);

// GET /api/recommendations/feed - Get personalized feed (products + recommendations)
router.get('/feed', protect, publicLimiter, getPersonalizedFeed);

module.exports = router;
