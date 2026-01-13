// backend/routes/dashboardRoutes.js
const express = require("express");
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const dashboardController = require('../controllers/dashboardController');

// 🔥 Authentication Middleware
const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    try {
      token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      next();
    } catch (error) {
      console.error("❌ Token verification failed:", error.message);
      return res.status(401).json({ error: "Not authorized, token failed" });
    }
  } else {
    return res.status(401).json({ error: "Not authorized, no token" });
  }
};

// Helper function to parse Decimal128
const parseDecimal = (val) => {
  if (!val) return 0;
  return parseFloat(val.toString());
};

// Helper function to get date range based on time period
const getDateRange = (timePeriod, customStartDate, customEndDate) => {
  const now = new Date();
  let startDate, endDate;

  switch (timePeriod) {
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      break;
    case 'custom':
      startDate = new Date(customStartDate);
      endDate = new Date(customEndDate);
      break;
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  }

  return { startDate, endDate };
};

// --------------------------------------------------
// GET DASHBOARD STATS
// --------------------------------------------------
router.get("/stats", protect, async (req, res) => {
  try {
    const { timePeriod = 'month', startDate: customStart, endDate: customEnd } = req.query;
    
    const { startDate, endDate } = getDateRange(timePeriod, customStart, customEnd);
    
    console.log("📊 Fetching stats from", startDate, "to", endDate);

    // Get expenses for current period
    const expenses = await Expense.find({
      deleted: false,
      date: { $gte: startDate, $lte: endDate }
    });

    const totalExpenses = expenses.reduce((sum, exp) => sum + parseDecimal(exp.amount), 0);

    // Get bookings for revenue calculation
    const bookings = await Booking.find({
      checkin_date: { $gte: startDate, $lte: endDate }
    });

    const totalRevenue = bookings.reduce((sum, booking) => 
      sum + parseDecimal(booking.total_price), 0);
    
    const totalAdvances = bookings.reduce((sum, booking) => 
      sum + parseDecimal(booking.advance_amount), 0);
    
    const totalCommission = bookings.reduce((sum, booking) => 
      sum + parseDecimal(booking.commission_amount), 0);

    // Calculate previous period for trend
    const periodLength = endDate - startDate;
    const prevStartDate = new Date(startDate.getTime() - periodLength);
    const prevEndDate = new Date(startDate.getTime() - 1);

    // Current period bookings
    const currentBookings = await Booking.find({
      ...req.tenantFilter,
      checkin_date: { $gte: startDate, $lte: endDate },
      deleted: { $ne: true }
    });

    // Previous period bookings
    const prevBookings = await Booking.find({
      ...req.tenantFilter,
      checkin_date: { $gte: prevStartDate, $lte: prevEndDate },
      deleted: { $ne: true }
    });

    // Current period expenses
    const currentExpenses = await Expense.find({
      ...req.tenantFilter,
      date: { $gte: startDate, $lte: endDate }
    });

    // Previous period expenses
    const prevExpenses = await Expense.find({
      ...req.tenantFilter,
      date: { $gte: prevStartDate, $lte: prevEndDate }
    });

    // Calculate current values
    const currentRevenue = currentBookings.reduce((sum, b) => sum + parseDecimal(b.total_price), 0);
    const currentAdvances = currentBookings.reduce((sum, b) => sum + parseDecimal(b.advance_amount), 0);
    const currentCommission = currentBookings.reduce((sum, b) => sum + parseDecimal(b.commission || 0), 0);
    const currentExpenseTotal = currentExpenses.reduce((sum, e) => sum + parseDecimal(e.amount), 0);

    // Calculate previous values
    const prevRevenue = prevBookings.reduce((sum, b) => sum + parseDecimal(b.total_price), 0);
    const prevAdvances = prevBookings.reduce((sum, b) => sum + parseDecimal(b.advance_amount), 0);
    const prevCommission = prevBookings.reduce((sum, b) => sum + parseDecimal(b.commission || 0), 0);
    const prevExpenseTotal = prevExpenses.reduce((sum, e) => sum + parseDecimal(e.amount), 0);

    // Calculate trends
    const calcTrend = (current, previous) => {
      if (previous === 0) return current > 0 ? '+100%' : '0%';
      const change = ((current - previous) / previous) * 100;
      return `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
    };

    const response = {
      revenue: {
        value: currentRevenue,
        trend: calcTrend(currentRevenue, prevRevenue),
        isPositive: currentRevenue >= prevRevenue
      },
      advances: {
        value: currentAdvances,
        trend: calcTrend(currentAdvances, prevAdvances),
        isPositive: currentAdvances >= prevAdvances
      },
      commission: {
        value: currentCommission,
        trend: calcTrend(currentCommission, prevCommission),
        isPositive: currentCommission >= prevCommission
      },
      expenses: {
        value: currentExpenseTotal,
        trend: calcTrend(currentExpenseTotal, prevExpenseTotal),
        isPositive: currentExpenseTotal <= prevExpenseTotal // Lower expenses is positive
      }
    };

    console.log('✅ Dashboard stats fetched successfully');
    res.json(response);
  } catch (err) {
    console.error('❌ Error fetching dashboard stats:', err.message);
    res.status(500).json({ message: err.message });
  }
});
// Apply auth middleware to all routes
router.use(authMiddleware);

/**
 * @swagger
 * tags:
 *   name: Dashboard
 *   description: Dashboard statistics and analytics endpoints
 */

/**
 * @swagger
 * /api/dashboard/stats:
 *   get:
 *     summary: Get dashboard statistics
 *     description: Retrieve overall dashboard statistics including bookings, revenue, and key metrics
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalBookings:
 *                   type: number
 *                 totalRevenue:
 *                   type: number
 *                 totalExpenses:
 *                   type: number
 *                 netProfit:
 *                   type: number
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
router.get('/stats', dashboardController.getStats);

/**
 * @swagger
 * /api/dashboard/revenue-comparison:
 *   get:
 *     summary: Get revenue comparison data
 *     description: Retrieve revenue comparison data for analytics and reporting
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly, yearly]
 *         description: Time period for comparison
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for comparison range
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for comparison range
 *     responses:
 *       200:
 *         description: Revenue comparison data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 currentPeriod:
 *                   type: number
 *                 previousPeriod:
 *                   type: number
 *                 percentageChange:
 *                   type: number
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
router.get('/revenue-comparison', dashboardController.getRevenueComparison);

/**
 * @swagger
 * /api/dashboard/expense-comparison:
 *   get:
 *     summary: Get expense comparison data
 *     description: Retrieve expense comparison data for analytics and reporting
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly, yearly]
 *         description: Time period for comparison
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for comparison range
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for comparison range
 *     responses:
 *       200:
 *         description: Expense comparison data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 currentPeriod:
 *                   type: number
 *                 previousPeriod:
 *                   type: number
 *                 percentageChange:
 *                   type: number
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
router.get('/expense-comparison', dashboardController.getExpenseComparison);

/**
 * @swagger
 * /api/dashboard/expense-categories:
 *   get:
 *     summary: Get expenses by category
 *     description: Retrieve expense breakdown by category for pie charts and analytics
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for filtering
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for filtering
 *     responses:
 *       200:
 *         description: Expense categories retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   category:
 *                     type: string
 *                   amount:
 *                     type: number
 *                   percentage:
 *                     type: number
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
router.get('/expense-categories', dashboardController.getExpenseCategories);

module.exports = router;