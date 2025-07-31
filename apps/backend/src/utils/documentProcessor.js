/**
 * Document Processing Utility
 * Handles extraction and processing of various document formats
 */

const fs = require("fs").promises;
const path = require("path");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const TextChunker = require("./textChunker");

class DocumentProcessor {
  constructor(options = {}) {
    this.supportedFormats = [".pdf", ".docx", ".doc", ".txt", ".md"];
    this.chunker = new TextChunker(options.chunking || {});
    this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
    this.outputDir =
      options.outputDir || path.join(__dirname, "../knowledge/processed");
  }

  /**
   * Process a document file
   * @param {string} filePath - Path to the document
   * @param {Object} options - Processing options
   * @returns {Object} Processed document data
   */
  async processDocument(filePath, options = {}) {
    try {
      // Validate file
      await this.validateFile(filePath);

      const fileInfo = await this.getFileInfo(filePath);
      const extension = path.extname(filePath).toLowerCase();

      console.log(
        `Processing document: ${fileInfo.name} (${fileInfo.size} bytes)`
      );

      // Extract text based on file type
      let extractedText;
      let metadata = {
        originalFileName: fileInfo.name,
        fileSize: fileInfo.size,
        fileType: extension,
        processedAt: new Date().toISOString(),
        encoding: "utf-8",
      };

      switch (extension) {
        case ".pdf":
          const pdfResult = await this.processPDF(filePath);
          extractedText = pdfResult.text;
          metadata = { ...metadata, ...pdfResult.metadata };
          break;

        case ".docx":
        case ".doc":
          const docResult = await this.processDocx(filePath);
          extractedText = docResult.text;
          metadata = { ...metadata, ...docResult.metadata };
          break;

        case ".txt":
        case ".md":
          extractedText = await this.processTextFile(filePath);
          break;

        default:
          throw new Error(`Unsupported file format: ${extension}`);
      }

      // Clean and validate extracted text
      if (!extractedText || extractedText.trim().length === 0) {
        throw new Error("No text content extracted from document");
      }

      // Chunk the text
      const chunks = this.chunker.chunkText(extractedText, {
        sourceDocument: fileInfo.name,
        documentType: extension,
        ...options.metadata,
      });

      // Get processing statistics
      const stats = this.chunker.getChunkStats(chunks);

      // Save processed data if output directory is specified
      const processedData = {
        metadata,
        originalText: extractedText,
        chunks,
        stats,
        processedAt: new Date().toISOString(),
      };

      if (options.saveProcessed !== false) {
        await this.saveProcessedData(fileInfo.name, processedData);
      }

      return processedData;
    } catch (error) {
      console.error(`Error processing document ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Process PDF document
   * @param {string} filePath - Path to PDF file
   * @returns {Object} Extracted text and metadata
   */
  async processPDF(filePath) {
    try {
      const dataBuffer = await fs.readFile(filePath);
      const data = await pdfParse(dataBuffer);

      return {
        text: data.text,
        metadata: {
          pages: data.numpages,
          info: data.info,
          version: data.version,
          wordCount: data.text.split(/\s+/).length,
        },
      };
    } catch (error) {
      throw new Error(`Failed to process PDF: ${error.message}`);
    }
  }

  /**
   * Process DOCX document
   * @param {string} filePath - Path to DOCX file
   * @returns {Object} Extracted text and metadata
   */
  async processDocx(filePath) {
    try {
      const result = await mammoth.extractRawText({ path: filePath });

      if (result.messages.length > 0) {
        console.warn("DOCX processing warnings:", result.messages);
      }

      return {
        text: result.value,
        metadata: {
          warnings: result.messages,
          wordCount: result.value.split(/\s+/).length,
        },
      };
    } catch (error) {
      throw new Error(`Failed to process DOCX: ${error.message}`);
    }
  }

  /**
   * Process plain text file
   * @param {string} filePath - Path to text file
   * @returns {string} File content
   */
  async processTextFile(filePath) {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      return content;
    } catch (error) {
      throw new Error(`Failed to read text file: ${error.message}`);
    }
  }

  /**
   * Process multiple documents
   * @param {Array} filePaths - Array of file paths
   * @param {Object} options - Processing options
   * @returns {Array} Array of processed documents
   */
  async processMultipleDocuments(filePaths, options = {}) {
    const results = [];
    const errors = [];

    for (const filePath of filePaths) {
      try {
        const result = await this.processDocument(filePath, options);
        results.push(result);
      } catch (error) {
        errors.push({
          file: filePath,
          error: error.message,
        });
      }
    }

    return {
      processed: results,
      errors,
      summary: {
        totalFiles: filePaths.length,
        successful: results.length,
        failed: errors.length,
      },
    };
  }

  /**
   * Validate file before processing
   * @param {string} filePath - Path to file
   */
  async validateFile(filePath) {
    const stats = await fs.stat(filePath);

    if (!stats.isFile()) {
      throw new Error("Path is not a file");
    }

    if (stats.size > this.maxFileSize) {
      throw new Error(
        `File size exceeds maximum limit (${this.maxFileSize} bytes)`
      );
    }

    const extension = path.extname(filePath).toLowerCase();
    if (!this.supportedFormats.includes(extension)) {
      throw new Error(`Unsupported file format: ${extension}`);
    }
  }

  /**
   * Get file information
   * @param {string} filePath - Path to file
   * @returns {Object} File information
   */
  async getFileInfo(filePath) {
    const stats = await fs.stat(filePath);
    return {
      name: path.basename(filePath),
      path: filePath,
      size: stats.size,
      modified: stats.mtime,
      created: stats.birthtime,
    };
  }

  /**
   * Save processed data to file
   * @param {string} originalFileName - Original file name
   * @param {Object} processedData - Processed document data
   */
  async saveProcessedData(originalFileName, processedData) {
    try {
      // Ensure output directory exists
      await fs.mkdir(this.outputDir, { recursive: true });

      const baseName = path.parse(originalFileName).name;
      const outputPath = path.join(
        this.outputDir,
        `${baseName}_processed.json`
      );

      await fs.writeFile(outputPath, JSON.stringify(processedData, null, 2));
      console.log(`Processed data saved to: ${outputPath}`);
    } catch (error) {
      console.error("Failed to save processed data:", error);
    }
  }

  /**
   * Search for documents in directory
   * @param {string} directory - Directory to search
   * @param {boolean} recursive - Search recursively
   * @returns {Array} Array of supported document paths
   */
  async findDocuments(directory, recursive = false) {
    const documents = [];

    try {
      const items = await fs.readdir(directory);

      for (const item of items) {
        const itemPath = path.join(directory, item);
        const stats = await fs.stat(itemPath);

        if (stats.isDirectory() && recursive) {
          const subDocs = await this.findDocuments(itemPath, recursive);
          documents.push(...subDocs);
        } else if (stats.isFile()) {
          const extension = path.extname(item).toLowerCase();
          if (this.supportedFormats.includes(extension)) {
            documents.push(itemPath);
          }
        }
      }
    } catch (error) {
      console.error(`Error searching directory ${directory}:`, error);
    }

    return documents;
  }

  /**
   * Extract metadata from processed documents
   * @param {Array} processedDocuments - Array of processed documents
   * @returns {Object} Consolidated metadata
   */
  extractMetadata(processedDocuments) {
    const metadata = {
      totalDocuments: processedDocuments.length,
      totalChunks: 0,
      totalWords: 0,
      totalCharacters: 0,
      fileTypes: {},
      processingDate: new Date().toISOString(),
    };

    processedDocuments.forEach((doc) => {
      metadata.totalChunks += doc.chunks.length;
      metadata.totalWords += doc.stats.totalWords;
      metadata.totalCharacters += doc.stats.totalChars;

      const fileType = doc.metadata.fileType;
      metadata.fileTypes[fileType] = (metadata.fileTypes[fileType] || 0) + 1;
    });

    return metadata;
  }

  /**
   * Get processing statistics
   * @param {Array} processedDocuments - Array of processed documents
   * @returns {Object} Processing statistics
   */
  getProcessingStats(processedDocuments) {
    const stats = this.extractMetadata(processedDocuments);

    return {
      ...stats,
      averageChunksPerDocument: Math.round(
        stats.totalChunks / stats.totalDocuments
      ),
      averageWordsPerDocument: Math.round(
        stats.totalWords / stats.totalDocuments
      ),
      averageCharactersPerDocument: Math.round(
        stats.totalCharacters / stats.totalDocuments
      ),
    };
  }
}

module.exports = DocumentProcessor;
