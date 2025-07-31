const cors = require("cors");
const logger = require("../utils/logger");

class CorsMiddleware {
  // Development CORS configuration
  getDevelopmentCors() {
    return cors({
      origin: [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
      ],
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "X-API-Key",
        "Accept",
        "Origin",
      ],
      exposedHeaders: [
        "X-Total-Count",
        "X-Rate-Limit-Limit",
        "X-Rate-Limit-Remaining",
        "X-Rate-Limit-Reset",
      ],
      optionsSuccessStatus: 200,
      maxAge: 86400, // 24 hours
    });
  }

  // Production CORS configuration
  getProductionCors() {
    const allowedOrigins = process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(",")
      : ["https://yourdomain.com"];

    return cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, etc.)
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          logger.warn("CORS blocked origin:", origin);
          callback(new Error("Not allowed by CORS"));
        }
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "X-API-Key",
        "Accept",
        "Origin",
      ],
      exposedHeaders: [
        "X-Total-Count",
        "X-Rate-Limit-Limit",
        "X-Rate-Limit-Remaining",
        "X-Rate-Limit-Reset",
      ],
      optionsSuccessStatus: 200,
      maxAge: 86400, // 24 hours
    });
  }

  // Get CORS configuration based on environment
  getCorsConfig() {
    const isDevelopment = process.env.NODE_ENV === "development";
    return isDevelopment ? this.getDevelopmentCors() : this.getProductionCors();
  }

  // Custom CORS handler with logging
  customCorsHandler() {
    return (req, res, next) => {
      const origin = req.get("Origin");
      const method = req.method;

      // Log CORS requests
      if (origin && origin !== req.get("Host")) {
        logger.info("CORS request:", {
          origin,
          method,
          url: req.originalUrl,
          userAgent: req.get("User-Agent"),
        });
      }

      // Apply CORS
      this.getCorsConfig()(req, res, next);
    };
  }

  // Preflight handler for complex requests
  preflightHandler() {
    return (req, res, next) => {
      if (req.method === "OPTIONS") {
        logger.info("CORS preflight request:", {
          origin: req.get("Origin"),
          method: req.get("Access-Control-Request-Method"),
          headers: req.get("Access-Control-Request-Headers"),
          url: req.originalUrl,
        });

        res.header("Access-Control-Allow-Origin", req.get("Origin") || "*");
        res.header(
          "Access-Control-Allow-Methods",
          "GET, POST, PUT, DELETE, OPTIONS"
        );
        res.header(
          "Access-Control-Allow-Headers",
          "Content-Type, Authorization, X-Requested-With, X-API-Key"
        );
        res.header("Access-Control-Allow-Credentials", "true");
        res.header("Access-Control-Max-Age", "86400");

        return res.status(200).end();
      }

      next();
    };
  }

  // Socket.IO CORS configuration
  getSocketCorsConfig() {
    const isDevelopment = process.env.NODE_ENV === "development";

    if (isDevelopment) {
      return {
        origin: [
          "http://localhost:3000",
          "http://localhost:3001",
          "http://127.0.0.1:3000",
          "http://127.0.0.1:3001",
        ],
        credentials: true,
        methods: ["GET", "POST"],
      };
    }

    const allowedOrigins = process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(",")
      : ["https://yourdomain.com"];

    return {
      origin: allowedOrigins,
      credentials: true,
      methods: ["GET", "POST"],
    };
  }

  // Middleware to handle CORS errors
  corsErrorHandler() {
    return (err, req, res, next) => {
      if (err.message && err.message.includes("CORS")) {
        logger.warn("CORS error:", {
          origin: req.get("Origin"),
          method: req.method,
          url: req.originalUrl,
          userAgent: req.get("User-Agent"),
          error: err.message,
        });

        return res.status(403).json({
          success: false,
          error: "CORS policy violation",
          message: "Origin not allowed by CORS policy",
        });
      }

      next(err);
    };
  }

  // Dynamic CORS based on API key or authentication
  dynamicCors() {
    return (req, res, next) => {
      const origin = req.get("Origin");
      const apiKey = req.get("X-API-Key");
      const authToken = req.get("Authorization");

      // Allow requests with valid API key from any origin
      if (apiKey && apiKey === process.env.API_KEY) {
        res.header("Access-Control-Allow-Origin", origin || "*");
        res.header("Access-Control-Allow-Credentials", "true");
        return next();
      }

      // Apply standard CORS for other requests
      this.getCorsConfig()(req, res, next);
    };
  }

  // Whitelist specific domains for embedded widgets
  getEmbedCorsConfig() {
    const embedDomains = process.env.EMBED_DOMAINS
      ? process.env.EMBED_DOMAINS.split(",")
      : [];

    return cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (direct access)
        if (!origin) return callback(null, true);

        // Check if origin is in embed domains
        const isEmbedDomain = embedDomains.some((domain) =>
          origin.includes(domain)
        );

        if (isEmbedDomain) {
          callback(null, true);
        } else {
          logger.warn("Embed CORS blocked origin:", origin);
          callback(new Error("Not allowed for embedding"));
        }
      },
      credentials: false, // Disable credentials for embed
      methods: ["GET", "POST"],
      allowedHeaders: ["Content-Type", "X-API-Key"],
      optionsSuccessStatus: 200,
    });
  }

  // Security headers middleware
  securityHeaders() {
    return (req, res, next) => {
      // Remove X-Powered-By header
      res.removeHeader("X-Powered-By");

      // Security headers
      res.header("X-Content-Type-Options", "nosniff");
      res.header("X-Frame-Options", "DENY");
      res.header("X-XSS-Protection", "1; mode=block");
      res.header("Referrer-Policy", "strict-origin-when-cross-origin");

      // Content Security Policy
      res.header(
        "Content-Security-Policy",
        "default-src 'self'; " +
          "script-src 'self' 'unsafe-inline'; " +
          "style-src 'self' 'unsafe-inline'; " +
          "img-src 'self' data: https:; " +
          "font-src 'self' https:; " +
          "connect-src 'self' https:; " +
          "frame-ancestors 'none';"
      );

      next();
    };
  }

  // CORS configuration for file uploads
  getUploadCorsConfig() {
    return cors({
      origin: this.getCorsConfig().origin,
      credentials: true,
      methods: ["POST", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "Accept",
        "Origin",
      ],
      maxAge: 86400,
    });
  }

  // Log CORS requests for debugging
  corsLogger() {
    return (req, res, next) => {
      const origin = req.get("Origin");

      if (origin && process.env.NODE_ENV === "development") {
        logger.debug("CORS request details:", {
          origin,
          method: req.method,
          url: req.originalUrl,
          headers: {
            "Access-Control-Request-Method": req.get(
              "Access-Control-Request-Method"
            ),
            "Access-Control-Request-Headers": req.get(
              "Access-Control-Request-Headers"
            ),
          },
        });
      }

      next();
    };
  }
}

module.exports = new CorsMiddleware();
