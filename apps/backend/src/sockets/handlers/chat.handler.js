const Message = require("../../models/Message.model");
const Conversation = require("../../models/Conversation.model");
const openRouterService = require("../../services/openrouter.service");
const knowledgeService = require("../../services/knowledge.service");
const cacheService = require("../../services/cache.service");
const logger = require("../../utils/logger");

class ChatHandler {
  constructor(io, redis) {
    this.io = io;
    this.redis = redis;
  }

  // Handle new message from user
  async handleMessage(socket, data) {
    try {
      const { conversationId, content, userId } = data;

      // Validate input
      if (!content || !content.trim()) {
        socket.emit("error", { message: "Message content is required" });
        return;
      }

      // Create user message
      const userMessage = new Message({
        conversationId,
        content: content.trim(),
        sender: "user",
        userId,
        timestamp: new Date(),
      });

      await userMessage.save();

      // Emit user message to all clients in conversation
      this.io.to(conversationId).emit("message", {
        id: userMessage._id,
        content: userMessage.content,
        sender: "user",
        timestamp: userMessage.timestamp,
        conversationId,
      });

      // Update conversation last activity
      await Conversation.findByIdAndUpdate(conversationId, {
        lastActivity: new Date(),
        lastMessage: content.trim(),
      });

      // Get conversation context for AI response
      const context = await this.getConversationContext(conversationId);

      // Get relevant knowledge if available
      const relevantKnowledge = await knowledgeService.searchRelevantContent(
        content
      );

      // Generate AI response
      await this.generateAIResponse(
        conversationId,
        context,
        relevantKnowledge,
        userId
      );
    } catch (error) {
      logger.error("Error handling message:", error);
      socket.emit("error", { message: "Failed to process message" });
    }
  }

  // Generate AI response
  async generateAIResponse(conversationId, context, relevantKnowledge, userId) {
    try {
      // Emit typing indicator
      this.io.to(conversationId).emit("typing", {
        sender: "assistant",
        isTyping: true,
      });

      // Prepare context for AI
      const systemPrompt = this.buildSystemPrompt(relevantKnowledge);
      const messages = this.formatMessagesForAI(context, systemPrompt);

      // Get AI response using streaming
      const aiResponse = await openRouterService.generateResponse(messages, {
        stream: true,
        onChunk: (chunk) => {
          // Emit streaming response
          this.io.to(conversationId).emit("messageChunk", {
            conversationId,
            chunk,
            sender: "assistant",
          });
        },
      });

      // Stop typing indicator
      this.io.to(conversationId).emit("typing", {
        sender: "assistant",
        isTyping: false,
      });

      // Save AI message to database
      const aiMessage = new Message({
        conversationId,
        content: aiResponse,
        sender: "assistant",
        timestamp: new Date(),
        metadata: {
          knowledgeUsed: relevantKnowledge.length > 0,
          sources: relevantKnowledge.map((k) => k.source),
        },
      });

      await aiMessage.save();

      // Emit complete AI message
      this.io.to(conversationId).emit("message", {
        id: aiMessage._id,
        content: aiMessage.content,
        sender: "assistant",
        timestamp: aiMessage.timestamp,
        conversationId,
        metadata: aiMessage.metadata,
      });

      // Update conversation
      await Conversation.findByIdAndUpdate(conversationId, {
        lastActivity: new Date(),
        lastMessage: aiResponse.substring(0, 100) + "...",
      });
    } catch (error) {
      logger.error("Error generating AI response:", error);

      // Stop typing indicator
      this.io.to(conversationId).emit("typing", {
        sender: "assistant",
        isTyping: false,
      });

      // Send error message
      this.io.to(conversationId).emit("error", {
        message: "Failed to generate response",
      });
    }
  }

  // Get conversation context
  async getConversationContext(conversationId) {
    try {
      // Check cache first
      const cachedContext = await cacheService.get(`context:${conversationId}`);
      if (cachedContext) {
        return JSON.parse(cachedContext);
      }

      // Get recent messages from database
      const messages = await Message.find({ conversationId })
        .sort({ timestamp: -1 })
        .limit(20)
        .lean();

      // Reverse to get chronological order
      const context = messages.reverse();

      // Cache for 5 minutes
      await cacheService.set(
        `context:${conversationId}`,
        JSON.stringify(context),
        300
      );

      return context;
    } catch (error) {
      logger.error("Error getting conversation context:", error);
      return [];
    }
  }

  // Build system prompt with knowledge
  buildSystemPrompt(relevantKnowledge) {
    let systemPrompt = `You are a helpful AI assistant. Be concise, accurate, and helpful.`;

    if (relevantKnowledge.length > 0) {
      systemPrompt += `\n\nRelevant knowledge base information:\n`;
      relevantKnowledge.forEach((knowledge, index) => {
        systemPrompt += `${index + 1}. ${knowledge.content}\n`;
      });
      systemPrompt += `\nUse this information to provide accurate and helpful responses.`;
    }

    return systemPrompt;
  }

  // Format messages for AI API
  formatMessagesForAI(context, systemPrompt) {
    const messages = [{ role: "system", content: systemPrompt }];

    // Add conversation history
    context.forEach((msg) => {
      messages.push({
        role: msg.sender === "user" ? "user" : "assistant",
        content: msg.content,
      });
    });

    return messages;
  }

  // Handle message editing
  async handleEditMessage(socket, data) {
    try {
      const { messageId, newContent, userId } = data;

      // Find and update message
      const message = await Message.findById(messageId);
      if (!message) {
        socket.emit("error", { message: "Message not found" });
        return;
      }

      // Check permissions (if implementing user auth)
      if (message.userId !== userId) {
        socket.emit("error", { message: "Unauthorized" });
        return;
      }

      // Update message
      message.content = newContent;
      message.editedAt = new Date();
      await message.save();

      // Emit updated message
      this.io.to(message.conversationId).emit("messageUpdated", {
        id: message._id,
        content: message.content,
        editedAt: message.editedAt,
        conversationId: message.conversationId,
      });
    } catch (error) {
      logger.error("Error editing message:", error);
      socket.emit("error", { message: "Failed to edit message" });
    }
  }

  // Handle message deletion
  async handleDeleteMessage(socket, data) {
    try {
      const { messageId, userId } = data;

      // Find message
      const message = await Message.findById(messageId);
      if (!message) {
        socket.emit("error", { message: "Message not found" });
        return;
      }

      // Check permissions
      if (message.userId !== userId) {
        socket.emit("error", { message: "Unauthorized" });
        return;
      }

      // Soft delete message
      message.isDeleted = true;
      message.deletedAt = new Date();
      await message.save();

      // Emit message deletion
      this.io.to(message.conversationId).emit("messageDeleted", {
        id: message._id,
        conversationId: message.conversationId,
      });
    } catch (error) {
      logger.error("Error deleting message:", error);
      socket.emit("error", { message: "Failed to delete message" });
    }
  }

  // Handle conversation creation
  async handleCreateConversation(socket, data) {
    try {
      const { title, userId } = data;

      const conversation = new Conversation({
        title: title || "New Conversation",
        userId,
        createdAt: new Date(),
        lastActivity: new Date(),
      });

      await conversation.save();

      // Join conversation room
      socket.join(conversation._id.toString());

      // Emit conversation created
      socket.emit("conversationCreated", {
        id: conversation._id,
        title: conversation.title,
        createdAt: conversation.createdAt,
      });
    } catch (error) {
      logger.error("Error creating conversation:", error);
      socket.emit("error", { message: "Failed to create conversation" });
    }
  }

  // Handle joining conversation
  async handleJoinConversation(socket, data) {
    try {
      const { conversationId, userId } = data;

      // Verify conversation exists
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        socket.emit("error", { message: "Conversation not found" });
        return;
      }

      // Join conversation room
      socket.join(conversationId);

      // Load conversation history
      const messages = await Message.find({
        conversationId,
        isDeleted: { $ne: true },
      })
        .sort({ timestamp: 1 })
        .limit(50)
        .lean();

      // Send conversation history
      socket.emit("conversationHistory", {
        conversationId,
        messages: messages.map((msg) => ({
          id: msg._id,
          content: msg.content,
          sender: msg.sender,
          timestamp: msg.timestamp,
          metadata: msg.metadata,
        })),
      });

      // Emit user joined
      socket.to(conversationId).emit("userJoined", {
        userId,
        conversationId,
      });
    } catch (error) {
      logger.error("Error joining conversation:", error);
      socket.emit("error", { message: "Failed to join conversation" });
    }
  }

  // Handle leaving conversation
  handleLeaveConversation(socket, data) {
    try {
      const { conversationId, userId } = data;

      // Leave conversation room
      socket.leave(conversationId);

      // Emit user left
      socket.to(conversationId).emit("userLeft", {
        userId,
        conversationId,
      });
    } catch (error) {
      logger.error("Error leaving conversation:", error);
      socket.emit("error", { message: "Failed to leave conversation" });
    }
  }

  // Handle message delivery confirmation
  async handleMessageDelivered(socket, data) {
    try {
      const { messageId, userId } = data;

      // Update message delivery status
      await Message.findByIdAndUpdate(messageId, {
        $addToSet: { deliveredTo: userId },
        deliveredAt: new Date(),
      });

      // Emit delivery confirmation
      socket.to(data.conversationId).emit("messageDelivered", {
        messageId,
        userId,
        deliveredAt: new Date(),
      });
    } catch (error) {
      logger.error("Error handling message delivery:", error);
    }
  }

  // Handle message read confirmation
  async handleMessageRead(socket, data) {
    try {
      const { messageId, userId } = data;

      // Update message read status
      await Message.findByIdAndUpdate(messageId, {
        $addToSet: { readBy: userId },
        readAt: new Date(),
      });

      // Emit read confirmation
      socket.to(data.conversationId).emit("messageRead", {
        messageId,
        userId,
        readAt: new Date(),
      });
    } catch (error) {
      logger.error("Error handling message read:", error);
    }
  }
}

module.exports = ChatHandler;
