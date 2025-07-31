/**
 * Text Chunking Utility
 * Splits text into manageable chunks for processing and embedding
 */

class TextChunker {
    constructor(options = {}) {
      this.maxChunkSize = options.maxChunkSize || 1000;
      this.overlap = options.overlap || 200;
      this.separators = options.separators || ['\n\n', '\n', '. ', '! ', '? ', ' '];
      this.minChunkSize = options.minChunkSize || 100;
    }
  
    /**
     * Split text into chunks with overlap
     * @param {string} text - Text to chunk
     * @param {Object} metadata - Optional metadata to attach to chunks
     * @returns {Array} Array of chunk objects
     */
    chunkText(text, metadata = {}) {
      if (!text || typeof text !== 'string') {
        throw new Error('Invalid text input');
      }
  
      // Clean and normalize text
      const cleanText = this.cleanText(text);
      
      if (cleanText.length <= this.maxChunkSize) {
        return [{
          content: cleanText,
          index: 0,
          startChar: 0,
          endChar: cleanText.length,
          metadata: { ...metadata, chunkCount: 1 }
        }];
      }
  
      const chunks = [];
      let startIndex = 0;
      let chunkIndex = 0;
  
      while (startIndex < cleanText.length) {
        const endIndex = Math.min(startIndex + this.maxChunkSize, cleanText.length);
        let chunkEnd = endIndex;
  
        // Try to find a good breaking point
        if (endIndex < cleanText.length) {
          chunkEnd = this.findBreakPoint(cleanText, startIndex, endIndex);
        }
  
        const chunkContent = cleanText.substring(startIndex, chunkEnd);
        
        // Skip chunks that are too small (unless it's the last chunk)
        if (chunkContent.length >= this.minChunkSize || chunkEnd === cleanText.length) {
          chunks.push({
            content: chunkContent.trim(),
            index: chunkIndex,
            startChar: startIndex,
            endChar: chunkEnd,
            metadata: {
              ...metadata,
              chunkCount: null, // Will be set after all chunks are created
              wordCount: this.countWords(chunkContent),
              charCount: chunkContent.length
            }
          });
          chunkIndex++;
        }
  
        // Move start index forward with overlap
        startIndex = Math.max(chunkEnd - this.overlap, startIndex + 1);
      }
  
      // Update chunk count metadata
      chunks.forEach(chunk => {
        chunk.metadata.chunkCount = chunks.length;
      });
  
      return chunks;
    }
  
    /**
     * Find the best breaking point for a chunk
     * @param {string} text - Full text
     * @param {number} start - Start index
     * @param {number} end - End index
     * @returns {number} Best breaking point
     */
    findBreakPoint(text, start, end) {
      // Try each separator in order of preference
      for (const separator of this.separators) {
        const lastIndex = text.lastIndexOf(separator, end);
        if (lastIndex > start + this.minChunkSize) {
          return lastIndex + separator.length;
        }
      }
  
      // If no good separator found, use the original end
      return end;
    }
  
    /**
     * Clean and normalize text
     * @param {string} text - Text to clean
     * @returns {string} Cleaned text
     */
    cleanText(text) {
      return text
        .replace(/\r\n/g, '\n') // Normalize line endings
        .replace(/\t/g, ' ') // Replace tabs with spaces
        .replace(/\s+/g, ' ') // Collapse multiple spaces
        .replace(/\n\s+/g, '\n') // Remove spaces at beginning of lines
        .replace(/\n{3,}/g, '\n\n') // Limit consecutive newlines
        .trim();
    }
  
    /**
     * Count words in text
     * @param {string} text - Text to count
     * @returns {number} Word count
     */
    countWords(text) {
      return text.trim().split(/\s+/).filter(word => word.length > 0).length;
    }
  
    /**
     * Chunk text by sentences
     * @param {string} text - Text to chunk
     * @param {Object} metadata - Optional metadata
     * @returns {Array} Array of sentence chunks
     */
    chunkBySentences(text, metadata = {}) {
      const sentences = this.splitIntoSentences(text);
      const chunks = [];
      let currentChunk = '';
      let chunkIndex = 0;
      let startChar = 0;
  
      for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i];
        const testChunk = currentChunk + (currentChunk ? ' ' : '') + sentence;
  
        if (testChunk.length > this.maxChunkSize && currentChunk) {
          // Save current chunk
          chunks.push({
            content: currentChunk.trim(),
            index: chunkIndex,
            startChar,
            endChar: startChar + currentChunk.length,
            metadata: {
              ...metadata,
              sentences: currentChunk.split(/[.!?]+/).filter(s => s.trim()),
              wordCount: this.countWords(currentChunk),
              charCount: currentChunk.length
            }
          });
  
          chunkIndex++;
          startChar += currentChunk.length;
          currentChunk = sentence;
        } else {
          currentChunk = testChunk;
        }
      }
  
      // Add the last chunk
      if (currentChunk) {
        chunks.push({
          content: currentChunk.trim(),
          index: chunkIndex,
          startChar,
          endChar: startChar + currentChunk.length,
          metadata: {
            ...metadata,
            sentences: currentChunk.split(/[.!?]+/).filter(s => s.trim()),
            wordCount: this.countWords(currentChunk),
            charCount: currentChunk.length
          }
        });
      }
  
      // Update chunk count
      chunks.forEach(chunk => {
        chunk.metadata.chunkCount = chunks.length;
      });
  
      return chunks;
    }
  
    /**
     * Split text into sentences
     * @param {string} text - Text to split
     * @returns {Array} Array of sentences
     */
    splitIntoSentences(text) {
      // Simple sentence splitting - can be improved with NLP libraries
      return text
        .split(/(?<=[.!?])\s+/)
        .filter(sentence => sentence.trim().length > 0);
    }
  
    /**
     * Chunk text by paragraphs
     * @param {string} text - Text to chunk
     * @param {Object} metadata - Optional metadata
     * @returns {Array} Array of paragraph chunks
     */
    chunkByParagraphs(text, metadata = {}) {
      const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());
      const chunks = [];
      let currentChunk = '';
      let chunkIndex = 0;
      let startChar = 0;
  
      for (const paragraph of paragraphs) {
        const testChunk = currentChunk + (currentChunk ? '\n\n' : '') + paragraph;
  
        if (testChunk.length > this.maxChunkSize && currentChunk) {
          // Save current chunk
          chunks.push({
            content: currentChunk.trim(),
            index: chunkIndex,
            startChar,
            endChar: startChar + currentChunk.length,
            metadata: {
              ...metadata,
              paragraphs: currentChunk.split(/\n\s*\n/).filter(p => p.trim()),
              wordCount: this.countWords(currentChunk),
              charCount: currentChunk.length
            }
          });
  
          chunkIndex++;
          startChar += currentChunk.length;
          currentChunk = paragraph;
        } else {
          currentChunk = testChunk;
        }
      }
  
      // Add the last chunk
      if (currentChunk) {
        chunks.push({
          content: currentChunk.trim(),
          index: chunkIndex,
          startChar,
          endChar: startChar + currentChunk.length,
          metadata: {
            ...metadata,
            paragraphs: currentChunk.split(/\n\s*\n/).filter(p => p.trim()),
            wordCount: this.countWords(currentChunk),
            charCount: currentChunk.length
          }
        });
      }
  
      // Update chunk count
      chunks.forEach(chunk => {
        chunk.metadata.chunkCount = chunks.length;
      });
  
      return chunks;
    }
  
    /**
     * Get chunk statistics
     * @param {Array} chunks - Array of chunks
     * @returns {Object} Statistics object
     */
    getChunkStats(chunks) {
      if (!chunks || chunks.length === 0) {
        return { totalChunks: 0, totalWords: 0, totalChars: 0, avgChunkSize: 0 };
      }
  
      const totalChars = chunks.reduce((sum, chunk) => sum + chunk.content.length, 0);
      const totalWords = chunks.reduce((sum, chunk) => sum + (chunk.metadata.wordCount || 0), 0);
  
      return {
        totalChunks: chunks.length,
        totalWords,
        totalChars,
        avgChunkSize: Math.round(totalChars / chunks.length),
        minChunkSize: Math.min(...chunks.map(c => c.content.length)),
        maxChunkSize: Math.max(...chunks.map(c => c.content.length))
      };
    }
  }
  
  module.exports = TextChunker;