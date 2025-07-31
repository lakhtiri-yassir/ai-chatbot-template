/**
 * Logger Utility
 * Provides structured logging with multiple output formats and log levels
 */

const fs = require('fs').promises;
const path = require('path');

class Logger {
  constructor(options = {}) {
    this.logLevel = options.logLevel || process.env.LOG_LEVEL || 'info';
    this.logDir = options.logDir || path.join(process.cwd(), 'logs');
    this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
    this.maxFiles = options.maxFiles || 5;
    this.enableConsole = options.enableConsole !== false;
    this.enableFile = options.enableFile !== false;
    this.enableJSON = options.enableJSON || false;
    this.appName = options.appName || 'ai-chatbot';
    
    // Log levels with numeric values for comparison
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
      trace: 4
    };
    
    // Colors for console output
    this.colors = {
      error: '\x1b[31m',   // Red
      warn: '\x1b[33m',    // Yellow
      info: '\x1b[36m',    // Cyan
      debug: '\x1b[32m',   // Green
      trace: '\x1b[35m',   // Magenta
      reset: '\x1b[0m'     // Reset
    };
    
    // Initialize logger
    this.init();
  }

  /**
   * Initialize logger
   */
  async init() {
    if (this.enableFile) {
      try {
        await fs.mkdir(this.logDir, { recursive: true });
      } catch (error) {
        console.error('Failed to create log directory:', error);
      }
    }
  }

  /**
   * Check if log level is enabled
   * @param {string} level - Log level to check
   * @returns {boolean} Whether level is enabled
   */
  isLevelEnabled(level) {
    return this.levels[level] <= this.levels[this.logLevel];
  }

  /**
   * Format log message
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} meta - Additional metadata
   * @returns {Object} Formatted log entry
   */
  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      app: this.appName,
      message,
      ...meta
    };

    // Add process info for errors
    if (level === 'error') {
      logEntry.process = {
        pid: process.pid,
        memory: process.memoryUsage(),
        uptime: process.uptime()
      };
    }

    return logEntry;
  }

  /**
   * Format message for console output
   * @param {Object} logEntry - Log entry object
   * @returns {string} Formatted console message
   */
  formatConsoleMessage(logEntry) {
    const { timestamp, level, message, ...meta } = logEntry;
    const color = this.colors[level.toLowerCase()] || this.colors.reset;
    const resetColor = this.colors.reset;
    
    let output = `${color}[${timestamp}] ${level}${resetColor}: ${message}`;
    
    // Add metadata if present
    const metaKeys = Object.keys(meta).filter(key => 
      key !== 'app' && key !== 'process'
    );
    
    if (metaKeys.length > 0) {
      const metaStr = metaKeys.map(key => `${key}=${JSON.stringify(meta[key])}`).join(' ');
      output += ` | ${metaStr}`;
    }
    
    return output;
  }

  /**
   * Write log to file
   * @param {Object} logEntry - Log entry object
   */
  async writeToFile(logEntry) {
    if (!this.enableFile) return;

    try {
      const logFileName = `${this.appName}-${new Date().toISOString().split('T')[0]}.log`;
      const logFilePath = path.join(this.logDir, logFileName);
      
      const logLine = this.enableJSON 
        ? JSON.stringify(logEntry) + '\n'
        : `[${logEntry.timestamp}] ${logEntry.level}: ${logEntry.message}\n`;
      
      await fs.appendFile(logFilePath, logLine);
      
      // Check file size and rotate if necessary
      await this.rotateLogIfNeeded(logFilePath);
      
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  /**
   * Rotate log file if it exceeds max size
   * @param {string} logFilePath - Path to log file
   */
  async rotateLogIfNeeded(logFilePath) {
    try {
      const stats = await fs.stat(logFilePath);
      
      if (stats.size > this.maxFileSize) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const rotatedPath = logFilePath.replace('.log', `-${timestamp}.log`);
        
        await fs.rename(logFilePath, rotatedPath);
        
        // Clean up old log files
        await this.cleanOldLogs();
      }
    } catch (error) {
      // File might not exist yet, which is fine
    }
  }

  /**
   * Clean up old log files
   */
  async cleanOldLogs() {
    try {
      const files = await fs.readdir(this.logDir);
      const logFiles = files
        .filter(file => file.startsWith(this.appName) && file.endsWith('.log'))
        .map(file => ({
          name: file,
          path: path.join(this.logDir, file)
        }));

      if (logFiles.length > this.maxFiles) {
        // Sort by modification time and delete oldest files
        const filesWithStats = await Promise.all(
          logFiles.map(async file => ({
            ...file,
            stats: await fs.stat(file.path)
          }))
        );

        filesWithStats
          .sort((a, b) => b.stats.mtime - a.stats.mtime)
          .slice(this.maxFiles)
          .forEach(async file => {
            try {
              await fs.unlink(file.path);
            } catch (error) {
              console.error(`Failed to delete old log file ${file.name}:`, error);
            }
          });
      }
    } catch (error) {
      console.error('Failed to clean old logs:', error);
    }
  }

  /**
   * Log a message
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} meta - Additional metadata
   */
  async log(level, message, meta = {}) {
    if (!this.isLevelEnabled(level)) return;

    const logEntry = this.formatMessage(level, message, meta);

    // Console output
    if (this.enableConsole) {
      const consoleMessage = this.formatConsoleMessage(logEntry);
      console.log(consoleMessage);
    }

    // File output
    await this.writeToFile(logEntry);
  }

  /**
   * Log error message
   * @param {string} message - Error message
   * @param {Object|Error} meta - Error object or metadata
   */
  async error(message, meta = {}) {
    // Handle Error objects
    if (meta instanceof Error) {
      meta = {
        error: {
          name: meta.name,
          message: meta.message,
          stack: meta.stack
        }
      };
    }
    
    await this.log('error', message, meta);
  }

  /**
   * Log warning message
   * @param {string} message - Warning message
   * @param {Object} meta - Additional metadata
   */
  async warn(message, meta = {}) {
    await this.log('warn', message, meta);
  }

  /**
   * Log info message
   * @param {string} message - Info message
   * @param {Object} meta - Additional metadata
   */
  async info(message, meta = {}) {
    await this.log('info', message, meta);
  }

  /**
   * Log debug message
   * @param {string} message - Debug message
   * @param {Object} meta - Additional metadata
   */
  async debug(message, meta = {}) {
    await this.log('debug', message, meta);
  }

  /**
   * Log trace message
   * @param {string} message - Trace message
   * @param {Object} meta - Additional metadata
   */
  async trace(message, meta = {}) {
    await this.log('trace', message, meta);
  }

  /**
   * Log HTTP request
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {number} duration - Request duration in ms
   */
  async logRequest(req, res, duration) {
    const meta = {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress
    };

    const level = res.statusCode >= 400 ? 'warn' : 'info';
    await this.log(level, `${req.method} ${req.url}`, meta);
  }

  /**
   * Log chat message
   * @param {string} conversationId - Conversation ID
   * @param {string} role - Message role (user/assistant)
   * @param {string} content - Message content
   * @param {Object} meta - Additional metadata
   */
  async logChatMessage(conversationId, role, content, meta = {}) {
    await this.log('info', 'Chat message', {
      conversationId,
      role,
      contentLength: content.length,
      ...meta
    });
  }

  /**
   * Log document processing
   * @param {string} operation - Operation type
   * @param {string} documentId - Document ID
   * @param {Object} meta - Additional metadata
   */
  async logDocumentOperation(operation, documentId, meta = {}) {
    await this.log('info', `Document ${operation}`, {
      operation,
      documentId,
      ...meta
    });
  }

  /**
   * Log embedding operation
   * @param {string} operation - Operation type
   * @param {number} count - Number of embeddings
   * @param {Object} meta - Additional metadata
   */
  async logEmbedding(operation, count, meta = {}) {
    await this.log('info', `Embedding ${operation}`, {
      operation,
      count,
      ...meta
    });
  }

  /**
   * Create a child logger with additional context
   * @param {Object} context - Additional context for all logs
   * @returns {Logger} Child logger instance
   */
  child(context = {}) {
    const childLogger = Object.create(this);
    childLogger.defaultMeta = { ...this.defaultMeta, ...context };
    
    // Override log method to include default metadata
    childLogger.log = async (level, message, meta = {}) => {
      const combinedMeta = { ...childLogger.defaultMeta, ...meta };
      return this.log.call(this, level, message, combinedMeta);
    };
    
    return childLogger;
  }

  /**
   * Get log statistics
   * @returns {Object} Log statistics
   */
  async getStats() {
    if (!this.enableFile) {
      return { message: 'File logging disabled' };
    }

    try {
      const files = await fs.readdir(this.logDir);
      const logFiles = files.filter(file => 
        file.startsWith(this.appName) && file.endsWith('.log')
      );

      let totalSize = 0;
      const fileStats = await Promise.all(
        logFiles.map(async file => {
          const filePath = path.join(this.logDir, file);
          const stats = await fs.stat(filePath);
          totalSize += stats.size;
          
          return {
            name: file,
            size: stats.size,
            modified: stats.mtime
          };
        })
      );

      return {
        logDir: this.logDir,
        totalFiles: logFiles.length,
        totalSize,
        maxFileSize: this.maxFileSize,
        maxFiles: this.maxFiles,
        files: fileStats
      };
    } catch (error) {
      return { error: error.message };
    }
  }
}

// Create default logger instance
const defaultLogger = new Logger();

// Export both class and default instance
module.exports = Logger;
module.exports.logger = defaultLogger;