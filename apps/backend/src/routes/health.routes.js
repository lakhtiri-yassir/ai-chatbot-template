const express = require('express');
const router = express.Router();
const healthController = require('../controllers/health.controller');
const authMiddleware = require('../middleware/auth.middleware');
const rateLimitMiddleware = require('../middleware/rateLimit.middleware');
const errorMiddleware = require('../middleware/error.middleware');

// Basic health check - no authentication required
router.get('/',
  rateLimitMiddleware.generalRateLimit(),
  errorMiddleware.asyncHandler(healthController.healthCheck)
);

// Alternative health check endpoint
router.get('/check',
  rateLimitMiddleware.generalRateLimit(),
  errorMiddleware.asyncHandler(healthController.healthCheck)
);

// Detailed system status - no authentication required for monitoring
router.get('/status',
  rateLimitMiddleware.generalRateLimit(),
  errorMiddleware.asyncHandler(healthController.systemStatus)
);

// API metrics - no authentication required for monitoring
router.get('/metrics',
  rateLimitMiddleware.generalRateLimit(),
  errorMiddleware.asyncHandler(healthController.getMetrics)
);

// System reset - development only
router.post('/reset',
  rateLimitMiddleware.generalRateLimit(),
  errorMiddleware.asyncHandler(healthController.resetSystem)
);

module.exports = router;