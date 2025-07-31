const connectDB = require("./database");
const redisConfig = require("./redis");
const openRouterConfig = require("./openrouter");

// Environment validation
const requiredEnvVars = [
  "MONGODB_URI",
  "OPENROUTER_API_KEY",
  "JWT_SECRET",
  "NODE_ENV",
];

const validateEnvironment = () => {
  const missing = requiredEnvVars.filter((envVar) => !process.env[envVar]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
};

// Configuration object
const config = {
  // Server configuration
  server: {
    port: process.env.PORT || 5000,
    host: process.env.HOST || "localhost",
    cors: {
      origin: process.env.CORS_ORIGIN || "http://localhost:3000",
      credentials: true,
    },
  },

  // Database configuration
  database: {
    mongodb: {
      uri: process.env.MONGODB_URI,
      options: {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      },
    },
    redis: {
      url: process.env.REDIS_URL || "redis://localhost:6379",
      ttl: parseInt(process.env.REDIS_TTL) || 3600, // 1 hour default
    },
  },

  // Authentication configuration
  auth: {
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 10,
  },

  // OpenRouter configuration
  openRouter: {
    apiKey: process.env.OPENROUTER_API_KEY,
    model: process.env.OPENROUTER_MODEL || "openai/gpt-3.5-turbo",
    maxTokens: parseInt(process.env.OPENROUTER_MAX_TOKENS) || 1000,
    temperature: parseFloat(process.env.OPENROUTER_TEMPERATURE) || 0.7,
  },

  // Rate limiting configuration
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100, // limit each IP to 100 requests per windowMs
    skipSuccessfulRequests: true,
  },

  // File upload configuration
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
    allowedTypes: [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "text/markdown",
    ],
  },

  // Text chunking configuration
  chunking: {
    chunkSize: parseInt(process.env.CHUNK_SIZE) || 1000,
    chunkOverlap: parseInt(process.env.CHUNK_OVERLAP) || 200,
    maxChunks: parseInt(process.env.MAX_CHUNKS) || 100,
  },

  // Knowledge base configuration
  knowledge: {
    documentsPath: process.env.KNOWLEDGE_DOCS_PATH || "./knowledge/documents",
    processedPath:
      process.env.KNOWLEDGE_PROCESSED_PATH || "./knowledge/processed",
    autoProcess: process.env.AUTO_PROCESS_KNOWLEDGE === "true",
    vectorDimensions: parseInt(process.env.VECTOR_DIMENSIONS) || 1536,
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || "info",
    format: process.env.LOG_FORMAT || "combined",
    enableConsole: process.env.ENABLE_CONSOLE_LOG !== "false",
    enableFile: process.env.ENABLE_FILE_LOG === "true",
    logFile: process.env.LOG_FILE || "app.log",
  },
};

// Initialize all configurations
const initializeConfig = async () => {
  try {
    // Validate environment variables
    validateEnvironment();

    // Connect to databases
    await connectDB();
    await redisConfig.connect();

    console.log("✅ All configurations initialized successfully");
    return config;
  } catch (error) {
    console.error("❌ Configuration initialization failed:", error);
    process.exit(1);
  }
};

module.exports = {
  config,
  initializeConfig,
  connectDB,
  redisConfig,
  openRouterConfig,
};
