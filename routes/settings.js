const express = require('express');
const {
  getUserSettings,
  updateProfile,
  updateShippingAddress,
  deleteShippingAddress,
  changePassword,
  getSecuritySettings,
  deleteAccount,
  getPrivacySettings,
  updatePrivacySettings,
} = require('../controllers/settingsController');
const { protect } = require('../middleware/authMiddleware');
const { moderateLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

// All settings routes require authentication
router.use(protect);

/**
 * Profile settings
 */
// GET /api/settings - Get user settings
router.get('/', getUserSettings);

// PUT /api/settings/profile - Update profile (rate-limited)
router.put('/profile', moderateLimiter, updateProfile);

/**
 * Shipping addresses
 */
// POST /api/settings/addresses - Add shipping address (rate-limited)
router.post('/addresses', moderateLimiter, updateShippingAddress);

// DELETE /api/settings/addresses/:addressId - Delete shipping address
router.delete('/addresses/:addressId', deleteShippingAddress);

/**
 * Security & Password
 */
// GET /api/settings/security - Get security settings
router.get('/security', getSecuritySettings);

// PUT /api/settings/password - Change password (rate-limited)
router.put('/password', moderateLimiter, changePassword);

// DELETE /api/settings/account - Delete account (rate-limited, extra protection)
router.delete('/account', moderateLimiter, deleteAccount);

/**
 * Privacy settings
 */
// GET /api/settings/privacy - Get privacy settings
router.get('/privacy', getPrivacySettings);

// PUT /api/settings/privacy - Update privacy settings (rate-limited)
router.put('/privacy', moderateLimiter, updatePrivacySettings);

module.exports = router;
