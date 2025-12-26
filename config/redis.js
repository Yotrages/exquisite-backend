const redis = require('redis');

// Create Redis client
const client = redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  retryStrategy: (options) => {
    if (options.error && options.error.code === 'ECONNREFUSED') {
      console.error('Redis connection refused. Using in-memory cache fallback.');
      return new Error('Redis connection refused');
    }
    if (options.total_retry_time > 1000 * 60 * 60) {
      return new Error('Retry time exhausted');
    }
    if (options.attempt > 10) {
      return undefined;
    }
    return Math.min(options.attempt * 100, 3000);
  },
});

client.on('error', (err) => {
  console.error('Redis Client Error', err);
});

client.on('connect', () => {
  console.log('Redis Client Connected');
});

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
