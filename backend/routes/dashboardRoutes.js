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

    const result = {
      prevData: [],
      nowData: [],
      nextData: []
    };

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

module.exports = router;