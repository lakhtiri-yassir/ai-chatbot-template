/**
 * Express Application Setup
 * Main application configuration and middleware setup
 */

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const path = require("path");

// Import middleware
const corsMiddleware = require("./middleware/cors.middleware");
const authMiddleware = require("./middleware/auth.middleware");
const rateLimitMiddleware = require("./middleware/rateLimit.middleware");
const errorMiddleware = require("./middleware/error.middleware");

// Import routes
const routes = require("./routes");

// Import utilities
const { logger } = require("./utils/logger");

// Import config
const config = require("./config");

class App {
  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Setup middleware
   */
  setupMiddleware() {
    // Security middleware
    this.app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: [
              "'self'",
              "'unsafe-inline'",
              "https://fonts.googleapis.com",
            ],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "ws:", "wss:"],
          },
        },
        crossOriginEmbedderPolicy: false,
      })
    );

    // Compression middleware
    this.app.use(compression());

    // CORS middleware
    this.app.use(corsMiddleware);

    // Body parsing middleware
    this.app.use(
      express.json({
        limit: "10mb",
        verify: (req, res, buf) => {
          req.rawBody = buf;
        },
      })
    );
    this.app.use(
      express.urlencoded({
        extended: true,
        limit: "10mb",
      })
    );

    // Request logging middleware
    this.app.use(
      morgan("combined", {
        stream: {
          write: (message) => {
            logger.info(message.trim(), { source: "morgan" });
          },
        },
      })
    );

    // Request timing middleware
    this.app.use((req, res, next) => {
      req.startTime = Date.now();

      // Log request completion
      res.on("finish", () => {
        const duration = Date.now() - req.startTime;
        logger.logRequest(req, res, duration);
      });

      next();
    });

    // Rate limiting middleware
    this.app.use(rateLimitMiddleware);

    // Health check endpoint (before auth)
    this.app.get("/health", (req, res) => {
      res.status(200).json({
        status: "ok",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.env.npm_package_version || "1.0.0",
      });
    });

    // API documentation endpoint
    this.app.get("/api", (req, res) => {
      res.json({
        name: "AI Chatbot API",
        version: process.env.npm_package_version || "1.0.0",
        description: "Real-time AI chatbot with document knowledge base",
        endpoints: {
          chat: "/api/chat",
          knowledge: "/api/knowledge",
          health: "/health",
        },
        documentation: "/api/docs",
        websocket: "/socket.io",
      });
    });

    // Serve static files from uploads directory
    this.app.use(
      "/uploads",
      express.static(path.join(__dirname, "../knowledge/documents"))
    );

    // Optional: Serve processed files
    this.app.use(
      "/processed",
      express.static(path.join(__dirname, "../knowledge/processed"))
    );
  }

  /**
   * Setup routes
   */
  setupRoutes() {
    // API routes
    this.app.use("/api", routes);

    // Catch-all for undefined API routes
    this.app.all("/api/*", (req, res) => {
      res.status(404).json({
        success: false,
        error: "API endpoint not found",
        path: req.path,
        method: req.method,
        availableEndpoints: [
          "GET /api",
          "POST /api/chat/message",
          "GET /api/chat/conversations",
          "GET /api/chat/conversations/:id",
          "DELETE /api/chat/conversations/:id",
          "POST /api/knowledge/upload",
          "GET /api/knowledge/documents",
          "DELETE /api/knowledge/documents/:id",
          "POST /api/knowledge/process",
          "GET /api/knowledge/search",
          "GET /health",
        ],
      });
    });

    // Root endpoint
    this.app.get("/", (req, res) => {
      res.json({
        message: "AI Chatbot Backend API",
        version: process.env.npm_package_version || "1.0.0",
        environment: process.env.NODE_ENV || "development",
        timestamp: new Date().toISOString(),
        documentation: "/api",
        health: "/health",
      });
    });

    // Serve frontend in production
    if (process.env.NODE_ENV === "production") {
      // Serve static files from frontend build
      this.app.use(express.static(path.join(__dirname, "../../frontend/dist")));

      // Handle React Router (return `index.html` for non-API routes)
      this.app.get("*", (req, res) => {
        res.sendFile(path.join(__dirname, "../../frontend/dist", "index.html"));
      });
    }
  }

  /**
   * Setup error handling
   */
  setupErrorHandling() {
    // 404 handler for non-API routes
    this.app.use((req, res, next) => {
      if (req.path.startsWith("/api/")) {
        return next(); // Let API 404 handler deal with it
      }

      res.status(404).json({
        success: false,
        error: "Route not found",
        path: req.path,
        method: req.method,
      });
    });

    // Global error handler
    this.app.use(errorMiddleware);

    // Graceful shutdown handling
    this.setupGracefulShutdown();
  }

  /**
   * Setup graceful shutdown
   */
  setupGracefulShutdown() {
    const gracefulShutdown = (signal) => {
      logger.info(`Received ${signal}. Starting graceful shutdown...`);

      // Stop accepting new connections
      if (this.server) {
        this.server.close((err) => {
          if (err) {
            logger.error("Error during server shutdown:", err);
            process.exit(1);
          }

          logger.info("Server closed successfully");

          // Close database connections
          this.closeConnections()
            .then(() => {
              logger.info("All connections closed. Exiting process.");
              process.exit(0);
            })
            .catch((error) => {
              logger.error("Error closing connections:", error);
              process.exit(1);
            });
        });
      } else {
        this.closeConnections()
          .then(() => process.exit(0))
          .catch(() => process.exit(1));
      }

      // Force exit after 30 seconds
      setTimeout(() => {
        logger.error("Force exit due to timeout");
        process.exit(1);
      }, 30000);
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));

    // Handle uncaught exceptions
    process.on("uncaughtException", (error) => {
      logger.error("Uncaught Exception:", error);
      gracefulShutdown("UNCAUGHT_EXCEPTION");
    });

    // Handle unhandled promise rejections
    process.on("unhandledRejection", (reason, promise) => {
      logger.error("Unhandled Rejection at:", { promise, reason });
      gracefulShutdown("UNHANDLED_REJECTION");
    });
  }

  /**
   * Close database and external connections
   */
  async closeConnections() {
    const promises = [];

    try {
      // Close MongoDB connection
      if (config.database && config.database.close) {
        promises.push(config.database.close());
      }

      // Close Redis connection
      if (config.redis && config.redis.quit) {
        promises.push(config.redis.quit());
      }

      await Promise.all(promises);
      logger.info("All database connections closed");
    } catch (error) {
      logger.error("Error closing database connections:", error);
      throw error;
    }
  }

  /**
   * Start the server
   */
  async start(port = process.env.PORT || 3001) {
    try {
      // Initialize database connections
      await config.initialize();

      this.server = this.app.listen(port, () => {
        logger.info(`Server started on port ${port}`, {
          environment: process.env.NODE_ENV || "development",
          port,
          pid: process.pid,
        });
      });

      return this.server;
    } catch (error) {
      logger.error("Failed to start server:", error);
      throw error;
    }
  }

  /**
   * Get Express app instance
   */
  getApp() {
    return this.app;
  }

  /**
   * Get server instance
   */
  getServer() {
    return this.server;
  }
}

module.exports = App;
