const openRouterConfig = require("../config/openrouter");
const cacheService = require("./cache.service");
const logger = require("../utils/logger");

class OpenRouterService {
  constructor() {
    this.client = openRouterConfig.client;
    this.defaultModel = openRouterConfig.defaultModel;
    this.maxRetries = 3;
    this.retryDelay = 1000;
  }

  /**
   * Get chat completion from OpenRouter
   * @param {Array} messages - Array of chat messages
   * @param {Object} options - Configuration options
   * @returns {Object} Chat completion response
   */
  async getChatCompletion(messages, options = {}) {
    try {
      const {
        model = this.defaultModel,
        temperature = 0.7,
        maxTokens = 1000,
        topP = 1,
        frequencyPenalty = 0,
        presencePenalty = 0,
        stream = false,
        ...additionalParams
      } = options;

      // Check cache first (for non-streaming requests)
      if (!stream) {
        const cacheKey = this.generateCacheKey(messages, options);
        const cachedResponse = await cacheService.get(cacheKey);

        if (cachedResponse) {
          logger.info("Cache hit for chat completion");
          return JSON.parse(cachedResponse);
        }
      }

      const startTime = Date.now();

      const response = await openRouterConfig.chatCompletion(messages, {
        model,
        temperature,
        maxTokens,
        topP,
        frequencyPenalty,
        presencePenalty,
        stream,
        ...additionalParams,
      });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // Format response
      const formattedResponse = {
        content: response.choices[0].message.content,
        model: response.model,
        usage: response.usage,
        responseTime,
        finishReason: response.choices[0].finish_reason,
        timestamp: new Date().toISOString(),
      };

      // Cache response (only for non-streaming)
      if (!stream) {
        const cacheKey = this.generateCacheKey(messages, options);
        await cacheService.set(
          cacheKey,
          JSON.stringify(formattedResponse),
          300 // 5 minutes cache
        );
      }

      logger.info("Chat completion successful", {
        model,
        tokensUsed: response.usage?.total_tokens,
        responseTime,
      });

      return formattedResponse;
    } catch (error) {
      logger.error("Chat completion failed:", error);
      throw this.handleError(error);
    }
  }

  /**
   * Stream chat completion from OpenRouter
   * @param {Array} messages - Array of chat messages
   * @param {Function} onChunk - Callback for each chunk
   * @param {Object} options - Configuration options
   */
  async streamChatCompletion(messages, onChunk, options = {}) {
    try {
      const {
        model = this.defaultModel,
        temperature = 0.7,
        maxTokens = 1000,
        topP = 1,
        frequencyPenalty = 0,
        presencePenalty = 0,
        ...additionalParams
      } = options;

      const startTime = Date.now();
      let fullContent = "";
      let totalTokens = 0;

      const response = await this.client.post(
        "/chat/completions",
        {
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
          top_p: topP,
          frequency_penalty: frequencyPenalty,
          presence_penalty: presencePenalty,
          stream: true,
          ...additionalParams,
        },
        {
          responseType: "stream",
        }
      );

      return new Promise((resolve, reject) => {
        let buffer = "";

        response.data.on("data", (chunk) => {
          buffer += chunk.toString();

          // Process complete lines
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.trim() === "") continue;
            if (line.trim() === "data: [DONE]") {
              const endTime = Date.now();
              const responseTime = endTime - startTime;

              resolve({
                content: fullContent,
                model,
                usage: { total_tokens: totalTokens },
                responseTime,
                finishReason: "stop",
                timestamp: new Date().toISOString(),
              });
              return;
            }

            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.choices && data.choices[0].delta.content) {
                  const chunkContent = data.choices[0].delta.content;
                  fullContent += chunkContent;

                  // Call the chunk callback
                  onChunk(chunkContent);
                }

                // Track token usage if available
                if (data.usage) {
                  totalTokens = data.usage.total_tokens;
                }
              } catch (parseError) {
                logger.warn("Failed to parse streaming chunk:", parseError);
              }
            }
          }
        });

        response.data.on("error", (error) => {
          logger.error("Streaming error:", error);
          reject(this.handleError(error));
        });

        response.data.on("end", () => {
          const endTime = Date.now();
          const responseTime = endTime - startTime;

          resolve({
            content: fullContent,
            model,
            usage: { total_tokens: totalTokens },
            responseTime,
            finishReason: "stop",
            timestamp: new Date().toISOString(),
          });
        });
      });
    } catch (error) {
      logger.error("Stream chat completion failed:", error);
      throw this.handleError(error);
    }
  }

  /**
   * Get text embeddings from OpenRouter
   * @param {String|Array} input - Text or array of texts to embed
   * @param {Object} options - Configuration options
   * @returns {Array} Array of embedding vectors
   */
  async getEmbeddings(input, options = {}) {
    try {
      const { model = "openai/text-embedding-ada-002", dimensions = 1536 } =
        options;

      // Ensure input is an array
      const inputs = Array.isArray(input) ? input : [input];

      // Check cache first
      const cacheKey = this.generateEmbeddingCacheKey(inputs, model);
      const cachedEmbeddings = await cacheService.get(cacheKey);

      if (cachedEmbeddings) {
        logger.info("Cache hit for embeddings");
        return JSON.parse(cachedEmbeddings);
      }

      const response = await this.client.post("/embeddings", {
        model,
        input: inputs,
        dimensions,
      });

      const embeddings = response.data.data.map((item) => item.embedding);

      // Cache embeddings for 24 hours
      await cacheService.set(
        cacheKey,
        JSON.stringify(embeddings),
        86400 // 24 hours
      );

      logger.info("Embeddings generated successfully", {
        model,
        inputCount: inputs.length,
        tokensUsed: response.data.usage?.total_tokens,
      });

      return embeddings;
    } catch (error) {
      logger.error("Embeddings generation failed:", error);
      throw this.handleError(error);
    }
  }

  /**
   * Get available models from OpenRouter
   * @returns {Array} Array of available models
   */
  async getAvailableModels() {
    try {
      const cacheKey = "openrouter:models";
      const cachedModels = await cacheService.get(cacheKey);

      if (cachedModels) {
        return JSON.parse(cachedModels);
      }

      const response = await openRouterConfig.getModels();
      const models = response.data;

      // Cache models for 1 hour
      await cacheService.set(cacheKey, JSON.stringify(models), 3600);

      return models;
    } catch (error) {
      logger.error("Failed to get available models:", error);
      throw this.handleError(error);
    }
  }

  /**
   * Get model information
   * @param {String} modelId - Model identifier
   * @returns {Object} Model information
   */
  async getModelInfo(modelId) {
    try {
      const models = await this.getAvailableModels();
      const model = models.find((m) => m.id === modelId);

      if (!model) {
        throw new Error(`Model ${modelId} not found`);
      }

      return model;
    } catch (error) {
      logger.error("Failed to get model info:", error);
      throw this.handleError(error);
    }
  }

  /**
   * Check API usage and limits
   * @returns {Object} Usage information
   */
  async getUsage() {
    try {
      const cacheKey = "openrouter:usage";
      const cachedUsage = await cacheService.get(cacheKey);

      if (cachedUsage) {
        return JSON.parse(cachedUsage);
      }

      const response = await openRouterConfig.getUsage();
      const usage = response.data;

      // Cache usage for 5 minutes
      await cacheService.set(cacheKey, JSON.stringify(usage), 300);

      return usage;
    } catch (error) {
      logger.error("Failed to get usage info:", error);
      throw this.handleError(error);
    }
  }

  /**
   * Validate message format
   * @param {Array} messages - Array of messages to validate
   * @returns {Boolean} True if valid
   */
  validateMessages(messages) {
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error("Messages must be a non-empty array");
    }

    for (const message of messages) {
      if (!message.role || !message.content) {
        throw new Error("Each message must have role and content");
      }

      if (!["system", "user", "assistant"].includes(message.role)) {
        throw new Error("Invalid message role");
      }

      if (
        typeof message.content !== "string" ||
        message.content.trim().length === 0
      ) {
        throw new Error("Message content must be a non-empty string");
      }
    }

    return true;
  }

  /**
   * Generate cache key for chat completion
   * @param {Array} messages - Chat messages
   * @param {Object} options - Configuration options
   * @returns {String} Cache key
   */
  generateCacheKey(messages, options) {
    const key = {
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      model: options.model || this.defaultModel,
      temperature: options.temperature || 0.7,
      maxTokens: options.maxTokens || 1000,
    };

    return `openrouter:chat:${Buffer.from(JSON.stringify(key)).toString(
      "base64"
    )}`;
  }

  /**
   * Generate cache key for embeddings
   * @param {Array} inputs - Input texts
   * @param {String} model - Model name
   * @returns {String} Cache key
   */
  generateEmbeddingCacheKey(inputs, model) {
    const key = {
      inputs: inputs.sort(), // Sort for consistent caching
      model,
    };

    return `openrouter:embeddings:${Buffer.from(JSON.stringify(key)).toString(
      "base64"
    )}`;
  }

  /**
   * Handle and format errors
   * @param {Error} error - Original error
   * @returns {Error} Formatted error
   */
  handleError(error) {
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.error?.message || error.message;

      switch (status) {
        case 401:
          return new Error("OpenRouter API authentication failed");
        case 429:
          return new Error("OpenRouter API rate limit exceeded");
        case 500:
          return new Error("OpenRouter API server error");
        default:
          return new Error(`OpenRouter API error: ${message}`);
      }
    }

    return error;
  }

  /**
   * Get model pricing information
   * @param {String} modelId - Model identifier
   * @returns {Object} Pricing information
   */
  async getModelPricing(modelId) {
    try {
      const model = await this.getModelInfo(modelId);

      return {
        model: modelId,
        pricing: model.pricing || { prompt: 0, completion: 0 },
        contextWindow: model.context_length || 4096,
        maxOutput: model.max_tokens || 1000,
      };
    } catch (error) {
      logger.error("Failed to get model pricing:", error);
      throw this.handleError(error);
    }
  }

  /**
   * Calculate estimated cost for a request
   * @param {Array} messages - Chat messages
   * @param {Object} options - Request options
   * @returns {Object} Cost estimation
   */
  async estimateCost(messages, options = {}) {
    try {
      const model = options.model || this.defaultModel;
      const pricing = await this.getModelPricing(model);

      // Simple token estimation (rough approximation)
      const totalText = messages.map((m) => m.content).join(" ");
      const estimatedTokens = Math.ceil(totalText.length / 4); // Rough estimation

      const promptCost = (estimatedTokens * pricing.pricing.prompt) / 1000000;
      const completionTokens = options.maxTokens || 1000;
      const completionCost =
        (completionTokens * pricing.pricing.completion) / 1000000;

      return {
        model,
        estimatedPromptTokens: estimatedTokens,
        estimatedCompletionTokens: completionTokens,
        estimatedPromptCost: promptCost,
        estimatedCompletionCost: completionCost,
        estimatedTotalCost: promptCost + completionCost,
      };
    } catch (error) {
      logger.error("Failed to estimate cost:", error);
      throw this.handleError(error);
    }
  }
}

module.exports = new OpenRouterService();
