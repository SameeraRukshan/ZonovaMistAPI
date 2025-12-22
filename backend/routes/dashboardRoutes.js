<<<<<<< HEAD
// routes/dashboardRoutes.js
const express = require('express');
const router = express.Router();
const Booking = require('../models/booking');
const authMiddleware = require('../middleware/authMiddleware');

// Apply auth middleware to all routes
router.use(authMiddleware);

/**
 * Helper function to get date range based on period and comparison
 */
function getDateRange(timePeriod, comparison) {
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
}

/**
 * GET /dashboard/stats - Get dashboard statistics
 */
router.get('/stats', async (req, res) => {
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
        value: revenue,
        trend: `${revenueTrend > 0 ? '+' : ''}${revenueTrend}%`,
        isPositive: revenueTrend >= 0
      },
      advances: {
        value: advances,
        trend: `${advancesTrend > 0 ? '+' : ''}${advancesTrend}%`,
        isPositive: advancesTrend >= 0
      },
      commission: {
        value: 0, // Placeholder until implemented
        trend: '+0.0%',
        isPositive: true
      },
      expenses: {
        value: 0, // Placeholder until implemented
        trend: '+0.0%',
        isPositive: true
      }
    };
    
    console.log('✅ Dashboard stats calculated:', stats);
    res.json(stats);
    
  } catch (err) {
    console.error('❌ Error fetching dashboard stats:', err.message);
    res.status(500).json({ message: err.message });
  }
});

/**
 * GET /dashboard/revenue-comparison - Get revenue comparison data
 */
router.get('/revenue-comparison', async (req, res) => {
  try {
    const { timePeriod = 'month', comparisons = 'now', startDate, endDate } = req.query;
    const comparisonList = comparisons.split(',');
    
    console.log('📊 Fetching revenue comparison:', { timePeriod, comparisons: comparisonList });
    
=======
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

  if (timePeriod === 'custom' && customStartDate && customEndDate) {
    startDate = new Date(customStartDate);
    endDate = new Date(customEndDate);
  } else if (timePeriod === 'year') {
    startDate = new Date(now.getFullYear(), 0, 1);
    endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
  } else { // month
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
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

    const prevExpenses = await Expense.find({
      deleted: false,
      date: { $gte: prevStartDate, $lte: prevEndDate }
    });

    const prevTotalExpenses = prevExpenses.reduce((sum, exp) => 
      sum + parseDecimal(exp.amount), 0);

    // Calculate trend
    const expenseTrend = prevTotalExpenses === 0 ? 0 : 
      ((totalExpenses - prevTotalExpenses) / prevTotalExpenses) * 100;

    res.json({
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

>>>>>>> room-rate-new
    const result = {
      prevData: [],
      nowData: [],
      nextData: []
    };
<<<<<<< HEAD
    
    for (const comparison of comparisonList) {
      let dateRange;
      
      if (timePeriod === 'custom' && startDate && endDate) {
        // For custom date range
        const start = new Date(startDate);
        const end = new Date(endDate);
        const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        
        if (comparison === 'prev') {
          const prevStart = new Date(start);
          prevStart.setDate(prevStart.getDate() - daysDiff);
          dateRange = { startDate: prevStart, endDate: start };
        } else if (comparison === 'now') {
          dateRange = { startDate: start, endDate: end };
        } else {
          const nextStart = new Date(end);
          dateRange = { startDate: end, endDate: new Date(nextStart.setDate(nextStart.getDate() + daysDiff)) };
        }
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
    console.error('❌ Error fetching revenue comparison:', err.message);
    res.status(500).json({ message: err.message });
  }
});

/**
 * GET /dashboard/expense-comparison - Get expense comparison data
 */
router.get('/expense-comparison', async (req, res) => {
  try {
    // Placeholder: Return empty data until expenses are implemented
    const { timePeriod = 'month', comparisons = 'now' } = req.query;
    
    console.log('📊 Fetching expense comparison (placeholder)');
    
=======

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
        // Group by month-year for month view
        const monthlyData = {};
        expenses.forEach(exp => {
          const date = new Date(exp.date);
          const monthYear = `${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear()}`;
          
          if (!monthlyData[monthYear]) {
            monthlyData[monthYear] = {
              label: monthYear,
              value: 0,
              date: date
            };
          }
          
          const amount = parseDecimal(exp.amount);
          monthlyData[monthYear].value += amount;
          console.log(`  Added ${amount} to ${monthYear}, total: ${monthlyData[monthYear].value}`);
        });
        
        return Object.values(monthlyData).sort((a, b) => a.date - b.date);
      }
    };

    // Process data based on comparisons
    if (comparisonsList.includes('now')) {
      const groupByYear = timePeriod === 'year';
      result.nowData = getExpenseData(allExpenses, groupByYear);
      console.log(`✅ Now data ready: ${result.nowData.length} periods`);
    }

    if (comparisonsList.includes('prev')) {
      // For prev, you can implement date filtering if needed
      result.prevData = [];
      console.log("⚠️ Prev data not implemented yet");
    }

    if (comparisonsList.includes('next')) {
      // Future data is empty
      result.nextData = [];
    }

    console.log(`✅ Expense comparison ready:`, {
      prevCount: result.prevData.length,
      nowCount: result.nowData.length,
      nextCount: result.nextData.length,
      totalAmount: result.nowData.reduce((sum, d) => sum + d.value, 0)
    });

    res.json(result);

  } catch (err) {
    console.error("❌ Expense Comparison Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// --------------------------------------------------
// ✅ FIXED: GET EXPENSE CATEGORIES DATA
// --------------------------------------------------
router.get("/expense-categories", protect, async (req, res) => {
  try {
    const { timePeriod = 'month', startDate: customStart, endDate: customEnd } = req.query;
    
    console.log("📊 Fetching expense categories for timePeriod:", timePeriod);

    // ✅ FIX: Get ALL expenses from database (no date filter)
    const expenses = await Expense.find({ 
      deleted: false 
    });

    console.log(`📊 Found ${expenses.length} total expenses`);

    if (expenses.length === 0) {
      console.log("⚠️ No expenses found");
      return res.json([]);
    }

    // Group by category
    const categoryMap = {};
    const categoryColors = {
      'Light Bill': '#FF6B6B',
      'Water Bill': '#4ECDC4',
      'Internet Bill': '#45B7D1',
      'Salary': '#FFA07A',
      'Cleaning': '#98D8C8',
      'Rent': '#F7DC6F',
      'Purchases': '#BB8FCE'
    };

    expenses.forEach(exp => {
      const category = exp.category || 'Other';
      
      if (!categoryMap[category]) {
        categoryMap[category] = {
          category,
          amount: 0,
          color: categoryColors[category] || '#95A5A6'
        };
      }
      
      const amount = parseDecimal(exp.amount);
      categoryMap[category].amount += amount;
      console.log(`  ${category}: +${amount} = ${categoryMap[category].amount}`);
    });

    const result = Object.values(categoryMap)
      .filter(cat => cat.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    console.log(`✅ Categories ready: ${result.length} categories`);
    result.forEach(cat => {
      console.log(`   ${cat.category}: Rs. ${cat.amount.toFixed(2)}`);
    });

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

>>>>>>> room-rate-new
    const result = {
      prevData: [],
      nowData: [],
      nextData: []
    };
<<<<<<< HEAD
    
    // TODO: Implement when Expense model is ready
    // Add ...req.tenantFilter to $match when implemented
    
    res.json(result);
    
  } catch (err) {
    console.error('❌ Error fetching expense comparison:', err.message);
    res.status(500).json({ message: err.message });
  }
});

/**
 * GET /dashboard/expense-categories - Get expense by category
 */
router.get('/expense-categories', async (req, res) => {
  try {
    // Placeholder: Return empty data until expenses are implemented
    console.log('📊 Fetching expense categories (placeholder)');
    
    const categories = [
      { category: 'Light Bill', amount: 0, color: '#FFA726' },
      { category: 'Water Bill', amount: 0, color: '#42A5F5' },
      { category: 'Internet Bill', amount: 0, color: '#AB47BC' },
      { category: 'Salary', amount: 0, color: '#66BB6A' },
      { category: 'Cleaning', amount: 0, color: '#26A69A' },
      { category: 'Rent', amount: 0, color: '#FF7043' },
      { category: 'Purchases', amount: 0, color: '#EC407A' }
    ];
    
    // TODO: Implement when Expense model is ready
    /*
    const result = await Expense.aggregate([
      {
        $match: {
          deleted: { $ne: true },
          date: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$category',
          amount: { $sum: '$amount' }
        }
      }
    ]);
    */
    
    res.json(categories);
    
  } catch (err) {
    console.error('❌ Error fetching expense categories:', err.message);
    res.status(500).json({ message: err.message });
  }
});

/**
 * Helper function to fill missing dates with zero values
 */
function fillMissingDates(dataPoints, dateRange, timePeriod) {
  const { startDate, endDate } = dateRange;
  const filled = [];
  
  if (timePeriod === 'year') {
    // Fill 12 months
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    for (let i = 0; i < 12; i++) {
      const existing = dataPoints.find(dp => dp.label === monthNames[i]);
      filled.push(existing || {
        label: monthNames[i],
        value: 0,
        date: new Date(startDate.getFullYear(), i, 1)
      });
    }
  } else if (timePeriod === 'week') {
    // Fill 7 days
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const day = date.getDate();
      const existing = dataPoints.find(dp => dp.label === day.toString());
      filled.push(existing || {
        label: day.toString(),
        value: 0,
        date: date
      });
    }
  } else {
    // Fill days in month
    const daysInPeriod = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    for (let i = 0; i <= daysInPeriod; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const day = date.getDate();
      const existing = dataPoints.find(dp => dp.label === day.toString());
      filled.push(existing || {
        label: day.toString(),
        value: 0,
        date: date
      });
    }
  }
  
  // Ensure all values are plain numbers
  return filled.map(item => ({
    ...item,
    value: typeof item.value === 'number' ? item.value : parseFloat(item.value.toString())
  }));
}

=======

    // Get revenue data from bookings
    const getRevenueData = async (start, end) => {
      const bookings = await Booking.find({
        checkin_date: { $gte: start, $lte: end }
      });

      if (timePeriod === 'year') {
        // Group by month
        const monthlyData = {};
        bookings.forEach(booking => {
          const month = new Date(booking.checkin_date).getMonth();
          const monthName = new Date(2000, month).toLocaleString('default', { month: 'short' });
          if (!monthlyData[month]) {
            monthlyData[month] = {
              label: monthName,
              value: 0,
              date: new Date(new Date(booking.checkin_date).getFullYear(), month, 1)
            };
          }
          monthlyData[month].value += parseDecimal(booking.total_price);
        });
        return Object.values(monthlyData).sort((a, b) => a.date - b.date);
      } else {
        // Group by day
        const dailyData = {};
        bookings.forEach(booking => {
          const day = new Date(booking.checkin_date).toISOString().split('T')[0];
          if (!dailyData[day]) {
            dailyData[day] = {
              label: new Date(booking.checkin_date).getDate().toString(),
              value: 0,
              date: new Date(booking.checkin_date)
            };
          }
          dailyData[day].value += parseDecimal(booking.total_price);
        });
        return Object.values(dailyData).sort((a, b) => a.date - b.date);
      }
    };

    if (comparisonsList.includes('prev')) {
      const periodLength = endDate - startDate;
      const prevStart = new Date(startDate.getTime() - periodLength);
      const prevEnd = new Date(startDate.getTime() - 1);
      result.prevData = await getRevenueData(prevStart, prevEnd);
    }

    if (comparisonsList.includes('now')) {
      result.nowData = await getRevenueData(startDate, endDate);
    }

    if (comparisonsList.includes('next')) {
      const periodLength = endDate - startDate;
      const nextStart = new Date(endDate.getTime() + 1);
      const nextEnd = new Date(endDate.getTime() + periodLength);
      result.nextData = await getRevenueData(nextStart, nextEnd);
    }

    res.json(result);

  } catch (err) {
    console.error("❌ Revenue Comparison Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

>>>>>>> room-rate-new
module.exports = router;