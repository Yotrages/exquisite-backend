const express = require('express');
const { registerUser, loginUser, changePassword } = require('../controllers/userController');
const router = express.Router();
const passport = require('passport');
const handleOAuthCallback = require('../controllers/authController');


router.post('/register', registerUser);
router.post('/login', loginUser);
router.put('/forgot', changePassword)

// Google OAuth
router.get('/auth/google', (req, res, next) => {
  const state = req.query.state;
  passport.authenticate('google', { 
    scope: ['profile', 'email'],
    state: state 
  })(req, res, next);
});

router.get('/auth/google/callback', passport.authenticate('google', { session: false }), handleOAuthCallback);

// GitHub OAuth  
router.get('/auth/github', (req, res, next) => {
  const state = req.query.state;
  passport.authenticate('github', { 
    scope: ['user:email'],
    state: state 
  })(req, res, next);
});

router.get('/auth/github/callback', passport.authenticate('github', { session: false }), handleOAuthCallback);


module.exports = router;
