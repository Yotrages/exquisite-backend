const express = require('express');
const {
  addReview,
  getProductReviews,
  updateReview,
  deleteReview,
  markHelpful,
  markUnhelpful,
  getUserReviews,
  moderateReview,
} = require('../controllers/reviewController');
const { protect, admin } = require('../middleware/authMiddleware');
const { moderateLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

/**
 * Public routes (read-only)
 */
// GET /api/reviews/product/:productId - Get all reviews for a product
router.get('/product/:productId', getProductReviews);

/**
 * Protected routes (authenticated users)
 */
// POST /api/reviews - Add new review (rate-limited)
router.post('/', protect, moderateLimiter, addReview);

// PUT /api/reviews/:id - Update review (only review author or admin)
router.put('/:id', protect, moderateLimiter, updateReview);

// DELETE /api/reviews/:id - Delete review (only review author or admin)
router.delete('/:id', protect, deleteReview);

// POST /api/reviews/:id/helpful - Mark review as helpful
router.post('/:id/helpful', protect, markHelpful);

// POST /api/reviews/:id/unhelpful - Mark review as unhelpful
router.post('/:id/unhelpful', protect, markUnhelpful);

// GET /api/reviews/user/:userId - Get user's reviews
router.get('/user/:userId', getUserReviews);

/**
 * Admin routes (moderation)
 */
// PUT /api/reviews/moderate/:id - Moderate review (admin only)
router.put('/moderate/:id', protect, admin, moderateReview);

module.exports = router;
