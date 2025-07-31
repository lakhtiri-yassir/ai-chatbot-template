const jwt = require("jsonwebtoken");
const logger = require("../utils/logger");

class AuthMiddleware {
  // Verify JWT token
  async verifyToken(req, res, next) {
    try {
      const token = this.extractToken(req);

      if (!token) {
        return res.status(401).json({
          success: false,
          error: "Access token is required",
        });
      }

      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
      } catch (jwtError) {
        logger.warn("JWT verification failed:", jwtError.message);
        return res.status(401).json({
          success: false,
          error: "Invalid or expired token",
        });
      }
    } catch (error) {
      logger.error("Auth middleware error:", error);
      res.status(500).json({
        success: false,
        error: "Authentication failed",
      });
    }
  }

  // Optional authentication (doesn't fail if no token)
  async optionalAuth(req, res, next) {
    try {
      const token = this.extractToken(req);

      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          req.user = decoded;
        } catch (jwtError) {
          // Log but don't fail - this is optional auth
          logger.info("Optional auth failed:", jwtError.message);
        }
      }

      next();
    } catch (error) {
      logger.error("Optional auth middleware error:", error);
      next(); // Continue even if error
    }
  }

  // Extract token from request
  extractToken(req) {
    // Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      return authHeader.substring(7);
    }

    // Check cookies
    if (req.cookies && req.cookies.token) {
      return req.cookies.token;
    }

    // Check query parameter (for WebSocket connections)
    if (req.query && req.query.token) {
      return req.query.token;
    }

    return null;
  }

  // Generate JWT token
  generateToken(payload, options = {}) {
    const defaultOptions = {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
      issuer: "ai-chatbot-api",
      audience: "ai-chatbot-client",
    };

    return jwt.sign(payload, process.env.JWT_SECRET, {
      ...defaultOptions,
      ...options,
    });
  }

  // Verify refresh token
  async verifyRefreshToken(req, res, next) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          error: "Refresh token is required",
        });
      }

      try {
        const decoded = jwt.verify(
          refreshToken,
          process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET
        );
        req.refreshTokenPayload = decoded;
        next();
      } catch (jwtError) {
        logger.warn("Refresh token verification failed:", jwtError.message);
        return res.status(401).json({
          success: false,
          error: "Invalid refresh token",
        });
      }
    } catch (error) {
      logger.error("Refresh token middleware error:", error);
      res.status(500).json({
        success: false,
        error: "Token refresh failed",
      });
    }
  }

  // Check if user has required role
  requireRole(requiredRole) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: "Authentication required",
        });
      }

      if (req.user.role !== requiredRole) {
        return res.status(403).json({
          success: false,
          error: "Insufficient permissions",
        });
      }

      next();
    };
  }

  // Check if user has any of the required roles
  requireAnyRole(requiredRoles) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: "Authentication required",
        });
      }

      if (!requiredRoles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          error: "Insufficient permissions",
        });
      }

      next();
    };
  }

  // Middleware for API key authentication (for external services)
  async verifyApiKey(req, res, next) {
    try {
      const apiKey = req.headers["x-api-key"];

      if (!apiKey) {
        return res.status(401).json({
          success: false,
          error: "API key is required",
        });
      }

      // In a real app, you'd validate against a database
      const validApiKey = process.env.API_KEY;

      if (apiKey !== validApiKey) {
        return res.status(401).json({
          success: false,
          error: "Invalid API key",
        });
      }

      next();
    } catch (error) {
      logger.error("API key verification error:", error);
      res.status(500).json({
        success: false,
        error: "API key verification failed",
      });
    }
  }

  // Socket.IO authentication middleware
  authenticateSocket(socket, next) {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;

      if (!token) {
        return next(new Error("Authentication token required"));
      }

      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.user = decoded;
        next();
      } catch (jwtError) {
        logger.warn("Socket authentication failed:", jwtError.message);
        next(new Error("Invalid token"));
      }
    } catch (error) {
      logger.error("Socket auth middleware error:", error);
      next(new Error("Authentication failed"));
    }
  }
}

module.exports = new AuthMiddleware();
