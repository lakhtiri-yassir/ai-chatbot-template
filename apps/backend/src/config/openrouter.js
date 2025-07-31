const axios = require("axios");
const logger = require("../utils/logger");

class OpenRouterConfig {
  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY;
    this.baseURL = "https://openrouter.ai/api/v1";
    this.defaultModel = process.env.OPENROUTER_MODEL || "openai/gpt-3.5-turbo";
    this.maxRetries = 3;
    this.retryDelay = 1000;

    if (!this.apiKey) {
      throw new Error("OPENROUTER_API_KEY is required");
    }

    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
        "X-Title": "AI Chatbot Template",
      },
      timeout: 60000, // 60 seconds timeout
    });

    this.setupInterceptors();
  }

  setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        logger.info(
          `OpenRouter API Request: ${config.method?.toUpperCase()} ${
            config.url
          }`
        );
        return config;
      },
      (error) => {
        logger.error("OpenRouter Request Error:", error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        logger.info(
          `OpenRouter API Response: ${response.status} ${response.statusText}`
        );
        return response;
      },
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 429 && !originalRequest._retry) {
          originalRequest._retry = true;

          const retryAfter = error.response.headers["retry-after"];
          const delay = retryAfter
            ? parseInt(retryAfter) * 1000
            : this.retryDelay;

          logger.warn(`Rate limited. Retrying after ${delay}ms`);
          await new Promise((resolve) => setTimeout(resolve, delay));

          return this.client(originalRequest);
        }

        if (
          error.response?.status >= 500 &&
          originalRequest._retryCount < this.maxRetries
        ) {
          originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;

          const delay = this.retryDelay * originalRequest._retryCount;
          logger.warn(
            `Server error. Retrying after ${delay}ms (attempt ${originalRequest._retryCount})`
          );

          await new Promise((resolve) => setTimeout(resolve, delay));
          return this.client(originalRequest);
        }

        logger.error("OpenRouter API Error:", {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          message: error.message,
        });

        return Promise.reject(error);
      }
    );
  }

  async chatCompletion(messages, options = {}) {
    try {
      const response = await this.client.post("/chat/completions", {
        model: options.model || this.defaultModel,
        messages: messages,
        max_tokens: options.maxTokens || 1000,
        temperature: options.temperature || 0.7,
        top_p: options.topP || 1,
        frequency_penalty: options.frequencyPenalty || 0,
        presence_penalty: options.presencePenalty || 0,
        stream: options.stream || false,
        ...options.additionalParams,
      });

      return response.data;
    } catch (error) {
      logger.error("Chat completion failed:", error);
      throw error;
    }
  }

  async getModels() {
    try {
      const response = await this.client.get("/models");
      return response.data;
    } catch (error) {
      logger.error("Failed to get models:", error);
      throw error;
    }
  }

  async getUsage() {
    try {
      const response = await this.client.get("/auth/key");
      return response.data;
    } catch (error) {
      logger.error("Failed to get usage:", error);
      throw error;
    }
  }
}

module.exports = new OpenRouterConfig();
