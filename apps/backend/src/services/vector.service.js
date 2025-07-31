const openRouterService = require("./openrouter.service");
const cacheService = require("./cache.service");
const Chunk = require("../models/Chunk.model");
const logger = require("../utils/logger");

class VectorService {
  constructor() {
    this.embeddingModel = "openai/text-embedding-ada-002";
    this.embeddingDimensions = 1536;
    this.batchSize = 20; // Process embeddings in batches
    this.similarityThreshold = 0.7;
  }

  /**
   * Generate embeddings for text
   * @param {String|Array} text - Text or array of texts
   * @param {Object} options - Configuration options
   * @returns {Array} Array of embedding vectors
   */
  async generateEmbeddings(text, options = {}) {
    try {
      const {
        model = this.embeddingModel,
        batchSize = this.batchSize,
        useCache = true,
      } = options;

      const texts = Array.isArray(text) ? text : [text];

      if (texts.length === 0) {
        throw new Error("No text provided for embedding generation");
      }

      // Filter out empty texts
      const validTexts = texts.filter((t) => t && t.trim().length > 0);

      if (validTexts.length === 0) {
        throw new Error("No valid text provided for embedding generation");
      }

      // Process in batches to avoid API limits
      const embeddings = [];

      for (let i = 0; i < validTexts.length; i += batchSize) {
        const batch = validTexts.slice(i, i + batchSize);

        try {
          const batchEmbeddings = await openRouterService.getEmbeddings(batch, {
            model,
            dimensions: this.embeddingDimensions,
          });

          embeddings.push(...batchEmbeddings);

          // Add small delay between batches to avoid rate limiting
          if (i + batchSize < validTexts.length) {
            await this.delay(100);
          }
        } catch (error) {
          logger.error(`Failed to generate embeddings for batch ${i}:`, error);
          throw error;
        }
      }

      logger.info("Embeddings generated successfully", {
        model,
        textCount: validTexts.length,
        embeddingCount: embeddings.length,
      });

      return embeddings;
    } catch (error) {
      logger.error("Embedding generation failed:", error);
      throw error;
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   * @param {Array} vectorA - First vector
   * @param {Array} vectorB - Second vector
   * @returns {Number} Similarity score (0-1)
   */
  cosineSimilarity(vectorA, vectorB) {
    if (!vectorA || !vectorB || vectorA.length !== vectorB.length) {
      throw new Error("Invalid vectors for similarity calculation");
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vectorA.length; i++) {
      dotProduct += vectorA[i] * vectorB[i];
      normA += vectorA[i] * vectorA[i];
      normB += vectorB[i] * vectorB[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Find similar chunks using vector similarity
   * @param {Array} queryVector - Query embedding vector
   * @param {Object} options - Search options
   * @returns {Array} Array of similar chunks with scores
   */
  async findSimilarChunks(queryVector, options = {}) {
    try {
      const {
        limit = 10,
        threshold = this.similarityThreshold,
        documentId = null,
        contentType = null,
        includeMetadata = true,
      } = options;

      // Use MongoDB aggregation for vector similarity search
      const results = await Chunk.findSimilar(queryVector, {
        limit,
        threshold,
        documentId,
        contentType,
      });

      // Format results
      const formattedResults = results.map((chunk) => ({
        id: chunk._id,
        chunkId: chunk.chunkId,
        content: chunk.content,
        similarity: chunk.similarity,
        documentId: chunk.documentId,
        position: chunk.position,
        metadata: includeMetadata ? chunk.metadata : undefined,
        wordCount: chunk.metadata?.wordCount || 0,
        contentType: chunk.metadata?.contentType || "text",
      }));

      logger.info("Vector similarity search completed", {
        queryDimensions: queryVector.length,
        resultsFound: formattedResults.length,
        threshold,
        limit,
      });

      return formattedResults;
    } catch (error) {
      logger.error("Vector similarity search failed:", error);
      throw error;
    }
  }

  /**
   * Search for relevant chunks using text query
   * @param {String} query - Search query
   * @param {Object} options - Search options
   * @returns {Array} Array of relevant chunks
   */
  async searchRelevantChunks(query, options = {}) {
    try {
      if (!query || query.trim().length === 0) {
        throw new Error("Search query cannot be empty");
      }

      const {
        limit = 5,
        threshold = this.similarityThreshold,
        documentId = null,
        contentType = null,
        useCache = true,
      } = options;

      // Generate embedding for query
      const [queryEmbedding] = await this.generateEmbeddings(query, {
        useCache,
      });

      // Find similar chunks
      const similarChunks = await this.findSimilarChunks(queryEmbedding, {
        limit,
        threshold,
        documentId,
        contentType,
      });

      // Update usage statistics
      await this.updateChunkUsageStats(similarChunks);

      return similarChunks;
    } catch (error) {
      logger.error("Relevant chunk search failed:", error);
      throw error;
    }
  }

  /**
   * Store embeddings for chunks
   * @param {Array} chunks - Array of chunk objects
   * @param {Object} options - Storage options
   * @returns {Array} Array of updated chunks
   */
  async storeChunkEmbeddings(chunks, options = {}) {
    try {
      const {
        model = this.embeddingModel,
        batchSize = this.batchSize,
        overwrite = false,
      } = options;

      const chunksToProcess = overwrite
        ? chunks
        : chunks.filter(
            (chunk) =>
              !chunk.embedding?.vector || chunk.embedding.vector.length === 0
          );

      if (chunksToProcess.length === 0) {
        logger.info("No chunks need embedding generation");
        return chunks;
      }

      logger.info(`Processing embeddings for ${chunksToProcess.length} chunks`);

      const updatedChunks = [];

      // Process in batches
      for (let i = 0; i < chunksToProcess.length; i += batchSize) {
        const batch = chunksToProcess.slice(i, i + batchSize);
        const batchTexts = batch.map((chunk) => chunk.content);

        try {
          // Generate embeddings for batch
          const embeddings = await this.generateEmbeddings(batchTexts, {
            model,
            batchSize: batchSize,
          });

          // Update chunks with embeddings
          for (let j = 0; j < batch.length; j++) {
            const chunk = batch[j];
            const embedding = embeddings[j];

            if (embedding && embedding.length === this.embeddingDimensions) {
              await chunk.setEmbedding(embedding, model);
              updatedChunks.push(chunk);

              logger.debug(`Embedding stored for chunk ${chunk.chunkId}`);
            } else {
              logger.warn(`Invalid embedding for chunk ${chunk.chunkId}`);
              await chunk.updateEmbeddingStatus(
                "failed",
                "Invalid embedding dimensions"
              );
            }
          }

          // Progress logging
          logger.info(
            `Processed batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(
              chunksToProcess.length / batchSize
            )}`
          );
        } catch (error) {
          logger.error(`Failed to process embedding batch ${i}:`, error);

          // Mark chunks as failed
          for (const chunk of batch) {
            await chunk.updateEmbeddingStatus("failed", error.message);
          }
        }
      }

      logger.info("Chunk embedding storage completed", {
        totalChunks: chunks.length,
        processedChunks: chunksToProcess.length,
        successfulChunks: updatedChunks.length,
      });

      return updatedChunks;
    } catch (error) {
      logger.error("Chunk embedding storage failed:", error);
      throw error;
    }
  }

  /**
   * Update chunk usage statistics
   * @param {Array} chunks - Array of chunks that were retrieved
   */
  async updateChunkUsageStats(chunks) {
    try {
      const updatePromises = chunks.map(async (chunk, index) => {
        try {
          const chunkDoc = await Chunk.findById(chunk.id);
          if (chunkDoc) {
            await chunkDoc.incrementRetrievalCount();
            await chunkDoc.updateRelevanceScore(chunk.similarity);

            // Update top result frequency for first few results
            if (index < 3) {
              const current = chunkDoc.stats.topResultFrequency || 0;
              const count = chunkDoc.stats.retrievalCount || 1;
              chunkDoc.stats.topResultFrequency =
                (current * (count - 1) + 1) / count;
              await chunkDoc.save();
            }
          }
        } catch (error) {
          logger.warn(`Failed to update stats for chunk ${chunk.id}:`, error);
        }
      });

      await Promise.allSettled(updatePromises);
    } catch (error) {
      logger.error("Failed to update chunk usage stats:", error);
    }
  }

  /**
   * Find duplicate or similar chunks
   * @param {String} chunkId - Chunk ID to find duplicates for
   * @param {Object} options - Search options
   * @returns {Array} Array of similar chunks
   */
  async findDuplicateChunks(chunkId, options = {}) {
    try {
      const { threshold = 0.95, limit = 10 } = options;

      const chunk = await Chunk.findOne({ chunkId });
      if (!chunk || !chunk.embedding?.vector) {
        throw new Error("Chunk not found or missing embedding");
      }

      const similarChunks = await this.findSimilarChunks(
        chunk.embedding.vector,
        {
          limit: limit + 1, // +1 because it will include itself
          threshold,
        }
      );

      // Filter out the original chunk
      const duplicates = similarChunks.filter((c) => c.chunkId !== chunkId);

      return duplicates;
    } catch (error) {
      logger.error("Duplicate chunk search failed:", error);
      throw error;
    }
  }

  /**
   * Validate embedding vector
   * @param {Array} vector - Embedding vector to validate
   * @returns {Boolean} True if valid
   */
  validateEmbedding(vector) {
    if (!Array.isArray(vector)) {
      return false;
    }

    if (vector.length !== this.embeddingDimensions) {
      return false;
    }

    // Check if all elements are numbers
    return vector.every((val) => typeof val === "number" && !isNaN(val));
  }

  /**
   * Get embedding statistics
   * @param {String} documentId - Optional document ID filter
   * @returns {Object} Embedding statistics
   */
  async getEmbeddingStats(documentId = null) {
    try {
      const stats = await Chunk.getStats(documentId);

      return {
        totalChunks: stats[0]?.totalChunks || 0,
        embeddingCompleted: stats[0]?.embeddingCompleted || 0,
        embeddingPending:
          stats[0]?.totalChunks - stats[0]?.embeddingCompleted || 0,
        avgRelevanceScore: stats[0]?.avgRelevanceScore || 0,
        totalRetrievals: stats[0]?.totalRetrievals || 0,
        completionRate:
          stats[0]?.totalChunks > 0
            ? (
                (stats[0]?.embeddingCompleted / stats[0]?.totalChunks) *
                100
              ).toFixed(2)
            : 0,
      };
    } catch (error) {
      logger.error("Failed to get embedding stats:", error);
      throw error;
    }
  }

  /**
   * Utility function to add delay
   * @param {Number} ms - Milliseconds to delay
   */
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Normalize vector (convert to unit vector)
   * @param {Array} vector - Vector to normalize
   * @returns {Array} Normalized vector
   */
  normalizeVector(vector) {
    const magnitude = Math.sqrt(
      vector.reduce((sum, val) => sum + val * val, 0)
    );

    if (magnitude === 0) {
      return vector;
    }

    return vector.map((val) => val / magnitude);
  }

  /**
   * Calculate vector magnitude
   * @param {Array} vector - Vector to calculate magnitude for
   * @returns {Number} Vector magnitude
   */
  vectorMagnitude(vector) {
    return Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  }
}

module.exports = new VectorService();
