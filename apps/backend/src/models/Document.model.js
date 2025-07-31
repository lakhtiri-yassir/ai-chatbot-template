const mongoose = require("mongoose");
const path = require("path");

const documentSchema = new mongoose.Schema(
  {
    // Basic document info
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    // File information
    filename: {
      type: String,
      required: true,
      trim: true,
    },

    originalName: {
      type: String,
      required: true,
      trim: true,
    },

    filePath: {
      type: String,
      required: true,
    },

    fileSize: {
      type: Number,
      required: true,
      min: 0,
    },

    mimeType: {
      type: String,
      required: true,
      enum: [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
        "text/markdown",
        "text/html",
        "application/msword",
      ],
    },

    // Content extraction
    extractedText: {
      type: String,
      required: true,
    },

    // Document metadata
    metadata: {
      // File properties
      pages: Number,
      wordCount: Number,
      characterCount: Number,
      language: {
        type: String,
        default: "en",
      },

      // Processing info
      extractionMethod: {
        type: String,
        enum: ["pdf-parse", "mammoth", "text", "manual"],
        required: true,
      },

      extractionDate: {
        type: Date,
        default: Date.now,
      },

      // Document analysis
      topics: [String],
      keywords: [String],
      categories: [String],

      // Quality metrics
      extractionQuality: {
        type: Number,
        min: 0,
        max: 1,
        default: 1,
      },

      // File hash for duplicate detection
      fileHash: {
        type: String,
        unique: true,
        required: true,
      },

      // Document structure
      hasImages: {
        type: Boolean,
        default: false,
      },

      hasTables: {
        type: Boolean,
        default: false,
      },

      hasLinks: {
        type: Boolean,
        default: false,
      },

      // Author information
      author: String,
      createdDate: Date,
      modifiedDate: Date,

      // OCR information (if applicable)
      isOCR: {
        type: Boolean,
        default: false,
      },

      ocrConfidence: {
        type: Number,
        min: 0,
        max: 1,
      },
    },

    // Processing status
    processingStatus: {
      type: String,
      enum: ["pending", "processing", "completed", "failed", "requires_review"],
      default: "pending",
      index: true,
    },

    // Processing progress
    processingProgress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },

    // Error information
    processingError: {
      message: String,
      code: String,
      timestamp: Date,
      retryCount: {
        type: Number,
        default: 0,
      },
    },

    // Chunking information
    chunkingStatus: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
    },

    totalChunks: {
      type: Number,
      default: 0,
    },

    // Vector embedding status
    embeddingStatus: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
    },

    // Usage statistics
    stats: {
      viewCount: {
        type: Number,
        default: 0,
      },
      queryCount: {
        type: Number,
        default: 0,
      },
      lastQueried: Date,
      avgRelevanceScore: {
        type: Number,
        min: 0,
        max: 1,
      },
      chunkUtilization: {
        type: Number,
        min: 0,
        max: 1,
      },
    },

    // Access control
    isPublic: {
      type: Boolean,
      default: false,
    },

    uploadedBy: {
      type: String,
      default: "system",
    },

    // Version control
    version: {
      type: Number,
      default: 1,
    },

    parentDocument: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
    },

    // Tags for categorization
    tags: [
      {
        type: String,
        trim: true,
        maxlength: 50,
      },
    ],

    // Priority for processing
    priority: {
      type: Number,
      min: 1,
      max: 10,
      default: 5,
    },

    // Expiration date
    expiresAt: {
      type: Date,
      index: { expireAfterSeconds: 0 },
    },

    // Timestamps
    createdAt: {
      type: Date,
      default: Date.now,
    },

    updatedAt: {
      type: Date,
      default: Date.now,
    },

    // Soft delete
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Indexes for performance
documentSchema.index({ processingStatus: 1, priority: -1 });
documentSchema.index({ chunkingStatus: 1 });
documentSchema.index({ embeddingStatus: 1 });
documentSchema.index({ uploadedBy: 1, createdAt: -1 });
documentSchema.index({ tags: 1 });
documentSchema.index({ deletedAt: 1 });
documentSchema.index({ "metadata.fileHash": 1 });

// Virtual for file extension
documentSchema.virtual("fileExtension").get(function () {
  return path.extname(this.originalName).toLowerCase();
});

// Virtual for file size in human readable format
documentSchema.virtual("fileSizeFormatted").get(function () {
  const bytes = this.fileSize;
  const sizes = ["Bytes", "KB", "MB", "GB"];

  if (bytes === 0) return "0 Bytes";

  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i];
});

// Virtual for processing completion percentage
documentSchema.virtual("completionPercentage").get(function () {
  const weights = { processing: 0.4, chunking: 0.3, embedding: 0.3 };
  let completion = 0;

  if (this.processingStatus === "completed") completion += weights.processing;
  if (this.chunkingStatus === "completed") completion += weights.chunking;
  if (this.embeddingStatus === "completed") completion += weights.embedding;

  return Math.round(completion * 100);
});

// Pre-save middleware
documentSchema.pre("save", function (next) {
  this.updatedAt = new Date();

  // Calculate word count if not provided
  if (!this.metadata.wordCount && this.extractedText) {
    this.metadata.wordCount = this.extractedText.split(/\s+/).length;
  }

  // Calculate character count if not provided
  if (!this.metadata.characterCount && this.extractedText) {
    this.metadata.characterCount = this.extractedText.length;
  }

  next();
});

// Method to update processing status
documentSchema.methods.updateProcessingStatus = function (
  status,
  progress = null,
  error = null
) {
  this.processingStatus = status;

  if (progress !== null) {
    this.processingProgress = progress;
  }

  if (error) {
    this.processingError = {
      message: error.message || error,
      code: error.code || "UNKNOWN_ERROR",
      timestamp: new Date(),
      retryCount: (this.processingError?.retryCount || 0) + 1,
    };
  } else {
    this.processingError = undefined;
  }

  return this.save();
};

// Method to increment query count
documentSchema.methods.incrementQueryCount = function () {
  this.stats.queryCount++;
  this.stats.lastQueried = new Date();
  return this.save();
};

// Method to update relevance score
documentSchema.methods.updateRelevanceScore = function (score) {
  const current = this.stats.avgRelevanceScore || 0;
  const count = this.stats.queryCount || 1;

  this.stats.avgRelevanceScore = (current * (count - 1) + score) / count;
  return this.save();
};

// Method to soft delete
documentSchema.methods.softDelete = function () {
  this.deletedAt = new Date();
  return this.save();
};

// Method to restore from soft delete
documentSchema.methods.restore = function () {
  this.deletedAt = null;
  return this.save();
};

// Static method to find by status
documentSchema.statics.findByStatus = function (status, limit = 10) {
  return this.find({
    processingStatus: status,
    deletedAt: null,
  })
    .sort({ priority: -1, createdAt: 1 })
    .limit(limit);
};

// Static method to find pending processing
documentSchema.statics.findPendingProcessing = function () {
  return this.find({
    $or: [
      { processingStatus: "pending" },
      { processingStatus: "processing" },
      { chunkingStatus: "pending" },
      { embeddingStatus: "pending" },
    ],
    deletedAt: null,
  }).sort({ priority: -1, createdAt: 1 });
};

// Static method to get statistics
documentSchema.statics.getStats = function () {
  return this.aggregate([
    { $match: { deletedAt: null } },
    {
      $group: {
        _id: null,
        totalDocuments: { $sum: 1 },
        totalSize: { $sum: "$fileSize" },
        totalChunks: { $sum: "$totalChunks" },
        avgWordCount: { $avg: "$metadata.wordCount" },
        processingCompleted: {
          $sum: {
            $cond: [{ $eq: ["$processingStatus", "completed"] }, 1, 0],
          },
        },
        processingPending: {
          $sum: {
            $cond: [{ $eq: ["$processingStatus", "pending"] }, 1, 0],
          },
        },
        processingFailed: {
          $sum: {
            $cond: [{ $eq: ["$processingStatus", "failed"] }, 1, 0],
          },
        },
      },
    },
  ]);
};

// Static method to search documents
documentSchema.statics.search = function (query, options = {}) {
  const { tags, mimeType, limit = 20, skip = 0, dateFrom, dateTo } = options;

  const searchQuery = {
    deletedAt: null,
    processingStatus: "completed",
    $or: [
      { title: { $regex: query, $options: "i" } },
      { description: { $regex: query, $options: "i" } },
      { extractedText: { $regex: query, $options: "i" } },
    ],
  };

  if (tags && tags.length > 0) {
    searchQuery.tags = { $in: tags };
  }

  if (mimeType) {
    searchQuery.mimeType = mimeType;
  }

  if (dateFrom || dateTo) {
    searchQuery.createdAt = {};
    if (dateFrom) searchQuery.createdAt.$gte = new Date(dateFrom);
    if (dateTo) searchQuery.createdAt.$lte = new Date(dateTo);
  }

  return this.find(searchQuery)
    .sort({ "stats.avgRelevanceScore": -1, createdAt: -1 })
    .limit(limit)
    .skip(skip);
};

// Static method to find duplicates
documentSchema.statics.findDuplicates = function () {
  return this.aggregate([
    { $match: { deletedAt: null } },
    {
      $group: {
        _id: "$metadata.fileHash",
        documents: { $push: "$ROOT" },
        count: { $sum: 1 },
      },
    },
    { $match: { count: { $gt: 1 } } },
  ]);
};

// Static method to cleanup expired documents
documentSchema.statics.cleanupExpired = function () {
  return this.updateMany(
    { expiresAt: { $lt: new Date() } },
    { deletedAt: new Date() }
  );
};

// Method to create new version
documentSchema.methods.createVersion = function (newData) {
  const newDocument = new this.constructor({
    ...this.toObject(),
    ...newData,
    _id: undefined,
    version: this.version + 1,
    parentDocument: this._id,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return newDocument.save();
};

// Method to export document data
documentSchema.methods.exportData = function () {
  return {
    id: this._id,
    title: this.title,
    description: this.description,
    filename: this.filename,
    originalName: this.originalName,
    fileSize: this.fileSizeFormatted,
    mimeType: this.mimeType,
    extractedText: this.extractedText,
    metadata: this.metadata,
    processingStatus: this.processingStatus,
    totalChunks: this.totalChunks,
    stats: this.stats,
    tags: this.tags,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

// Method to get document summary
documentSchema.methods.getSummary = function () {
  const preview = this.extractedText
    ? this.extractedText.substring(0, 200) + "..."
    : "";

  return {
    id: this._id,
    title: this.title,
    description: this.description,
    fileSize: this.fileSizeFormatted,
    wordCount: this.metadata.wordCount,
    totalChunks: this.totalChunks,
    processingStatus: this.processingStatus,
    completionPercentage: this.completionPercentage,
    preview,
    tags: this.tags,
    createdAt: this.createdAt,
  };
};

// Text index for search
documentSchema.index({
  title: "text",
  description: "text",
  extractedText: "text",
});

module.exports = mongoose.model("Document", documentSchema);
