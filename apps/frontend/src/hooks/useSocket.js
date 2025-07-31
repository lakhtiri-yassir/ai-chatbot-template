import { useContext, useCallback, useEffect, useRef } from "react";
import SocketContext from "../context/SocketContext";

/**
 * Enhanced socket hook with connection management and utilities
 */
export const useSocket = () => {
  const context = useContext(SocketContext);

  if (!context) {
    throw new Error("useSocket must be used within a SocketProvider");
  }

  const {
    socket,
    isConnected,
    connectionError,
    reconnectAttempt,
    typingUsers,
    onlineUsers,
    connect,
    disconnect,
    joinConversation,
    leaveConversation,
    sendMessage,
    startTyping,
    stopTyping,
    markMessageDelivered,
    markMessageRead,
    emit,
    on,
    off,
    getTypingUsers,
    isUserOnline,
    getConnectionStatus,
    SOCKET_EVENTS,
  } = context;

  // Connection management
  const ensureConnection = useCallback(() => {
    if (!isConnected) {
      connect();
    }
  }, [isConnected, connect]);

  // Safe emit that ensures connection
  const safeEmit = useCallback(
    (event, data) => {
      if (isConnected) {
        emit(event, data);
      } else {
        console.warn("Socket not connected, attempting to reconnect...");
        ensureConnection();
      }
    },
    [isConnected, emit, ensureConnection]
  );

  // Enhanced typing management
  const useTypingIndicator = (conversationId) => {
    const typingTimeoutRef = useRef(null);
    const isTypingRef = useRef(false);

    const startTypingIndicator = useCallback(() => {
      if (!conversationId || isTypingRef.current) return;

      isTypingRef.current = true;
      startTyping(conversationId);

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Auto-stop typing after 3 seconds
      typingTimeoutRef.current = setTimeout(() => {
        stopTypingIndicator();
      }, 3000);
    }, [conversationId, startTyping]);

    const stopTypingIndicator = useCallback(() => {
      if (!conversationId || !isTypingRef.current) return;

      isTypingRef.current = false;
      stopTyping(conversationId);

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    }, [conversationId, stopTyping]);

    const refreshTypingTimeout = useCallback(() => {
      if (isTypingRef.current) {
        startTypingIndicator();
      }
    }, [startTypingIndicator]);

    // Cleanup on unmount
    useEffect(() => {
      return () => {
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        if (isTypingRef.current) {
          stopTypingIndicator();
        }
      };
    }, [stopTypingIndicator]);

    return {
      startTyping: startTypingIndicator,
      stopTyping: stopTypingIndicator,
      refreshTimeout: refreshTypingTimeout,
      isTyping: isTypingRef.current,
    };
  };

  // Connection status utilities
  const getConnectionInfo = useCallback(() => {
    return {
      status: getConnectionStatus(),
      isConnected,
      hasError: !!connectionError,
      error: connectionError,
      reconnectAttempt,
      socketId: socket?.id,
    };
  }, [
    getConnectionStatus,
    isConnected,
    connectionError,
    reconnectAttempt,
    socket,
  ]);

  // Event listener management
  const useSocketEvent = (event, handler, dependencies = []) => {
    useEffect(() => {
      if (!socket) return;

      const wrappedHandler = (...args) => {
        try {
          handler(...args);
        } catch (error) {
          console.error(`Error in socket event handler for ${event}:`, error);
        }
      };

      socket.on(event, wrappedHandler);

      return () => {
        socket.off(event, wrappedHandler);
      };
    }, [socket, event, handler, ...dependencies]);
  };

  // Batch event listeners
  const useSocketEvents = (eventHandlers) => {
    useEffect(() => {
      if (!socket) return;

      const wrappedHandlers = {};

      // Add all event listeners
      Object.entries(eventHandlers).forEach(([event, handler]) => {
        const wrappedHandler = (...args) => {
          try {
            handler(...args);
          } catch (error) {
            console.error(`Error in socket event handler for ${event}:`, error);
          }
        };

        wrappedHandlers[event] = wrappedHandler;
        socket.on(event, wrappedHandler);
      });

      // Cleanup function
      return () => {
        Object.entries(wrappedHandlers).forEach(([event, handler]) => {
          socket.off(event, handler);
        });
      };
    }, [socket, eventHandlers]);
  };

  // Message delivery tracking
  const trackMessageDelivery = useCallback(
    (messageId) => {
      const timeout = setTimeout(() => {
        console.warn(`Message ${messageId} delivery timeout`);
      }, 30000); // 30 second timeout

      const handleDelivery = (data) => {
        if (data.messageId === messageId) {
          clearTimeout(timeout);
          off(SOCKET_EVENTS.MESSAGE_DELIVERED, handleDelivery);
        }
      };

      on(SOCKET_EVENTS.MESSAGE_DELIVERED, handleDelivery);

      return () => {
        clearTimeout(timeout);
        off(SOCKET_EVENTS.MESSAGE_DELIVERED, handleDelivery);
      };
    },
    [on, off, SOCKET_EVENTS]
  );

  // Enhanced message sending with delivery tracking
  const sendMessageWithTracking = useCallback(
    async (message, conversationId) => {
      return new Promise((resolve, reject) => {
        const messageId = message._id;
        const timeout = setTimeout(() => {
          reject(new Error("Message send timeout"));
        }, 10000);

        const handleSuccess = (data) => {
          if (data.messageId === messageId) {
            clearTimeout(timeout);
            off(SOCKET_EVENTS.MESSAGE_SENT, handleSuccess);
            off(SOCKET_EVENTS.MESSAGE_ERROR, handleError);
            resolve(data);
          }
        };

        const handleError = (data) => {
          if (data.messageId === messageId) {
            clearTimeout(timeout);
            off(SOCKET_EVENTS.MESSAGE_SENT, handleSuccess);
            off(SOCKET_EVENTS.MESSAGE_ERROR, handleError);
            reject(new Error(data.error || "Message send failed"));
          }
        };

        on(SOCKET_EVENTS.MESSAGE_SENT, handleSuccess);
        on(SOCKET_EVENTS.MESSAGE_ERROR, handleError);

        sendMessage(message, conversationId);
      });
    },
    [sendMessage, on, off, SOCKET_EVENTS]
  );

  // Room management utilities
  const useConversationRoom = (conversationId) => {
    const currentRoomRef = useRef(null);

    useEffect(() => {
      if (!conversationId) return;

      // Leave previous room
      if (currentRoomRef.current && currentRoomRef.current !== conversationId) {
        leaveConversation(currentRoomRef.current);
      }

      // Join new room
      if (conversationId !== currentRoomRef.current) {
        joinConversation(conversationId);
        currentRoomRef.current = conversationId;
      }

      return () => {
        if (currentRoomRef.current) {
          leaveConversation(currentRoomRef.current);
          currentRoomRef.current = null;
        }
      };
    }, [conversationId, joinConversation, leaveConversation]);

    return currentRoomRef.current;
  };

  // Presence utilities
  const getUserPresence = useCallback(
    (userId) => {
      return {
        isOnline: isUserOnline(userId),
        lastSeen: null, // Could be extended with last seen data
      };
    },
    [isUserOnline]
  );

  const getConversationPresence = useCallback(
    (conversationId) => {
      const typingInConversation = getTypingUsers(conversationId);

      return {
        typingUsers: typingInConversation,
        typingCount: typingInConversation.length,
        isAnyoneTyping: typingInConversation.length > 0,
      };
    },
    [getTypingUsers]
  );

  // Auto-reconnection with exponential backoff
  const useAutoReconnect = (maxAttempts = 5) => {
    const attemptCountRef = useRef(0);
    const reconnectTimeoutRef = useRef(null);

    useEffect(() => {
      if (connectionError && attemptCountRef.current < maxAttempts) {
        const delay = Math.min(
          1000 * Math.pow(2, attemptCountRef.current),
          30000
        );

        reconnectTimeoutRef.current = setTimeout(() => {
          attemptCountRef.current++;
          connect();
        }, delay);
      }

      if (isConnected) {
        attemptCountRef.current = 0;
      }

      return () => {
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
      };
    }, [connectionError, isConnected, maxAttempts, connect]);
  };

  // Heartbeat/ping utility
  const useHeartbeat = (interval = 30000) => {
    useEffect(() => {
      if (!isConnected) return;

      const heartbeatInterval = setInterval(() => {
        safeEmit("ping", { timestamp: Date.now() });
      }, interval);

      return () => {
        clearInterval(heartbeatInterval);
      };
    }, [isConnected, safeEmit, interval]);
  };

  return {
    // Original context values
    socket,
    isConnected,
    connectionError,
    reconnectAttempt,
    typingUsers,
    onlineUsers,

    // Original actions
    connect,
    disconnect,
    joinConversation,
    leaveConversation,
    sendMessage,
    startTyping,
    stopTyping,
    markMessageDelivered,
    markMessageRead,
    emit,
    on,
    off,
    getTypingUsers,
    isUserOnline,
    getConnectionStatus,
    SOCKET_EVENTS,

    // Enhanced utilities
    ensureConnection,
    safeEmit,
    useTypingIndicator,
    getConnectionInfo,
    useSocketEvent,
    useSocketEvents,
    trackMessageDelivery,
    sendMessageWithTracking,
    useConversationRoom,
    getUserPresence,
    getConversationPresence,
    useAutoReconnect,
    useHeartbeat,
  };
};

export default useSocket;
