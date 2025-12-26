const { getFromCache, setInCache, deleteFromCache } = require('../config/redis');

/**
 * Cache middleware for GET requests
 * Usage: app.get('/route', cacheMiddleware(expirationSeconds), handler)
 */
const cacheMiddleware = (expirationSeconds = 3600) => {
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Skip cache if bypass parameter is set
    if (req.query.noCache === 'true') {
      return next();
    }

    const cacheKey = `${req.method}:${req.originalUrl}`;

    try {
      const cachedData = await getFromCache(cacheKey);
      if (cachedData) {
        res.set('X-Cache', 'HIT');
        return res.json(cachedData);
      }
    } catch (err) {
      console.error('Cache retrieval error:', err);
      // Continue without cache
    }

    // Store the original send method
    const originalSend = res.json;

    // Override the json method to cache responses
    res.json = function (data) {
      // Cache successful responses (2xx status codes)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        setInCache(cacheKey, data, expirationSeconds).catch((err) =>
          console.error('Cache set error:', err)
        );
        res.set('X-Cache', 'MISS');
      }

      return originalSend.call(this, data);
    };

    next();
  };
};

/**
 * Invalidate cache by pattern
 * Useful for clearing cache after mutations
 */
const invalidateCache = async (pattern = '*') => {
  try {
    // Cache keys use format: METHOD:URL
    const patterns = [
      `GET:*${pattern}*`,
      `GET:*/products*`,
      `GET:*/orders*`,
      `GET:*/admin*`,
    ];

    for (const pat of patterns) {
      await deleteFromCache(pat);
    }
  } catch (err) {
    console.error('Cache invalidation error:', err);
  }
};

/**
 * Cache invalidator middleware for POST/PUT/DELETE
 */
const cacheInvalidatorMiddleware = (pattern) => {
  return async (req, res, next) => {
    // Store original send
    const originalSend = res.json;

    res.json = function (data) {
      // Invalidate cache after successful mutations
      if (res.statusCode >= 200 && res.statusCode < 300) {
        invalidateCache(pattern).catch((err) =>
          console.error('Cache invalidation error:', err)
        );
      }

      return originalSend.call(this, data);
    };

    next();
  };
};

module.exports = {
  cacheMiddleware,
  invalidateCache,
  cacheInvalidatorMiddleware
};
