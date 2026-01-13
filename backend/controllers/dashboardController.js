const Expense = require("../models/expense");
const Booking = require("../models/booking");

// Helper function to parse Decimal128
const parseDecimal = (val) => {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;
  if (val.$numberDecimal) return parseFloat(val.$numberDecimal);
  if (typeof val === 'string') return parseFloat(val) || 0;
  return 0;
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

/**
 * GET /dashboard/stats - Get dashboard statistics
 */
const getStats = async (req, res) => {
  try {
    console.log('📊 Fetching dashboard stats');
    const { timePeriod = 'month', startDate: customStart, endDate: customEnd } = req.query;
    const { startDate, endDate } = getDateRange(timePeriod, customStart, customEnd);

    // Get previous period for comparison
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
};

/**
 * GET /dashboard/revenue-comparison - Get revenue comparison data
 */
const getRevenueComparison = async (req, res) => {
  try {
    const { timePeriod = 'month', comparisons: comparisonsStr = 'now', startDate: customStart, endDate: customEnd } = req.query;
    const comparisons = comparisonsStr.split(',');
    
    console.log('📊 Fetching revenue comparison:', { timePeriod, comparisons });

    const { startDate, endDate } = getDateRange(timePeriod, customStart, customEnd);
    const periodLength = endDate - startDate;

    const result = {
      prevData: [],
      nowData: [],
      nextData: []
    };

    // Helper to get data points for a period
    const getDataPoints = async (periodStart, periodEnd) => {
      const bookings = await Booking.find({
        ...req.tenantFilter,
        checkin_date: { $gte: periodStart, $lte: periodEnd },
        deleted: { $ne: true }
      }).sort({ checkin_date: 1 });

      // Group by day
      const dailyData = {};
      bookings.forEach(booking => {
        const dateKey = booking.checkin_date.toISOString().split('T')[0];
        if (!dailyData[dateKey]) {
          dailyData[dateKey] = 0;
        }
        dailyData[dateKey] += parseDecimal(booking.total_price);
      });

      return Object.entries(dailyData).map(([date, value]) => ({
        label: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: value,
        date: date
      }));
    };

    // Process each comparison period
    for (const comp of comparisons) {
      let periodStart, periodEnd;
      
      switch (comp.trim()) {
        case 'prev':
          periodStart = new Date(startDate.getTime() - periodLength);
          periodEnd = new Date(startDate.getTime() - 1);
          result.prevData = await getDataPoints(periodStart, periodEnd);
          break;
        case 'now':
          result.nowData = await getDataPoints(startDate, endDate);
          break;
        case 'next':
          periodStart = new Date(endDate.getTime() + 1);
          periodEnd = new Date(endDate.getTime() + periodLength);
          result.nextData = await getDataPoints(periodStart, periodEnd);
          break;
      }
    }

    console.log('✅ Revenue comparison fetched successfully');
    res.json(result);
  } catch (err) {
    console.error('❌ Error fetching revenue comparison:', err.message);
    res.status(500).json({ message: err.message });
  }
};

/**
 * GET /dashboard/expense-comparison - Get expense comparison data
 */
const getExpenseComparison = async (req, res) => {
  try {
    const { timePeriod = 'month', comparisons: comparisonsStr = 'now', startDate: customStart, endDate: customEnd } = req.query;
    const comparisons = comparisonsStr.split(',');
    
    console.log('📊 Fetching expense comparison:', { timePeriod, comparisons });

    const { startDate, endDate } = getDateRange(timePeriod, customStart, customEnd);
    const periodLength = endDate - startDate;

    const result = {
      prevData: [],
      nowData: [],
      nextData: []
    };

    // Helper to get data points for a period
    const getDataPoints = async (periodStart, periodEnd) => {
      const expenses = await Expense.find({
        ...req.tenantFilter,
        date: { $gte: periodStart, $lte: periodEnd }
      }).sort({ date: 1 });

      // Group by day
      const dailyData = {};
      expenses.forEach(expense => {
        const dateKey = expense.date.toISOString().split('T')[0];
        if (!dailyData[dateKey]) {
          dailyData[dateKey] = 0;
        }
        dailyData[dateKey] += parseDecimal(expense.amount);
      });

      return Object.entries(dailyData).map(([date, value]) => ({
        label: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: value,
        date: date
      }));
    };

    // Process each comparison period
    for (const comp of comparisons) {
      let periodStart, periodEnd;
      
      switch (comp.trim()) {
        case 'prev':
          periodStart = new Date(startDate.getTime() - periodLength);
          periodEnd = new Date(startDate.getTime() - 1);
          result.prevData = await getDataPoints(periodStart, periodEnd);
          break;
        case 'now':
          result.nowData = await getDataPoints(startDate, endDate);
          break;
        case 'next':
          periodStart = new Date(endDate.getTime() + 1);
          periodEnd = new Date(endDate.getTime() + periodLength);
          result.nextData = await getDataPoints(periodStart, periodEnd);
          break;
      }
    }

    console.log('✅ Expense comparison fetched successfully');
    res.json(result);
  } catch (err) {
    console.error('❌ Error fetching expense comparison:', err.message);
    res.status(500).json({ message: err.message });
  }
};

/**
 * GET /dashboard/expense-categories - Get expense by category
 */
const getExpenseCategories = async (req, res) => {
  try {
    const { timePeriod = 'month', startDate: customStart, endDate: customEnd } = req.query;
    const { startDate, endDate } = getDateRange(timePeriod, customStart, customEnd);

    console.log('📊 Fetching expense categories');

    const expenses = await Expense.find({
      ...req.tenantFilter,
      date: { $gte: startDate, $lte: endDate }
    });

    // Group by category
    const categoryData = {};
    expenses.forEach(expense => {
      const category = expense.category || 'Other';
      if (!categoryData[category]) {
        categoryData[category] = 0;
      }
      categoryData[category] += parseDecimal(expense.amount);
    });

    // Define colors for categories
    const categoryColors = {
      'Food': '#FF6384',
      'Utilities': '#36A2EB',
      'Maintenance': '#FFCE56',
      'Salary': '#4BC0C0',
      'Supplies': '#9966FF',
      'Marketing': '#FF9F40',
      'Other': '#C9CBCF'
    };

    const result = Object.entries(categoryData).map(([category, amount]) => ({
      category: category,
      amount: amount,
      color: categoryColors[category] || '#C9CBCF'
    }));

    console.log('✅ Expense categories fetched successfully');
    res.json(result);
  } catch (err) {
    console.error('❌ Error fetching expense categories:', err.message);
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getStats,
  getRevenueComparison,
  getExpenseComparison,
  getExpenseCategories
};