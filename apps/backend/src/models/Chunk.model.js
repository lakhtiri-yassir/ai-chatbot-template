const mongoose = require("mongoose");

const chunkSchema = new mongoose.Schema(
  {
    // Reference to parent document
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
      required: true,
      index: true,
    },

    // Chunk identification
    chunkId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // Chunk content
    content: {
      type: String,
      required: true,
      maxlength: 5000,
    },

    // Original content before cleaning
    originalContent: {
      type: String,
      maxlength: 5000,
    },

    // Chunk position in document
    position: {
      startIndex: {
        type: Number,
        required: true,
      },
      endIndex: {
        type: Number,
        required: true,
      },
      pageNumber: Number,
      sectionNumber: Number,
      paragraphNumber: Number,
    },

    // Chunk metadata
    metadata: {
      // Size information
      wordCount: {
        type: Number,
        required: true,
      },
      characterCount: {
        type: Number,
        required: true,
      },

      // Content type
      contentType: {
        type: String,
        enum: ["text", "heading", "table", "list", "code", "quote"],
        default: "text",
      },

      // Semantic information
      title: String,
      headings: [String],
      keywords: [String],
      entities: [String],

      // Quality metrics
      quality: {
        type: Number,
        min: 0,
        max: 1,
        default: 1,
      },

      // Content analysis
      language: {
        type: String,
        default: "en",
      },

      sentiment: {
        type: String,
        enum: ["positive", "negative", "neutral", "mixed"],
      },

      complexity: {
        type: String,
        enum: ["low", "medium", "high"],
        default: "medium",
      },

      // Overlap with adjacent chunks
      overlapBefore: {
        type: Number,
        default: 0,
      },

      overlapAfter: {
        type: Number,
        default: 0,
      },

      // Processing information
      processingDate: {
        type: Date,
        default: Date.now,
      },

      chunkingMethod: {
        type: String,
        enum: ["fixed", "semantic", "sentence", "paragraph"],
        default: "fixed",
      },
    },

    // Vector embedding
    embedding: {
      vector: {
        type: [Number],
        validate: {
          validator: function (arr) {
            return arr.length === 1536; // OpenAI embedding dimension
          },
          message: "Embedding vector must have 1536 dimensions",
        },
      },

      model: {
        type: String,
        default: "text-embedding-ada-002",
      },

      createdAt: {
        type: Date,
        default: Date.now,
      },

      // Embedding quality/confidence
      confidence: {
        type: Number,
        min: 0,
        max: 1,
        default: 1,
      },
    },

    // Usage statistics
    stats: {
      queryCount: {
        type: Number,
        default: 0,
      },

      retrievalCount: {
        type: Number,
        default: 0,
      },

      lastQueried: Date,

      lastRetrieved: Date,

      // Relevance scores from searches
      avgRelevanceScore: {
        type: Number,
        min: 0,
        max: 1,
      },

      // How often this chunk appears in top results
      topResultFrequency: {
        type: Number,
        min: 0,
        max: 1,
      },
    },

    // Relationships
    adjacentChunks: {
      previous: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Chunk",
      },
      next: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Chunk",
      },
    },

    // Related chunks (semantic similarity)
    relatedChunks: [
      {
        chunkId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Chunk",
        },
        similarity: {
          type: Number,
          min: 0,
          max: 1,
        },
      },
    ],

    // Processing status
    processingStatus: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
      index: true,
    },

    embeddingStatus: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
      index: true,
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
chunkSchema.index({ documentId: 1, "position.startIndex": 1 });
chunkSchema.index({ processingStatus: 1, priority: -1 });
chunkSchema.index({ embeddingStatus: 1 });
chunkSchema.index({ "metadata.contentType": 1 });
chunkSchema.index({ "stats.avgRelevanceScore": -1 });
chunkSchema.index({ deletedAt: 1 });

// Virtual for content preview
chunkSchema.virtual("preview").get(function () {
  return this.content.length > 100
    ? this.content.substring(0, 100) + "..."
    : this.content;
});

// Virtual for embedding status
chunkSchema.virtual("hasEmbedding").get(function () {
  return this.embedding.vector && this.embedding.vector.length > 0;
});

// Pre-save middleware
chunkSchema.pre("save", function (next) {
  this.updatedAt = new Date();

  // Calculate word count if not provided
  if (!this.metadata.wordCount) {
    this.metadata.wordCount = this.content.split(/\s+/).length;
  }

  // Calculate character count if not provided
  if (!this.metadata.characterCount) {
    this.metadata.characterCount = this.content.length;
  }

  next();
});

// Method to update processing status
chunkSchema.methods.updateProcessingStatus = function (status, error = null) {
  this.processingStatus = status;

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

// Method to update embedding status
chunkSchema.methods.updateEmbeddingStatus = function (status, error = null) {
  this.embeddingStatus = status;

  if (error) {
    this.processingError = {
      message: error.message || error,
      code: error.code || "EMBEDDING_ERROR",
      timestamp: new Date(),
      retryCount: (this.processingError?.retryCount || 0) + 1,
    };
  }

  return this.save();
};

// Method to set embedding
chunkSchema.methods.setEmbedding = function (
  vector,
  model = "text-embedding-ada-002"
) {
  this.embedding = {
    vector,
    model,
    createdAt: new Date(),
    confidence: 1,
  };

  this.embeddingStatus = "completed";
  return this.save();
};

// Method to increment query count
chunkSchema.methods.incrementQueryCount = function () {
  this.stats.queryCount++;
  this.stats.lastQueried = new Date();
  return this.save();
};

// Method to increment retrieval count
chunkSchema.methods.incrementRetrievalCount = function () {
  this.stats.retrievalCount++;
  this.stats.lastRetrieved = new Date();
  return this.save();
};

// Method to update relevance score
chunkSchema.methods.updateRelevanceScore = function (score) {
  const current = this.stats.avgRelevanceScore || 0;
  const count = this.stats.queryCount || 1;

  this.stats.avgRelevanceScore = (current * (count - 1) + score) / count;
  return this.save();
};

// Method to soft delete
chunkSchema.methods.softDelete = function () {
  this.deletedAt = new Date();
  return this.save();
};

// Method to restore from soft delete
chunkSchema.methods.restore = function () {
  this.deletedAt = null;
  return this.save();
};

// Static method to find by document
chunkSchema.statics.findByDocument = function (documentId, options = {}) {
  const { limit = 100, skip = 0 } = options;

  return this.find({
    documentId,
    deletedAt: null,
    processingStatus: "completed",
  })
    .sort({ "position.startIndex": 1 })
    .limit(limit)
    .skip(skip);
};

// Static method to find chunks needing processing
chunkSchema.statics.findPendingProcessing = function (type = "processing") {
  const statusField =
    type === "embedding" ? "embeddingStatus" : "processingStatus";

  return this.find({
    [statusField]: { $in: ["pending", "processing"] },
    deletedAt: null,
  })
    .sort({ priority: -1, createdAt: 1 })
    .limit(100);
};

// Static method for vector similarity search
chunkSchema.statics.findSimilar = function (queryVector, options = {}) {
  const {
    limit = 10,
    threshold = 0.7,
    documentId = null,
    contentType = null,
  } = options;

  const pipeline = [
    {
      $match: {
        deletedAt: null,
        embeddingStatus: "completed",
        "embedding.vector": { $exists: true, $ne: [] },
        ...(documentId && {
          documentId: new mongoose.Types.ObjectId(documentId),
        }),
        ...(contentType && { "metadata.contentType": contentType }),
      },
    },
    {
      $addFields: {
        similarity: {
          $reduce: {
            input: { $range: [0, { $size: "$embedding.vector" }] },
            initialValue: 0,
            in: {
              $add: [
                "$$value",
                {
                  $multiply: [
                    { $arrayElemAt: ["$embedding.vector", "$$this"] },
                    { $arrayElemAt: [queryVector, "$$this"] },
                  ],
                },
              ],
            },
          },
        },
      },
    },
    {
      $match: {
        similarity: { $gte: threshold },
      },
    },
    {
      $sort: { similarity: -1 },
    },
    {
      $limit: limit,
    },
  ];

  return this.aggregate(pipeline);
};

// Static method to get statistics
chunkSchema.statics.getStats = function (documentId = null) {
  const matchStage = { deletedAt: null };
  if (documentId) {
    matchStage.documentId = new mongoose.Types.ObjectId(documentId);
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalChunks: { $sum: 1 },
        avgWordCount: { $avg: "$metadata.wordCount" },
        avgCharCount: { $avg: "$metadata.characterCount" },
        processingCompleted: {
          $sum: {
            $cond: [{ $eq: ["$processingStatus", "completed"] }, 1, 0],
          },
        },
        embeddingCompleted: {
          $sum: {
            $cond: [{ $eq: ["$embeddingStatus", "completed"] }, 1, 0],
          },
        },
        avgRelevanceScore: { $avg: "$stats.avgRelevanceScore" },
        totalQueries: { $sum: "$stats.queryCount" },
        totalRetrievals: { $sum: "$stats.retrievalCount" },
      },
    },
  ]);
};

// Static method to cleanup orphaned chunks
chunkSchema.statics.cleanupOrphaned = function () {
  return this.aggregate([
    {
      $lookup: {
        from: "documents",
        localField: "documentId",
        foreignField: "_id",
        as: "document",
      },
    },
    {
      $match: {
        $or: [
          { document: { $size: 0 } },
          { "document.deletedAt": { $ne: null } },
        ],
      },
    },
    {
      $project: { _id: 1 },
    },
  ]).then((orphanedChunks) => {
    const ids = orphanedChunks.map((chunk) => chunk._id);
    return this.updateMany({ _id: { $in: ids } }, { deletedAt: new Date() });
  });
};

// Method to export chunk data
chunkSchema.methods.exportData = function () {
  return {
    id: this._id,
    chunkId: this.chunkId,
    content: this.content,
    position: this.position,
    metadata: this.metadata,
    stats: this.stats,
    hasEmbedding: this.hasEmbedding,
    processingStatus: this.processingStatus,
    embeddingStatus: this.embeddingStatus,
    createdAt: this.createdAt,
  };
};

// Text index for search
chunkSchema.index({ content: "text" });

module.exports = mongoose.model("Chunk", chunkSchema);
