const { config } = require("../config");
const redisConfig = require("../config/redis");
const mongoose = require("mongoose");
const logger = require("../utils/logger");

class HealthController {
  // Basic health check
  async healthCheck(req, res) {
    try {
      res.status(200).json({
        success: true,
        message: "AI Chatbot API is healthy",
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || "1.0.0",
      });
    } catch (error) {
      logger.error("Health check error:", error);
      res.status(500).json({
        success: false,
        error: "Health check failed",
      });
    }
  }

  // Detailed system status
  async systemStatus(req, res) {
    try {
      const status = {
        api: "healthy",
        database: "unknown",
        redis: "unknown",
        openrouter: "unknown",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        environment: process.env.NODE_ENV || "development",
      };

      // Check MongoDB connection
      try {
        if (mongoose.connection.readyState === 1) {
          status.database = "connected";
        } else {
          status.database = "disconnected";
        }
      } catch (error) {
        status.database = "error";
      }

      // Check Redis connection
      try {
        const redisClient = redisConfig.getClient();
        if (redisClient && redisClient.isOpen) {
          await redisClient.ping();
          status.redis = "connected";
        } else {
          status.redis = "disconnected";
        }
      } catch (error) {
        status.redis = "error";
      }

      // Check OpenRouter API
      try {
        const openRouterConfig = require("../config/openrouter");
        await openRouterConfig.getModels();
        status.openrouter = "connected";
      } catch (error) {
        status.openrouter = "error";
      }

      // Determine overall health
      const isHealthy =
        status.database === "connected" &&
        status.redis === "connected" &&
        status.openrouter === "connected";

      res.status(isHealthy ? 200 : 503).json({
        success: isHealthy,
        data: status,
      });
    } catch (error) {
      logger.error("System status error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get system status",
      });
    }
  }

  // Get API metrics
  async getMetrics(req, res) {
    try {
      const metrics = {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        timestamp: new Date().toISOString(),
        nodeVersion: process.version,
        platform: process.platform,
        environment: process.env.NODE_ENV || "development",
      };

      // Add database metrics if available
      if (mongoose.connection.readyState === 1) {
        metrics.database = {
          status: "connected",
          host: mongoose.connection.host,
          name: mongoose.connection.name,
          collections: Object.keys(mongoose.connection.collections),
        };
      }

      res.status(200).json({
        success: true,
        data: metrics,
      });
    } catch (error) {
      logger.error("Get metrics error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get metrics",
      });
    }
  }

  // Reset system (for development)
  async resetSystem(req, res) {
    try {
      if (process.env.NODE_ENV === "production") {
        return res.status(403).json({
          success: false,
          error: "Reset not allowed in production",
        });
      }

      // Clear Redis cache
      const redisClient = redisConfig.getClient();
      if (redisClient && redisClient.isOpen) {
        await redisClient.flushAll();
      }

      // You could add more reset logic here
      // Like clearing certain database collections

      res.status(200).json({
        success: true,
        message: "System reset completed",
      });
    } catch (error) {
      logger.error("Reset system error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to reset system",
      });
    }
  }
}

module.exports = new HealthController();
