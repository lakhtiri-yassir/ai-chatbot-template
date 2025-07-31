import { io } from "socket.io-client";

/**
 * Socket.IO service for real-time communication
 */
export class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.listeners = new Map();
    this.connectionPromise = null;
    this.heartbeatInterval = null;
    this.lastHeartbeat = null;
  }

  // Socket configuration
  getSocketConfig() {
    return {
      transports: ["websocket", "polling"],
      upgrade: true,
      rememberUpgrade: true,
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
      reconnectionDelayMax: 10000,
      timeout: 20000,
      forceNew: false,
      withCredentials: true,
      extraHeaders: {
        "Access-Control-Allow-Origin": "*",
      },
    };
  }

  // Initialize socket connection
  async connect(serverUrl = null) {
    if (this.socket && this.isConnected) {
      return this.socket;
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    const url =
      serverUrl || import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

    this.connectionPromise = new Promise((resolve, reject) => {
      try {
        this.socket = io(url, this.getSocketConfig());
        this.setupEventListeners(resolve, reject);
        this.socket.connect();
      } catch (error) {
        this.connectionPromise = null;
        reject(error);
      }
    });

    return this.connectionPromise;
  }

  // Setup core event listeners
  setupEventListeners(resolve, reject) {
    // Connection events
    this.socket.on("connect", () => {
      console.log("🟢 Socket connected:", this.socket.id);
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.connectionPromise = null;
      this.startHeartbeat();
      resolve(this.socket);
    });

    this.socket.on("disconnect", (reason) => {
      console.log("🔴 Socket disconnected:", reason);
      this.isConnected = false;
      this.stopHeartbeat();

      // Emit custom disconnect event
      this.emit("socket:disconnect", { reason });
    });

    this.socket.on("connect_error", (error) => {
      console.error("🚨 Socket connection error:", error);
      this.isConnected = false;

      if (this.connectionPromise) {
        this.connectionPromise = null;
        reject(error);
      }

      this.emit("socket:connect_error", { error });
    });

    // Reconnection events
    this.socket.on("reconnect", (attemptNumber) => {
      console.log("🔄 Socket reconnected after", attemptNumber, "attempts");
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      this.emit("socket:reconnect", { attemptNumber });
    });

    this.socket.on("reconnect_attempt", (attemptNumber) => {
      console.log("🔄 Socket reconnection attempt:", attemptNumber);
      this.reconnectAttempts = attemptNumber;
      this.emit("socket:reconnect_attempt", { attemptNumber });
    });

    this.socket.on("reconnect_error", (error) => {
      console.error("🚨 Socket reconnection error:", error);
      this.emit("socket:reconnect_error", { error });
    });

    this.socket.on("reconnect_failed", () => {
      console.error("🚨 Socket reconnection failed");
      this.emit("socket:reconnect_failed");
    });

    // Heartbeat/ping events
    this.socket.on("pong", (latency) => {
      this.lastHeartbeat = Date.now();
      this.emit("socket:pong", { latency });
    });

    // Error handling
    this.socket.on("error", (error) => {
      console.error("🚨 Socket error:", error);
      this.emit("socket:error", { error });
    });
  }

  // Disconnect socket
  disconnect() {
    if (this.socket) {
      this.stopHeartbeat();
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.connectionPromise = null;
    }
  }

  // Start heartbeat monitoring
  startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected && this.socket) {
        this.socket.emit("ping");
      }
    }, 30000); // Every 30 seconds
  }

  // Stop heartbeat monitoring
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // Emit event to server
  emit(event, data = {}) {
    if (!this.socket || !this.isConnected) {
      console.warn("Socket not connected, cannot emit:", event);
      return false;
    }

    try {
      this.socket.emit(event, {
        ...data,
        timestamp: Date.now(),
      });
      return true;
    } catch (error) {
      console.error("Error emitting socket event:", error);
      return false;
    }
  }

  // Listen for events from server
  on(event, callback) {
    if (!this.socket) {
      console.warn("Socket not initialized, cannot listen for:", event);
      return;
    }

    // Store callback for cleanup
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);

    this.socket.on(event, callback);
  }

  // Remove event listener
  off(event, callback) {
    if (!this.socket) {
      return;
    }

    this.socket.off(event, callback);

    // Remove from listeners map
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
      if (this.listeners.get(event).size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  // Remove all listeners for an event
  removeAllListeners(event) {
    if (!this.socket) {
      return;
    }

    this.socket.removeAllListeners(event);
    this.listeners.delete(event);
  }

  // Chat-specific methods
  joinConversation(conversationId) {
    return this.emit("join_conversation", { conversationId });
  }

  leaveConversation(conversationId) {
    return this.emit("leave_conversation", { conversationId });
  }

  sendMessage(message, conversationId) {
    return this.emit("new_message", {
      ...message,
      conversationId,
    });
  }

  startTyping(conversationId) {
    return this.emit("typing_start", { conversationId });
  }

  stopTyping(conversationId) {
    return this.emit("typing_stop", { conversationId });
  }

  markMessageDelivered(messageId) {
    return this.emit("message_delivered", { messageId });
  }

  markMessageRead(messageId) {
    return this.emit("message_read", { messageId });
  }

  // Utility methods
  getConnectionStatus() {
    return {
      connected: this.isConnected,
      socketId: this.socket?.id,
      reconnectAttempts: this.reconnectAttempts,
      lastHeartbeat: this.lastHeartbeat,
    };
  }

  // Promise-based emit with timeout
  async emitWithResponse(event, data, timeout = 5000) {
    if (!this.socket || !this.isConnected) {
      throw new Error("Socket not connected");
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Socket emit timeout for event: ${event}`));
      }, timeout);

      this.socket.emit(event, data, (response) => {
        clearTimeout(timeoutId);
        if (response?.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
  }

  // Batch emit multiple events
  batchEmit(events) {
    const results = [];

    events.forEach(({ event, data }) => {
      const result = this.emit(event, data);
      results.push({ event, success: result });
    });

    return results;
  }

  // Get latency information
  async getLatency() {
    if (!this.socket || !this.isConnected) {
      return null;
    }

    return new Promise((resolve) => {
      const start = Date.now();

      this.socket.emit("ping", (response) => {
        const latency = Date.now() - start;
        resolve(latency);
      });
    });
  }

  // Reconnect manually
  async reconnect() {
    if (this.socket) {
      this.disconnect();
    }

    return this.connect();
  }

  // Check if socket is healthy
  isHealthy() {
    if (!this.isConnected || !this.socket) {
      return false;
    }

    // Check if heartbeat is recent (within last 60 seconds)
    if (this.lastHeartbeat && Date.now() - this.lastHeartbeat > 60000) {
      return false;
    }

    return true;
  }

  // Get debug information
  getDebugInfo() {
    return {
      connected: this.isConnected,
      socketId: this.socket?.id,
      reconnectAttempts: this.reconnectAttempts,
      lastHeartbeat: this.lastHeartbeat,
      activeListeners: Array.from(this.listeners.keys()),
      transport: this.socket?.io?.engine?.transport?.name,
      upgrades: this.socket?.io?.engine?.upgrades,
    };
  }

  // Cleanup method
  cleanup() {
    this.stopHeartbeat();

    // Remove all listeners
    this.listeners.forEach((callbacks, event) => {
      this.removeAllListeners(event);
    });
    this.listeners.clear();

    // Disconnect socket
    this.disconnect();
  }
}

// Create singleton instance
const socketService = new SocketService();

// Auto-cleanup on page unload
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    socketService.cleanup();
  });
}

// Export both the class and the instance
export { socketService };
export default socketService;
