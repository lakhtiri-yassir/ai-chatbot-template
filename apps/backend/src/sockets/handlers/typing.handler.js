const logger = require("../../utils/logger");

class TypingHandler {
  constructor(io, redis) {
    this.io = io;
    this.redis = redis;
    this.typingUsers = new Map(); // conversationId -> Set of userIds
    this.typingTimeouts = new Map(); // userId -> timeout
  }

  // Handle user started typing
  async handleTypingStart(socket, data) {
    try {
      const { conversationId, userId, userName } = data;

      // Validate input
      if (!conversationId || !userId) {
        socket.emit("error", { message: "Missing required fields" });
        return;
      }

      // Clear existing timeout for this user
      this.clearTypingTimeout(userId);

      // Add user to typing users for this conversation
      if (!this.typingUsers.has(conversationId)) {
        this.typingUsers.set(conversationId, new Set());
      }
      this.typingUsers.get(conversationId).add(userId);

      // Store typing status in Redis for persistence across server restarts
      await this.redis.sadd(`typing:${conversationId}`, userId);
      await this.redis.expire(`typing:${conversationId}`, 10); // Expire after 10 seconds

      // Store user name in Redis for display
      if (userName) {
        await this.redis.setex(`user:${userId}:name`, 300, userName);
      }

      // Emit typing status to other users in the conversation
      socket.to(conversationId).emit("userTyping", {
        userId,
        userName,
        conversationId,
        isTyping: true,
        timestamp: new Date(),
      });

      // Set timeout to automatically stop typing after 10 seconds
      const timeout = setTimeout(() => {
        this.handleTypingStop(socket, { conversationId, userId });
      }, 10000);

      this.typingTimeouts.set(userId, timeout);

      // Log typing activity
      logger.debug(
        `User ${userId} started typing in conversation ${conversationId}`
      );
    } catch (error) {
      logger.error("Error handling typing start:", error);
      socket.emit("error", { message: "Failed to handle typing status" });
    }
  }

  // Handle user stopped typing
  async handleTypingStop(socket, data) {
    try {
      const { conversationId, userId } = data;

      // Validate input
      if (!conversationId || !userId) {
        return;
      }

      // Clear timeout
      this.clearTypingTimeout(userId);

      // Remove user from typing users
      if (this.typingUsers.has(conversationId)) {
        this.typingUsers.get(conversationId).delete(userId);

        // Clean up empty conversation sets
        if (this.typingUsers.get(conversationId).size === 0) {
          this.typingUsers.delete(conversationId);
        }
      }

      // Remove from Redis
      await this.redis.srem(`typing:${conversationId}`, userId);

      // Get user name from Redis
      const userName = await this.redis.get(`user:${userId}:name`);

      // Emit typing stopped to other users
      socket.to(conversationId).emit("userTyping", {
        userId,
        userName,
        conversationId,
        isTyping: false,
        timestamp: new Date(),
      });

      // Log typing activity
      logger.debug(
        `User ${userId} stopped typing in conversation ${conversationId}`
      );
    } catch (error) {
      logger.error("Error handling typing stop:", error);
    }
  }

  // Handle getting current typing users
  async handleGetTypingUsers(socket, data) {
    try {
      const { conversationId } = data;

      if (!conversationId) {
        socket.emit("error", { message: "Conversation ID required" });
        return;
      }

      // Get typing users from Redis
      const typingUserIds = await this.redis.smembers(
        `typing:${conversationId}`
      );

      // Get user names
      const typingUsers = [];
      for (const userId of typingUserIds) {
        const userName = await this.redis.get(`user:${userId}:name`);
        typingUsers.push({
          userId,
          userName: userName || `User ${userId}`,
        });
      }

      // Send current typing users to requesting client
      socket.emit("typingUsers", {
        conversationId,
        typingUsers,
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error("Error getting typing users:", error);
      socket.emit("error", { message: "Failed to get typing users" });
    }
  }

  // Handle user joining conversation (get typing status)
  async handleJoinConversation(socket, data) {
    try {
      const { conversationId, userId } = data;

      // Get current typing users from Redis
      const typingUserIds = await this.redis.smembers(
        `typing:${conversationId}`
      );

      // Send typing status to newly joined user
      for (const typingUserId of typingUserIds) {
        if (typingUserId !== userId) {
          const userName = await this.redis.get(`user:${typingUserId}:name`);
          socket.emit("userTyping", {
            userId: typingUserId,
            userName: userName || `User ${typingUserId}`,
            conversationId,
            isTyping: true,
            timestamp: new Date(),
          });
        }
      }
    } catch (error) {
      logger.error("Error handling join conversation for typing:", error);
    }
  }

  // Handle user disconnection
  async handleUserDisconnect(socket, userId) {
    try {
      if (!userId) return;

      // Clear typing timeout
      this.clearTypingTimeout(userId);

      // Find all conversations this user was typing in
      const conversationsToCleanup = [];
      for (const [conversationId, typingUsers] of this.typingUsers) {
        if (typingUsers.has(userId)) {
          conversationsToCleanup.push(conversationId);
        }
      }

      // Clean up typing status for all conversations
      for (const conversationId of conversationsToCleanup) {
        await this.handleTypingStop(socket, { conversationId, userId });
      }

      // Clean up user data from Redis
      await this.redis.del(`user:${userId}:name`);

      logger.debug(`Cleaned up typing status for disconnected user ${userId}`);
    } catch (error) {
      logger.error("Error handling user disconnect for typing:", error);
    }
  }

  // Clear typing timeout for user
  clearTypingTimeout(userId) {
    if (this.typingTimeouts.has(userId)) {
      clearTimeout(this.typingTimeouts.get(userId));
      this.typingTimeouts.delete(userId);
    }
  }

  // Get typing indicator text for display
  getTypingIndicatorText(typingUsers) {
    if (!typingUsers || typingUsers.length === 0) {
      return "";
    }

    const names = typingUsers.map((user) => user.userName);

    if (names.length === 1) {
      return `${names[0]} is typing...`;
    } else if (names.length === 2) {
      return `${names[0]} and ${names[1]} are typing...`;
    } else if (names.length === 3) {
      return `${names[0]}, ${names[1]}, and ${names[2]} are typing...`;
    } else {
      return `${names[0]}, ${names[1]}, and ${
        names.length - 2
      } others are typing...`;
    }
  }

  // Handle typing heartbeat (keep typing status alive)
  async handleTypingHeartbeat(socket, data) {
    try {
      const { conversationId, userId } = data;

      if (!conversationId || !userId) {
        return;
      }

      // Check if user is still typing
      const isTyping = await this.redis.sismember(
        `typing:${conversationId}`,
        userId
      );

      if (isTyping) {
        // Extend expiration
        await this.redis.expire(`typing:${conversationId}`, 10);

        // Reset timeout
        this.clearTypingTimeout(userId);
        const timeout = setTimeout(() => {
          this.handleTypingStop(socket, { conversationId, userId });
        }, 10000);
        this.typingTimeouts.set(userId, timeout);
      }
    } catch (error) {
      logger.error("Error handling typing heartbeat:", error);
    }
  }

  // Clean up expired typing statuses
  async cleanupExpiredTyping() {
    try {
      const conversationKeys = await this.redis.keys("typing:*");

      for (const key of conversationKeys) {
        const ttl = await this.redis.ttl(key);
        if (ttl === -1) {
          // Key exists but has no expiration, clean it up
          await this.redis.del(key);
        }
      }
    } catch (error) {
      logger.error("Error cleaning up expired typing:", error);
    }
  }

  // Initialize periodic cleanup
  initializeCleanup() {
    // Run cleanup every 30 seconds
    setInterval(() => {
      this.cleanupExpiredTyping();
    }, 30000);
  }

  // Handle bulk typing status (for conversation loads)
  async handleBulkTypingStatus(socket, data) {
    try {
      const { conversationIds, userId } = data;

      if (!conversationIds || !Array.isArray(conversationIds)) {
        socket.emit("error", { message: "Invalid conversation IDs" });
        return;
      }

      const typingStatus = {};

      for (const conversationId of conversationIds) {
        const typingUserIds = await this.redis.smembers(
          `typing:${conversationId}`
        );
        const typingUsers = [];

        for (const typingUserId of typingUserIds) {
          if (typingUserId !== userId) {
            const userName = await this.redis.get(`user:${typingUserId}:name`);
            typingUsers.push({
              userId: typingUserId,
              userName: userName || `User ${typingUserId}`,
            });
          }
        }

        if (typingUsers.length > 0) {
          typingStatus[conversationId] = {
            typingUsers,
            text: this.getTypingIndicatorText(typingUsers),
          };
        }
      }

      socket.emit("bulkTypingStatus", {
        typingStatus,
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error("Error handling bulk typing status:", error);
      socket.emit("error", { message: "Failed to get typing status" });
    }
  }
}

module.exports = TypingHandler;
