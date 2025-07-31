const redis = require("redis");
const logger = require("../utils/logger");

class RedisConfig {
  constructor() {
    this.client = null;
    this.publisher = null;
    this.subscriber = null;
  }

  async connect() {
    try {
      // Main Redis client
      this.client = redis.createClient({
        url: process.env.REDIS_URL || "redis://localhost:6379",
        retry_strategy: (options) => {
          if (options.error && options.error.code === "ECONNREFUSED") {
            logger.error("Redis connection refused");
            return new Error("Redis connection refused");
          }
          if (options.total_retry_time > 1000 * 60 * 60) {
            logger.error("Redis retry time exhausted");
            return new Error("Retry time exhausted");
          }
          if (options.attempt > 10) {
            return undefined;
          }
          return Math.min(options.attempt * 100, 3000);
        },
      });

      // Publisher for real-time events
      this.publisher = redis.createClient({
        url: process.env.REDIS_URL || "redis://localhost:6379",
      });

      // Subscriber for real-time events
      this.subscriber = redis.createClient({
        url: process.env.REDIS_URL || "redis://localhost:6379",
      });

      await this.client.connect();
      await this.publisher.connect();
      await this.subscriber.connect();

      logger.info("Redis connected successfully");

      // Handle Redis errors
      this.client.on("error", (err) => {
        logger.error("Redis Client Error:", err);
      });

      this.publisher.on("error", (err) => {
        logger.error("Redis Publisher Error:", err);
      });

      this.subscriber.on("error", (err) => {
        logger.error("Redis Subscriber Error:", err);
      });
    } catch (error) {
      logger.error("Redis connection failed:", error);
      throw error;
    }
  }

  async disconnect() {
    try {
      if (this.client) await this.client.quit();
      if (this.publisher) await this.publisher.quit();
      if (this.subscriber) await this.subscriber.quit();
      logger.info("Redis disconnected");
    } catch (error) {
      logger.error("Redis disconnection error:", error);
    }
  }

  getClient() {
    return this.client;
  }

  getPublisher() {
    return this.publisher;
  }

  getSubscriber() {
    return this.subscriber;
  }
}

module.exports = new RedisConfig();
