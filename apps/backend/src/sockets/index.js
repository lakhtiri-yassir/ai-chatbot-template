const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const ChatHandler = require("./handlers/chat.handler");
const TypingHandler = require("./handlers/typing.handler");
const logger = require("../utils/logger");

class SocketManager {
  constructor(server, redis) {
    this.server = server;
    this.redis = redis;
    this.connectedUsers = new Map(); // socketId -> userData
    this.userSockets = new Map(); // userId -> Set of socketIds

    // Initialize Socket.IO with CORS configuration
    this.io = new Server(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        allowedHeaders: ["Content-Type", "Authorization"],
        credentials: true,
      },
      pingTimeout: 60000,
      pingInterval: 25000,
      transports: ["websocket", "polling"],
    });

    // Initialize handlers
    this.chatHandler = new ChatHandler(this.io, this.redis);
    this.typingHandler = new TypingHandler(this.io, this.redis);

    // Setup middleware and event handlers
    this.setupMiddleware();
    this.setupEventHandlers();
    this.setupCleanup();

    logger.info("Socket.IO server initialized");
  }

  // Setup authentication and connection middleware
  setupMiddleware() {
    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token =
          socket.handshake.auth.token || socket.handshake.headers.authorization;

        if (!token) {
          // Allow anonymous connections with generated user ID
          socket.userId = `anonymous_${Date.now()}_${Math.random()
            .toString(36)
            .substr(2, 9)}`;
          socket.userName = `Anonymous User`;
          socket.isAnonymous = true;
          return next();
        }

        // Verify JWT token for authenticated users
        const decoded = jwt.verify(
          token.replace("Bearer ", ""),
          process.env.JWT_SECRET
        );
        socket.userId = decoded.userId;
        socket.userName = decoded.userName || `User ${decoded.userId}`;
        socket.isAnonymous = false;

        // Store user session in Redis
        await this.redis.setex(
          `session:${socket.userId}`,
          3600,
          JSON.stringify({
            userId: socket.userId,
            userName: socket.userName,
            socketId: socket.id,
            connectedAt: new Date(),
          })
        );

        next();
      } catch (error) {
        logger.error("Socket authentication error:", error);
        next(new Error("Authentication failed"));
      }
    });

    // Rate limiting middleware
    this.io.use(async (socket, next) => {
      const rateLimitKey = `ratelimit:${socket.userId}`;
      const current = await this.redis.incr(rateLimitKey);

      if (current === 1) {
        await this.redis.expire(rateLimitKey, 60); // 1 minute window
      }

      if (current > 100) {
        // 100 requests per minute
        next(new Error("Rate limit exceeded"));
        return;
      }

      next();
    });

    // Connection logging middleware
    this.io.use((socket, next) => {
      logger.info(
        `New connection attempt from ${socket.userId} (${socket.handshake.address})`
      );
      next();
    });
  }

  // Setup main event handlers
  setupEventHandlers() {
    this.io.on("connection", (socket) => {
      this.handleConnection(socket);
    });
  }

  // Handle new socket connection
  async handleConnection(socket) {
    try {
      // Store connection info
      const userData = {
        userId: socket.userId,
        userName: socket.userName,
        socketId: socket.id,
        connectedAt: new Date(),
        isAnonymous: socket.isAnonymous,
      };

      this.connectedUsers.set(socket.id, userData);

      // Track user sockets for multi-device support
      if (!this.userSockets.has(socket.userId)) {
        this.userSockets.set(socket.userId, new Set());
      }
      this.userSockets.get(socket.userId).add(socket.id);

      // Update user presence in Redis
      await this.updateUserPresence(socket.userId, "online");

      // Send connection confirmation
      socket.emit("connected", {
        userId: socket.userId,
        userName: socket.userName,
        socketId: socket.id,
        serverTime: new Date(),
      });

      logger.info(`User ${socket.userId} connected (${socket.id})`);

      // Setup event handlers for this socket
      this.setupSocketEventHandlers(socket);

      // Handle disconnection
      socket.on("disconnect", () => {
        this.handleDisconnection(socket);
      });

      // Handle errors
      socket.on("error", (error) => {
        logger.error(`Socket error for user ${socket.userId}:`, error);
      });
    } catch (error) {
      logger.error("Error handling connection:", error);
      socket.emit("error", { message: "Connection failed" });
    }
  }

  // Setup event handlers for individual socket
  setupSocketEventHandlers(socket) {
    // Chat events
    socket.on("message", (data) => {
      this.chatHandler.handleMessage(socket, {
        ...data,
        userId: socket.userId,
      });
    });

    socket.on("editMessage", (data) => {
      this.chatHandler.handleEditMessage(socket, {
        ...data,
        userId: socket.userId,
      });
    });

    socket.on("deleteMessage", (data) => {
      this.chatHandler.handleDeleteMessage(socket, {
        ...data,
        userId: socket.userId,
      });
    });

    socket.on("createConversation", (data) => {
      this.chatHandler.handleCreateConversation(socket, {
        ...data,
        userId: socket.userId,
      });
    });

    socket.on("joinConversation", (data) => {
      this.chatHandler.handleJoinConversation(socket, {
        ...data,
        userId: socket.userId,
      });
      this.typingHandler.handleJoinConversation(socket, {
        ...data,
        userId: socket.userId,
      });
    });

    socket.on("leaveConversation", (data) => {
      this.chatHandler.handleLeaveConversation(socket, {
        ...data,
        userId: socket.userId,
      });
    });

    socket.on("messageDelivered", (data) => {
      this.chatHandler.handleMessageDelivered(socket, {
        ...data,
        userId: socket.userId,
      });
    });

    socket.on("messageRead", (data) => {
      this.chatHandler.handleMessageRead(socket, {
        ...data,
        userId: socket.userId,
      });
    });

    // Typing events
    socket.on("typingStart", (data) => {
      this.typingHandler.handleTypingStart(socket, {
        ...data,
        userId: socket.userId,
        userName: socket.userName,
      });
    });

    socket.on("typingStop", (data) => {
      this.typingHandler.handleTypingStop(socket, {
        ...data,
        userId: socket.userId,
      });
    });

    socket.on("getTypingUsers", (data) => {
      this.typingHandler.handleGetTypingUsers(socket, data);
    });

    socket.on("typingHeartbeat", (data) => {
      this.typingHandler.handleTypingHeartbeat(socket, {
        ...data,
        userId: socket.userId,
      });
    });

    socket.on("bulkTypingStatus", (data) => {
      this.typingHandler.handleBulkTypingStatus(socket, {
        ...data,
        userId: socket.userId,
      });
    });

    // Presence events
    socket.on("updatePresence", (data) => {
      this.handleUpdatePresence(socket, data);
    });

    socket.on("getUserPresence", (data) => {
      this.handleGetUserPresence(socket, data);
    });

    socket.on("getOnlineUsers", (data) => {
      this.handleGetOnlineUsers(socket, data);
    });

    // Utility events
    socket.on("ping", () => {
      socket.emit("pong", { timestamp: new Date() });
    });

    socket.on("getServerInfo", () => {
      socket.emit("serverInfo", {
        version: process.env.npm_package_version || "1.0.0",
        uptime: process.uptime(),
        connectedUsers: this.connectedUsers.size,
        timestamp: new Date(),
      });
    });

    // Room management
    socket.on("joinRoom", (data) => {
      this.handleJoinRoom(socket, data);
    });

    socket.on("leaveRoom", (data) => {
      this.handleLeaveRoom(socket, data);
    });

    socket.on("getRoomUsers", (data) => {
      this.handleGetRoomUsers(socket, data);
    });
  }

  // Handle socket disconnection
  async handleDisconnection(socket) {
    try {
      const userData = this.connectedUsers.get(socket.id);
      if (!userData) return;

      // Clean up typing status
      await this.typingHandler.handleUserDisconnect(socket, userData.userId);

      // Remove from connected users
      this.connectedUsers.delete(socket.id);

      // Update user sockets tracking
      if (this.userSockets.has(userData.userId)) {
        this.userSockets.get(userData.userId).delete(socket.id);

        // If no more sockets for this user, mark as offline
        if (this.userSockets.get(userData.userId).size === 0) {
          this.userSockets.delete(userData.userId);
          await this.updateUserPresence(userData.userId, "offline");
        }
      }

      // Clean up session
      await this.redis.del(`session:${userData.userId}`);

      logger.info(`User ${userData.userId} disconnected (${socket.id})`);
    } catch (error) {
      logger.error("Error handling disconnection:", error);
    }
  }

  // Handle presence updates
  async handleUpdatePresence(socket, data) {
    try {
      const { status, customMessage } = data;
      const validStatuses = ["online", "away", "busy", "offline"];

      if (!validStatuses.includes(status)) {
        socket.emit("error", { message: "Invalid presence status" });
        return;
      }

      await this.updateUserPresence(socket.userId, status, customMessage);

      // Broadcast presence update to relevant users
      this.io.emit("userPresenceUpdate", {
        userId: socket.userId,
        userName: socket.userName,
        status,
        customMessage,
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error("Error updating presence:", error);
      socket.emit("error", { message: "Failed to update presence" });
    }
  }

  // Get user presence
  async handleGetUserPresence(socket, data) {
    try {
      const { userId } = data;
      const presence = await this.redis.hgetall(`presence:${userId}`);

      socket.emit("userPresence", {
        userId,
        presence: presence || { status: "offline" },
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error("Error getting user presence:", error);
      socket.emit("error", { message: "Failed to get user presence" });
    }
  }

  // Get online users
  async handleGetOnlineUsers(socket, data) {
    try {
      const onlineUsers = [];

      for (const [userId, sockets] of this.userSockets) {
        if (sockets.size > 0) {
          const presence = await this.redis.hgetall(`presence:${userId}`);
          const userData = this.connectedUsers.get(Array.from(sockets)[0]);

          onlineUsers.push({
            userId,
            userName: userData?.userName || `User ${userId}`,
            status: presence?.status || "online",
            customMessage: presence?.customMessage,
            connectedAt: userData?.connectedAt,
          });
        }
      }

      socket.emit("onlineUsers", {
        users: onlineUsers,
        count: onlineUsers.length,
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error("Error getting online users:", error);
      socket.emit("error", { message: "Failed to get online users" });
    }
  }

  // Handle room joining
  handleJoinRoom(socket, data) {
    try {
      const { roomId, roomType } = data;

      if (!roomId) {
        socket.emit("error", { message: "Room ID required" });
        return;
      }

      socket.join(roomId);

      // Notify room members
      socket.to(roomId).emit("userJoinedRoom", {
        userId: socket.userId,
        userName: socket.userName,
        roomId,
        roomType,
        timestamp: new Date(),
      });

      socket.emit("roomJoined", {
        roomId,
        roomType,
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error("Error joining room:", error);
      socket.emit("error", { message: "Failed to join room" });
    }
  }

  // Handle room leaving
  handleLeaveRoom(socket, data) {
    try {
      const { roomId } = data;

      if (!roomId) {
        socket.emit("error", { message: "Room ID required" });
        return;
      }

      socket.leave(roomId);

      // Notify room members
      socket.to(roomId).emit("userLeftRoom", {
        userId: socket.userId,
        userName: socket.userName,
        roomId,
        timestamp: new Date(),
      });

      socket.emit("roomLeft", {
        roomId,
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error("Error leaving room:", error);
      socket.emit("error", { message: "Failed to leave room" });
    }
  }

  // Get room users
  async handleGetRoomUsers(socket, data) {
    try {
      const { roomId } = data;

      if (!roomId) {
        socket.emit("error", { message: "Room ID required" });
        return;
      }

      const socketsInRoom = await this.io.in(roomId).fetchSockets();
      const roomUsers = [];

      for (const roomSocket of socketsInRoom) {
        const userData = this.connectedUsers.get(roomSocket.id);
        if (userData) {
          roomUsers.push({
            userId: userData.userId,
            userName: userData.userName,
            socketId: roomSocket.id,
            connectedAt: userData.connectedAt,
          });
        }
      }

      socket.emit("roomUsers", {
        roomId,
        users: roomUsers,
        count: roomUsers.length,
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error("Error getting room users:", error);
      socket.emit("error", { message: "Failed to get room users" });
    }
  }

  // Update user presence in Redis
  async updateUserPresence(userId, status, customMessage = null) {
    try {
      const presenceData = {
        status,
        lastSeen: new Date().toISOString(),
        ...(customMessage && { customMessage }),
      };

      await this.redis.hmset(`presence:${userId}`, presenceData);
      await this.redis.expire(`presence:${userId}`, 300); // 5 minutes
    } catch (error) {
      logger.error("Error updating user presence:", error);
    }
  }

  // Setup cleanup processes
  setupCleanup() {
    // Initialize typing cleanup
    this.typingHandler.initializeCleanup();

    // Cleanup expired sessions every 10 minutes
    setInterval(async () => {
      try {
        const sessionKeys = await this.redis.keys("session:*");
        for (const key of sessionKeys) {
          const ttl = await this.redis.ttl(key);
          if (ttl === -1) {
            await this.redis.del(key);
          }
        }
      } catch (error) {
        logger.error("Error cleaning up sessions:", error);
      }
    }, 600000);

    // Cleanup expired presence every 5 minutes
    setInterval(async () => {
      try {
        const presenceKeys = await this.redis.keys("presence:*");
        for (const key of presenceKeys) {
          const ttl = await this.redis.ttl(key);
          if (ttl === -1) {
            await this.redis.del(key);
          }
        }
      } catch (error) {
        logger.error("Error cleaning up presence:", error);
      }
    }, 300000);
  }

  // Get connection statistics
  getStats() {
    return {
      connectedUsers: this.connectedUsers.size,
      uniqueUsers: this.userSockets.size,
      totalSockets: this.io.sockets.sockets.size,
      rooms: this.io.sockets.adapter.rooms.size,
      uptime: process.uptime(),
    };
  }

  // Graceful shutdown
  async shutdown() {
    try {
      logger.info("Shutting down Socket.IO server...");

      // Notify all connected users
      this.io.emit("serverShutdown", {
        message: "Server is shutting down",
        timestamp: new Date(),
      });

      // Close all connections
      this.io.close();

      // Clean up Redis keys
      const sessionKeys = await this.redis.keys("session:*");
      if (sessionKeys.length > 0) {
        await this.redis.del(...sessionKeys);
      }

      logger.info("Socket.IO server shut down complete");
    } catch (error) {
      logger.error("Error during shutdown:", error);
    }
  }
}

module.exports = SocketManager;
