const knowledgeService = require("../services/knowledge.service");
const documentService = require("../services/document.service");
const logger = require("../utils/logger");

class KnowledgeController {
  // Get knowledge base status
  async getKnowledgeStatus(req, res) {
    try {
      const status = await knowledgeService.getKnowledgeStatus();

      res.status(200).json({
        success: true,
        data: status,
      });
    } catch (error) {
      logger.error("Get knowledge status error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get knowledge status",
      });
    }
  }

  // Process knowledge base documents
  async processKnowledgeBase(req, res) {
    try {
      const { reprocess = false } = req.body;

      // Start processing in background
      knowledgeService
        .processKnowledgeBase(reprocess)
        .then(() => {
          logger.info("Knowledge base processing completed");
        })
        .catch((error) => {
          logger.error("Knowledge base processing failed:", error);
        });

      res.status(200).json({
        success: true,
        message: "Knowledge base processing started",
      });
    } catch (error) {
      logger.error("Process knowledge base error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to start knowledge base processing",
      });
    }
  }

  // Search knowledge base
  async searchKnowledge(req, res) {
    try {
      const { query, limit = 10 } = req.query;

      if (!query || !query.trim()) {
        return res.status(400).json({
          success: false,
          error: "Search query is required",
        });
      }

      const results = await knowledgeService.searchRelevantChunks(
        query.trim(),
        parseInt(limit)
      );

      res.status(200).json({
        success: true,
        data: {
          query: query.trim(),
          results,
          count: results.length,
        },
      });
    } catch (error) {
      logger.error("Search knowledge error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to search knowledge base",
      });
    }
  }

  // Upload and process document
  async uploadDocument(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "No file uploaded",
        });
      }

      const { title, description } = req.body;

      // Process uploaded document
      const document = await documentService.processUploadedDocument(req.file, {
        title: title || req.file.originalname,
        description: description || "",
      });

      res.status(201).json({
        success: true,
        data: { document },
        message: "Document uploaded and processed successfully",
      });
    } catch (error) {
      logger.error("Upload document error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to upload and process document",
      });
    }
  }

  // Get all documents
  async getDocuments(req, res) {
    try {
      const { limit = 20, offset = 0 } = req.query;

      const documents = await documentService.getDocuments(
        parseInt(limit),
        parseInt(offset)
      );

      res.status(200).json({
        success: true,
        data: { documents },
      });
    } catch (error) {
      logger.error("Get documents error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get documents",
      });
    }
  }

  // Delete document
  async deleteDocument(req, res) {
    try {
      const { documentId } = req.params;

      await documentService.deleteDocument(documentId);

      res.status(200).json({
        success: true,
        message: "Document deleted successfully",
      });
    } catch (error) {
      logger.error("Delete document error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to delete document",
      });
    }
  }

  // Get document chunks
  async getDocumentChunks(req, res) {
    try {
      const { documentId } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      const chunks = await knowledgeService.getDocumentChunks(
        documentId,
        parseInt(limit),
        parseInt(offset)
      );

      res.status(200).json({
        success: true,
        data: { chunks },
      });
    } catch (error) {
      logger.error("Get document chunks error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get document chunks",
      });
    }
  }

  // Reprocess specific document
  async reprocessDocument(req, res) {
    try {
      const { documentId } = req.params;

      await knowledgeService.reprocessDocument(documentId);

      res.status(200).json({
        success: true,
        message: "Document reprocessing completed",
      });
    } catch (error) {
      logger.error("Reprocess document error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to reprocess document",
      });
    }
  }
}

module.exports = new KnowledgeController();
