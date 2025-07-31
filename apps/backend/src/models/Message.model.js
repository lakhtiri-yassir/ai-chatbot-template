const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    // Reference to conversation
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },

    // Message role (user, assistant, system)
    role: {
      type: String,
      required: true,
      enum: ["user", "assistant", "system"],
      index: true,
    },

    // Message content
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 10000,
    },

    // Original content before processing
    originalContent: {
      type: String,
      trim: true,
    },

    // Message type for different content types
    messageType: {
      type: String,
      enum: ["text", "image", "file", "code", "error", "system"],
      default: "text",
    },

    // Message metadata
    metadata: {
      // AI model used (for assistant messages)
      model: String,

      // Token usage
      tokensUsed: {
        type: Number,
        min: 0,
      },

      // Response time (for assistant messages)
      responseTime: {
        type: Number, // in milliseconds
        min: 0,
      },

      // Whether knowledge base was used
      knowledgeUsed: {
        type: Boolean,
        default: false,
      },

      // Number of knowledge chunks used
      knowledgeChunksUsed: {
        type: Number,
        default: 0,
      },

      // Confidence score for AI responses
      confidence: {
        type: Number,
        min: 0,
        max: 1,
      },

      // Temperature used for AI generation
      temperature: {
        type: Number,
        min: 0,
        max: 2,
      },

      // User device info (for user messages)
      userAgent: String,

      // IP address (hashed for privacy)
      ipHash: String,

      // Processing flags
      isProcessed: {
        type: Boolean,
        default: false,
      },

      // Streaming information
      isStreamed: {
        type: Boolean,
        default: false,
      },

      // Error information
      error: {
        message: String,
        code: String,
        retryCount: {
          type: Number,
          default: 0,
        },
      },

      // Content analysis
      sentiment: {
        type: String,
        enum: ["positive", "negative", "neutral", "mixed"],
      },

      // Language detection
      language: {
        type: String,
        default: "en",
      },

      // Content flags
      flags: {
        inappropriate: {
          type: Boolean,
          default: false,
        },
        spam: {
          type: Boolean,
          default: false,
        },
        requiresReview: {
          type: Boolean,
          default: false,
        },
      },
    },

    // Attachments (for file uploads)
    attachments: [
      {
        fileName: String,
        fileType: String,
        fileSize: Number,
        fileUrl: String,
        thumbnailUrl: String,
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Message reactions/ratings
    reactions: [
      {
        type: {
          type: String,
          enum: [
            "like",
            "dislike",
            "helpful",
            "not_helpful",
            "funny",
            "confused",
          ],
          required: true,
        },
        userId: String,
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Message status
    status: {
      type: String,
      enum: ["pending", "sent", "delivered", "failed", "retry"],
      default: "sent",
    },

    // Parent message for threading
    parentMessageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },

    // Message sequence number in conversation
    sequenceNumber: {
      type: Number,
      required: true,
    },

    // Edit history
    editHistory: [
      {
        content: String,
        editedAt: {
          type: Date,
          default: Date.now,
        },
        reason: String,
      },
    ],

    // Feedback specific to this message
    feedback: {
      rating: {
        type: Number,
        min: 1,
        max: 5,
      },
      comment: {
        type: String,
        maxlength: 500,
      },
      categories: [
        {
          type: String,
          enum: [
            "accuracy",
            "helpfulness",
            "clarity",
            "completeness",
            "relevance",
          ],
        },
      ],
      submittedAt: {
        type: Date,
        default: Date.now,
      },
    },

    // Timestamps
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },

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
messageSchema.index({ conversationId: 1, timestamp: 1 });
messageSchema.index({ conversationId: 1, sequenceNumber: 1 });
messageSchema.index({ role: 1, createdAt: -1 });
messageSchema.index({ deletedAt: 1 });
messageSchema.index({ status: 1 });

// Virtual for message age
messageSchema.virtual("age").get(function () {
  return Date.now() - this.timestamp.getTime();
});

// Virtual for human readable timestamp
messageSchema.virtual("timestampFormatted").get(function () {
  return this.timestamp.toLocaleString();
});

// Pre-save middleware
messageSchema.pre("save", function (next) {
  this.updatedAt = new Date();

  // Set sequence number if not provided
  if (!this.sequenceNumber) {
    this.constructor
      .countDocuments({ conversationId: this.conversationId })
      .then((count) => {
        this.sequenceNumber = count + 1;
        next();
      })
      .catch(next);
  } else {
    next();
  }
});

// Method to add reaction
messageSchema.methods.addReaction = function (type, userId) {
  // Remove existing reaction from this user
  this.reactions = this.reactions.filter((r) => r.userId !== userId);

  // Add new reaction
  this.reactions.push({
    type,
    userId,
    timestamp: new Date(),
  });

  return this.save();
};

// Method to remove reaction
messageSchema.methods.removeReaction = function (userId) {
  this.reactions = this.reactions.filter((r) => r.userId !== userId);
  return this.save();
};

// Method to edit message
messageSchema.methods.editContent = function (
  newContent,
  reason = "User edit"
) {
  // Save to edit history
  this.editHistory.push({
    content: this.content,
    editedAt: new Date(),
    reason,
  });

  // Update content
  this.content = newContent;
  this.updatedAt = new Date();

  return this.save();
};

// Method to add feedback
messageSchema.methods.addFeedback = function (feedbackData) {
  this.feedback = {
    ...feedbackData,
    submittedAt: new Date(),
  };

  return this.save();
};

// Method to soft delete
messageSchema.methods.softDelete = function () {
  this.deletedAt = new Date();
  return this.save();
};

// Method to restore from soft delete
messageSchema.methods.restore = function () {
  this.deletedAt = null;
  return this.save();
};

// Static method to find by conversation
messageSchema.statics.findByConversation = function (
  conversationId,
  limit = 50,
  skip = 0
) {
  return this.find({
    conversationId,
    deletedAt: null,
  })
    .sort({ sequenceNumber: 1 })
    .limit(limit)
    .skip(skip);
};

// Static method to get recent messages
messageSchema.statics.getRecent = function (limit = 100) {
  return this.find({ deletedAt: null })
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate("conversationId", "title userId");
};

// Static method to get message statistics
messageSchema.statics.getStats = function (conversationId) {
  return this.aggregate([
    {
      $match: {
        conversationId: new mongoose.Types.ObjectId(conversationId),
        deletedAt: null,
      },
    },
    {
      $group: {
        _id: "$role",
        count: { $sum: 1 },
        totalTokens: { $sum: "$metadata.tokensUsed" },
        avgResponseTime: { $avg: "$metadata.responseTime" },
        avgConfidence: { $avg: "$metadata.confidence" },
      },
    },
  ]);
};

// Static method to search messages
messageSchema.statics.search = function (query, options = {}) {
  const {
    conversationId,
    role,
    limit = 20,
    skip = 0,
    dateFrom,
    dateTo,
  } = options;

  const searchQuery = {
    deletedAt: null,
    $text: { $search: query },
  };

  if (conversationId) searchQuery.conversationId = conversationId;
  if (role) searchQuery.role = role;
  if (dateFrom || dateTo) {
    searchQuery.timestamp = {};
    if (dateFrom) searchQuery.timestamp.$gte = new Date(dateFrom);
    if (dateTo) searchQuery.timestamp.$lte = new Date(dateTo);
  }

  return this.find(searchQuery)
    .sort({ score: { $meta: "textScore" }, timestamp: -1 })
    .limit(limit)
    .skip(skip);
};

// Method to export message data
messageSchema.methods.exportData = function () {
  return {
    id: this._id,
    role: this.role,
    content: this.content,
    timestamp: this.timestamp,
    sequenceNumber: this.sequenceNumber,
    metadata: this.metadata,
    reactions: this.reactions,
    feedback: this.feedback,
    attachments: this.attachments,
  };
};

// Text index for search
messageSchema.index({ content: "text" });

module.exports = mongoose.model("Message", messageSchema);
