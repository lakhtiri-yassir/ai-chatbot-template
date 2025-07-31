const Document = require('../models/Document.model');
const Chunk = require('../models/Chunk.model');
const chunkingService = require('./chunking.service');
const embeddingService = require('./embedding.service');
const vectorService = require('./vector.service');
const cacheService = require('./cache.service');
const documentProcessor = require('../utils/documentProcessor');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs').promises;

class KnowledgeService {
  constructor() {
    this.processingQueue = [];
    this.isProcessing = false;
    this.documentsPath = process.env.KNOWLEDGE_DOCS_PATH || './knowledge/documents';
    this.processedPath = process.env.KNOWLEDGE_PROCESSED_PATH || './knowledge/processed';
    this.supportedFormats = [
      '.pdf', '.docx', '.doc', '.txt', '.md', '.html'
    ];
  }

  /**
   * Initialize knowledge service
   */
  async initialize() {
    try {
      await this.ensureDirectories();
      await this.loadInitialDocuments();
      logger.info('Knowledge service initialized');
    } catch (error) {
      logger.error('Failed to initialize knowledge service:', error);
      throw error;
    }
  }

  /**
   * Ensure required directories exist
   */
  async ensureDirectories() {
    try {
      await fs.mkdir(this.documentsPath, { recursive: true });
      await fs.mkdir(this.processedPath, { recursive: true });
    } catch (error) {
      logger.error('Failed to create directories:', error);
      throw error;
    }
  }

  /**
   * Load initial documents from the documents directory
   */
  async loadInitialDocuments() {
    try {
      const files = await fs.readdir(this.documentsPath);
      const documentFiles = files.filter(file => 
        this.supportedFormats.includes(path.extname(file).toLowerCase())
      );

      for (const file of documentFiles) {
        const filePath = path.join(this.documentsPath, file);
        const stats = await fs.stat(filePath);
        
        // Check if document already exists
        const existingDoc = await Document.findOne({
          filename: file,
          fileSize: stats.size
        });

        if (!existingDoc) {
          logger.info(`Processing initial document: ${file}`);
          await this.processDocumentFile(filePath, {
            title: path.basename(file, path.extname(file)),
            description: `Auto-loaded from ${file}`,
            priority: 8
          });
        }
      }
    } catch (error) {
      logger.error('Failed to load initial documents:', error);
    }
  }

  /**
   * Process a document file
   * @param {String} filePath - Path to the document file
   * @param {Object} metadata - Document metadata
   * @returns {Object} Processed document
   */
  async processDocumentFile(filePath, metadata = {}) {
    try {
      const {
        title = path.basename(filePath, path.extname(filePath)),
        description = '',
        priority = 5
      } = metadata;

      const stats = await fs.stat(filePath);
      const fileContent = await fs.readFile(filePath);
      
      // Extract text content
      const extractedText = await documentProcessor.extractText(filePath, fileContent);
      
      if (!extractedText || extractedText.trim().length === 0) {
        throw new Error('No text could be extracted from the document');
      }

      // Generate file hash
      const crypto = require('crypto');
      const fileHash = crypto.createHash('md5').update(fileContent).digest('hex');

      // Create document
      const document = new Document({
        title,
        description,
        filename: path.basename(filePath),
        originalName: path.basename(filePath),
        filePath,
        fileSize: stats.size,
        mimeType: this.getMimeType(filePath),
        extractedText,
        metadata: {
          fileHash,
          extractionMethod: this.getExtractionMethod(filePath),
          extractionDate: new Date(),
          wordCount: extractedText.split(/\s+/).length,
          characterCount: extractedText.length
        },
        processingStatus: 'completed',
        priority,
        uploadedBy: 'system'
      });

      const savedDocument = await document.save();
      
      // Queue for chunking and embedding
      this.queueDocumentProcessing(savedDocument._id, {
        chunking: true,
        embedding: true
      });

      logger.info(`Document processed successfully: ${title}`, {
        documentId: savedDocument._id,
        fileSize: stats.size,
        wordCount: document.metadata.wordCount
      });

      return savedDocument;

    } catch (error) {
      logger.error(`Failed to process document file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Process entire knowledge base
   * @param {Boolean} reprocess - Whether to reprocess existing documents
   * @returns {Object} Processing results
   */
  async processKnowledgeBase(reprocess = false) {
    try {
      logger.info('Starting knowledge base processing', { reprocess });

      const results = {
        documents: {
          processed: 0,
          failed: 0,
          skipped: 0
        },
        chunks: {
          created: 0,
          failed: 0
        },
        embeddings: {
          generated: 0,
          failed: 0
        }
      };

      // Get documents to process
      const query = reprocess ? {} : {
        $or: [
          { chunkingStatus: { $ne: 'completed' } },
          { embeddingStatus: { $ne: 'completed' } }
        ]
      };

      const documents = await Document.find(query)
        .sort({ priority: -1, createdAt: 1 });

      for (const document of documents) {
        try {
          // Process chunking if needed
          if (reprocess || document.chunkingStatus !== 'completed') {
            logger.info(`Processing chunks for document ${document.title}`);
            
            const chunks = await chunkingService.processDocument(document._id, {
              method: 'semantic',
              chunkSize: 1000,
              overlap: 200
            });

            results.chunks.created += chunks.length;
          }

          // Process embeddings if needed
          if (reprocess || document.embeddingStatus !== 'completed') {
            logger.info(`Processing embeddings for document ${document.title}`);
            
            const embeddingResults = await embeddingService.processDocumentEmbeddings(
              document._id,
              { overwrite: reprocess }
            );

            results.embeddings.generated += embeddingResults.processed;
            results.embeddings.failed += embeddingResults.failed;
          }

          results.documents.processed++;

        } catch (error) {
          logger.error(`Failed to process document ${document.title}:`, error);
          results.documents.failed++;
        }
      }

      logger.info('Knowledge base processing completed', results);
      return results;

    } catch (error) {
      logger.error('Knowledge base processing failed:', error);
      throw error;
    }
  }

  /**
   * Search for relevant chunks
   * @param {String} query - Search query
   * @param {Object} options - Search options
   * @returns {Array} Array of relevant chunks
   */
  async searchRelevantChunks(query, options = {}) {
    try {
      const {
        limit = 5,
        threshold = 0.7,
        documentId = null,
        includeMetadata = true,
        useCache = true
      } = options;

      if (!query || query.trim().length === 0) {
        return [];
      }

      // Check cache first
      const cacheKey = this.generateSearchCacheKey(query, options);
      if (useCache) {
        const cachedResults = await cacheService.get(cacheKey);
        if (cachedResults) {
          logger.info('Knowledge search cache hit');
          return JSON.parse(cachedResults);
        }
      }

      // Perform vector search
      const results = await vectorService.searchRelevantChunks(query, {
        limit,
        threshold,
        documentId
      });

      // Enhance results with document information
      const enhancedResults = await this.enhanceSearchResults(results, includeMetadata);

      // Update search statistics
      await this.updateSearchStats(query, enhancedResults.length);

      // Cache results
      if (useCache) {
        await cacheService.set(cacheKey, JSON.stringify(enhancedResults), 300); // 5 minutes
      }

      logger.info('Knowledge search completed', {
        query: query.substring(0, 50),
        resultsFound: enhancedResults.length,
        threshold
      });

      return enhancedResults;

    } catch (error) {
      logger.error('Knowledge search failed:', error);
      throw error;
    }
  }

  /**
   * Get knowledge base status
   * @returns {Object} Knowledge base status
   */
  async getKnowledgeStatus() {
    try {
      const [documentStats, chunkStats, embeddingStats] = await Promise.all([
        Document.getStats(),
        Chunk.getStats(),
        embeddingService.getEmbeddingStats()
      ]);

      const status = {
        documents: {
          total: documentStats[0]?.totalDocuments || 0,
          processed: documentStats[0]?.processingCompleted || 0,
          pending: documentStats[0]?.processingPending || 0,
          failed: documentStats[0]?.processingFailed || 0,
          totalSize: documentStats[0]?.totalSize || 0
        },
        chunks: {
          total: chunkStats[0]?.totalChunks || 0,
          avgWordCount: chunkStats[0]?.avgWordCount || 0,
          avgCharCount: chunkStats[0]?.avgCharCount || 0
        },
        embeddings: {
          total: embeddingStats.total || 0,
          completed: embeddingStats.completed || 0,
          pending: embeddingStats.pending || 0,
          failed: embeddingStats.failed || 0,
          completionRate: embeddingStats.completionRate || 0
        },
        processing: {
          isProcessing: this.isProcessing,
          queueLength: this.processingQueue.length
        },
        lastUpdated: new Date().toISOString()
      };

      return status;

    } catch (error) {
      logger.error('Failed to get knowledge status:', error);
      throw error;
    }
  }

  /**
   * Get document chunks
   * @param {String} documentId - Document ID
   * @param {Number} limit - Maximum number of chunks
   * @param {Number} offset - Offset for pagination
   * @returns {Array} Array of chunks
   */
  async getDocumentChunks(documentId, limit = 50, offset = 0) {
    try {
      const chunks = await Chunk.find({
        documentId,
        deletedAt: null
      })
      .sort({ 'position.startIndex': 1 })
      .skip(offset)
      .limit(limit)
      .lean();

      return chunks.map(chunk => ({
        id: chunk._id,
        chunkId: chunk.chunkId,
        content: chunk.content,
        position: chunk.position,
        metadata: chunk.metadata,
        embeddingStatus: chunk.embeddingStatus,
        stats: chunk.stats
      }));

    } catch (error) {
      logger.error('Failed to get document chunks:', error);
      throw error;
    }
  }

  /**
   * Reprocess specific document
   * @param {String} documentId - Document ID
   * @param {Object} options - Processing options
   * @returns {Object} Processing results
   */
  async reprocessDocument(documentId, options = {}) {
    try {
      const {
        rechunk = true,
        reembed = true,
        chunkingOptions = {}
      } = options;

      const document = await Document.findById(documentId);
      if (!document) {
        throw new Error('Document not found');
      }

      logger.info(`Reprocessing document: ${document.title}`);

      const results = {
        chunking: null,
        embedding: null
      };

      // Reprocess chunking
      if (rechunk) {
        const chunks = await chunkingService.rechunkDocument(documentId, {
          method: 'semantic',
          chunkSize: 1000,
          overlap: 200,
          ...chunkingOptions
        });

        results.chunking = {
          chunksCreated: chunks.length
        };
      }

      // Reprocess embeddings
      if (reembed) {
        const embeddingResults = await embeddingService.processDocumentEmbeddings(
          documentId,
          { overwrite: true }
        );

        results.embedding = embeddingResults;
      }

      logger.info('Document reprocessing completed', {
        documentId,
        title: document.title,
        results
      });

      return results;

    } catch (error) {
      logger.error(`Failed to reprocess document ${documentId}:`, error);
      throw error;
    }
  }

  /**
   * Queue document processing
   * @param {String} documentId - Document ID
   * @param {Object} options - Processing options
   */
  queueDocumentProcessing(documentId, options = {}) {
    this.processingQueue.push({
      documentId,
      options,
      timestamp: new Date()
    });

    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  /**
   * Process the document queue
   */
  async processQueue() {
    if (this.isProcessing || this.processingQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    logger.info('Starting document processing queue');

    try {
      while (this.processingQueue.length > 0) {
        const { documentId, options } = this.processingQueue.shift();

        try {
          // Process chunking
          if (options.chunking) {
            await chunkingService.processDocument(documentId, {
              method: 'semantic',
              chunkSize: 1000,
              overlap: 200
            });
          }

          // Process embeddings
          if (options.embedding) {
            await embeddingService.processDocumentEmbeddings(documentId);
          }

          logger.info(`Queue processing completed for document ${documentId}`);

        } catch (error) {
          logger.error(`Queue processing failed for document ${documentId}:`, error);
        }
      }
    } finally {
      this.isProcessing = false;
      logger.info('Document processing queue completed');
    }
  }

  /**
   * Enhance search results with document information
   * @param {Array} results - Search results
   * @param {Boolean} includeMetadata - Whether to include metadata
   * @returns {Array} Enhanced results
   */
  async enhanceSearchResults(results, includeMetadata = true) {
    try {
      const documentIds = [...new Set(results.map(r => r.documentId))];
      const documents = await Document.find({
        _id: { $in: documentIds }
      }).lean();

      const documentMap = documents.reduce((map, doc) => {
        map[doc._id] = doc;
        return map;
      }, {});

      return results.map(result => {
        const document = documentMap[result.documentId];
        
        const enhanced = {
          ...result,
          document: {
            id: document._id,
            title: document.title,
            filename: document.filename
          }
        };

        if (includeMetadata) {
          enhanced.document.metadata = document.metadata;
        }

        return enhanced;
      });

    } catch (error) {
      logger.error('Failed to enhance search results:', error);
      return results;
    }
  }

  /**
   * Update search statistics
   * @param {String} query - Search query
   * @param {Number} resultsCount - Number of results found
   */
  async updateSearchStats(query, resultsCount) {
    try {
      const statsKey = 'knowledge:search:stats';
      const stats = await cacheService.get(statsKey);
      
      let searchStats = stats ? JSON.parse(stats) : {
        totalSearches: 0,
        avgResults: 0,
        topQueries: {},
        lastUpdated: new Date()
      };

      searchStats.totalSearches++;
      searchStats.avgResults = (searchStats.avgResults * (searchStats.totalSearches - 1) + resultsCount) / searchStats.totalSearches;
      
      // Track top queries
      const queryKey = query.toLowerCase().trim();
      searchStats.topQueries[queryKey] = (searchStats.topQueries[queryKey] || 0) + 1;

      // Keep only top 100 queries
      const sortedQueries = Object.entries(searchStats.topQueries)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 100);
      
      searchStats.topQueries = Object.fromEntries(sortedQueries);
      searchStats.lastUpdated = new Date();

      await cacheService.set(statsKey, JSON.stringify(searchStats), 3600); // 1 hour

    } catch (error) {
      logger.error('Failed to update search stats:', error);
    }
  }

  /**
   * Generate cache key for search results
   * @param {String} query - Search query
   * @param {Object} options - Search options
   * @returns {String} Cache key
   */
  generateSearchCacheKey(query, options) {
    const key = {
      query: query.toLowerCase().trim(),
      limit: options.limit || 5,
      threshold: options.threshold || 0.7,
      documentId: options.documentId || null
    };

    return `knowledge:search:${Buffer.from(JSON.stringify(key)).toString('base64')}`;
  }

  /**
   * Get MIME type for file
   * @param {String} filePath - File path
   * @returns {String} MIME type
   */
  getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.pdf': 'application/pdf',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.doc': 'application/msword',
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.html': 'text/html'
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Get extraction method for file
   * @param {String} filePath - File path
   * @returns {String} Extraction method
   */
  getExtractionMethod(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const methods = {
      '.pdf': 'pdf-parse',
      '.docx': 'mammoth',
      '.doc': 'mammoth',
      '.txt': 'text',
      '.md': 'text',
      '.html': 'text'
    };

    return methods[ext] || 'manual';
  }

  /**
   * Clean up orphaned data
   * @returns {Object} Cleanup results
   */
  async cleanup() {
    try {
      logger.info('Starting knowledge base cleanup');

      const results = {
        orphanedChunks: 0,
        expiredCache: 0,
        failedDocuments: 0
      };

      // Clean up orphaned chunks
      const orphanedResult = await Chunk.cleanupOrphaned();
      results.orphanedChunks = orphanedResult.modifiedCount || 0;

      // Clean up expired documents
      const expiredResult = await Document.cleanupExpired();
      results.expiredDocuments = expiredResult.modifiedCount || 0;

      // Clean up failed processing attempts (older than 24 hours)
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const failedResult = await Document.updateMany(
        {
          processingStatus: 'failed',
          'processingError.timestamp': { $lt: dayAgo }
        },
        {
          processingStatus: 'pending',
          $unset: { processingError: 1 }
        }
      );
      results.failedDocuments = failedResult.modifiedCount || 0;

      logger.info('Knowledge base cleanup completed', results);
      return results;

    } catch (error) {
      logger.error('Knowledge base cleanup failed:', error);
      throw error;
    }
  }

  /**
   * Get search analytics
   * @returns {Object} Search analytics
   */
  async getSearchAnalytics() {
    try {
      const statsKey = 'knowledge:search:stats';
      const stats = await cacheService.get(statsKey);
      
      if (!stats) {
        return {
          totalSearches: 0,
          avgResults: 0,
          topQueries: {},
          lastUpdated: null
        };
      }

      return JSON.parse(stats);

    } catch (error) {
      logger.error('Failed to get search analytics:', error);
      return {
        totalSearches: 0,
        avgResults: 0,
        topQueries: {},
        lastUpdated: null
      };
    }
  }

  /**
   * Optimize knowledge base
   * @returns {Object} Optimization results
   */
  async optimize() {
    try {
      logger.info('Starting knowledge base optimization');

      const results = {
        documentsOptimized: 0,
        chunksOptimized: 0,
        embeddingsOptimized: 0
      };

      // Find documents with poor chunking
      const poorChunkingDocs = await Document.find({
        chunkingStatus: 'completed',
        totalChunks: { $lt: 5 }, // Very few chunks might indicate poor chunking
        'metadata.wordCount': { $gt: 1000 } // But has substantial content
      });

      // Rechunk documents with poor chunking
      for (const doc of poorChunkingDocs) {
        try {
          await chunkingService.rechunkDocument(doc._id, {
            method: 'semantic',
            chunkSize: 800,
            overlap: 150
          });
          results.documentsOptimized++;
        } catch (error) {
          logger.error(`Failed to optimize document ${doc._id}:`, error);
        }
      }

      // Find chunks with poor embedding quality
      const poorEmbeddingChunks = await Chunk.find({
        embeddingStatus: 'completed',
        'embedding.confidence': { $lt: 0.8 }
      });

      // Regenerate embeddings for poor quality chunks
      for (const chunk of poorEmbeddingChunks) {
        try {
          await embeddingService.processBatchChunkEmbeddings([chunk]);
          results.chunksOptimized++;
        } catch (error) {
          logger.error(`Failed to optimize chunk ${chunk._id}:`, error);
        }
      }

      logger.info('Knowledge base optimization completed', results);
      return results;

    } catch (error) {
      logger.error('Knowledge base optimization failed:', error);
      throw error;
    }
  }

  /**
   * Export knowledge base data
   * @param {Object} options - Export options
   * @returns {Object} Exported data
   */
  async exportKnowledgeBase(options = {}) {
    try {
      const {
        includeContent = true,
        includeEmbeddings = false,
        documentIds = null
      } = options;

      const query = { deletedAt: null };
      if (documentIds) {
        query._id = { $in: documentIds };
      }

      const documents = await Document.find(query).lean();
      const exportData = {
        documents: [],
        chunks: [],
        metadata: {
          exportedAt: new Date().toISOString(),
          totalDocuments: documents.length,
          includeContent,
          includeEmbeddings
        }
      };

      for (const doc of documents) {
        const exportDoc = {
          id: doc._id,
          title: doc.title,
          description: doc.description,
          filename: doc.filename,
          metadata: doc.metadata,
          processingStatus: doc.processingStatus,
          chunkingStatus: doc.chunkingStatus,
          embeddingStatus: doc.embeddingStatus,
          totalChunks: doc.totalChunks,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt
        };

        if (includeContent) {
          exportDoc.extractedText = doc.extractedText;
        }

        exportData.documents.push(exportDoc);

        // Get chunks for this document
        const chunks = await Chunk.find({
          documentId: doc._id,
          deletedAt: null
        }).lean();

        for (const chunk of chunks) {
          const exportChunk = {
            id: chunk._id,
            chunkId: chunk.chunkId,
            documentId: chunk.documentId,
            content: chunk.content,
            position: chunk.position,
            metadata: chunk.metadata,
            processingStatus: chunk.processingStatus,
            embeddingStatus: chunk.embeddingStatus,
            createdAt: chunk.createdAt
          };

          if (includeEmbeddings && chunk.embedding) {
            exportChunk.embedding = chunk.embedding;
          }

          exportData.chunks.push(exportChunk);
        }
      }

      exportData.metadata.totalChunks = exportData.chunks.length;

      logger.info('Knowledge base export completed', {
        documents: exportData.documents.length,
        chunks: exportData.chunks.length,
        includeContent,
        includeEmbeddings
      });

      return exportData;

    } catch (error) {
      logger.error('Knowledge base export failed:', error);
      throw error;
    }
  }

  /**
   * Import knowledge base data
   * @param {Object} data - Import data
   * @param {Object} options - Import options
   * @returns {Object} Import results
   */
  async importKnowledgeBase(data, options = {}) {
    try {
      const {
        overwrite = false,
        validateData = true
      } = options;

      if (validateData) {
        if (!data.documents || !Array.isArray(data.documents)) {
          throw new Error('Invalid import data: documents array required');
        }

        if (!data.chunks || !Array.isArray(data.chunks)) {
          throw new Error('Invalid import data: chunks array required');
        }
      }

      const results = {
        documentsImported: 0,
        chunksImported: 0,
        documentsSkipped: 0,
        chunksSkipped: 0,
        errors: []
      };

      // Import documents
      for (const docData of data.documents) {
        try {
          const existingDoc = await Document.findById(docData.id);
          
          if (existingDoc && !overwrite) {
            results.documentsSkipped++;
            continue;
          }

          const document = new Document({
            _id: docData.id,
            title: docData.title,
            description: docData.description,
            filename: docData.filename,
            extractedText: docData.extractedText || '',
            metadata: docData.metadata || {},
            processingStatus: docData.processingStatus || 'pending',
            chunkingStatus: docData.chunkingStatus || 'pending',
            embeddingStatus: docData.embeddingStatus || 'pending',
            totalChunks: docData.totalChunks || 0,
            uploadedBy: 'import'
          });

          await document.save();
          results.documentsImported++;

        } catch (error) {
          results.errors.push(`Document ${docData.id}: ${error.message}`);
        }
      }

      // Import chunks
      for (const chunkData of data.chunks) {
        try {
          const existingChunk = await Chunk.findById(chunkData.id);
          
          if (existingChunk && !overwrite) {
            results.chunksSkipped++;
            continue;
          }

          const chunk = new Chunk({
            _id: chunkData.id,
            chunkId: chunkData.chunkId,
            documentId: chunkData.documentId,
            content: chunkData.content,
            position: chunkData.position,
            metadata: chunkData.metadata || {},
            embedding: chunkData.embedding || {},
            processingStatus: chunkData.processingStatus || 'pending',
            embeddingStatus: chunkData.embeddingStatus || 'pending'
          });

          await chunk.save();
          results.chunksImported++;

        } catch (error) {
          results.errors.push(`Chunk ${chunkData.id}: ${error.message}`);
        }
      }

      logger.info('Knowledge base import completed', results);
      return results;

    } catch (error) {
      logger.error('Knowledge base import failed:', error);
      throw error;
    }
  }

  /**
   * Get knowledge base health check
   * @returns {Object} Health status
   */
  async healthCheck() {
    try {
      const [dbHealth, cacheHealth, processingHealth] = await Promise.all([
        this.checkDatabaseHealth(),
        cacheService.healthCheck(),
        this.checkProcessingHealth()
      ]);

      const overallHealth = dbHealth.status === 'healthy' && 
                           cacheHealth.status === 'healthy' && 
                           processingHealth.status === 'healthy';

      return {
        status: overallHealth ? 'healthy' : 'degraded',
        database: dbHealth,
        cache: cacheHealth,
        processing: processingHealth,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Knowledge service health check failed:', error);
      return {
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Check database health
   * @returns {Object} Database health status
   */
  async checkDatabaseHealth() {
    try {
      const documentsCount = await Document.countDocuments();
      const chunksCount = await Chunk.countDocuments();

      return {
        status: 'healthy',
        documents: documentsCount,
        chunks: chunksCount,
        message: 'Database is operational'
      };

    } catch (error) {
      return {
        status: 'error',
        message: error.message
      };
    }
  }

  /**
   * Check processing health
   * @returns {Object} Processing health status
   */
  async checkProcessingHealth() {
    try {
      const pendingDocs = await Document.countDocuments({
        $or: [
          { processingStatus: 'processing' },
          { chunkingStatus: 'processing' },
          { embeddingStatus: 'processing' }
        ]
      });

      const failedDocs = await Document.countDocuments({
        $or: [
          { processingStatus: 'failed' },
          { chunkingStatus: 'failed' },
          { embeddingStatus: 'failed' }
        ]
      });

      return {
        status: 'healthy',
        isProcessing: this.isProcessing,
        queueLength: this.processingQueue.length,
        pendingDocuments: pendingDocs,
        failedDocuments: failedDocs,
        message: 'Processing system is operational'
      };

    } catch (error) {
      return {
        status: 'error',
        message: error.message
      };
    }
  }
}

module.exports = new KnowledgeService();