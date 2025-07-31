import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { io } from "socket.io-client";
import { useChat } from "./ChatContext";

// Create context
const SocketContext = createContext();

// Socket connection configuration
const SOCKET_CONFIG = {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
  forceNew: true,
};

// Socket events
export const SOCKET_EVENTS = {
  // Connection events
  CONNECT: "connect",
  DISCONNECT: "disconnect",
  CONNECT_ERROR: "connect_error",
  RECONNECT: "reconnect",
  RECONNECT_ATTEMPT: "reconnect_attempt",
  RECONNECT_ERROR: "reconnect_error",
  RECONNECT_FAILED: "reconnect_failed",

  // Chat events
  JOIN_CONVERSATION: "join_conversation",
  LEAVE_CONVERSATION: "leave_conversation",
  NEW_MESSAGE: "new_message",
  MESSAGE_SENT: "message_sent",
  MESSAGE_DELIVERED: "message_delivered",
  MESSAGE_READ: "message_read",
  MESSAGE_ERROR: "message_error",

  // Typing events
  TYPING_START: "typing_start",
  TYPING_STOP: "typing_stop",
  USER_TYPING: "user_typing",

  // Presence events
  USER_ONLINE: "user_online",
  USER_OFFLINE: "user_offline",
  USER_STATUS: "user_status",

  // Real-time updates
  CONVERSATION_UPDATED: "conversation_updated",
  CONVERSATION_DELETED: "conversation_deleted",

  // System events
  ERROR: "error",
  NOTIFICATION: "notification",
};

// Context provider component
export const SocketProvider = ({ children }) => {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [typingUsers, setTypingUsers] = useState({});
  const [onlineUsers, setOnlineUsers] = useState(new Set());

  const chatContext = useChat();
  const typingTimeoutRef = useRef({});

  // Initialize socket connection
  const initializeSocket = () => {
    const serverURL =
      import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

    socketRef.current = io(serverURL, {
      ...SOCKET_CONFIG,
      withCredentials: true,
      transportOptions: {
        polling: {
          extraHeaders: {
            "Access-Control-Allow-Origin": "*",
          },
        },
      },
    });

    setupSocketListeners();
  };

  // Setup all socket event listeners
  const setupSocketListeners = () => {
    const socket = socketRef.current;
    if (!socket) return;

    // Connection events
    socket.on(SOCKET_EVENTS.CONNECT, () => {
      console.log("Socket connected:", socket.id);
      setIsConnected(true);
      setConnectionError(null);
      setReconnectAttempt(0);
      chatContext.setConnectionStatus("connected");
    });

    socket.on(SOCKET_EVENTS.DISCONNECT, (reason) => {
      console.log("Socket disconnected:", reason);
      setIsConnected(false);
      chatContext.setConnectionStatus("disconnected");

      if (reason === "io server disconnect") {
        // Server initiated disconnect, reconnect manually
        socket.connect();
      }
    });

    socket.on(SOCKET_EVENTS.CONNECT_ERROR, (error) => {
      console.error("Socket connection error:", error);
      setConnectionError(error.message);
      chatContext.setConnectionStatus("error");
    });

    socket.on(SOCKET_EVENTS.RECONNECT_ATTEMPT, (attemptNumber) => {
      console.log("Reconnection attempt:", attemptNumber);
      setReconnectAttempt(attemptNumber);
      chatContext.setConnectionStatus("reconnecting");
    });

    socket.on(SOCKET_EVENTS.RECONNECT, (attemptNumber) => {
      console.log("Socket reconnected after", attemptNumber, "attempts");
      setIsConnected(true);
      setConnectionError(null);
      setReconnectAttempt(0);
      chatContext.setConnectionStatus("connected");
    });

    socket.on(SOCKET_EVENTS.RECONNECT_FAILED, () => {
      console.error("Socket reconnection failed");
      setConnectionError("Failed to reconnect to server");
      chatContext.setConnectionStatus("failed");
    });

    // Chat message events
    socket.on(SOCKET_EVENTS.NEW_MESSAGE, (message) => {
      console.log("New message received:", message);
      chatContext.addMessage(message);

      // Update conversation's last message
      if (message.conversationId) {
        chatContext.updateConversation({
          _id: message.conversationId,
          lastMessage: message,
          updatedAt: message.timestamp,
        });
      }
    });

    socket.on(SOCKET_EVENTS.MESSAGE_SENT, (data) => {
      console.log("Message sent confirmation:", data);
      chatContext.setMessageStatus(data.messageId, "sent");
    });

    socket.on(SOCKET_EVENTS.MESSAGE_DELIVERED, (data) => {
      console.log("Message delivered:", data);
      chatContext.setMessageStatus(data.messageId, "delivered");
    });

    socket.on(SOCKET_EVENTS.MESSAGE_READ, (data) => {
      console.log("Message read:", data);
      chatContext.setMessageStatus(data.messageId, "read");
    });

    socket.on(SOCKET_EVENTS.MESSAGE_ERROR, (data) => {
      console.error("Message error:", data);
      chatContext.setMessageStatus(data.messageId, "failed");
      chatContext.setError(data.error);
    });

    // Typing events
    socket.on(SOCKET_EVENTS.USER_TYPING, (data) => {
      const { userId, conversationId, isTyping } = data;

      setTypingUsers((prev) => {
        const key = `${conversationId}-${userId}`;
        const updated = { ...prev };

        if (isTyping) {
          updated[key] = {
            userId,
            conversationId,
            timestamp: Date.now(),
          };

          // Clear existing timeout
          if (typingTimeoutRef.current[key]) {
            clearTimeout(typingTimeoutRef.current[key]);
          }

          // Set timeout to remove typing indicator
          typingTimeoutRef.current[key] = setTimeout(() => {
            setTypingUsers((current) => {
              const newState = { ...current };
              delete newState[key];
              return newState;
            });
            delete typingTimeoutRef.current[key];
          }, 5000);
        } else {
          delete updated[key];
          if (typingTimeoutRef.current[key]) {
            clearTimeout(typingTimeoutRef.current[key]);
            delete typingTimeoutRef.current[key];
          }
        }

        return updated;
      });
    });

    // Presence events
    socket.on(SOCKET_EVENTS.USER_ONLINE, (userId) => {
      setOnlineUsers((prev) => new Set([...prev, userId]));
    });

    socket.on(SOCKET_EVENTS.USER_OFFLINE, (userId) => {
      setOnlineUsers((prev) => {
        const updated = new Set(prev);
        updated.delete(userId);
        return updated;
      });
    });

    socket.on(SOCKET_EVENTS.USER_STATUS, (data) => {
      const { onlineUsers: users } = data;
      setOnlineUsers(new Set(users));
    });

    // Conversation events
    socket.on(SOCKET_EVENTS.CONVERSATION_UPDATED, (conversation) => {
      console.log("Conversation updated:", conversation);
      chatContext.updateConversation(conversation);
    });

    socket.on(SOCKET_EVENTS.CONVERSATION_DELETED, (conversationId) => {
      console.log("Conversation deleted:", conversationId);
      chatContext.deleteConversation(conversationId);
    });

    // Error and notification events
    socket.on(SOCKET_EVENTS.ERROR, (error) => {
      console.error("Socket error:", error);
      chatContext.setError(error.message || "Socket error occurred");
    });

    socket.on(SOCKET_EVENTS.NOTIFICATION, (notification) => {
      console.log("Socket notification:", notification);
      // Handle notifications (could integrate with a notification system)
    });
  };

  // Socket action methods
  const socketActions = {
    connect: () => {
      if (socketRef.current && !isConnected) {
        socketRef.current.connect();
      } else if (!socketRef.current) {
        initializeSocket();
        socketRef.current.connect();
      }
    },

    disconnect: () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    },

    joinConversation: (conversationId) => {
      if (socketRef.current && isConnected) {
        socketRef.current.emit(SOCKET_EVENTS.JOIN_CONVERSATION, {
          conversationId,
        });
      }
    },

    leaveConversation: (conversationId) => {
      if (socketRef.current && isConnected) {
        socketRef.current.emit(SOCKET_EVENTS.LEAVE_CONVERSATION, {
          conversationId,
        });
      }
    },

    sendMessage: (message, conversationId) => {
      if (socketRef.current && isConnected) {
        socketRef.current.emit(SOCKET_EVENTS.NEW_MESSAGE, {
          ...message,
          conversationId,
          timestamp: new Date().toISOString(),
        });
      }
    },

    startTyping: (conversationId) => {
      if (socketRef.current && isConnected) {
        socketRef.current.emit(SOCKET_EVENTS.TYPING_START, { conversationId });
      }
    },

    stopTyping: (conversationId) => {
      if (socketRef.current && isConnected) {
        socketRef.current.emit(SOCKET_EVENTS.TYPING_STOP, { conversationId });
      }
    },

    markMessageDelivered: (messageId) => {
      if (socketRef.current && isConnected) {
        socketRef.current.emit(SOCKET_EVENTS.MESSAGE_DELIVERED, { messageId });
      }
    },

    markMessageRead: (messageId) => {
      if (socketRef.current && isConnected) {
        socketRef.current.emit(SOCKET_EVENTS.MESSAGE_READ, { messageId });
      }
    },

    emit: (event, data) => {
      if (socketRef.current && isConnected) {
        socketRef.current.emit(event, data);
      }
    },

    on: (event, callback) => {
      if (socketRef.current) {
        socketRef.current.on(event, callback);
      }
    },

    off: (event, callback) => {
      if (socketRef.current) {
        socketRef.current.off(event, callback);
      }
    },
  };

  // Helper functions
  const getTypingUsers = (conversationId) => {
    return Object.values(typingUsers).filter(
      (typing) => typing.conversationId === conversationId
    );
  };

  const isUserOnline = (userId) => {
    return onlineUsers.has(userId);
  };

  const getConnectionStatus = () => {
    if (isConnected) return "connected";
    if (connectionError) return "error";
    if (reconnectAttempt > 0) return "reconnecting";
    return "disconnected";
  };

  // Initialize socket on mount
  useEffect(() => {
    initializeSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      // Clear all typing timeouts
      Object.values(typingTimeoutRef.current).forEach((timeout) => {
        clearTimeout(timeout);
      });
    };
  }, []);

  // Auto-connect when chat context is ready
  useEffect(() => {
    if (chatContext && !isConnected && socketRef.current) {
      socketActions.connect();
    }
  }, [chatContext, isConnected]);

  const value = {
    socket: socketRef.current,
    isConnected,
    connectionError,
    reconnectAttempt,
    typingUsers,
    onlineUsers,
    ...socketActions,
    getTypingUsers,
    isUserOnline,
    getConnectionStatus,
    SOCKET_EVENTS,
  };

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
};

// Custom hook to use socket context
export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
};

export default SocketContext;
