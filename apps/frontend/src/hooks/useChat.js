import { useContext, useCallback, useEffect, useMemo } from 'react';
import ChatContext from '../context/ChatContext';
import { useSocket } from './useSocket';

/**
 * Enhanced chat hook with additional utilities and Socket.IO integration
 */
export const useChat = () => {
  const context = useContext(ChatContext);
  const { joinConversation, leaveConversation, sendMessage: socketSendMessage } = useSocket();

  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }

  const {
    conversations,
    currentConversation,
    messages,
    isLoading,
    error,
    isTyping,
    connectionStatus,
    unreadCount,
    searchQuery,
    filteredConversations,
    messageStatus,
    ...actions
  } = context;

  // Enhanced send message with Socket.IO integration
  const sendMessage = useCallback(async (content, options = {}) => {
    try {
      const {
        conversationId = currentConversation?._id,
        type = 'text',
        metadata = {},
        useSocket = true,
      } = options;

      // Create temporary message for immediate UI feedback
      const tempMessage = {
        _id: `temp-${Date.now()}`,
        content,
        type,
        sender: 'user',
        timestamp: new Date().toISOString(),
        conversationId,
        metadata,
        status: 'sending',
      };

      // Add to UI immediately
      actions.addMessage(tempMessage);

      let response;
      if (useSocket && connectionStatus === 'connected') {
        // Send via Socket.IO for real-time delivery
        response = await socketSendMessage(tempMessage, conversationId);
      } else {
        // Fallback to HTTP API
        response = await actions.sendMessage(content, conversationId);
      }

      // Update with real message data
      if (response?.message) {
        actions.updateMessage({
          ...tempMessage,
          ...response.message,
          status: 'sent',
        });
      }

      return response;
    } catch (error) {
      actions.setError(error.message);
      throw error;
    }
  }, [currentConversation, connectionStatus, actions, socketSendMessage]);

  // Switch conversation with Socket.IO room management
  const switchConversation = useCallback(async (conversation) => {
    try {
      // Leave current conversation room
      if (currentConversation?._id) {
        leaveConversation(currentConversation._id);
      }

      // Set new conversation
      actions.setCurrentConversation(conversation);

      // Join new conversation room
      if (conversation?._id) {
        joinConversation(conversation._id);
        
        // Load messages for the conversation
        await actions.loadMessages(conversation._id);
      }
    } catch (error) {
      actions.setError(error.message);
    }
  }, [currentConversation, actions, joinConversation, leaveConversation]);

  // Create new conversation with auto-switch
  const createAndSwitchConversation = useCallback(async (title) => {
    try {
      const conversation = await actions.createConversation(title);
      await switchConversation(conversation);
      return conversation;
    } catch (error) {
      actions.setError(error.message);
      throw error;
    }
  }, [actions, switchConversation]);

  // Delete conversation with cleanup
  const deleteConversation = useCallback(async (conversationId) => {
    try {
      // Leave room if it's the current conversation
      if (currentConversation?._id === conversationId) {
        leaveConversation(conversationId);
        actions.setCurrentConversation(null);
        actions.clearMessages();
      }

      // Delete from state
      actions.deleteConversation(conversationId);

      // If there are other conversations, switch to the first one
      if (conversations.length > 1) {
        const remainingConversations = conversations.filter(c => c._id !== conversationId);
        if (remainingConversations.length > 0) {
          await switchConversation(remainingConversations[0]);
        }
      }
    } catch (error) {
      actions.setError(error.message);
    }
  }, [currentConversation, conversations, actions, leaveConversation, switchConversation]);

  // Search conversations
  const searchConversations = useCallback((query) => {
    actions.setSearchQuery(query);
  }, [actions]);

  // Get message by ID
  const getMessage = useCallback((messageId) => {
    return messages.find(msg => msg._id === messageId);
  }, [messages]);

  // Get messages by type
  const getMessagesByType = useCallback((type) => {
    return messages.filter(msg => msg.type === type);
  }, [messages]);

  // Get user messages
  const getUserMessages = useCallback(() => {
    return messages.filter(msg => msg.sender === 'user');
  }, [messages]);

  // Get assistant messages
  const getAssistantMessages = useCallback(() => {
    return messages.filter(msg => msg.sender === 'assistant');
  }, [messages]);

  // Get conversation statistics
  const getConversationStats = useCallback(() => {
    const stats = {
      totalMessages: messages.length,
      userMessages: getUserMessages().length,
      assistantMessages: getAssistantMessages().length,
      averageResponseTime: 0,
      lastActivity: null,
    };

    if (messages.length > 0) {
      stats.lastActivity = messages[messages.length - 1].timestamp;
      
      // Calculate average response time
      const userMessages = getUserMessages();
      const assistantMessages = getAssistantMessages();
      
      if (userMessages.length > 0 && assistantMessages.length > 0) {
        let totalResponseTime = 0;
        let responseCount = 0;
        
        for (let i = 0; i < userMessages.length; i++) {
          const userMsg = userMessages[i];
          const nextAssistantMsg = assistantMessages.find(
            aMsg => new Date(aMsg.timestamp) > new Date(userMsg.timestamp)
          );
          
          if (nextAssistantMsg) {
            const responseTime = new Date(nextAssistantMsg.timestamp) - new Date(userMsg.timestamp);
            totalResponseTime += responseTime;
            responseCount++;
          }
        }
        
        if (responseCount > 0) {
          stats.averageResponseTime = totalResponseTime / responseCount;
        }
      }
    }

    return stats;
  }, [messages, getUserMessages, getAssistantMessages]);

  // Check if conversation has unread messages
  const hasUnreadMessages = useCallback((conversationId) => {
    if (!conversationId) return false;
    
    const conversation = conversations.find(c => c._id === conversationId);
    return conversation?.unreadCount > 0;
  }, [conversations]);

  // Mark conversation as read
  const markConversationAsRead = useCallback((conversationId) => {
    if (!conversationId) return;
    
    actions.updateConversation({
      _id: conversationId,
      unreadCount: 0,
    });
    
    if (currentConversation?._id === conversationId) {
      actions.markMessagesRead();
    }
  }, [actions, currentConversation]);

  // Retry failed message
  const retryMessage = useCallback(async (messageId) => {
    const message = getMessage(messageId);
    if (!message) return;

    try {
      actions.setMessageStatus(messageId, 'sending');
      
      const response = await sendMessage(message.content, {
        conversationId: message.conversationId,
        type: message.type,
        metadata: message.metadata,
      });

      // Remove the failed message
      actions.deleteMessage(messageId);
      
      return response;
    } catch (error) {
      actions.setMessageStatus(messageId, 'failed');
      throw error;
    }
  }, [getMessage, sendMessage, actions]);

  // Memoized values
  const memoizedValues = useMemo(() => ({
    // Current conversation info
    currentConversationId: currentConversation?._id,
    currentConversationTitle: currentConversation?.title,
    isCurrentConversationEmpty: messages.length === 0,
    
    // Message counts
    totalMessages: messages.length,
    userMessageCount: getUserMessages().length,
    assistantMessageCount: getAssistantMessages().length,
    
    // Status checks
    isConnected: connectionStatus === 'connected',
    hasError: !!error,
    hasConversations: conversations.length > 0,
    hasFilteredConversations: filteredConversations.length > 0,
    
    // Search state
    isSearching: searchQuery.length > 0,
    searchResultCount: filteredConversations.length,
    
    // Conversation stats
    conversationStats: getConversationStats(),
  }), [
    currentConversation,
    messages,
    connectionStatus,
    error,
    conversations,
    filteredConversations,
    searchQuery,
    getUserMessages,
    getAssistantMessages,
    getConversationStats,
  ]);

  return {
    // State
    conversations,
    currentConversation,
    messages,
    isLoading,
    error,
    isTyping,
    connectionStatus,
    unreadCount,
    searchQuery,
    filteredConversations,
    messageStatus,
    
    // Enhanced actions
    sendMessage,
    switchConversation,
    createAndSwitchConversation,
    deleteConversation,
    searchConversations,
    markConversationAsRead,
    retryMessage,
    
    // Utility functions
    getMessage,
    getMessagesByType,
    getUserMessages,
    getAssistantMessages,
    getConversationStats,
    hasUnreadMessages,
    
    // Original actions
    ...actions,
    
    // Memoized values
    ...memoizedValues,
  };
};

export default useChat;