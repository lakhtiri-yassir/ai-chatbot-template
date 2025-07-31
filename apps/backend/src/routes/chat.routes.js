const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chat.controller");
const authMiddleware = require("../middleware/auth.middleware");
const rateLimitMiddleware = require("../middleware/rateLimit.middleware");
const errorMiddleware = require("../middleware/error.middleware");

// Apply optional authentication to all chat routes
router.use(authMiddleware.optionalAuth);

// POST /api/chat/conversations - Create new conversation
router.post(
  "/conversations",
  rateLimitMiddleware.generalRateLimit(),
  errorMiddleware.asyncHandler(chatController.createConversation)
);

// GET /api/chat/conversations - Get all conversations for user
router.get(
  "/conversations",
  rateLimitMiddleware.generalRateLimit(),
  errorMiddleware.asyncHandler(chatController.getConversations)
);

// GET /api/chat/conversations/:conversationId - Get specific conversation
router.get(
  "/conversations/:conversationId",
  rateLimitMiddleware.generalRateLimit(),
  errorMiddleware.asyncHandler(chatController.getConversation)
);

// DELETE /api/chat/conversations/:conversationId - Delete conversation
router.delete(
  "/conversations/:conversationId",
  rateLimitMiddleware.generalRateLimit(),
  errorMiddleware.asyncHandler(chatController.deleteConversation)
);

// POST /api/chat/:conversationId/message - Send message
router.post(
  "/:conversationId/message",
  rateLimitMiddleware.chatRateLimit(),
  errorMiddleware.asyncHandler(chatController.sendMessage)
);

// POST /api/chat/:conversationId/stream - Stream message response
router.post(
  "/:conversationId/stream",
  rateLimitMiddleware.streamRateLimit(),
  errorMiddleware.asyncHandler(chatController.streamMessage)
);

// Parameter validation middleware
router.param("conversationId", (req, res, next, conversationId) => {
  // Validate MongoDB ObjectId format
  if (!conversationId.match(/^[0-9a-fA-F]{24}$/)) {
    return res.status(400).json({
      success: false,
      error: "Invalid conversation ID format",
    });
  }
  next();
});

module.exports = router;
