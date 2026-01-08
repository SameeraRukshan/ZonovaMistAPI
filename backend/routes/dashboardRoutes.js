// backend/routes/dashboardRoutes.js
const express = require("express");
const router = express.Router();
const Expense = require("../models/expense");
const Booking = require("../models/booking");
const jwt = require("jsonwebtoken");

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
    case 'week':
      const currentWeekStart = new Date(now);
      currentWeekStart.setDate(now.getDate() - now.getDay());
      currentWeekStart.setHours(0, 0, 0, 0);
      
      if (comparison === 'prev') {
        startDate = new Date(currentWeekStart);
        startDate.setDate(startDate.getDate() - 7);
        endDate = new Date(currentWeekStart);
        endDate.setMilliseconds(-1);
      } else if (comparison === 'now') {
        startDate = currentWeekStart;
        endDate = new Date(currentWeekStart);
        endDate.setDate(endDate.getDate() + 7);
        endDate.setMilliseconds(-1);
      } else { // next
        startDate = new Date(currentWeekStart);
        startDate.setDate(startDate.getDate() + 7);
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 7);
        endDate.setMilliseconds(-1);
      }
      break;
      
    case 'month':
      if (comparison === 'prev') {
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      } else if (comparison === 'now') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      } else { // next
        startDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59, 999);
      }
      break;
      
    case 'year':
      if (comparison === 'prev') {
        startDate = new Date(now.getFullYear() - 1, 0, 1);
        endDate = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
      } else if (comparison === 'now') {
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      } else { // next
        startDate = new Date(now.getFullYear() + 1, 0, 1);
        endDate = new Date(now.getFullYear() + 1, 11, 31, 23, 59, 59, 999);
      }
      break;
      
    case 'custom':
      // For custom, dates should be provided in query params
      return null;
      
    default:
      return null;
  }

  return { startDate, endDate };
};

// --------------------------------------------------
// GET DASHBOARD STATS
// --------------------------------------------------
router.get("/stats", protect, async (req, res) => {
  try {
    const { timePeriod = 'month', startDate, endDate } = req.query;
    
    let dateFilter = {};
    
    if (timePeriod === 'custom' && startDate && endDate) {
      dateFilter = {
        checkin_date: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };
    } else {
      const range = getDateRange(timePeriod, 'now');
      if (range) {
        dateFilter = {
          checkin_date: {
            $gte: range.startDate,
            $lte: range.endDate
          }
        };
      }
    }
    
    console.log('📊 Fetching dashboard stats with filter:', dateFilter);
    
    // Calculate Revenue (total_price from paid bookings)
    const revenueResult = await Booking.aggregate([
      {
        $match: {
          ...req.tenantFilter,
          status: 'paid',
          deleted: { $ne: true },
          ...dateFilter
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$total_price' }
        }
      }
    ]);
    
    // Calculate Advances (advance_amount from advance_paid bookings)
    const advancesResult = await Booking.aggregate([
      {
        $match: {
          ...req.tenantFilter,
          status: 'advance_paid',
          deleted: { $ne: true },
          ...dateFilter
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$advance_amount' }
        }
      }
    ]);
    
    // Calculate previous period for trends
    let prevDateFilter = {};
    if (timePeriod !== 'custom') {
      const prevRange = getDateRange(timePeriod, 'prev');
      if (prevRange) {
        prevDateFilter = {
          checkin_date: {
            $gte: prevRange.startDate,
            $lte: prevRange.endDate
          }
        };
      }
    }
    
    // Previous period revenue for trend calculation
    const prevRevenueResult = await Booking.aggregate([
      {
        $match: {
          ...req.tenantFilter,
          status: 'paid',
          deleted: { $ne: true },
          ...prevDateFilter
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$total_price' }
        }
      }
    ]);
    
    const prevAdvancesResult = await Booking.aggregate([
      {
        $match: {
          ...req.tenantFilter,
          status: 'advance_paid',
          deleted: { $ne: true },
          ...prevDateFilter
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$advance_amount' }
        }
      }
    ]);
    
    const revenue = revenueResult[0]?.total || 0;
    const advances = advancesResult[0]?.total || 0;
    const prevRevenue = prevRevenueResult[0]?.total || 0;
    const prevAdvances = prevAdvancesResult[0]?.total || 0;
    
    // Calculate trends
    const revenueTrend = prevRevenue > 0 
      ? ((revenue - prevRevenue) / prevRevenue * 100).toFixed(1)
      : '0.0';
    const advancesTrend = prevAdvances > 0
      ? ((advances - prevAdvances) / prevAdvances * 100).toFixed(1)
      : '0.0';
    
    const stats = {
      revenue: {
        value: totalRevenue,
        trend: `${totalRevenue > 0 ? '+' : ''}0.0%`,
        isPositive: true
      },
      advances: {
        value: totalAdvances,
        trend: `${totalAdvances > 0 ? '+' : ''}0.0%`,
        isPositive: true
      },
      commission: {
        value: totalCommission,
        trend: `${totalCommission > 0 ? '+' : ''}0.0%`,
        isPositive: true
      },
      expenses: {
        value: totalExpenses,
        trend: `${expenseTrend >= 0 ? '+' : ''}${expenseTrend.toFixed(1)}%`,
        isPositive: expenseTrend <= 0 // For expenses, less is better
      }
    });

  } catch (err) {
    console.error("❌ Stats Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// --------------------------------------------------
// ✅ FIXED: GET EXPENSE COMPARISON DATA
// --------------------------------------------------
router.get("/expense-comparison", protect, async (req, res) => {
  try {
    const { 
      timePeriod = 'month', 
      comparisons = 'now',
      startDate: customStart, 
      endDate: customEnd 
    } = req.query;

    const comparisonsList = comparisons.split(',');

    console.log("📊 Fetching expense comparison:", comparisonsList, "timePeriod:", timePeriod);

    const result = {
      prevData: [],
      nowData: [],
      nextData: []
    };

    // ✅ FIX: Get ALL expenses from database (no date filter for now)
    const allExpenses = await Expense.find({ 
      deleted: false 
    }).sort({ date: 1 });

    console.log(`📊 Found ${allExpenses.length} total expenses in database`);

    if (allExpenses.length === 0) {
      console.log("⚠️ No expenses found in database");
      return res.json(result);
    }

    // Helper to get expenses grouped by period
    const getExpenseData = (expenses, groupByYear = false) => {
      if (groupByYear) {
        // Group by month
        const monthlyData = {};
        expenses.forEach(exp => {
          const date = new Date(exp.date);
          const month = date.getMonth();
          const year = date.getFullYear();
          const monthName = new Date(year, month).toLocaleString('default', { month: 'short' });
          const key = `${year}-${month}`;
          
          if (!monthlyData[key]) {
            monthlyData[key] = {
              label: `${monthName} ${year}`,
              value: 0,
              date: new Date(year, month, 1)
            };
          }
          
          const amount = parseDecimal(exp.amount);
          monthlyData[key].value += amount;
          console.log(`  Added ${amount} to ${monthName} ${year}, total: ${monthlyData[key].value}`);
        });
        
        return Object.values(monthlyData).sort((a, b) => a.date - b.date);
      } else {
        dateRange = getDateRange(timePeriod, comparison);
      }
      
      if (!dateRange) continue;
      
      // Aggregate revenue by date
      const groupBy = timePeriod === 'year' 
        ? { $month: '$checkin_date' }
        : { $dayOfMonth: '$checkin_date' };
      
      const aggregation = await Booking.aggregate([
        {
          $match: {
            ...req.tenantFilter,
            status: 'paid',
            deleted: { $ne: true },
            checkin_date: {
              $gte: dateRange.startDate,
              $lte: dateRange.endDate
            }
          }
        },
        {
          $group: {
            _id: groupBy,
            total: { $sum: '$total_price' },
            date: { $first: '$checkin_date' }
          }
        },
        {
          $sort: { _id: 1 }
        }
      ]);
      
      // Format data points
      const dataPoints = aggregation.map(item => ({
        label: timePeriod === 'year' 
          ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][item._id - 1]
          : item._id.toString(),
        value: parseFloat(item.total.toString()), // Convert Decimal128 to number
        date: item.date
      }));
      
      // Fill in missing dates with 0
      const filledData = fillMissingDates(dataPoints, dateRange, timePeriod);
      
      if (comparison === 'prev') result.prevData = filledData;
      else if (comparison === 'now') result.nowData = filledData;
      else result.nextData = filledData;
    }
    
    console.log('✅ Revenue comparison data prepared');
    res.json(result);

  } catch (err) {
    console.error("❌ Expense Categories Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// --------------------------------------------------
// GET REVENUE COMPARISON DATA
// --------------------------------------------------
router.get("/revenue-comparison", protect, async (req, res) => {
  try {
    const { 
      timePeriod = 'month', 
      comparisons = 'now',
      startDate: customStart, 
      endDate: customEnd 
    } = req.query;

    const { startDate, endDate } = getDateRange(timePeriod, customStart, customEnd);
    const comparisonsList = comparisons.split(',');

    const result = {
      prevData: [],
      nowData: [],
      nextData: []
    };
    
    // TODO: Implement when Expense model is ready
    // Add ...req.tenantFilter to $match when implemented
    
    res.json(result);

  } catch (err) {
    console.error("❌ Revenue Comparison Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;