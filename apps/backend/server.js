const express = require("express");
const http = require("http");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

// Import your configurations
const { connectDB } = require("./src/config/database");
const { connectRedis } = require("./src/config/redis");
const logger = require("./src/utils/logger");

// Import routes
const chatRoutes = require("./src/routes/chat.routes");
const knowledgeRoutes = require("./src/routes/knowledge.routes");

// Import Socket Manager (the code I created)
const SocketManager = require("./src/sockets");

// Import middleware
const errorMiddleware = require("./src/middleware/error.middleware");
const authMiddleware = require("./src/middleware/auth.middleware");

async function startServer() {
  try {
    // 1. Connect to databases
    await connectDB();
    const redisClient = await connectRedis();

    // 2. Create Express app
    const app = express();

    // 3. Basic middleware
    app.use(helmet());
    app.use(
      cors({
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        credentials: true,
      })
    );
    app.use(express.json({ limit: "10mb" }));
    app.use(express.urlencoded({ extended: true }));

    // 4. Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
    });
    app.use("/api/", limiter);

    // 5. Routes
    app.use("/api/chat", chatRoutes);
    app.use("/api/knowledge", knowledgeRoutes);

    // Health check
    app.get("/health", (req, res) => {
      res.json({
        status: "OK",
        timestamp: new Date(),
        uptime: process.uptime(),
      });
    });

    // 6. Error handling
    app.use(errorMiddleware);

    // 7. Create HTTP server (needed for Socket.IO)
    const server = http.createServer(app);

    // 8. THIS IS WHERE YOUR SOCKET CODE GOES!
    // Initialize Socket.IO with the SocketManager I created
    const socketManager = new SocketManager(server, redisClient);

    // 9. Start the server
    const PORT = process.env.PORT || 8000;
    server.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📡 Socket.IO enabled for real-time features`);
      logger.info(
        `🔗 Frontend URL: ${
          process.env.FRONTEND_URL || "http://localhost:3000"
        }`
      );
    });

    // 10. Graceful shutdown (THIS IS THE IMPORTANT PART!)
    // When the server needs to shut down (like during deployment)
    process.on("SIGTERM", async () => {
      logger.info("🛑 Received SIGTERM, shutting down gracefully...");

      // Clean up Socket.IO connections
      await socketManager.shutdown();

      // Close database connections
      await redisClient.quit();

      // Exit the process
      process.exit(0);
    });

    process.on("SIGINT", async () => {
      logger.info("🛑 Received SIGINT, shutting down gracefully...");
      await socketManager.shutdown();
      await redisClient.quit();
      process.exit(0);
    });
  } catch (error) {
    logger.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

// Start the server
startServer();
