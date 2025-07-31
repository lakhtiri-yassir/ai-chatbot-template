const chatService = require("../services/openrouter.service");
const knowledgeService = require("../services/knowledge.service");
const cacheService = require("../services/cache.service");
const Conversation = require("../models/Conversation.model");
const Message = require("../models/Message.model");
const logger = require("../utils/logger");

class ChatController {
  // Create new conversation
  async createConversation(req, res) {
    try {
      const { title, initialMessage } = req.body;

      const conversation = new Conversation({
        title: title || "New Conversation",
        userId: req.user?.id || "anonymous",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await conversation.save();

      // If there's an initial message, process it
      if (initialMessage) {
        const message = new Message({
          conversationId: conversation._id,
          role: "user",
          content: initialMessage,
          timestamp: new Date(),
        });

        await message.save();

        // Get AI response
        const aiResponse = await this.processMessage(
          conversation._id,
          initialMessage
        );

        return res.status(201).json({
          success: true,
          data: {
            conversation,
            initialMessage: message,
            aiResponse,
          },
        });
      }

      res.status(201).json({
        success: true,
        data: { conversation },
      });
    } catch (error) {
      logger.error("Create conversation error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to create conversation",
      });
    }
  }

  // Send message and get AI response
  async sendMessage(req, res) {
    try {
      const { conversationId } = req.params;
      const { message, useKnowledge = true } = req.body;

      if (!message || !message.trim()) {
        return res.status(400).json({
          success: false,
          error: "Message content is required",
        });
      }

      // Check if conversation exists
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: "Conversation not found",
        });
      }

      // Save user message
      const userMessage = new Message({
        conversationId,
        role: "user",
        content: message.trim(),
        timestamp: new Date(),
      });

      await userMessage.save();

      // Process message and get AI response
      const aiResponse = await this.processMessage(
        conversationId,
        message,
        useKnowledge
      );

      // Update conversation timestamp
      conversation.updatedAt = new Date();
      await conversation.save();

      res.status(200).json({
        success: true,
        data: {
          userMessage,
          aiResponse,
        },
      });
    } catch (error) {
      logger.error("Send message error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to send message",
      });
    }
  }

  // Process message with AI and knowledge base
  async processMessage(conversationId, messageContent, useKnowledge = true) {
    try {
      // Get conversation history
      const messages = await Message.find({ conversationId })
        .sort({ timestamp: 1 })
        .limit(20); // Limit to last 20 messages for context

      // Get relevant knowledge if enabled
      let knowledgeContext = "";
      if (useKnowledge) {
        const relevantChunks = await knowledgeService.searchRelevantChunks(
          messageContent
        );
        if (relevantChunks.length > 0) {
          knowledgeContext = relevantChunks
            .map((chunk) => chunk.content)
            .join("\n\n");
        }
      }

      // Build context for AI
      const systemPrompt = this.buildSystemPrompt(knowledgeContext);
      const conversationHistory = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      // Add current message
      conversationHistory.push({
        role: "user",
        content: messageContent,
      });

      // Get AI response
      const aiResponse = await chatService.getChatCompletion([
        { role: "system", content: systemPrompt },
        ...conversationHistory,
      ]);

      // Save AI response
      const aiMessage = new Message({
        conversationId,
        role: "assistant",
        content: aiResponse.content,
        timestamp: new Date(),
        metadata: {
          model: aiResponse.model,
          tokensUsed: aiResponse.usage?.total_tokens,
          knowledgeUsed: useKnowledge && knowledgeContext.length > 0,
        },
      });

      await aiMessage.save();

      return aiMessage;
    } catch (error) {
      logger.error("Process message error:", error);
      throw error;
    }
  }

  // Build system prompt with knowledge context
  buildSystemPrompt(knowledgeContext) {
    let systemPrompt = `You are a helpful AI assistant. Be conversational, accurate, and helpful.`;

    if (knowledgeContext) {
      systemPrompt += `\n\nYou have access to the following knowledge base information that may be relevant to the user's question:\n\n${knowledgeContext}\n\nUse this information to provide accurate and helpful responses. If the knowledge base doesn't contain relevant information, you can still provide general assistance.`;
    }

    return systemPrompt;
  }

  // Get conversation history
  async getConversation(req, res) {
    try {
      const { conversationId } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: "Conversation not found",
        });
      }

      const messages = await Message.find({ conversationId })
        .sort({ timestamp: 1 })
        .skip(parseInt(offset))
        .limit(parseInt(limit));

      res.status(200).json({
        success: true,
        data: {
          conversation,
          messages,
        },
      });
    } catch (error) {
      logger.error("Get conversation error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get conversation",
      });
    }
  }

  // Get all conversations for user
  async getConversations(req, res) {
    try {
      const userId = req.user?.id || "anonymous";
      const { limit = 20, offset = 0 } = req.query;

      const conversations = await Conversation.find({ userId })
        .sort({ updatedAt: -1 })
        .skip(parseInt(offset))
        .limit(parseInt(limit));

      res.status(200).json({
        success: true,
        data: { conversations },
      });
    } catch (error) {
      logger.error("Get conversations error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get conversations",
      });
    }
  }

  // Delete conversation
  async deleteConversation(req, res) {
    try {
      const { conversationId } = req.params;

      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: "Conversation not found",
        });
      }

      // Delete all messages in conversation
      await Message.deleteMany({ conversationId });

      // Delete conversation
      await Conversation.findByIdAndDelete(conversationId);

      res.status(200).json({
        success: true,
        message: "Conversation deleted successfully",
      });
    } catch (error) {
      logger.error("Delete conversation error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to delete conversation",
      });
    }
  }

  // Stream message response (for real-time typing effect)
  async streamMessage(req, res) {
    try {
      const { conversationId } = req.params;
      const { message, useKnowledge = true } = req.body;

      // Set up SSE headers
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("Access-Control-Allow-Origin", "*");

      // Save user message
      const userMessage = new Message({
        conversationId,
        role: "user",
        content: message.trim(),
        timestamp: new Date(),
      });

      await userMessage.save();

      // Get context for streaming
      const messages = await Message.find({ conversationId })
        .sort({ timestamp: 1 })
        .limit(20);

      let knowledgeContext = "";
      if (useKnowledge) {
        const relevantChunks = await knowledgeService.searchRelevantChunks(
          message
        );
        if (relevantChunks.length > 0) {
          knowledgeContext = relevantChunks
            .map((chunk) => chunk.content)
            .join("\n\n");
        }
      }

      const systemPrompt = this.buildSystemPrompt(knowledgeContext);
      const conversationHistory = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      conversationHistory.push({
        role: "user",
        content: message,
      });

      // Stream AI response
      await chatService.streamChatCompletion(
        [{ role: "system", content: systemPrompt }, ...conversationHistory],
        (chunk) => {
          res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
        }
      );

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error) {
      logger.error("Stream message error:", error);
      res.write(
        `data: ${JSON.stringify({ error: "Failed to stream message" })}\n\n`
      );
      res.end();
    }
  }
}

module.exports = new ChatController();
