// routes/dashboardRoutes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const dashboardController = require('../controllers/dashboardController');

// Apply auth middleware to all routes
router.use(authMiddleware);

/**
 * GET /dashboard/stats - Get dashboard statistics
 */
router.get('/stats', dashboardController.getStats);

/**
 * GET /dashboard/revenue-comparison - Get revenue comparison data
 */
router.get('/revenue-comparison', dashboardController.getRevenueComparison);

/**
 * GET /dashboard/expense-comparison - Get expense comparison data
 */
router.get('/expense-comparison', dashboardController.getExpenseComparison);

/**
 * GET /dashboard/expense-categories - Get expense by category
 */
router.get('/expense-categories', dashboardController.getExpenseCategories);

module.exports = router;