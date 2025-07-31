const express = require("express");
const router = express.Router();
const corsMiddleware = require("../middleware/cors.middleware");
const errorMiddleware = require("../middleware/error.middleware");

// Import route modules
const chatRoutes = require("./chat.routes");
const knowledgeRoutes = require("./knowledge.routes");
const healthRoutes = require("./health.routes");
const authRoutes = require("./auth.routes");

// Apply CORS middleware
router.use(corsMiddleware.customCorsHandler());

// Apply security headers
router.use(corsMiddleware.securityHeaders());

// API documentation endpoint
router.get("/", (req, res) => {
  res.json({
    success: true,
    message: "AI Chatbot API",
    version: "1.0.0",
    endpoints: {
      chat: "/api/chat",
      knowledge: "/api/knowledge",
      health: "/api/health",
      auth: "/api/auth",
    },
    documentation: {
      chat: {
        "POST /api/chat/conversations": "Create new conversation",
        "GET /api/chat/conversations": "Get all conversations",
        "GET /api/chat/conversations/:id": "Get specific conversation",
        "DELETE /api/chat/conversations/:id": "Delete conversation",
        "POST /api/chat/:id/message": "Send message",
        "POST /api/chat/:id/stream": "Stream message response",
      },
      knowledge: {
        "GET /api/knowledge/status": "Get knowledge base status",
        "POST /api/knowledge/process": "Process knowledge base",
        "GET /api/knowledge/search": "Search knowledge base",
        "POST /api/knowledge/upload": "Upload document",
        "GET /api/knowledge/documents": "Get all documents",
        "DELETE /api/knowledge/documents/:id": "Delete document",
        "GET /api/knowledge/documents/:id/chunks": "Get document chunks",
        "POST /api/knowledge/documents/:id/reprocess": "Reprocess document",
      },
      health: {
        "GET /api/health": "Basic health check",
        "GET /api/health/status": "Detailed system status",
        "GET /api/health/metrics": "API metrics",
        "POST /api/health/reset": "Reset system (dev only)",
      },
      auth: {
        "POST /api/auth/register": "Register new user",
        "POST /api/auth/login": "Login user",
        "GET /api/auth/profile": "Get user profile",
        "POST /api/auth/refresh": "Refresh token",
        "POST /api/auth/logout": "Logout user",
      },
    },
    timestamp: new Date().toISOString(),
  });
});

// Mount route modules
router.use("/chat", chatRoutes);
router.use("/knowledge", knowledgeRoutes);
router.use("/health", healthRoutes);
router.use("/auth", authRoutes);

// Handle 404 for API routes
router.use("*", errorMiddleware.notFoundHandler);

module.exports = router;
