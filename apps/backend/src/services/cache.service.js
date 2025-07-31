const redisConfig = require("../config/redis");
const logger = require("../utils/logger");

class CacheService {
  constructor() {
    this.client = null;
    this.defaultTTL = 3600; // 1 hour
    this.maxRetries = 3;
    this.retryDelay = 1000;
  }

  /**
   * Initialize cache service
   */
  async initialize() {
    try {
      this.client = redisConfig.getClient();

      if (!this.client) {
        throw new Error("Redis client not available");
      }

      logger.info("Cache service initialized");
    } catch (error) {
      logger.error("Failed to initialize cache service:", error);
      throw error;
    }
  }

  /**
   * Get value from cache
   * @param {String} key - Cache key
   * @returns {String|null} Cached value or null
   */
  async get(key) {
    try {
      if (!this.client || !this.client.isOpen) {
        logger.warn("Cache client not available for GET operation");
        return null;
      }

      const value = await this.client.get(key);

      if (value) {
        logger.debug(`Cache HIT for key: ${key}`);
      } else {
        logger.debug(`Cache MISS for key: ${key}`);
      }

      return value;
    } catch (error) {
      logger.error(`Cache GET failed for key ${key}:`, error);
      return null; // Fail gracefully
    }
  }

  /**
   * Set value in cache
   * @param {String} key - Cache key
   * @param {String} value - Value to cache
   * @param {Number} ttl - Time to live in seconds
   * @returns {Boolean} Success status
   */
  async set(key, value, ttl = this.defaultTTL) {
    try {
      if (!this.client || !this.client.isOpen) {
        logger.warn("Cache client not available for SET operation");
        return false;
      }

      await this.client.setEx(key, ttl, value);
      logger.debug(`Cache SET for key: ${key} (TTL: ${ttl}s)`);

      return true;
    } catch (error) {
      logger.error(`Cache SET failed for key ${key}:`, error);
      return false; // Fail gracefully
    }
  }

  /**
   * Delete value from cache
   * @param {String} key - Cache key
   * @returns {Boolean} Success status
   */
  async delete(key) {
    try {
      if (!this.client || !this.client.isOpen) {
        logger.warn("Cache client not available for DELETE operation");
        return false;
      }

      const result = await this.client.del(key);
      logger.debug(`Cache DELETE for key: ${key} (result: ${result})`);

      return result > 0;
    } catch (error) {
      logger.error(`Cache DELETE failed for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Check if key exists in cache
   * @param {String} key - Cache key
   * @returns {Boolean} True if key exists
   */
  async exists(key) {
    try {
      if (!this.client || !this.client.isOpen) {
        return false;
      }

      const exists = await this.client.exists(key);
      return exists === 1;
    } catch (error) {
      logger.error(`Cache EXISTS failed for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Set expiration time for a key
   * @param {String} key - Cache key
   * @param {Number} ttl - Time to live in seconds
   * @returns {Boolean} Success status
   */
  async expire(key, ttl) {
    try {
      if (!this.client || !this.client.isOpen) {
        return false;
      }

      const result = await this.client.expire(key, ttl);
      logger.debug(`Cache EXPIRE for key: ${key} (TTL: ${ttl}s)`);

      return result === 1;
    } catch (error) {
      logger.error(`Cache EXPIRE failed for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get time to live for a key
   * @param {String} key - Cache key
   * @returns {Number} TTL in seconds (-1 if no expiry, -2 if key doesn't exist)
   */
  async ttl(key) {
    try {
      if (!this.client || !this.client.isOpen) {
        return -2;
      }

      return await this.client.ttl(key);
    } catch (error) {
      logger.error(`Cache TTL failed for key ${key}:`, error);
      return -2;
    }
  }

  /**
   * Increment numeric value
   * @param {String} key - Cache key
   * @param {Number} increment - Amount to increment (default: 1)
   * @returns {Number} New value after increment
   */
  async increment(key, increment = 1) {
    try {
      if (!this.client || !this.client.isOpen) {
        return 0;
      }

      const result = await this.client.incrBy(key, increment);
      logger.debug(
        `Cache INCR for key: ${key} by ${increment} (result: ${result})`
      );

      return result;
    } catch (error) {
      logger.error(`Cache INCR failed for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Decrement numeric value
   * @param {String} key - Cache key
   * @param {Number} decrement - Amount to decrement (default: 1)
   * @returns {Number} New value after decrement
   */
  async decrement(key, decrement = 1) {
    try {
      if (!this.client || !this.client.isOpen) {
        return 0;
      }

      const result = await this.client.decrBy(key, decrement);
      logger.debug(
        `Cache DECR for key: ${key} by ${decrement} (result: ${result})`
      );

      return result;
    } catch (error) {
      logger.error(`Cache DECR failed for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Get multiple keys at once
   * @param {Array} keys - Array of cache keys
   * @returns {Array} Array of values (null for missing keys)
   */
  async mget(keys) {
    try {
      if (!this.client || !this.client.isOpen) {
        return new Array(keys.length).fill(null);
      }

      const values = await this.client.mGet(keys);
      logger.debug(`Cache MGET for ${keys.length} keys`);

      return values;
    } catch (error) {
      logger.error(`Cache MGET failed for keys ${keys.join(", ")}:`, error);
      return new Array(keys.length).fill(null);
    }
  }

  /**
   * Set multiple key-value pairs
   * @param {Object} keyValues - Object with key-value pairs
   * @param {Number} ttl - Time to live in seconds
   * @returns {Boolean} Success status
   */
  async mset(keyValues, ttl = this.defaultTTL) {
    try {
      if (!this.client || !this.client.isOpen) {
        return false;
      }

      const pipeline = this.client.multi();

      for (const [key, value] of Object.entries(keyValues)) {
        pipeline.setEx(key, ttl, value);
      }

      await pipeline.exec();
      logger.debug(`Cache MSET for ${Object.keys(keyValues).length} keys`);

      return true;
    } catch (error) {
      logger.error(`Cache MSET failed:`, error);
      return false;
    }
  }

  /**
   * Delete multiple keys
   * @param {Array} keys - Array of cache keys
   * @returns {Number} Number of keys deleted
   */
  async mdel(keys) {
    try {
      if (!this.client || !this.client.isOpen) {
        return 0;
      }

      const result = await this.client.del(keys);
      logger.debug(`Cache MDEL for ${keys.length} keys (deleted: ${result})`);

      return result;
    } catch (error) {
      logger.error(`Cache MDEL failed for keys ${keys.join(", ")}:`, error);
      return 0;
    }
  }

  /**
   * Search for keys by pattern
   * @param {String} pattern - Search pattern (e.g., 'user:*')
   * @returns {Array} Array of matching keys
   */
  async keys(pattern) {
    try {
      if (!this.client || !this.client.isOpen) {
        return [];
      }

      const keys = await this.client.keys(pattern);
      logger.debug(
        `Cache KEYS for pattern: ${pattern} (found: ${keys.length})`
      );

      return keys;
    } catch (error) {
      logger.error(`Cache KEYS failed for pattern ${pattern}:`, error);
      return [];
    }
  }

  /**
   * Delete all keys matching pattern
   * @param {String} pattern - Search pattern
   * @returns {Number} Number of keys deleted
   */
  async deletePattern(pattern) {
    try {
      const keys = await this.keys(pattern);

      if (keys.length === 0) {
        return 0;
      }

      return await this.mdel(keys);
    } catch (error) {
      logger.error(
        `Cache DELETE PATTERN failed for pattern ${pattern}:`,
        error
      );
      return 0;
    }
  }

  /**
   * Hash operations - set field in hash
   * @param {String} key - Hash key
   * @param {String} field - Field name
   * @param {String} value - Field value
   * @returns {Boolean} Success status
   */
  async hset(key, field, value) {
    try {
      if (!this.client || !this.client.isOpen) {
        return false;
      }

      await this.client.hSet(key, field, value);
      logger.debug(`Cache HSET for key: ${key}, field: ${field}`);

      return true;
    } catch (error) {
      logger.error(`Cache HSET failed for key ${key}, field ${field}:`, error);
      return false;
    }
  }

  /**
   * Hash operations - get field from hash
   * @param {String} key - Hash key
   * @param {String} field - Field name
   * @returns {String|null} Field value or null
   */
  async hget(key, field) {
    try {
      if (!this.client || !this.client.isOpen) {
        return null;
      }

      const value = await this.client.hGet(key, field);
      logger.debug(
        `Cache HGET for key: ${key}, field: ${field} (found: ${!!value})`
      );

      return value;
    } catch (error) {
      logger.error(`Cache HGET failed for key ${key}, field ${field}:`, error);
      return null;
    }
  }

  /**
   * Hash operations - get all fields from hash
   * @param {String} key - Hash key
   * @returns {Object} Hash object
   */
  async hgetall(key) {
    try {
      if (!this.client || !this.client.isOpen) {
        return {};
      }

      const hash = await this.client.hGetAll(key);
      logger.debug(
        `Cache HGETALL for key: ${key} (fields: ${Object.keys(hash).length})`
      );

      return hash;
    } catch (error) {
      logger.error(`Cache HGETALL failed for key ${key}:`, error);
      return {};
    }
  }

  /**
   * Hash operations - delete field from hash
   * @param {String} key - Hash key
   * @param {String} field - Field name
   * @returns {Boolean} Success status
   */
  async hdel(key, field) {
    try {
      if (!this.client || !this.client.isOpen) {
        return false;
      }

      const result = await this.client.hDel(key, field);
      logger.debug(
        `Cache HDEL for key: ${key}, field: ${field} (result: ${result})`
      );

      return result === 1;
    } catch (error) {
      logger.error(`Cache HDEL failed for key ${key}, field ${field}:`, error);
      return false;
    }
  }

  /**
   * List operations - push to list
   * @param {String} key - List key
   * @param {String} value - Value to push
   * @param {String} direction - 'left' or 'right' (default: 'right')
   * @returns {Number} New list length
   */
  async lpush(key, value, direction = "right") {
    try {
      if (!this.client || !this.client.isOpen) {
        return 0;
      }

      const result =
        direction === "left"
          ? await this.client.lPush(key, value)
          : await this.client.rPush(key, value);

      logger.debug(
        `Cache ${direction.toUpperCase()}PUSH for key: ${key} (length: ${result})`
      );

      return result;
    } catch (error) {
      logger.error(
        `Cache ${direction.toUpperCase()}PUSH failed for key ${key}:`,
        error
      );
      return 0;
    }
  }

  /**
   * List operations - pop from list
   * @param {String} key - List key
   * @param {String} direction - 'left' or 'right' (default: 'right')
   * @returns {String|null} Popped value or null
   */
  async lpop(key, direction = "right") {
    try {
      if (!this.client || !this.client.isOpen) {
        return null;
      }

      const result =
        direction === "left"
          ? await this.client.lPop(key)
          : await this.client.rPop(key);

      logger.debug(
        `Cache ${direction.toUpperCase()}POP for key: ${key} (found: ${!!result})`
      );

      return result;
    } catch (error) {
      logger.error(
        `Cache ${direction.toUpperCase()}POP failed for key ${key}:`,
        error
      );
      return null;
    }
  }

  /**
   * List operations - get list range
   * @param {String} key - List key
   * @param {Number} start - Start index
   * @param {Number} stop - Stop index
   * @returns {Array} Array of values
   */
  async lrange(key, start = 0, stop = -1) {
    try {
      if (!this.client || !this.client.isOpen) {
        return [];
      }

      const result = await this.client.lRange(key, start, stop);
      logger.debug(
        `Cache LRANGE for key: ${key} (${start}:${stop}) (found: ${result.length})`
      );

      return result;
    } catch (error) {
      logger.error(`Cache LRANGE failed for key ${key}:`, error);
      return [];
    }
  }

  /**
   * Set operations - add to set
   * @param {String} key - Set key
   * @param {String} value - Value to add
   * @returns {Boolean} True if added, false if already exists
   */
  async sadd(key, value) {
    try {
      if (!this.client || !this.client.isOpen) {
        return false;
      }

      const result = await this.client.sAdd(key, value);
      logger.debug(`Cache SADD for key: ${key} (added: ${result === 1})`);

      return result === 1;
    } catch (error) {
      logger.error(`Cache SADD failed for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Set operations - remove from set
   * @param {String} key - Set key
   * @param {String} value - Value to remove
   * @returns {Boolean} True if removed, false if didn't exist
   */
  async srem(key, value) {
    try {
      if (!this.client || !this.client.isOpen) {
        return false;
      }

      const result = await this.client.sRem(key, value);
      logger.debug(`Cache SREM for key: ${key} (removed: ${result === 1})`);

      return result === 1;
    } catch (error) {
      logger.error(`Cache SREM failed for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Set operations - get all members
   * @param {String} key - Set key
   * @returns {Array} Array of set members
   */
  async smembers(key) {
    try {
      if (!this.client || !this.client.isOpen) {
        return [];
      }

      const result = await this.client.sMembers(key);
      logger.debug(`Cache SMEMBERS for key: ${key} (found: ${result.length})`);

      return result;
    } catch (error) {
      logger.error(`Cache SMEMBERS failed for key ${key}:`, error);
      return [];
    }
  }

  /**
   * Cache session data
   * @param {String} sessionId - Session ID
   * @param {Object} data - Session data
   * @param {Number} ttl - Time to live in seconds
   * @returns {Boolean} Success status
   */
  async setSession(sessionId, data, ttl = 86400) {
    const key = `session:${sessionId}`;
    return await this.set(key, JSON.stringify(data), ttl);
  }

  /**
   * Get session data
   * @param {String} sessionId - Session ID
   * @returns {Object|null} Session data or null
   */
  async getSession(sessionId) {
    const key = `session:${sessionId}`;
    const data = await this.get(key);

    if (data) {
      try {
        return JSON.parse(data);
      } catch (error) {
        logger.error(`Failed to parse session data for ${sessionId}:`, error);
        return null;
      }
    }

    return null;
  }

  /**
   * Delete session
   * @param {String} sessionId - Session ID
   * @returns {Boolean} Success status
   */
  async deleteSession(sessionId) {
    const key = `session:${sessionId}`;
    return await this.delete(key);
  }

  /**
   * Cache user data
   * @param {String} userId - User ID
   * @param {Object} data - User data
   * @param {Number} ttl - Time to live in seconds
   * @returns {Boolean} Success status
   */
  async setUser(userId, data, ttl = 3600) {
    const key = `user:${userId}`;
    return await this.set(key, JSON.stringify(data), ttl);
  }

  /**
   * Get user data
   * @param {String} userId - User ID
   * @returns {Object|null} User data or null
   */
  async getUser(userId) {
    const key = `user:${userId}`;
    const data = await this.get(key);

    if (data) {
      try {
        return JSON.parse(data);
      } catch (error) {
        logger.error(`Failed to parse user data for ${userId}:`, error);
        return null;
      }
    }

    return null;
  }

  /**
   * Cache rate limit data
   * @param {String} identifier - Rate limit identifier
   * @param {Number} count - Current count
   * @param {Number} ttl - Time to live in seconds
   * @returns {Boolean} Success status
   */
  async setRateLimit(identifier, count, ttl = 900) {
    const key = `rate_limit:${identifier}`;
    return await this.set(key, count.toString(), ttl);
  }

  /**
   * Get rate limit data
   * @param {String} identifier - Rate limit identifier
   * @returns {Number} Current count or 0
   */
  async getRateLimit(identifier) {
    const key = `rate_limit:${identifier}`;
    const data = await this.get(key);

    return data ? parseInt(data, 10) : 0;
  }

  /**
   * Increment rate limit counter
   * @param {String} identifier - Rate limit identifier
   * @param {Number} ttl - Time to live in seconds
   * @returns {Number} New count
   */
  async incrementRateLimit(identifier, ttl = 900) {
    const key = `rate_limit:${identifier}`;
    const count = await this.increment(key);

    // Set expiration on first increment
    if (count === 1) {
      await this.expire(key, ttl);
    }

    return count;
  }

  /**
   * Clear all cache
   * @returns {Boolean} Success status
   */
  async flush() {
    try {
      if (!this.client || !this.client.isOpen) {
        return false;
      }

      await this.client.flushAll();
      logger.info("Cache flushed");

      return true;
    } catch (error) {
      logger.error("Cache flush failed:", error);
      return false;
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  async getStats() {
    try {
      if (!this.client || !this.client.isOpen) {
        return {
          connected: false,
          keys: 0,
          memory: 0,
          hits: 0,
          misses: 0,
        };
      }

      const info = await this.client.info();
      const dbSize = await this.client.dbSize();

      // Parse info string for statistics
      const stats = {
        connected: true,
        keys: dbSize,
        memory: 0,
        hits: 0,
        misses: 0,
      };

      // Extract memory and hit/miss stats from info
      const lines = info.split("\r\n");
      for (const line of lines) {
        if (line.startsWith("used_memory:")) {
          stats.memory = parseInt(line.split(":")[1], 10);
        } else if (line.startsWith("keyspace_hits:")) {
          stats.hits = parseInt(line.split(":")[1], 10);
        } else if (line.startsWith("keyspace_misses:")) {
          stats.misses = parseInt(line.split(":")[1], 10);
        }
      }

      return stats;
    } catch (error) {
      logger.error("Failed to get cache stats:", error);
      return {
        connected: false,
        keys: 0,
        memory: 0,
        hits: 0,
        misses: 0,
      };
    }
  }

  /**
   * Health check for cache service
   * @returns {Object} Health status
   */
  async healthCheck() {
    try {
      if (!this.client || !this.client.isOpen) {
        return {
          status: "disconnected",
          message: "Redis client not connected",
        };
      }

      const startTime = Date.now();
      await this.client.ping();
      const responseTime = Date.now() - startTime;

      return {
        status: "healthy",
        responseTime,
        message: "Cache service is operational",
      };
    } catch (error) {
      logger.error("Cache health check failed:", error);
      return {
        status: "error",
        message: error.message,
      };
    }
  }

  /**
   * Utility method to wrap cache operations with error handling
   * @param {Function} operation - Cache operation function
   * @param {*} fallback - Fallback value on error
   * @returns {*} Operation result or fallback
   */
  async withFallback(operation, fallback = null) {
    try {
      return await operation();
    } catch (error) {
      logger.error("Cache operation failed, using fallback:", error);
      return fallback;
    }
  }

  /**
   * Batch operations helper
   * @param {Array} operations - Array of operations
   * @returns {Array} Array of results
   */
  async batch(operations) {
    try {
      if (!this.client || !this.client.isOpen) {
        return operations.map(() => null);
      }

      const pipeline = this.client.multi();

      for (const operation of operations) {
        const { method, args } = operation;
        pipeline[method](...args);
      }

      const results = await pipeline.exec();
      logger.debug(
        `Cache batch operation completed (${operations.length} operations)`
      );

      return results.map((result) => result[1]); // Extract values from [error, result] pairs
    } catch (error) {
      logger.error("Cache batch operation failed:", error);
      return operations.map(() => null);
    }
  }
}

module.exports = new CacheService();
