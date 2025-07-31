const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
  {
    // Basic conversation info
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
      default: "New Conversation",
    },

    // User identification
    userId: {
      type: String,
      required: true,
      index: true,
      default: "anonymous",
    },

    // Session information
    sessionId: {
      type: String,
      index: true,
      default: function () {
        return `session_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`;
      },
    },

    // Conversation metadata
    metadata: {
      userAgent: String,
      ipAddress: String,
      referrer: String,
      language: {
        type: String,
        default: "en",
      },
      timezone: String,
      device: {
        type: String,
        enum: ["desktop", "mobile", "tablet", "unknown"],
        default: "unknown",
      },
    },

    // Settings for this conversation
    settings: {
      useKnowledgeBase: {
        type: Boolean,
        default: true,
      },
      aiModel: {
        type: String,
        default: "openai/gpt-3.5-turbo",
      },
      temperature: {
        type: Number,
        default: 0.7,
        min: 0,
        max: 2,
      },
      maxTokens: {
        type: Number,
        default: 1000,
        min: 10,
        max: 4000,
      },
      systemPrompt: {
        type: String,
        default: "You are a helpful AI assistant.",
      },
    },

    // Conversation statistics
    stats: {
      messageCount: {
        type: Number,
        default: 0,
      },
      userMessages: {
        type: Number,
        default: 0,
      },
      aiMessages: {
        type: Number,
        default: 0,
      },
      totalTokensUsed: {
        type: Number,
        default: 0,
      },
      averageResponseTime: {
        type: Number,
        default: 0,
      },
      knowledgeQueriesUsed: {
        type: Number,
        default: 0,
      },
    },

    // Status tracking
    status: {
      type: String,
      enum: ["active", "paused", "completed", "archived"],
      default: "active",
    },

    // Tags for categorization
    tags: [
      {
        type: String,
        trim: true,
        maxlength: 50,
      },
    ],

    // Rating and feedback
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },

    feedback: {
      type: String,
      maxlength: 1000,
    },

    // Last activity tracking
    lastActivity: {
      type: Date,
      default: Date.now,
    },

    // Conversation duration
    duration: {
      type: Number, // in milliseconds
      default: 0,
    },

    // Privacy settings
    privacy: {
      isPrivate: {
        type: Boolean,
        default: false,
      },
      allowAnalytics: {
        type: Boolean,
        default: true,
      },
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
conversationSchema.index({ userId: 1, createdAt: -1 });
conversationSchema.index({ sessionId: 1 });
conversationSchema.index({ status: 1 });
conversationSchema.index({ lastActivity: -1 });
conversationSchema.index({ deletedAt: 1 });

// Virtual for message count
conversationSchema.virtual("messageCount", {
  ref: "Message",
  localField: "_id",
  foreignField: "conversationId",
  count: true,
});

// Virtual for duration in human readable format
conversationSchema.virtual("durationFormatted").get(function () {
  if (!this.duration) return "0 seconds";

  const seconds = Math.floor(this.duration / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
});

// Pre-save middleware to update timestamps
conversationSchema.pre("save", function (next) {
  this.updatedAt = new Date();

  // Update last activity if not explicitly set
  if (!this.isModified("lastActivity")) {
    this.lastActivity = new Date();
  }

  next();
});

// Method to update statistics
conversationSchema.methods.updateStats = function (messageData) {
  this.stats.messageCount++;

  if (messageData.role === "user") {
    this.stats.userMessages++;
  } else if (messageData.role === "assistant") {
    this.stats.aiMessages++;

    // Update token usage
    if (messageData.metadata?.tokensUsed) {
      this.stats.totalTokensUsed += messageData.metadata.tokensUsed;
    }

    // Update response time
    if (messageData.metadata?.responseTime) {
      const currentAvg = this.stats.averageResponseTime;
      const count = this.stats.aiMessages;
      this.stats.averageResponseTime =
        (currentAvg * (count - 1) + messageData.metadata.responseTime) / count;
    }

    // Update knowledge queries count
    if (messageData.metadata?.knowledgeUsed) {
      this.stats.knowledgeQueriesUsed++;
    }
  }

  return this.save();
};

// Method to calculate conversation duration
conversationSchema.methods.calculateDuration = function () {
  if (this.createdAt && this.updatedAt) {
    this.duration = this.updatedAt.getTime() - this.createdAt.getTime();
  }
  return this.duration;
};

// Method to soft delete
conversationSchema.methods.softDelete = function () {
  this.deletedAt = new Date();
  this.status = "archived";
  return this.save();
};

// Method to restore from soft delete
conversationSchema.methods.restore = function () {
  this.deletedAt = null;
  this.status = "active";
  return this.save();
};

// Static method to find active conversations
conversationSchema.statics.findActive = function () {
  return this.find({
    deletedAt: null,
    status: { $in: ["active", "paused"] },
  });
};

// Static method to find by user
conversationSchema.statics.findByUser = function (
  userId,
  limit = 20,
  skip = 0
) {
  return this.find({
    userId,
    deletedAt: null,
  })
    .sort({ lastActivity: -1 })
    .limit(limit)
    .skip(skip);
};

// Static method to get conversation statistics
conversationSchema.statics.getStats = function (userId) {
  return this.aggregate([
    { $match: { userId, deletedAt: null } },
    {
      $group: {
        _id: null,
        totalConversations: { $sum: 1 },
        totalMessages: { $sum: "$stats.messageCount" },
        totalTokens: { $sum: "$stats.totalTokensUsed" },
        avgResponseTime: { $avg: "$stats.averageResponseTime" },
        avgRating: { $avg: "$rating" },
      },
    },
  ]);
};

// Method to export conversation data
conversationSchema.methods.exportData = function () {
  return {
    id: this._id,
    title: this.title,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    stats: this.stats,
    settings: this.settings,
    rating: this.rating,
    feedback: this.feedback,
    tags: this.tags,
    duration: this.durationFormatted,
  };
};

module.exports = mongoose.model("Conversation", conversationSchema);
