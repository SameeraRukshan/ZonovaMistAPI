const Expense = require("../models/expense");
const { addTenantId } = require("../middleware/authMiddleware");

// Safe date parse helper
const safeDate = (d) => {
  const dt = new Date(d);
  return isNaN(dt) ? new Date() : dt;
};

/**
 * CREATE EXPENSE
 * POST /api/expenses
 */
const createExpense = async (req, res) => {
  try {
    console.log("📥 Received expense data:", JSON.stringify(req.body, null, 2));
    console.log("👤 User ID:", req.user.id);
    
    const { category, title, amount, date, description, images } = req.body;

    if (!category || !title) {
      console.error("❌ Missing required fields");
      return res.status(400).json({ error: "Category & title are required" });
    }

    let imageArray = [];
    if (images && Array.isArray(images)) {
      imageArray = images.map(img => ({
        filename: img.filename || 'image.jpg',
        url: img.url,
        cloudinary_id: img.cloudinary_id,
        fileSize: img.fileSize || 0,
        mimeType: img.mimeType || 'image/jpeg',
        uploadedAt: new Date()
      }));
    }

    const expenseData = addTenantId(req, {
      category,
      title,
      amount: parseFloat(amount) || 0,
      date: safeDate(date),
      description: description || "",
      images: imageArray,
    });

    const expense = new Expense(expenseData);
    const saved = await expense.save();
    console.log("✅ Expense created:", saved._id);
    
    return res.status(201).json(saved);
  } catch (err) {
    console.error("❌ Create Expense Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};

/**
 * GET ALL EXPENSES
 * GET /api/expenses
 */
const getAllExpenses = async (req, res) => {
  try {
    console.log("📋 Fetching expenses for user:", req.user.id);
    const list = await Expense.find({ 
      deleted: false,
      ...req.tenantFilter
    }).sort({ createdAt: -1 });
    console.log(`✅ Found ${list.length} expenses`);
    res.json(list);
  } catch (err) {
    console.error("❌ Fetch Error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET SINGLE EXPENSE
 * GET /api/expenses/:id
 */
const getExpenseById = async (req, res) => {
  try {
    console.log("🔍 Fetching expense:", req.params.id);
    const exp = await Expense.findOne({
      _id: req.params.id,
      ...req.tenantFilter
    });
    if (!exp || exp.deleted) {
      console.error("❌ Expense not found");
      return res.status(404).json({ error: "Not found" });
    }
    console.log("✅ Expense found");
    res.json(exp);
  } catch (err) {
    console.error("❌ Fetch Error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

/**
 * UPDATE EXPENSE
 * PUT /api/expenses/:id
 */
const updateExpense = async (req, res) => {
  try {
    console.log("📝 Updating expense:", req.params.id);
    const exp = await Expense.findOne({
      _id: req.params.id,
      ...req.tenantFilter
    });
    if (!exp || exp.deleted) {
      console.error("❌ Expense not found");
      return res.status(404).json({ error: "Not found" });
    }

    const { category, title, amount, date, description, images } = req.body;

    if (category) exp.category = category;
    if (title) exp.title = title;
    if (amount !== undefined) exp.amount = parseFloat(amount);
    if (date) exp.date = safeDate(date);
    if (description !== undefined) exp.description = description;

    if (images && Array.isArray(images)) {
      const newImages = images.map(img => ({
        filename: img.filename || 'image.jpg',
        url: img.url,
        cloudinary_id: img.cloudinary_id || '',
        fileSize: img.fileSize || 0,
        mimeType: img.mimeType || 'image/jpeg',
        uploadedAt: new Date()
      }));
      exp.images = newImages;
    }

    const updated = await exp.save();
    console.log("✅ Expense updated");
    res.json(updated);
  } catch (err) {
    console.error("❌ Update Error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

/**
 * DELETE EXPENSE (soft delete)
 * DELETE /api/expenses/:id
 */
const deleteExpense = async (req, res) => {
  try {
    console.log("🗑️ Deleting expense:", req.params.id);
    const exp = await Expense.findOne({
      _id: req.params.id,
      ...req.tenantFilter
    });
    if (!exp || exp.deleted) {
      console.error("❌ Expense not found");
      return res.status(404).json({ error: "Not found" });
    }

    exp.deleted = true;
    exp.deletedAt = new Date();
    await exp.save();

    console.log("✅ Expense deleted");
    res.json({ message: "Expense deleted successfully" });
  } catch (err) {
    console.error("❌ Delete Error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  createExpense,
  getAllExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense
};
