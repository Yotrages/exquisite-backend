const express = require('express');
const {
  addToWishlist,
  removeFromWishlist,
  getWishlist,
  isInWishlist,
  clearWishlist,
  moveToCart,
  getPriceDrops,
  updateNotificationSettings,
  togglePublicWishlist,
} = require('../controllers/wishlistController');
const { protect } = require('../middleware/authMiddleware');
const { moderateLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

/**
 * Protected routes (authenticated users)
 */
// GET /api/wishlist - Get user's wishlists
router.get('/', protect, getWishlist);

// POST /api/wishlist/product/:productId - Add product to wishlist (rate-limited)
router.post('/product/:productId', protect, moderateLimiter, addToWishlist);

// DELETE /api/wishlist/product/:productId - Remove product from wishlist
router.delete('/product/:productId', protect, removeFromWishlist);

// GET /api/wishlist/is/:productId - Check if product in wishlist
router.get('/is/:productId', protect, isInWishlist);

// DELETE /api/wishlist/clear - Clear entire wishlist
router.delete('/clear', protect, clearWishlist);

// POST /api/wishlist/move-to-cart/:productId - Move product to cart
router.post('/move-to-cart/:productId', protect, moveToCart);

// GET /api/wishlist/price-drops - Get price drop notifications
router.get('/price-drops', protect, getPriceDrops);

// PUT /api/wishlist/notifications - Update notification settings
router.put('/notifications', protect, updateNotificationSettings);

// PUT /api/wishlist/toggle-public - Toggle wishlist public/private
router.put('/toggle-public', protect, togglePublicWishlist);

module.exports = router;
