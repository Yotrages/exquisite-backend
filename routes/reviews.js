const express = require('express');
const {
  addReview,
  getProductReviews,
  updateReview,
  deleteReview,
  markHelpful,
  markUnhelpful,
  getUserReviews,
  getMyReviews,
  moderateReview,
} = require('../controllers/reviewController');
const { protect, admin } = require('../middleware/authMiddleware');
const { moderateLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

// Public
router.get('/product/:productId', getProductReviews);

// Protected (authenticated users)
router.get('/mine', protect, getMyReviews);                          // current user's reviews
router.post('/', protect, moderateLimiter, addReview);
router.put('/:reviewId', protect, moderateLimiter, updateReview);
router.delete('/:reviewId', protect, deleteReview);
router.post('/:reviewId/helpful', protect, markHelpful);
router.post('/:reviewId/unhelpful', protect, markUnhelpful);

// Admin
router.get('/all', protect, admin, getUserReviews);
router.put('/moderate/:reviewId', protect, admin, moderateReview);

module.exports = router;
