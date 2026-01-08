// backend/routes/dashboardRoutes.js
const express = require("express");
const router = express.Router();
const Expense = require("../models/expense");
const Booking = require("../models/booking");
const auth = require("../middleware/authMiddleware");

// Use shared auth middleware (adds req.user and req.tenantFilter)

// Helper function to parse Decimal128
const parseDecimal = (val) => {
  if (!val) return 0;
  return parseFloat(val.toString());
};

// Helper function to get date range based on time period
const getDateRange = (timePeriod, comparison = 'now', customStartDate, customEndDate) => {
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
      if (customStartDate && customEndDate) {
        startDate = new Date(customStartDate);
        endDate = new Date(customEndDate);
      } else {
        return null;
      }
      
    default:
      return null;
  }

  return { startDate, endDate };
};

// --------------------------------------------------
// GET DASHBOARD STATS
// --------------------------------------------------
router.get("/stats", auth, async (req, res) => {
  try {
    const { timePeriod = 'month', startDate, endDate } = req.query;
    const range = getDateRange(timePeriod, 'now', startDate, endDate);
    const dateFilter = range ? { checkin_date: { $gte: range.startDate, $lte: range.endDate } } : {};
    
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
    const prevRange = timePeriod !== 'custom' ? getDateRange(timePeriod, 'prev', startDate, endDate) : null;
    const prevDateFilter = prevRange ? { checkin_date: { $gte: prevRange.startDate, $lte: prevRange.endDate } } : {};
    
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

    // Expenses for same range
    const expenseDateFilter = range ? { date: { $gte: range.startDate, $lte: range.endDate } } : {};
    const expensesAgg = await Expense.aggregate([
      { $match: { ...req.tenantFilter, deleted: { $ne: true }, ...expenseDateFilter } },
      { $group: { _id: null, total: { $sum: { $toDouble: "$amount" } } } }
    ]);
    const totalExpenses = expensesAgg[0]?.total || 0;
    
    // Previous period expenses
    const prevExpensesAgg = await Expense.aggregate([
      { $match: { ...req.tenantFilter, deleted: { $ne: true }, ...(prevRange ? { date: { $gte: prevRange.startDate, $lte: prevRange.endDate } } : {}) } },
      { $group: { _id: null, total: { $sum: { $toDouble: "$amount" } } } }
    ]);
    const prevExpenses = prevExpensesAgg[0]?.total || 0;
    
    // Calculate trends
    const revenueTrend = prevRevenue > 0 
      ? ((revenue - prevRevenue) / prevRevenue * 100).toFixed(1)
      : '0.0';
    const advancesTrend = prevAdvances > 0
      ? ((advances - prevAdvances) / prevAdvances * 100).toFixed(1)
      : '0.0';
    const expenseTrend = prevExpenses > 0
      ? ((totalExpenses - prevExpenses) / prevExpenses * 100).toFixed(1)
      : '0.0';

    const stats = {
      revenue: {
        value: revenue,
        trend: `${parseFloat(revenueTrend) >= 0 ? '+' : ''}${revenueTrend}%`,
        isPositive: parseFloat(revenueTrend) >= 0
      },
      advances: {
        value: advances,
        trend: `${parseFloat(advancesTrend) >= 0 ? '+' : ''}${advancesTrend}%`,
        isPositive: parseFloat(advancesTrend) >= 0
      },
      commission: {
        value: 0,
        trend: '+0.0%',
        isPositive: true
      },
      expenses: {
        value: totalExpenses,
        trend: `${parseFloat(expenseTrend) >= 0 ? '+' : ''}${expenseTrend}%`,
        isPositive: parseFloat(expenseTrend) <= 0 // For expenses, less is better
      }
    };

    res.json(stats);

  } catch (err) {
    console.error("❌ Stats Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// --------------------------------------------------
// ✅ FIXED: GET EXPENSE COMPARISON DATA
// --------------------------------------------------
router.get("/expense-comparison", auth, async (req, res) => {
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

    // Build data for each comparison period
    for (const comparison of comparisonsList) {
      const range = getDateRange(timePeriod, comparison, customStart, customEnd);
      if (!range) continue;

      const match = { ...req.tenantFilter, deleted: { $ne: true }, date: { $gte: range.startDate, $lte: range.endDate } };
      const expenses = await Expense.find(match).sort({ date: 1 });

      // Group by day (week/month) or month (year)
      const points = [];
      const byKey = {};
      for (const exp of expenses) {
        const d = new Date(exp.date);
        const key = timePeriod === 'year' ? `${d.getFullYear()}-${d.getMonth()}` : d.toISOString().slice(0,10);
        const label = timePeriod === 'year'
          ? new Date(d.getFullYear(), d.getMonth(), 1).toLocaleString('default', { month: 'short' })
          : key;
        const val = parseDecimal(exp.amount);
        if (!byKey[key]) {
          byKey[key] = { label, value: 0, date: timePeriod === 'year' ? new Date(d.getFullYear(), d.getMonth(), 1) : new Date(key) };
        }
        byKey[key].value += val;
      }
      const data = Object.values(byKey).sort((a,b) => a.date - b.date);

      if (comparison === 'prev') result.prevData = data;
      else if (comparison === 'now') result.nowData = data;
      else result.nextData = data;
    }

    console.log('✅ Expense comparison data prepared');
    res.json(result);

  } catch (err) {
    console.error("❌ Expense Categories Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// --------------------------------------------------
// GET REVENUE COMPARISON DATA
// --------------------------------------------------
router.get("/revenue-comparison", auth, async (req, res) => {
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