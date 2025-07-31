const logger = require("../utils/logger");

class ErrorMiddleware {
  // Global error handler
  globalErrorHandler(err, req, res, next) {
    logger.error("Global error handler:", {
      message: err.message,
      stack: err.stack,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      userAgent: req.get("User-Agent"),
    });

    // Set default error
    let error = {
      statusCode: err.statusCode || 500,
      message: err.message || "Internal Server Error",
      success: false,
    };

    // Handle specific error types
    error = this.handleSpecificErrors(err, error);

    // Don't leak error details in production
    if (process.env.NODE_ENV === "production" && error.statusCode === 500) {
      error.message = "Something went wrong";
    }

    res.status(error.statusCode).json({
      success: error.success,
      error: error.message,
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    });
  }

  // Handle specific error types
  handleSpecificErrors(err, error) {
    // MongoDB/Mongoose errors
    if (err.name === "CastError") {
      error.statusCode = 400;
      error.message = "Invalid ID format";
    }

    if (err.name === "ValidationError") {
      error.statusCode = 400;
      const messages = Object.values(err.errors).map((val) => val.message);
      error.message = messages.join(", ");
    }

    if (err.code === 11000) {
      error.statusCode = 400;
      const field = Object.keys(err.keyValue)[0];
      error.message = `${field} already exists`;
    }

    // JWT errors
    if (err.name === "JsonWebTokenError") {
      error.statusCode = 401;
      error.message = "Invalid token";
    }

    if (err.name === "TokenExpiredError") {
      error.statusCode = 401;
      error.message = "Token expired";
    }

    // Multer errors (file upload)
    if (err.code === "LIMIT_FILE_SIZE") {
      error.statusCode = 400;
      error.message = "File too large";
    }

    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      error.statusCode = 400;
      error.message = "Unexpected file field";
    }

    // OpenRouter API errors
    if (err.response?.status === 429) {
      error.statusCode = 429;
      error.message = "Rate limit exceeded. Please try again later.";
    }

    if (err.response?.status === 401) {
      error.statusCode = 500;
      error.message = "AI service authentication failed";
    }

    // Redis errors
    if (err.message?.includes("Redis")) {
      error.statusCode = 500;
      error.message = "Cache service unavailable";
    }

    return error;
  }

  // 404 handler for undefined routes
  notFoundHandler(req, res, next) {
    const error = new Error(`Route ${req.originalUrl} not found`);
    error.statusCode = 404;
    next(error);
  }

  // Async error wrapper
  asyncHandler(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  // Validation error handler
  validationErrorHandler(validationResult) {
    return (req, res, next) => {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        const errorMessages = errors.array().map((error) => ({
          field: error.path,
          message: error.msg,
          value: error.value,
        }));

        return res.status(400).json({
          success: false,
          error: "Validation failed",
          details: errorMessages,
        });
      }

      next();
    };
  }

  // Custom error class
  createError(message, statusCode = 500) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
  }

  // Rate limit error handler
  rateLimitHandler(req, res) {
    logger.warn("Rate limit exceeded:", {
      ip: req.ip,
      url: req.originalUrl,
      userAgent: req.get("User-Agent"),
    });

    res.status(429).json({
      success: false,
      error: "Too many requests. Please try again later.",
      retryAfter: Math.round(req.rateLimit.resetTime / 1000),
    });
  }

  // CORS error handler
  corsErrorHandler(err, req, res, next) {
    if (err.message && err.message.includes("CORS")) {
      logger.warn("CORS error:", {
        origin: req.get("Origin"),
        method: req.method,
        url: req.originalUrl,
      });

      return res.status(403).json({
        success: false,
        error: "CORS policy violation",
      });
    }

    next(err);
  }

  // File upload error handler
  fileUploadErrorHandler(err, req, res, next) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        error: `File too large. Maximum size is ${Math.round(
          err.limit / 1024 / 1024
        )}MB`,
      });
    }

    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        success: false,
        error: `Too many files. Maximum is ${err.limit}`,
      });
    }

    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({
        success: false,
        error: `Unexpected file field: ${err.field}`,
      });
    }

    next(err);
  }

  // Database connection error handler
  databaseErrorHandler(err, req, res, next) {
    if (
      err.message?.includes("connection") ||
      err.message?.includes("timeout")
    ) {
      logger.error("Database connection error:", err);

      return res.status(503).json({
        success: false,
        error: "Database service unavailable",
      });
    }

    next(err);
  }

  // External API error handler
  externalAPIErrorHandler(err, req, res, next) {
    if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND") {
      logger.error("External API connection error:", err);

      return res.status(503).json({
        success: false,
        error: "External service unavailable",
      });
    }

    if (err.response?.status >= 500) {
      logger.error("External API server error:", err);

      return res.status(502).json({
        success: false,
        error: "External service error",
      });
    }

    next(err);
  }

  // Security error handler
  securityErrorHandler(err, req, res, next) {
    // Handle security-related errors
    if (err.type === "entity.parse.failed") {
      return res.status(400).json({
        success: false,
        error: "Invalid JSON format",
      });
    }

    if (err.type === "entity.too.large") {
      return res.status(413).json({
        success: false,
        error: "Request payload too large",
      });
    }

    next(err);
  }

  // Development error handler with detailed info
  developmentErrorHandler(err, req, res, next) {
    if (process.env.NODE_ENV === "development") {
      logger.error("Development error details:", {
        message: err.message,
        stack: err.stack,
        request: {
          method: req.method,
          url: req.originalUrl,
          headers: req.headers,
          body: req.body,
          params: req.params,
          query: req.query,
        },
      });
    }

    next(err);
  }
}

module.exports = new ErrorMiddleware();
