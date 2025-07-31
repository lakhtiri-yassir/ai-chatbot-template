const openRouterService = require("./openrouter.service");
const cacheService = require("./cache.service");
const Chunk = require("../models/Chunk.model");
const Document = require("../models/Document.model");
const logger = require("../utils/logger");
const crypto = require("crypto");

class EmbeddingService {
  constructor() {
    this.embeddingModel = "openai/text-embedding-ada-002";
    this.embeddingDimensions = 1536;
    this.batchSize = 50; // Process up to 50 texts at once
    this.maxRetries = 3;
    this.retryDelay = 1000;
    this.processingQueue = [];
    this.isProcessing = false;
  }

  /**
   * Generate embeddings for single text or array of texts
   * @param {String|Array} input - Text or array of texts
   * @param {Object} options - Configuration options
   * @returns {Array} Array of embedding vectors
   */
  async generateEmbeddings(input, options = {}) {
    try {
      const {
        model = this.embeddingModel,
        useCache = true,
        batchSize = this.batchSize,
      } = options;

      const texts = Array.isArray(input) ? input : [input];
      const validTexts = texts.filter((text) => text && text.trim().length > 0);

      if (validTexts.length === 0) {
        throw new Error("No valid text provided for embedding generation");
      }

      // Check cache first
      const embeddings = [];
      const textsToProcess = [];
      const cacheKeys = [];

      if (useCache) {
        for (const text of validTexts) {
          const cacheKey = this.generateCacheKey(text, model);
          const cachedEmbedding = await cacheService.get(cacheKey);

          if (cachedEmbedding) {
            embeddings.push(JSON.parse(cachedEmbedding));
            cacheKeys.push(null); // Mark as cached
          } else {
            embeddings.push(null); // Placeholder
            textsToProcess.push(text);
            cacheKeys.push(cacheKey);
          }
        }

        if (textsToProcess.length === 0) {
          logger.info("All embeddings found in cache");
          return embeddings;
        }
      } else {
        textsToProcess.push(...validTexts);
      }

      // Process texts in batches
      const newEmbeddings = [];
      for (let i = 0; i < textsToProcess.length; i += batchSize) {
        const batch = textsToProcess.slice(i, i + batchSize);

        const batchEmbeddings = await this.generateBatchEmbeddings(
          batch,
          model
        );
        newEmbeddings.push(...batchEmbeddings);

        // Small delay between batches
        if (i + batchSize < textsToProcess.length) {
          await this.delay(200);
        }
      }

      // Merge cached and new embeddings
      let newEmbeddingIndex = 0;
      for (let i = 0; i < embeddings.length; i++) {
        if (embeddings[i] === null) {
          embeddings[i] = newEmbeddings[newEmbeddingIndex];

          // Cache new embedding
          if (useCache && cacheKeys[i]) {
            await cacheService.set(
              cacheKeys[i],
              JSON.stringify(embeddings[i]),
              86400 // 24 hours
            );
          }

          newEmbeddingIndex++;
        }
      }

      logger.info("Embeddings generated successfully", {
        totalTexts: validTexts.length,
        cached: validTexts.length - textsToProcess.length,
        generated: textsToProcess.length,
        model,
      });

      return embeddings;
    } catch (error) {
      logger.error("Embedding generation failed:", error);
      throw error;
    }
  }

  /**
   * Generate embeddings for a batch of texts
   * @param {Array} texts - Array of texts
   * @param {String} model - Model to use
   * @returns {Array} Array of embeddings
   */
  async generateBatchEmbeddings(texts, model) {
    let attempt = 0;

    while (attempt < this.maxRetries) {
      try {
        const embeddings = await openRouterService.getEmbeddings(texts, {
          model,
          dimensions: this.embeddingDimensions,
        });

        // Validate embeddings
        for (const embedding of embeddings) {
          if (!this.validateEmbedding(embedding)) {
            throw new Error("Invalid embedding returned from API");
          }
        }

        return embeddings;
      } catch (error) {
        attempt++;

        if (attempt >= this.maxRetries) {
          throw error;
        }

        const delay = this.retryDelay * Math.pow(2, attempt - 1);
        logger.warn(
          `Embedding generation failed, retrying in ${delay}ms (attempt ${attempt}/${this.maxRetries})`
        );
        await this.delay(delay);
      }
    }
  }

  /**
   * Process embeddings for all chunks in a document
   * @param {String} documentId - Document ID
   * @param {Object} options - Processing options
   * @returns {Object} Processing results
   */
  async processDocumentEmbeddings(documentId, options = {}) {
    try {
      const { overwrite = false, batchSize = this.batchSize } = options;

      const document = await Document.findById(documentId);
      if (!document) {
        throw new Error("Document not found");
      }

      logger.info(`Processing embeddings for document ${documentId}`);

      // Get chunks that need embeddings
      const query = { documentId, deletedAt: null };
      if (!overwrite) {
        query.embeddingStatus = { $ne: "completed" };
      }

      const chunks = await Chunk.find(query).sort({ "position.startIndex": 1 });

      if (chunks.length === 0) {
        logger.info("No chunks need embedding processing");
        return { processed: 0, failed: 0, skipped: chunks.length };
      }

      // Update document embedding status
      document.embeddingStatus = "processing";
      await document.save();

      const results = {
        processed: 0,
        failed: 0,
        skipped: 0,
      };

      // Process chunks in batches
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);

        try {
          await this.processBatchChunkEmbeddings(batch);
          results.processed += batch.length;

          logger.info(
            `Processed embedding batch ${
              Math.floor(i / batchSize) + 1
            }/${Math.ceil(chunks.length / batchSize)}`
          );
        } catch (error) {
          logger.error(`Failed to process embedding batch ${i}:`, error);
          results.failed += batch.length;

          // Mark chunks as failed
          for (const chunk of batch) {
            await chunk.updateEmbeddingStatus("failed", error.message);
          }
        }
      }

      // Update document status
      if (results.failed === 0) {
        document.embeddingStatus = "completed";
      } else if (results.processed > 0) {
        document.embeddingStatus = "partially_completed";
      } else {
        document.embeddingStatus = "failed";
      }

      await document.save();

      logger.info("Document embedding processing completed", {
        documentId,
        ...results,
      });

      return results;
    } catch (error) {
      logger.error("Document embedding processing failed:", error);

      // Update document status
      try {
        const document = await Document.findById(documentId);
        if (document) {
          document.embeddingStatus = "failed";
          await document.save();
        }
      } catch (saveError) {
        logger.error("Failed to update document status:", saveError);
      }

      throw error;
    }
  }

  /**
   * Process embeddings for a batch of chunks
   * @param {Array} chunks - Array of chunk documents
   * @returns {Array} Array of updated chunks
   */
  async processBatchChunkEmbeddings(chunks) {
    try {
      // Extract text content
      const texts = chunks.map((chunk) => chunk.content);

      // Generate embeddings
      const embeddings = await this.generateEmbeddings(texts, {
        useCache: true,
        batchSize: this.batchSize,
      });

      // Update chunks with embeddings
      const updatePromises = chunks.map(async (chunk, index) => {
        try {
          const embedding = embeddings[index];

          if (embedding && this.validateEmbedding(embedding)) {
            await chunk.setEmbedding(embedding, this.embeddingModel);
            logger.debug(`Embedding set for chunk ${chunk.chunkId}`);
          } else {
            throw new Error("Invalid embedding generated");
          }
        } catch (error) {
          logger.error(
            `Failed to set embedding for chunk ${chunk.chunkId}:`,
            error
          );
          await chunk.updateEmbeddingStatus("failed", error.message);
          throw error;
        }
      });

      await Promise.all(updatePromises);
      return chunks;
    } catch (error) {
      logger.error("Batch chunk embedding processing failed:", error);
      throw error;
    }
  }

  /**
   * Search for similar content using embeddings
   * @param {String} query - Search query
   * @param {Object} options - Search options
   * @returns {Array} Array of similar chunks
   */
  async searchSimilar(query, options = {}) {
    try {
      const {
        limit = 10,
        threshold = 0.7,
        documentId = null,
        includeScore = true,
      } = options;

      if (!query || query.trim().length === 0) {
        throw new Error("Search query cannot be empty");
      }

      // Generate query embedding
      const [queryEmbedding] = await this.generateEmbeddings(query, {
        useCache: true,
      });

      // Search for similar chunks
      const similarChunks = await Chunk.findSimilar(queryEmbedding, {
        limit,
        threshold,
        documentId,
      });

      // Format results
      const results = similarChunks.map((chunk) => ({
        id: chunk._id,
        chunkId: chunk.chunkId,
        content: chunk.content,
        documentId: chunk.documentId,
        position: chunk.position,
        similarity: includeScore ? chunk.similarity : undefined,
        metadata: chunk.metadata,
      }));

      logger.info("Similarity search completed", {
        query: query.substring(0, 100),
        resultsFound: results.length,
        threshold,
      });

      return results;
    } catch (error) {
      logger.error("Similarity search failed:", error);
      throw error;
    }
  }

  /**
   * Get embedding statistics
   * @param {String} documentId - Optional document ID filter
   * @returns {Object} Embedding statistics
   */
  async getEmbeddingStats(documentId = null) {
    try {
      const matchQuery = { deletedAt: null };
      if (documentId) {
        matchQuery.documentId = documentId;
      }

      const stats = await Chunk.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: "$embeddingStatus",
            count: { $sum: 1 },
          },
        },
      ]);

      const result = {
        total: 0,
        completed: 0,
        pending: 0,
        processing: 0,
        failed: 0,
      };

      for (const stat of stats) {
        result.total += stat.count;
        result[stat._id] = stat.count;
      }

      result.completionRate =
        result.total > 0
          ? ((result.completed / result.total) * 100).toFixed(2)
          : 0;

      return result;
    } catch (error) {
      logger.error("Failed to get embedding stats:", error);
      throw error;
    }
  }

  /**
   * Queue embedding processing for background processing
   * @param {String} documentId - Document ID
   * @param {Object} options - Processing options
   */
  async queueEmbeddingProcessing(documentId, options = {}) {
    this.processingQueue.push({ documentId, options });

    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  /**
   * Process the embedding queue
   */
  async processQueue() {
    if (this.isProcessing || this.processingQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.processingQueue.length > 0) {
        const { documentId, options } = this.processingQueue.shift();

        try {
          await this.processDocumentEmbeddings(documentId, options);
        } catch (error) {
          logger.error(
            `Failed to process embeddings for document ${documentId}:`,
            error
          );
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Validate embedding vector
   * @param {Array} embedding - Embedding vector
   * @returns {Boolean} True if valid
   */
  validateEmbedding(embedding) {
    if (!Array.isArray(embedding)) {
      return false;
    }

    if (embedding.length !== this.embeddingDimensions) {
      return false;
    }

    return embedding.every(
      (val) => typeof val === "number" && !isNaN(val) && isFinite(val)
    );
  }

  /**
   * Generate cache key for embedding
   * @param {String} text - Text to embed
   * @param {String} model - Model name
   * @returns {String} Cache key
   */
  generateCacheKey(text, model) {
    const hash = crypto.createHash("md5").update(text).digest("hex");
    return `embedding:${model}:${hash}`;
  }

  /**
   * Clear embedding cache
   * @param {String} pattern - Optional pattern to match
   */
  async clearEmbeddingCache(pattern = "embedding:*") {
    try {
      await cacheService.deletePattern(pattern);
      logger.info("Embedding cache cleared", { pattern });
    } catch (error) {
      logger.error("Failed to clear embedding cache:", error);
      throw error;
    }
  }

  /**
   * Get embedding model information
   * @returns {Object} Model information
   */
  getModelInfo() {
    return {
      model: this.embeddingModel,
      dimensions: this.embeddingDimensions,
      maxBatchSize: this.batchSize,
      maxRetries: this.maxRetries,
    };
  }

  /**
   * Update embedding model configuration
   * @param {Object} config - New configuration
   */
  updateConfig(config) {
    if (config.model) {
      this.embeddingModel = config.model;
    }

    if (config.dimensions) {
      this.embeddingDimensions = config.dimensions;
    }

    if (config.batchSize) {
      this.batchSize = config.batchSize;
    }

    if (config.maxRetries) {
      this.maxRetries = config.maxRetries;
    }

    logger.info("Embedding service configuration updated", config);
  }

  /**
   * Utility function to add delay
   * @param {Number} ms - Milliseconds to delay
   */
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Reprocess embeddings for failed chunks
   * @param {String} documentId - Document ID
   * @returns {Object} Processing results
   */
  async reprocessFailedEmbeddings(documentId) {
    try {
      const failedChunks = await Chunk.find({
        documentId,
        embeddingStatus: "failed",
        deletedAt: null,
      });

      if (failedChunks.length === 0) {
        return { processed: 0, failed: 0 };
      }

      logger.info(
        `Reprocessing ${failedChunks.length} failed embeddings for document ${documentId}`
      );

      // Reset status to pending
      await Chunk.updateMany(
        { _id: { $in: failedChunks.map((c) => c._id) } },
        { embeddingStatus: "pending" }
      );

      // Process embeddings
      return await this.processDocumentEmbeddings(documentId, {
        overwrite: false,
      });
    } catch (error) {
      logger.error("Failed to reprocess failed embeddings:", error);
      throw error;
    }
  }
}

module.exports = new EmbeddingService();
