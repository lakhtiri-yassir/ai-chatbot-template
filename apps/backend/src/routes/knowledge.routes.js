const express = require("express");
const multer = require("multer");
const path = require("path");
const router = express.Router();
const knowledgeController = require("../controllers/knowledge.controller");
const authMiddleware = require("../middleware/auth.middleware");
const rateLimitMiddleware = require("../middleware/rateLimit.middleware");
const errorMiddleware = require("../middleware/error.middleware");

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

const fileFilter = (req, file, cb) => {
  // Check file type
  const allowedTypes = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "text/plain",
    "text/markdown",
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Invalid file type. Only PDF, DOCX, DOC, TXT, and MD files are allowed."
      ),
      false
    );
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1,
  },
});

// Apply optional authentication to all knowledge routes
router.use(authMiddleware.optionalAuth);

// GET /api/knowledge/status - Get knowledge base status
router.get(
  "/status",
  rateLimitMiddleware.generalRateLimit(),
  errorMiddleware.asyncHandler(knowledgeController.getKnowledgeStatus)
);

// POST /api/knowledge/process - Process knowledge base
router.post(
  "/process",
  rateLimitMiddleware.knowledgeProcessingRateLimit(),
  errorMiddleware.asyncHandler(knowledgeController.processKnowledgeBase)
);

// GET /api/knowledge/search - Search knowledge base
router.get(
  "/search",
  rateLimitMiddleware.searchRateLimit(),
  errorMiddleware.asyncHandler(knowledgeController.searchKnowledge)
);

// POST /api/knowledge/upload - Upload document
router.post(
  "/upload",
  rateLimitMiddleware.uploadRateLimit(),
  upload.single("document"),
  errorMiddleware.fileUploadErrorHandler,
  errorMiddleware.asyncHandler(knowledgeController.uploadDocument)
);

// GET /api/knowledge/documents - Get all documents
router.get(
  "/documents",
  rateLimitMiddleware.generalRateLimit(),
  errorMiddleware.asyncHandler(knowledgeController.getDocuments)
);

// DELETE /api/knowledge/documents/:documentId - Delete document
router.delete(
  "/documents/:documentId",
  rateLimitMiddleware.generalRateLimit(),
  errorMiddleware.asyncHandler(knowledgeController.deleteDocument)
);

// GET /api/knowledge/documents/:documentId/chunks - Get document chunks
router.get(
  "/documents/:documentId/chunks",
  rateLimitMiddleware.generalRateLimit(),
  errorMiddleware.asyncHandler(knowledgeController.getDocumentChunks)
);

// POST /api/knowledge/documents/:documentId/reprocess - Reprocess document
router.post(
  "/documents/:documentId/reprocess",
  rateLimitMiddleware.knowledgeProcessingRateLimit(),
  errorMiddleware.asyncHandler(knowledgeController.reprocessDocument)
);

// Parameter validation middleware
router.param("documentId", (req, res, next, documentId) => {
  // Validate MongoDB ObjectId format
  if (!documentId.match(/^[0-9a-fA-F]{24}$/)) {
    return res.status(400).json({
      success: false,
      error: "Invalid document ID format",
    });
  }
  next();
});

module.exports = router;
