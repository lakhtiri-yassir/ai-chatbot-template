const rateLimit = require("express-rate-limit");
const RedisStore = require("rate-limit-redis");
const redisConfig = require("../config/redis");
const logger = require("../utils/logger");

class RateLimitMiddleware {
  constructor() {
    this.redisClient = redisConfig.getClient();
  }

  // Create Redis store for rate limiting
  createRedisStore() {
    if (this.redisClient && this.redisClient.isOpen) {
      return new RedisStore({
        client: this.redisClient,
        prefix: "rl:",
        sendCommand: (...args) => this.redisClient.sendCommand(args),
      });
    }
    return undefined; // Fall back to memory store
  }

  // General API rate limiting
  generalRateLimit() {
    return rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: {
        success: false,
        error: "Too many requests from this IP, please try again later",
      },
      standardHeaders: true,
      legacyHeaders: false,
      store: this.createRedisStore(),
      keyGenerator: (req) => {
        // Use user ID if authenticated, otherwise IP
        return req.user?.id || req.ip;
      },
      skip: (req) => {
        // Skip rate limiting for health checks
        return req.path === "/health" || req.path === "/health/status";
      },
      onLimitReached: (req, res, options) => {
        logger.warn("Rate limit exceeded:", {
          ip: req.ip,
          userId: req.user?.id,
          url: req.originalUrl,
          userAgent: req.get("User-Agent"),
        });
      },
    });
  }

  // Strict rate limiting for chat endpoints
  chatRateLimit() {
    return rateLimit({
      windowMs: 1 * 60 * 1000, // 1 minute
      max: 20, // limit each user to 20 messages per minute
      message: {
        success: false,
        error: "Too many messages sent. Please slow down.",
      },
      standardHeaders: true,
      legacyHeaders: false,
      store: this.createRedisStore(),
      keyGenerator: (req) => {
        // Use user ID for chat rate limiting
        return req.user?.id || req.ip;
      },
      onLimitReached: (req, res, options) => {
        logger.warn("Chat rate limit exceeded:", {
          ip: req.ip,
          userId: req.user?.id,
          conversationId: req.params.conversationId,
        });
      },
    });
  }

  // Rate limiting for file uploads
  uploadRateLimit() {
    return rateLimit({
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 10, // limit each user to 10 file uploads per hour
      message: {
        success: false,
        error: "Too many file uploads. Please try again later.",
      },
      standardHeaders: true,
      legacyHeaders: false,
      store: this.createRedisStore(),
      keyGenerator: (req) => {
        return req.user?.id || req.ip;
      },
      onLimitReached: (req, res, options) => {
        logger.warn("Upload rate limit exceeded:", {
          ip: req.ip,
          userId: req.user?.id,
          fileName: req.file?.originalname,
        });
      },
    });
  }

  // Rate limiting for knowledge base processing
  knowledgeProcessingRateLimit() {
    return rateLimit({
      windowMs: 30 * 60 * 1000, // 30 minutes
      max: 5, // limit each user to 5 processing requests per 30 minutes
      message: {
        success: false,
        error: "Too many processing requests. Please wait before trying again.",
      },
      standardHeaders: true,
      legacyHeaders: false,
      store: this.createRedisStore(),
      keyGenerator: (req) => {
        return req.user?.id || req.ip;
      },
      onLimitReached: (req, res, options) => {
        logger.warn("Knowledge processing rate limit exceeded:", {
          ip: req.ip,
          userId: req.user?.id,
        });
      },
    });
  }

  // Rate limiting for search queries
  searchRateLimit() {
    return rateLimit({
      windowMs: 5 * 60 * 1000, // 5 minutes
      max: 50, // limit each user to 50 searches per 5 minutes
      message: {
        success: false,
        error: "Too many search requests. Please slow down.",
      },
      standardHeaders: true,
      legacyHeaders: false,
      store: this.createRedisStore(),
      keyGenerator: (req) => {
        return req.user?.id || req.ip;
      },
      onLimitReached: (req, res, options) => {
        logger.warn("Search rate limit exceeded:", {
          ip: req.ip,
          userId: req.user?.id,
          query: req.query.query,
        });
      },
    });
  }

  // Aggressive rate limiting for auth endpoints
  authRateLimit() {
    return rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // limit each IP to 5 auth requests per 15 minutes
      message: {
        success: false,
        error: "Too many authentication attempts. Please try again later.",
      },
      standardHeaders: true,
      legacyHeaders: false,
      store: this.createRedisStore(),
      keyGenerator: (req) => req.ip, // Always use IP for auth
      onLimitReached: (req, res, options) => {
        logger.warn("Auth rate limit exceeded:", {
          ip: req.ip,
          url: req.originalUrl,
          body: { ...req.body, password: "[REDACTED]" },
        });
      },
    });
  }

  // Custom rate limiting based on user tier
  createTierBasedRateLimit(limits) {
    return rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: (req) => {
        const userTier = req.user?.tier || "free";
        return limits[userTier] || limits.free;
      },
      message: {
        success: false,
        error: "Rate limit exceeded for your subscription tier",
      },
      standardHeaders: true,
      legacyHeaders: false,
      store: this.createRedisStore(),
      keyGenerator: (req) => {
        return req.user?.id || req.ip;
      },
      onLimitReached: (req, res, options) => {
        logger.warn("Tier-based rate limit exceeded:", {
          ip: req.ip,
          userId: req.user?.id,
          tier: req.user?.tier || "free",
        });
      },
    });
  }

  // Dynamic rate limiting based on system load
  createAdaptiveRateLimit(baseLimit) {
    return rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: (req) => {
        // Adjust rate limit based on system load
        const memoryUsage = process.memoryUsage();
        const memoryUsagePercent = memoryUsage.heapUsed / memoryUsage.heapTotal;

        if (memoryUsagePercent > 0.8) {
          return Math.floor(baseLimit * 0.5); // Reduce by 50% if memory usage is high
        } else if (memoryUsagePercent > 0.6) {
          return Math.floor(baseLimit * 0.75); // Reduce by 25% if memory usage is moderate
        }

        return baseLimit;
      },
      message: {
        success: false,
        error: "Service is experiencing high load. Please try again later.",
      },
      standardHeaders: true,
      legacyHeaders: false,
      store: this.createRedisStore(),
      keyGenerator: (req) => {
        return req.user?.id || req.ip;
      },
      onLimitReached: (req, res, options) => {
        logger.warn("Adaptive rate limit exceeded:", {
          ip: req.ip,
          userId: req.user?.id,
          memoryUsage: process.memoryUsage(),
        });
      },
    });
  }

  // Rate limiting for streaming endpoints
  streamRateLimit() {
    return rateLimit({
      windowMs: 1 * 60 * 1000, // 1 minute
      max: 10, // limit each user to 10 streaming requests per minute
      message: {
        success: false,
        error:
          "Too many streaming requests. Please wait before starting another stream.",
      },
      standardHeaders: true,
      legacyHeaders: false,
      store: this.createRedisStore(),
      keyGenerator: (req) => {
        return req.user?.id || req.ip;
      },
      onLimitReached: (req, res, options) => {
        logger.warn("Stream rate limit exceeded:", {
          ip: req.ip,
          userId: req.user?.id,
          conversationId: req.params.conversationId,
        });
      },
    });
  }

  // Custom rate limit handler
  customRateLimitHandler(req, res) {
    logger.warn("Custom rate limit exceeded:", {
      ip: req.ip,
      userId: req.user?.id,
      url: req.originalUrl,
      method: req.method,
    });

    res.status(429).json({
      success: false,
      error: "Rate limit exceeded",
      retryAfter: Math.round(req.rateLimit.resetTime / 1000),
      limit: req.rateLimit.limit,
      remaining: req.rateLimit.remaining,
      resetTime: new Date(req.rateLimit.resetTime).toISOString(),
    });
  }

  // Skip rate limiting for certain conditions
  skipRateLimit(req) {
    // Skip for health checks
    if (req.path.startsWith("/health")) return true;

    // Skip for admin users
    if (req.user?.role === "admin") return true;

    // Skip for internal requests
    if (req.ip === "127.0.0.1" || req.ip === "::1") return true;

    return false;
  }
}

module.exports = new RateLimitMiddleware();
