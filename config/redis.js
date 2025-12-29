const redis = require('redis');

const client = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        console.error('Redis: Max retries reached. Stopping reconnection.');
        return new Error('Redis connection lost');
      }
      return Math.min(retries * 100, 3000); // Backoff: 100ms, 200ms... up to 3s
    }
  }
});

// 3. Mandatory: Explicitly call connect() in v4/v5
(async () => {
  client.on('error', (err) => console.error('Redis Client Error:', err));
  client.on('connect', () => console.log('Redis Client Connected'));
  
  try {
    await client.connect();
  } catch (err) {
    console.error('Initial Redis connection failed:', err);
  }
})();

// In-memory fallback cache for when Redis is unavailable
const memoryCache = new Map();

const getFromCache = async (key) => {
  try {
    // Try Redis first
    const redisValue = await client.get(key);
    if (redisValue) {
      return JSON.parse(redisValue);
    }
  } catch (err) {
    console.error('Redis get error:', err);
    // Fallback to memory cache
    return memoryCache.get(key);
  }
};

const setInCache = async (key, value, expirationSeconds = 3600) => {
  try {
    const stringValue = JSON.stringify(value);
    // Set in Redis
    await client.setEx(key, expirationSeconds, stringValue);
    // Also set in memory cache
    memoryCache.set(key, value);
    setTimeout(() => memoryCache.delete(key), expirationSeconds * 1000);
  } catch (err) {
    console.error('Redis set error:', err);
    // Fallback to memory cache
    memoryCache.set(key, value);
    setTimeout(() => memoryCache.delete(key), expirationSeconds * 1000);
  }
};

const deleteFromCache = async (key) => {
  try {
    await client.del(key);
    memoryCache.delete(key);
  } catch (err) {
    console.error('Redis delete error:', err);
    memoryCache.delete(key);
  }
};

const clearCache = async (pattern = '*') => {
  try {
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(keys);
    }
    memoryCache.clear();
  } catch (err) {
    console.error('Redis clear error:', err);
    memoryCache.clear();
  }
};

module.exports = {
  client,
  getFromCache,
  setInCache,
  deleteFromCache,
  clearCache
};
