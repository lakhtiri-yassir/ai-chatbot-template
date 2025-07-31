const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

// Import your configurations
const { connectDB } = require("../src/config/database");
const { connectRedis } = require("../src/config/redis");
const logger = require("../src/utils/logger");

// Import routes
const chatRoutes = require("../src/routes/chat.routes");
const knowledgeRoutes = require("../src/routes/knowledge.routes");

// Import middleware
const errorMiddleware = require("../src/middleware/error.middleware");

// Create Express app
const app = express();

// Initialize databases (will be cached across function invocations)
let dbConnected = false;
let redisClient = null;

async function initializeDatabases() {
  if (!dbConnected) {
    try {
      await connectDB();
      redisClient = await connectRedis();
      dbConnected = true;
      logger.info("✅ Databases connected successfully");
    } catch (error) {
      logger.error("❌ Failed to connect to databases:", error);
      throw error;
    }
  }
  return { dbConnected, redisClient };
}

// Basic middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "https://your-app.vercel.app",
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use("/", limiter);

// Health check
app.get("/health", async (req, res) => {
  try {
    await initializeDatabases();
    res.json({
      status: "OK",
      timestamp: new Date(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
    });
  } catch (error) {
    res.status(500).json({
      status: "ERROR",
      message: "Database connection failed",
      timestamp: new Date(),
    });
  }
});

// Routes
app.use("/chat", chatRoutes);
app.use("/knowledge", knowledgeRoutes);

// Error handling
app.use(errorMiddleware);

// Vercel serverless function handler
module.exports = async (req, res) => {
  try {
    // Initialize databases on first request
    await initializeDatabases();
    
    // Handle the request
    return app(req, res);
  } catch (error) {
    logger.error("❌ API handler error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
}; 