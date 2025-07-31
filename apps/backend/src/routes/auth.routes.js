const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth.middleware");
const rateLimitMiddleware = require("../middleware/rateLimit.middleware");
const errorMiddleware = require("../middleware/error.middleware");
const { body } = require("express-validator");

// Validation middleware
const registerValidation = [
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long"),
  body("name")
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Name must be between 2 and 50 characters"),
];

const loginValidation = [
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email"),
  body("password").notEmpty().withMessage("Password is required"),
];

// Simple auth controller functions (you can expand these)
const authController = {
  // Register new user
  register: async (req, res) => {
    try {
      const { email, password, name } = req.body;

      // For demo purposes - in real app, hash password and save to DB
      const user = {
        id: Date.now().toString(),
        email,
        name,
        role: "user",
        createdAt: new Date(),
      };

      const token = authMiddleware.generateToken({
        id: user.id,
        email: user.email,
        role: user.role,
      });

      res.status(201).json({
        success: true,
        data: {
          user,
          token,
        },
        message: "User registered successfully",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "Registration failed",
      });
    }
  },

  // Login user
  login: async (req, res) => {
    try {
      const { email, password } = req.body;

      // For demo purposes - in real app, verify against DB
      const user = {
        id: Date.now().toString(),
        email,
        name: "Demo User",
        role: "user",
      };

      const token = authMiddleware.generateToken({
        id: user.id,
        email: user.email,
        role: user.role,
      });

      res.json({
        success: true,
        data: {
          user,
          token,
        },
        message: "Login successful",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "Login failed",
      });
    }
  },

  // Get current user
  getProfile: async (req, res) => {
    try {
      res.json({
        success: true,
        data: {
          user: req.user,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "Failed to get profile",
      });
    }
  },

  // Refresh token
  refreshToken: async (req, res) => {
    try {
      const { id, email, role } = req.refreshTokenPayload;

      const newToken = authMiddleware.generateToken({
        id,
        email,
        role,
      });

      res.json({
        success: true,
        data: {
          token: newToken,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "Token refresh failed",
      });
    }
  },

  // Logout user
  logout: async (req, res) => {
    try {
      // In a real app, you'd invalidate the token in Redis/DB
      res.json({
        success: true,
        message: "Logout successful",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "Logout failed",
      });
    }
  },
};

// POST /api/auth/register - Register new user
router.post(
  "/register",
  rateLimitMiddleware.authRateLimit(),
  registerValidation,
  errorMiddleware.validationErrorHandler(
    require("express-validator").validationResult
  ),
  errorMiddleware.asyncHandler(authController.register)
);

// POST /api/auth/login - Login user
router.post(
  "/login",
  rateLimitMiddleware.authRateLimit(),
  loginValidation,
  errorMiddleware.validationErrorHandler(
    require("express-validator").validationResult
  ),
  errorMiddleware.asyncHandler(authController.login)
);

// GET /api/auth/profile - Get current user profile
router.get(
  "/profile",
  authMiddleware.verifyToken,
  rateLimitMiddleware.generalRateLimit(),
  errorMiddleware.asyncHandler(authController.getProfile)
);

// POST /api/auth/refresh - Refresh token
router.post(
  "/refresh",
  authMiddleware.verifyRefreshToken,
  rateLimitMiddleware.authRateLimit(),
  errorMiddleware.asyncHandler(authController.refreshToken)
);

// POST /api/auth/logout - Logout user
router.post(
  "/logout",
  authMiddleware.verifyToken,
  rateLimitMiddleware.generalRateLimit(),
  errorMiddleware.asyncHandler(authController.logout)
);

module.exports = router;
