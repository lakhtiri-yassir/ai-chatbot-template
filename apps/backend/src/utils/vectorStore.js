/**
 * Vector Store Utility
 * Handles vector storage, retrieval, and similarity search operations
 */

const { MongoClient } = require("mongodb");
const redis = require("redis");
const similarity = require("./similarity");

class VectorStore {
  constructor(options = {}) {
    this.mongoUrl = options.mongoUrl || process.env.MONGODB_URI;
    this.redisUrl = options.redisUrl || process.env.REDIS_URL;
    this.dbName = options.dbName || "ai_chatbot";
    this.collectionName = options.collectionName || "vectors";
    this.cachePrefix = options.cachePrefix || "vector:";
    this.cacheTTL = options.cacheTTL || 3600; // 1 hour
    this.dimensions = options.dimensions || 1536; // Default for OpenAI embeddings
    this.similarityThreshold = options.similarityThreshold || 0.7;

    this.mongo = null;
    this.redis = null;
    this.db = null;
    this.collection = null;
  }

  /**
   * Initialize connections
   */
  async initialize() {
    try {
      // Initialize MongoDB connection
      this.mongo = new MongoClient(this.mongoUrl);
      await this.mongo.connect();
      this.db = this.mongo.db(this.dbName);
      this.collection = this.db.collection(this.collectionName);

      // Create indexes for better performance
      await this.createIndexes();

      // Initialize Redis connection
      this.redis = redis.createClient({ url: this.redisUrl });
      await this.redis.connect();

      console.log("Vector store initialized successfully");
    } catch (error) {
      console.error("Failed to initialize vector store:", error);
      throw error;
    }
  }

  /**
   * Create MongoDB indexes
   */
  async createIndexes() {
    try {
      // Index for document ID
      await this.collection.createIndex({ documentId: 1 });

      // Index for chunk ID
      await this.collection.createIndex({ chunkId: 1 });

      // Compound index for document and chunk
      await this.collection.createIndex({ documentId: 1, chunkIndex: 1 });

      // Index for metadata queries
      await this.collection.createIndex({ "metadata.sourceDocument": 1 });
      await this.collection.createIndex({ "metadata.documentType": 1 });

      // Index for timestamps
      await this.collection.createIndex({ createdAt: 1 });

      console.log("Vector store indexes created");
    } catch (error) {
      console.error("Failed to create indexes:", error);
    }
  }

  /**
   * Store vector embedding with metadata
   * @param {Object} vectorData - Vector data to store
   * @returns {Object} Stored vector document
   */
  async storeVector(vectorData) {
    try {
      const {
        documentId,
        chunkId,
        chunkIndex,
        content,
        embedding,
        metadata = {},
      } = vectorData;

      // Validate embedding dimensions
      if (!embedding || embedding.length !== this.dimensions) {
        throw new Error(
          `Invalid embedding dimensions. Expected ${this.dimensions}, got ${
            embedding ? embedding.length : 0
          }`
        );
      }

      const vectorDoc = {
        documentId,
        chunkId,
        chunkIndex,
        content,
        embedding,
        metadata: {
          ...metadata,
          createdAt: new Date(),
          dimensions: this.dimensions,
        },
      };

      const result = await this.collection.insertOne(vectorDoc);
      vectorDoc._id = result.insertedId;

      // Cache frequently accessed vectors
      await this.cacheVector(chunkId, vectorDoc);

      return vectorDoc;
    } catch (error) {
      console.error("Failed to store vector:", error);
      throw error;
    }
  }

  /**
   * Store multiple vectors in batch
   * @param {Array} vectorsData - Array of vector data objects
   * @returns {Array} Array of stored vector documents
   */
  async storeVectors(vectorsData) {
    try {
      const vectorDocs = vectorsData.map((vectorData) => {
        const {
          documentId,
          chunkId,
          chunkIndex,
          content,
          embedding,
          metadata = {},
        } = vectorData;

        // Validate embedding dimensions
        if (!embedding || embedding.length !== this.dimensions) {
          throw new Error(`Invalid embedding dimensions for chunk ${chunkId}`);
        }

        return {
          documentId,
          chunkId,
          chunkIndex,
          content,
          embedding,
          metadata: {
            ...metadata,
            createdAt: new Date(),
            dimensions: this.dimensions,
          },
        };
      });

      const result = await this.collection.insertMany(vectorDocs);

      // Add inserted IDs to documents
      vectorDocs.forEach((doc, index) => {
        doc._id = result.insertedIds[index];
      });

      // Cache vectors
      await Promise.all(
        vectorDocs.map((doc) => this.cacheVector(doc.chunkId, doc))
      );

      return vectorDocs;
    } catch (error) {
      console.error("Failed to store vectors:", error);
      throw error;
    }
  }

  /**
   * Perform similarity search
   * @param {Array} queryEmbedding - Query embedding vector
   * @param {Object} options - Search options
   * @returns {Array} Array of similar vectors with scores
   */
  async similaritySearch(queryEmbedding, options = {}) {
    try {
      const {
        limit = 10,
        threshold = this.similarityThreshold,
        documentId = null,
        documentType = null,
        includeContent = true,
      } = options;

      // Build match criteria
      const matchCriteria = {};
      if (documentId) {
        matchCriteria.documentId = documentId;
      }
      if (documentType) {
        matchCriteria["metadata.documentType"] = documentType;
      }

      // Get all vectors (or filtered subset)
      const vectors = await this.collection.find(matchCriteria).toArray();

      // Calculate similarities
      const similarities = vectors.map((vector) => {
        const score = similarity.cosineSimilarity(
          queryEmbedding,
          vector.embedding
        );
        return {
          ...vector,
          similarity: score,
          content: includeContent ? vector.content : undefined,
        };
      });

      // Filter by threshold and sort by similarity
      const results = similarities
        .filter((item) => item.similarity >= threshold)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);

      return results;
    } catch (error) {
      console.error("Failed to perform similarity search:", error);
      throw error;
    }
  }

  /**
   * Get vector by chunk ID
   * @param {string} chunkId - Chunk identifier
   * @returns {Object|null} Vector document or null if not found
   */
  async getVector(chunkId) {
    try {
      // Try cache first
      const cached = await this.getCachedVector(chunkId);
      if (cached) {
        return cached;
      }

      // Get from database
      const vector = await this.collection.findOne({ chunkId });

      if (vector) {
        await this.cacheVector(chunkId, vector);
      }

      return vector;
    } catch (error) {
      console.error("Failed to get vector:", error);
      throw error;
    }
  }

  /**
   * Get vectors by document ID
   * @param {string} documentId - Document identifier
   * @returns {Array} Array of vector documents
   */
  async getVectorsByDocument(documentId) {
    try {
      const vectors = await this.collection
        .find({ documentId })
        .sort({ chunkIndex: 1 })
        .toArray();

      return vectors;
    } catch (error) {
      console.error("Failed to get vectors by document:", error);
      throw error;
    }
  }

  /**
   * Update vector metadata
   * @param {string} chunkId - Chunk identifier
   * @param {Object} metadata - New metadata
   * @returns {boolean} Success status
   */
  async updateVectorMetadata(chunkId, metadata) {
    try {
      const result = await this.collection.updateOne(
        { chunkId },
        {
          $set: {
            metadata: {
              ...metadata,
              updatedAt: new Date(),
            },
          },
        }
      );

      if (result.modifiedCount > 0) {
        // Invalidate cache
        await this.invalidateCache(chunkId);
        return true;
      }

      return false;
    } catch (error) {
      console.error("Failed to update vector metadata:", error);
      throw error;
    }
  }

  /**
   * Delete vector by chunk ID
   * @param {string} chunkId - Chunk identifier
   * @returns {boolean} Success status
   */
  async deleteVector(chunkId) {
    try {
      const result = await this.collection.deleteOne({ chunkId });

      if (result.deletedCount > 0) {
        await this.invalidateCache(chunkId);
        return true;
      }

      return false;
    } catch (error) {
      console.error("Failed to delete vector:", error);
      throw error;
    }
  }

  /**
   * Delete all vectors for a document
   * @param {string} documentId - Document identifier
   * @returns {number} Number of deleted vectors
   */
  async deleteVectorsByDocument(documentId) {
    try {
      // Get all chunk IDs for cache invalidation
      const vectors = await this.collection
        .find({ documentId }, { projection: { chunkId: 1 } })
        .toArray();

      const result = await this.collection.deleteMany({ documentId });

      // Invalidate cache for all chunks
      await Promise.all(
        vectors.map((vector) => this.invalidateCache(vector.chunkId))
      );

      return result.deletedCount;
    } catch (error) {
      console.error("Failed to delete vectors by document:", error);
      throw error;
    }
  }

  /**
   * Get vector store statistics
   * @returns {Object} Statistics object
   */
  async getStats() {
    try {
      const totalVectors = await this.collection.countDocuments();
      const uniqueDocuments = await this.collection.distinct("documentId");

      const pipeline = [
        {
          $group: {
            _id: "$metadata.documentType",
            count: { $sum: 1 },
          },
        },
      ];

      const typeStats = await this.collection.aggregate(pipeline).toArray();

      return {
        totalVectors,
        uniqueDocuments: uniqueDocuments.length,
        typeDistribution: typeStats.reduce((acc, stat) => {
          acc[stat._id] = stat.count;
          return acc;
        }, {}),
        dimensions: this.dimensions,
      };
    } catch (error) {
      console.error("Failed to get vector store stats:", error);
      throw error;
    }
  }

  /**
   * Cache vector in Redis
   * @param {string} chunkId - Chunk identifier
   * @param {Object} vectorDoc - Vector document
   */
  async cacheVector(chunkId, vectorDoc) {
    try {
      const key = `${this.cachePrefix}${chunkId}`;
      await this.redis.setEx(key, this.cacheTTL, JSON.stringify(vectorDoc));
    } catch (error) {
      console.error("Failed to cache vector:", error);
    }
  }

  /**
   * Get cached vector from Redis
   * @param {string} chunkId - Chunk identifier
   * @returns {Object|null} Cached vector or null
   */
  async getCachedVector(chunkId) {
    try {
      const key = `${this.cachePrefix}${chunkId}`;
      const cached = await this.redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error("Failed to get cached vector:", error);
      return null;
    }
  }

  /**
   * Invalidate cache for a vector
   * @param {string} chunkId - Chunk identifier
   */
  async invalidateCache(chunkId) {
    try {
      const key = `${this.cachePrefix}${chunkId}`;
      await this.redis.del(key);
    } catch (error) {
      console.error("Failed to invalidate cache:", error);
    }
  }

  /**
   * Close connections
   */
  async close() {
    try {
      if (this.mongo) {
        await this.mongo.close();
      }
      if (this.redis) {
        await this.redis.quit();
      }
      console.log("Vector store connections closed");
    } catch (error) {
      console.error("Failed to close vector store connections:", error);
    }
  }
}

module.exports = VectorStore;
