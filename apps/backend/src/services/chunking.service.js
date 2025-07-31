const natural = require("natural");
const Document = require("../models/Document.model");
const Chunk = require("../models/Chunk.model");
const logger = require("../utils/logger");

class ChunkingService {
  constructor() {
    this.defaultChunkSize = 1000;
    this.defaultOverlap = 200;
    this.maxChunkSize = 2000;
    this.minChunkSize = 100;
    this.sentenceTokenizer = new natural.SentenceTokenizer();
    this.wordTokenizer = new natural.WordTokenizer();
  }

  /**
   * Process document and create chunks
   * @param {String} documentId - Document ID to process
   * @param {Object} options - Chunking options
   * @returns {Array} Array of created chunks
   */
  async processDocument(documentId, options = {}) {
    try {
      const {
        chunkSize = this.defaultChunkSize,
        overlap = this.defaultOverlap,
        method = "semantic",
        preserveStructure = true,
      } = options;

      // Get document
      const document = await Document.findById(documentId);
      if (!document) {
        throw new Error("Document not found");
      }

      if (!document.extractedText) {
        throw new Error("Document has no extracted text");
      }

      // Update document status
      await document.updateProcessingStatus("processing");

      logger.info(`Starting chunking for document ${documentId}`, {
        method,
        chunkSize,
        overlap,
        textLength: document.extractedText.length,
      });

      // Delete existing chunks for this document
      await Chunk.deleteMany({ documentId });

      // Create chunks based on method
      let chunks;
      switch (method) {
        case "fixed":
          chunks = this.createFixedSizeChunks(
            document.extractedText,
            chunkSize,
            overlap
          );
          break;
        case "semantic":
          chunks = this.createSemanticChunks(
            document.extractedText,
            chunkSize,
            overlap
          );
          break;
        case "sentence":
          chunks = this.createSentenceChunks(
            document.extractedText,
            chunkSize,
            overlap
          );
          break;
        case "paragraph":
          chunks = this.createParagraphChunks(
            document.extractedText,
            chunkSize,
            overlap
          );
          break;
        default:
          chunks = this.createSemanticChunks(
            document.extractedText,
            chunkSize,
            overlap
          );
      }

      // Save chunks to database
      const savedChunks = await this.saveChunks(chunks, documentId, method);

      // Update document with chunk count
      document.totalChunks = savedChunks.length;
      document.chunkingStatus = "completed";
      await document.save();

      logger.info(`Document chunking completed`, {
        documentId,
        method,
        chunksCreated: savedChunks.length,
        avgChunkSize:
          chunks.reduce((sum, c) => sum + c.content.length, 0) / chunks.length,
      });

      return savedChunks;
    } catch (error) {
      logger.error("Document chunking failed:", error);

      // Update document status to failed
      const document = await Document.findById(documentId);
      if (document) {
        document.chunkingStatus = "failed";
        await document.save();
      }

      throw error;
    }
  }

  /**
   * Create fixed-size chunks with overlap
   * @param {String} text - Text to chunk
   * @param {Number} chunkSize - Size of each chunk
   * @param {Number} overlap - Overlap between chunks
   * @returns {Array} Array of chunk objects
   */
  createFixedSizeChunks(text, chunkSize, overlap) {
    const chunks = [];
    let position = 0;
    let chunkIndex = 0;

    while (position < text.length) {
      const endPosition = Math.min(position + chunkSize, text.length);
      let chunkText = text.substring(position, endPosition);

      // Try to end at a word boundary if possible
      if (endPosition < text.length) {
        const lastSpaceIndex = chunkText.lastIndexOf(" ");
        if (lastSpaceIndex > chunkSize * 0.8) {
          // Only if we're not cutting too much
          chunkText = chunkText.substring(0, lastSpaceIndex);
        }
      }

      const chunk = {
        content: chunkText.trim(),
        position: {
          startIndex: position,
          endIndex: position + chunkText.length,
        },
        metadata: {
          chunkIndex,
          method: "fixed",
          overlapBefore: chunkIndex > 0 ? overlap : 0,
          overlapAfter: position + chunkText.length < text.length ? overlap : 0,
        },
      };

      chunks.push(chunk);

      // Move position forward, accounting for overlap
      position = position + chunkText.length - overlap;
      chunkIndex++;

      // Prevent infinite loop
      if (position >= text.length - overlap) {
        break;
      }
    }

    return chunks;
  }

  /**
   * Create semantic chunks based on content meaning
   * @param {String} text - Text to chunk
   * @param {Number} targetSize - Target size for chunks
   * @param {Number} overlap - Overlap between chunks
   * @returns {Array} Array of chunk objects
   */
  createSemanticChunks(text, targetSize, overlap) {
    // First, split by paragraphs
    const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
    const chunks = [];
    let currentChunk = "";
    let currentPosition = 0;
    let chunkIndex = 0;

    for (const paragraph of paragraphs) {
      const paragraphStart = text.indexOf(paragraph, currentPosition);

      // If adding this paragraph would exceed target size
      if (
        currentChunk.length + paragraph.length > targetSize &&
        currentChunk.length > 0
      ) {
        // Save current chunk
        chunks.push({
          content: currentChunk.trim(),
          position: {
            startIndex: currentPosition - currentChunk.length,
            endIndex: currentPosition,
          },
          metadata: {
            chunkIndex,
            method: "semantic",
            contentType: this.detectContentType(currentChunk),
            paragraphCount: currentChunk.split(/\n\s*\n/).length,
          },
        });

        // Start new chunk with overlap
        const overlapText = this.getOverlapText(currentChunk, overlap);
        currentChunk = overlapText + paragraph;
        currentPosition = paragraphStart;
        chunkIndex++;
      } else {
        // Add paragraph to current chunk
        currentChunk += (currentChunk.length > 0 ? "\n\n" : "") + paragraph;
        currentPosition = paragraphStart + paragraph.length;
      }
    }

    // Add final chunk if it exists
    if (currentChunk.trim().length > 0) {
      chunks.push({
        content: currentChunk.trim(),
        position: {
          startIndex: currentPosition - currentChunk.length,
          endIndex: currentPosition,
        },
        metadata: {
          chunkIndex,
          method: "semantic",
          contentType: this.detectContentType(currentChunk),
          paragraphCount: currentChunk.split(/\n\s*\n/).length,
        },
      });
    }

    return chunks;
  }

  /**
   * Create sentence-based chunks
   * @param {String} text - Text to chunk
   * @param {Number} targetSize - Target size for chunks
   * @param {Number} overlap - Overlap between chunks
   * @returns {Array} Array of chunk objects
   */
  createSentenceChunks(text, targetSize, overlap) {
    const sentences = this.sentenceTokenizer.tokenize(text);
    const chunks = [];
    let currentChunk = "";
    let currentSentences = [];
    let chunkIndex = 0;
    let position = 0;

    for (const sentence of sentences) {
      const sentenceStart = text.indexOf(sentence, position);

      // If adding this sentence would exceed target size
      if (
        currentChunk.length + sentence.length > targetSize &&
        currentChunk.length > 0
      ) {
        // Save current chunk
        chunks.push({
          content: currentChunk.trim(),
          position: {
            startIndex: position - currentChunk.length,
            endIndex: position,
          },
          metadata: {
            chunkIndex,
            method: "sentence",
            sentenceCount: currentSentences.length,
            avgSentenceLength: currentChunk.length / currentSentences.length,
          },
        });

        // Start new chunk with overlap (last few sentences)
        const overlapSentences = this.getOverlapSentences(
          currentSentences,
          overlap
        );
        currentChunk =
          overlapSentences.join(" ") +
          (overlapSentences.length > 0 ? " " : "") +
          sentence;
        currentSentences = [...overlapSentences, sentence];
        chunkIndex++;
      } else {
        // Add sentence to current chunk
        currentChunk += (currentChunk.length > 0 ? " " : "") + sentence;
        currentSentences.push(sentence);
      }

      position = sentenceStart + sentence.length;
    }

    // Add final chunk if it exists
    if (currentChunk.trim().length > 0) {
      chunks.push({
        content: currentChunk.trim(),
        position: {
          startIndex: position - currentChunk.length,
          endIndex: position,
        },
        metadata: {
          chunkIndex,
          method: "sentence",
          sentenceCount: currentSentences.length,
          avgSentenceLength: currentChunk.length / currentSentences.length,
        },
      });
    }

    return chunks;
  }

  /**
   * Create paragraph-based chunks
   * @param {String} text - Text to chunk
   * @param {Number} targetSize - Target size for chunks
   * @param {Number} overlap - Overlap between chunks
   * @returns {Array} Array of chunk objects
   */
  createParagraphChunks(text, targetSize, overlap) {
    const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
    const chunks = [];
    let currentChunk = "";
    let currentParagraphs = [];
    let chunkIndex = 0;
    let position = 0;

    for (const paragraph of paragraphs) {
      const paragraphStart = text.indexOf(paragraph, position);

      // If adding this paragraph would exceed target size
      if (
        currentChunk.length + paragraph.length > targetSize &&
        currentChunk.length > 0
      ) {
        // Save current chunk
        chunks.push({
          content: currentChunk.trim(),
          position: {
            startIndex: position - currentChunk.length,
            endIndex: position,
          },
          metadata: {
            chunkIndex,
            method: "paragraph",
            paragraphCount: currentParagraphs.length,
            avgParagraphLength: currentChunk.length / currentParagraphs.length,
            contentType: this.detectContentType(currentChunk),
          },
        });

        // Start new chunk with overlap (last paragraph)
        const overlapParagraphs = this.getOverlapParagraphs(
          currentParagraphs,
          overlap
        );
        currentChunk =
          overlapParagraphs.join("\n\n") +
          (overlapParagraphs.length > 0 ? "\n\n" : "") +
          paragraph;
        currentParagraphs = [...overlapParagraphs, paragraph];
        chunkIndex++;
      } else {
        // Add paragraph to current chunk
        currentChunk += (currentChunk.length > 0 ? "\n\n" : "") + paragraph;
        currentParagraphs.push(paragraph);
      }

      position = paragraphStart + paragraph.length;
    }

    // Add final chunk if it exists
    if (currentChunk.trim().length > 0) {
      chunks.push({
        content: currentChunk.trim(),
        position: {
          startIndex: position - currentChunk.length,
          endIndex: position,
        },
        metadata: {
          chunkIndex,
          method: "paragraph",
          paragraphCount: currentParagraphs.length,
          avgParagraphLength: currentChunk.length / currentParagraphs.length,
          contentType: this.detectContentType(currentChunk),
        },
      });
    }

    return chunks;
  }

  /**
   * Save chunks to database
   * @param {Array} chunks - Array of chunk objects
   * @param {String} documentId - Document ID
   * @param {String} method - Chunking method used
   * @returns {Array} Array of saved chunk documents
   */
  async saveChunks(chunks, documentId, method) {
    const savedChunks = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunkData = chunks[i];

      try {
        const chunk = new Chunk({
          documentId,
          chunkId: `${documentId}_chunk_${i + 1}`,
          content: chunkData.content,
          position: chunkData.position,
          metadata: {
            ...chunkData.metadata,
            wordCount: this.wordTokenizer.tokenize(chunkData.content).length,
            characterCount: chunkData.content.length,
            chunkingMethod: method,
            processingDate: new Date(),
          },
          processingStatus: "completed",
        });

        const savedChunk = await chunk.save();
        savedChunks.push(savedChunk);
      } catch (error) {
        logger.error(`Failed to save chunk ${i + 1}:`, error);
        // Continue with other chunks
      }
    }

    return savedChunks;
  }

  /**
   * Get overlap text from the end of a chunk
   * @param {String} text - Text to get overlap from
   * @param {Number} overlapSize - Size of overlap
   * @returns {String} Overlap text
   */
  getOverlapText(text, overlapSize) {
    if (text.length <= overlapSize) {
      return text;
    }

    const overlapText = text.substring(text.length - overlapSize);

    // Try to start at a word boundary
    const firstSpaceIndex = overlapText.indexOf(" ");
    if (firstSpaceIndex > 0 && firstSpaceIndex < overlapSize * 0.5) {
      return overlapText.substring(firstSpaceIndex + 1);
    }

    return overlapText;
  }

  /**
   * Get overlap sentences
   * @param {Array} sentences - Array of sentences
   * @param {Number} overlapSize - Size of overlap in characters
   * @returns {Array} Array of overlap sentences
   */
  getOverlapSentences(sentences, overlapSize) {
    if (sentences.length === 0) return [];

    const overlapSentences = [];
    let currentSize = 0;

    // Start from the end and work backwards
    for (let i = sentences.length - 1; i >= 0; i--) {
      const sentence = sentences[i];
      if (
        currentSize + sentence.length > overlapSize &&
        overlapSentences.length > 0
      ) {
        break;
      }

      overlapSentences.unshift(sentence);
      currentSize += sentence.length;
    }

    return overlapSentences;
  }

  /**
   * Get overlap paragraphs
   * @param {Array} paragraphs - Array of paragraphs
   * @param {Number} overlapSize - Size of overlap in characters
   * @returns {Array} Array of overlap paragraphs
   */
  getOverlapParagraphs(paragraphs, overlapSize) {
    if (paragraphs.length === 0) return [];

    const overlapParagraphs = [];
    let currentSize = 0;

    // Start from the end and work backwards
    for (let i = paragraphs.length - 1; i >= 0; i--) {
      const paragraph = paragraphs[i];
      if (
        currentSize + paragraph.length > overlapSize &&
        overlapParagraphs.length > 0
      ) {
        break;
      }

      overlapParagraphs.unshift(paragraph);
      currentSize += paragraph.length;
    }

    return overlapParagraphs;
  }

  /**
   * Detect content type of a chunk
   * @param {String} content - Chunk content
   * @returns {String} Content type
   */
  detectContentType(content) {
    // Simple heuristics for content type detection
    if (content.match(/^#+\s/m)) {
      return "heading";
    }

    if (content.match(/^\s*[\-\*\+]\s/m)) {
      return "list";
    }

    if (content.match(/^\s*\d+\.\s/m)) {
      return "list";
    }

    if (content.match(/```|`.*`/)) {
      return "code";
    }

    if (content.match(/^\s*>/m)) {
      return "quote";
    }

    if (content.match(/\|.*\|/)) {
      return "table";
    }

    return "text";
  }

  /**
   * Validate chunk content
   * @param {String} content - Chunk content to validate
   * @returns {Boolean} True if valid
   */
  validateChunk(content) {
    if (!content || typeof content !== "string") {
      return false;
    }

    const trimmed = content.trim();

    if (trimmed.length < this.minChunkSize) {
      return false;
    }

    if (trimmed.length > this.maxChunkSize) {
      return false;
    }

    return true;
  }

  /**
   * Get chunking statistics for a document
   * @param {String} documentId - Document ID
   * @returns {Object} Chunking statistics
   */
  async getChunkingStats(documentId) {
    try {
      const document = await Document.findById(documentId);
      if (!document) {
        throw new Error("Document not found");
      }

      const chunks = await Chunk.find({ documentId, deletedAt: null });

      if (chunks.length === 0) {
        return {
          documentId,
          totalChunks: 0,
          avgChunkSize: 0,
          avgWordCount: 0,
          chunkingMethod: null,
          contentTypes: {},
        };
      }

      const contentTypes = {};
      let totalSize = 0;
      let totalWords = 0;

      for (const chunk of chunks) {
        totalSize += chunk.content.length;
        totalWords += chunk.metadata.wordCount || 0;

        const contentType = chunk.metadata.contentType || "text";
        contentTypes[contentType] = (contentTypes[contentType] || 0) + 1;
      }

      return {
        documentId,
        totalChunks: chunks.length,
        avgChunkSize: Math.round(totalSize / chunks.length),
        avgWordCount: Math.round(totalWords / chunks.length),
        chunkingMethod: chunks[0]?.metadata?.chunkingMethod || "unknown",
        contentTypes,
        totalSize,
        totalWords,
      };
    } catch (error) {
      logger.error("Failed to get chunking stats:", error);
      throw error;
    }
  }

  /**
   * Rechunk document with new parameters
   * @param {String} documentId - Document ID
   * @param {Object} options - New chunking options
   * @returns {Array} Array of new chunks
   */
  async rechunkDocument(documentId, options = {}) {
    try {
      logger.info(`Rechunking document ${documentId}`, options);

      // Delete existing chunks
      await Chunk.deleteMany({ documentId });

      // Reset document chunking status
      const document = await Document.findById(documentId);
      if (document) {
        document.chunkingStatus = "pending";
        document.totalChunks = 0;
        await document.save();
      }

      // Process with new options
      return await this.processDocument(documentId, options);
    } catch (error) {
      logger.error("Document rechunking failed:", error);
      throw error;
    }
  }
}

module.exports = new ChunkingService();
