import api, { crud, apiUtils, APIError } from './api.js';

/**
 * Chat service for managing conversations and messages
 */
export class ChatService {
  constructor() {
    this.baseEndpoint = '/chat';
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  // Cache management
  _getCacheKey(method, params) {
    return `${method}_${JSON.stringify(params)}`;
  }

  _setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  _getCache(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  _clearCache() {
    this.cache.clear();
  }

  // Get all conversations
  async getConversations(params = {}) {
    try {
      const cacheKey = this._getCacheKey('conversations', params);
      const cached = this._getCache(cacheKey);
      
      if (cached) {
        return cached;
      }

      const response = await crud.get(`${this.baseEndpoint}/conversations`, params);
      
      this._setCache(cacheKey, response);
      return response;
    } catch (error) {
      console.error('Error fetching conversations:', error);
      throw new APIError('Failed to fetch conversations', error.status, error.data);
    }
  }

  // Get single conversation
  async getConversation(conversationId) {
    try {
      if (!conversationId) {
        throw new APIError('Conversation ID is required', 400);
      }

      const cacheKey = this._getCacheKey('conversation', { id: conversationId });
      const cached = this._getCache(cacheKey);
      
      if (cached) {
        return cached;
      }

      const response = await crud.get(`${this.baseEndpoint}/conversations/${conversationId}`);
      
      this._setCache(cacheKey, response);
      return response;
    } catch (error) {
      console.error('Error fetching conversation:', error);
      throw new APIError('Failed to fetch conversation', error.status, error.data);
    }
  }

  // Create new conversation
  async createConversation(data = {}) {
    try {
      const payload = {
        title: data.title || 'New Conversation',
        metadata: data.metadata || {},
        ...data,
      };

      const response = await crud.post(`${this.baseEndpoint}/conversations`, payload);
      
      // Clear conversations cache
      this._clearCache();
      
      return response;
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw new APIError('Failed to create conversation', error.status, error.data);
    }
  }

  // Update conversation
  async updateConversation(conversationId, data) {
    try {
      if (!conversationId) {
        throw new APIError('Conversation ID is required', 400);
      }

      const response = await crud.put(`${this.baseEndpoint}/conversations/${conversationId}`, data);
      
      // Clear related caches
      this._clearCache();
      
      return response;
    } catch (error) {
      console.error('Error updating conversation:', error);
      throw new APIError('Failed to update conversation', error.status, error.data);
    }
  }

  // Delete conversation
  async deleteConversation(conversationId) {
    try {
      if (!conversationId) {
        throw new APIError('Conversation ID is required', 400);
      }

      const response = await crud.delete(`${this.baseEndpoint}/conversations/${conversationId}`);
      
      // Clear caches
      this._clearCache();
      
      return response;
    } catch (error) {
      console.error('Error deleting conversation:', error);
      throw new APIError('Failed to delete conversation', error.status, error.data);
    }
  }

  // Get messages for a conversation
  async getMessages(conversationId, params = {}) {
    try {
      if (!conversationId) {
        throw new APIError('Conversation ID is required', 400);
      }

      const queryParams = {
        limit: params.limit || 50,
        offset: params.offset || 0,
        sortBy: params.sortBy || 'timestamp',
        sortOrder: params.sortOrder || 'desc',
        ...params,
      };

      const cacheKey = this._getCacheKey('messages', { conversationId, ...queryParams });
      const cached = this._getCache(cacheKey);
      
      if (cached) {
        return cached;
      }

      const response = await crud.get(
        `${this.baseEndpoint}/conversations/${conversationId}/messages`,
        queryParams
      );
      
      this._setCache(cacheKey, response);
      return response;
    } catch (error) {
      console.error('Error fetching messages:', error);
      throw new APIError('Failed to fetch messages', error.status, error.data);
    }
  }

  // Send message
  async sendMessage(conversationId, data) {
    try {
      if (!conversationId) {
        throw new APIError('Conversation ID is required', 400);
      }

      const payload = {
        content: data.content || data,
        type: data.type || 'text',
        metadata: data.metadata || {},
        attachments: data.attachments || [],
        ...(typeof data === 'object' ? data : {}),
      };

      if (!payload.content) {
        throw new APIError('Message content is required', 400);
      }

      const response = await crud.post(
        `${this.baseEndpoint}/conversations/${conversationId}/messages`,
        payload
      );
      
      // Clear messages cache for this conversation
      this._clearCache();
      
      return response;
    } catch (error) {
      console.error('Error sending message:', error);
      throw new APIError('Failed to send message', error.status, error.data);
    }
  }

  // Update message
  async updateMessage(conversationId, messageId, data) {
    try {
      if (!conversationId || !messageId) {
        throw new APIError('Conversation ID and Message ID are required', 400);
      }

      const response = await crud.put(
        `${this.baseEndpoint}/conversations/${conversationId}/messages/${messageId}`,
        data
      );
      
      // Clear messages cache
      this._clearCache();
      
      return response;
    } catch (error) {
      console.error('Error updating message:', error);
      throw new APIError('Failed to update message', error.status, error.data);
    }
  }

  // Delete message
  async deleteMessage(conversationId, messageId) {
    try {
      if (!conversationId || !messageId) {
        throw new APIError('Conversation ID and Message ID are required', 400);
      }

      const response = await crud.delete(
        `${this.baseEndpoint}/conversations/${conversationId}/messages/${messageId}`
      );
      
      // Clear messages cache
      this._clearCache();
      
      return response;
    } catch (error) {
      console.error('Error deleting message:', error);
      throw new APIError('Failed to delete message', error.status, error.data);
    }
  }

  // Search conversations
  async searchConversations(query, params = {}) {
    try {
      if (!query) {
        return { results: [], total: 0 };
      }

      const searchParams = {
        q: query,
        limit: params.limit || 20,
        offset: params.offset || 0,
        ...params,
      };

      const response = await crud.get(`${this.baseEndpoint}/search/conversations`, searchParams);
      return response;
    } catch (error) {
      console.error('Error searching conversations:', error);
      throw new APIError('Failed to search conversations', error.status, error.data);
    }
  }

  // Search messages
  async searchMessages(query, params = {}) {
    try {
      if (!query) {
        return { results: [], total: 0 };
      }

      const searchParams = {
        q: query,
        limit: params.limit || 20,
        offset: params.offset || 0,
        conversationId: params.conversationId,
        ...params,
      };

      const response = await crud.get(`${this.baseEndpoint}/search/messages`, searchParams);
      return response;
    } catch (error) {
      console.error('Error searching messages:', error);
      throw new APIError('Failed to search messages', error.status, error.data);
    }
  }

  // Get conversation statistics
  async getConversationStats(conversationId) {
    try {
      if (!conversationId) {
        throw new APIError('Conversation ID is required', 400);
      }

      const response = await crud.get(`${this.baseEndpoint}/conversations/${conversationId}/stats`);
      return response;
    } catch (error) {
      console.error('Error fetching conversation stats:', error);
      throw new APIError('Failed to fetch conversation statistics', error.status, error.data);
    }
  }

  // Mark conversation as read
  async markConversationAsRead(conversationId) {
    try {
      if (!conversationId) {
        throw new APIError('Conversation ID is required', 400);
      }

      const response = await crud.post(
        `${this.baseEndpoint}/conversations/${conversationId}/mark-read`
      );
      
      // Clear caches
      this._clearCache();
      
      return response;
    } catch (error) {
      console.error('Error marking conversation as read:', error);
      throw new APIError('Failed to mark conversation as read', error.status, error.data);
    }
  }

  // Mark message as read
  async markMessageAsRead(conversationId, messageId) {
    try {
      if (!conversationId || !messageId) {
        throw new APIError('Conversation ID and Message ID are required', 400);
      }

      const response = await crud.post(
        `${this.baseEndpoint}/conversations/${conversationId}/messages/${messageId}/mark-read`
      );
      
      return response;
    } catch (error) {
      console.error('Error marking message as read:', error);
      throw new APIError('Failed to mark message as read', error.status, error.data);
    }
  }

  // Export conversation
  async exportConversation(conversationId, format = 'json') {
    try {
      if (!conversationId) {
        throw new APIError('Conversation ID is required', 400);
      }

      const response = await apiUtils.downloadFile(
        `${this.baseEndpoint}/conversations/${conversationId}/export?format=${format}`,
        `conversation_${conversationId}.${format}`
      );
      
      return response;
    } catch (error) {
      console.error('Error exporting conversation:', error);
      throw new APIError('Failed to export conversation', error.status, error.data);
    }
  }

  // Bulk operations
  async bulkDeleteConversations(conversationIds) {
    try {
      if (!conversationIds || conversationIds.length === 0) {
        throw new APIError('Conversation IDs are required', 400);
      }

      const response = await crud.post(`${this.baseEndpoint}/conversations/bulk-delete`, {
        conversationIds,
      });
      
      // Clear caches
      this._clearCache();
      
      return response;
    } catch (error) {
      console.error('Error bulk deleting conversations:', error);
      throw new APIError('Failed to bulk delete conversations', error.status, error.data);
    }
  }

  // Bulk mark as read
  async bulkMarkAsRead(conversationIds) {
    try {
      if (!conversationIds || conversationIds.length === 0) {
        throw new APIError('Conversation IDs are required', 400);
      }

      const response = await crud.post(`${this.baseEndpoint}/conversations/bulk-mark-read`, {
        conversationIds,
      });
      
      // Clear caches
      this._clearCache();
      
      return response;
    } catch (error) {
      console.error('Error bulk marking as read:', error);
      throw new APIError('Failed to bulk mark as read', error.status, error.data);
    }
  }

  // Get typing users
  async getTypingUsers(conversationId) {
    try {
      if (!conversationId) {
        throw new APIError('Conversation ID is required', 400);
      }

      const response = await crud.get(`${this.baseEndpoint}/conversations/${conversationId}/typing`);
      return response;
    } catch (error) {
      console.error('Error fetching typing users:', error);
      throw new APIError('Failed to fetch typing users', error.status, error.data);
    }
  }

  // Generate conversation title
  async generateConversationTitle(conversationId) {
    try {
      if (!conversationId) {
        throw new APIError('Conversation ID is required', 400);
      }

      const response = await crud.post(
        `${this.baseEndpoint}/conversations/${conversationId}/generate-title`
      );
      
      // Clear caches
      this._clearCache();
      
      return response;
    } catch (error) {
      console.error('Error generating conversation title:', error);
      throw new APIError('Failed to generate conversation title', error.status, error.data);
    }
  }

  // Clear all caches
  clearCache() {
    this._clearCache();
  }
}

// Create singleton instance
const chatService = new ChatService();

// Export both the class and the instance
export { chatService };
export default chatService;