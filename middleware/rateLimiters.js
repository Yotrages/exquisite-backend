const rateLimit = require('express-rate-limit');

// Trustworthy proxy configuration - configure based on deployment
// For local: trust loopback (127.0.0.1)
// For production: trust your load balancer/reverse proxy
const getTrustProxyConfig = () => {
  if (process.env.NODE_ENV === 'production') {
    // For production with reverse proxy (Vercel, Railway, AWS, etc.)
    return process.env.TRUST_PROXY || 'uniqueIp'; // or specific IP like '203.0.113.195'
  }
  return 'loopback'; // Local development - trust loopback addresses
};

/**
 * GLOBAL - General API rate limiter
 * Applied to all routes for baseline protection
 * 200 requests per 15 minutes per IP
 */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // baseline limit
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in RateLimit-* headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  trustProxy: getTrustProxyConfig(),
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/';
  },
  keyGenerator: (req) => {
    // Use X-Forwarded-For or X-Real-IP headers if behind proxy
    return req.ip || req.connection.remoteAddress;
  },
});

/**
 * STRICT - Authentication endpoints
 * 10 attempts per 10 minutes per IP (login, register, password reset)
 */
const strictLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 15 minutes
  max: 10,
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  trustProxy: getTrustProxyConfig(),
  keyGenerator: (req) => req.ip || req.connection.remoteAddress,
  // Store in memory for now; in production, use Redis store
  // Can upgrade to redis-store for distributed rate limiting
});

/**
 * MODERATE - Write operations (POST, PUT)
 * 100 requests per 10 minutes per IP
 * For creating/updating resources
 */
const moderateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many write requests, please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
  trustProxy: getTrustProxyConfig(),
  keyGenerator: (req) => req.ip || req.connection.remoteAddress,
});

/**
 * PERMISSIVE - Read operations (GET)
 * 500 requests per 15 minutes per IP
 * Safe to allow more as these don't modify data
 */
const permissiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  message: 'Too many read requests, please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
  trustProxy: getTrustProxyConfig(),
  keyGenerator: (req) => req.ip || req.connection.remoteAddress,
});

/**
 * SENSITIVE - Destructive operations (DELETE)
 * 20 requests per 15 minutes per IP
 * Most restrictive for delete operations
 */
const sensitiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: 'Too many delete requests, please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
  trustProxy: getTrustProxyConfig(),
  keyGenerator: (req) => req.ip || req.connection.remoteAddress,
});

/**
 * ADMIN - Admin-only operations
 * 150 requests per 15 minutes per IP
 * Moderate limit for admin features
 */
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 150,
  message: 'Too many admin requests, please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
  trustProxy: getTrustProxyConfig(),
  keyGenerator: (req) => req.ip || req.connection.remoteAddress,
});

/**
 * PAYMENT - Payment processing
 * 10 requests per 15 minutes per IP
 * Most restrictive as these involve money
 */
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: 'Too many payment attempts, please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
  trustProxy: getTrustProxyConfig(),
  keyGenerator: (req) => req.ip || req.connection.remoteAddress,
});

/**
 * PUBLIC - Public endpoints (search, browse)
 * 1000 requests per 15 minutes per IP
 * Very permissive for public content
 */
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  message: 'Too many requests, please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
  trustProxy: getTrustProxyConfig(),
  keyGenerator: (req) => req.ip || req.connection.remoteAddress,
});

/**
 * CHATBOT - Chat / AI endpoints
 * 30 requests per 15 minutes per IP
 * Protective limit to prevent abuse and runaway API costs
 */
const chatbotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  message: 'Too many chat requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  trustProxy: getTrustProxyConfig(),
  keyGenerator: (req) => req.ip || req.connection.remoteAddress,
});

module.exports = {
  globalLimiter,
  strictLimiter,
  moderateLimiter,
  permissiveLimiter,
  sensitiveLimiter,
  adminLimiter,
  paymentLimiter,
  publicLimiter,
  chatbotLimiter,
  getTrustProxyConfig,
};
