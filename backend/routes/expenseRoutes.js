// backend/routes/expenseRoutes.js
const express = require("express");
const router = express.Router();
<<<<<<< HEAD
const Expense = require("../models/expense");
const jwt = require("jsonwebtoken");

// 🔥 Authentication Middleware
const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    try {
      token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      console.log("✅ User authenticated:", decoded.email);
      next();
    } catch (error) {
      console.error("❌ Token verification failed:", error.message);
      return res.status(401).json({ error: "Not authorized, token failed" });
    }
  } else {
    console.error("❌ No token provided");
    return res.status(401).json({ error: "Not authorized, no token" });
  }
};

// Safe date parse
const safeDate = (d) => {
  const dt = new Date(d);
  return isNaN(dt) ? new Date() : dt;
};

// --------------------------------------------------
// CREATE EXPENSE
// --------------------------------------------------
router.post("/", protect, async (req, res) => {
  try {
    console.log("📥 Received expense data:", JSON.stringify(req.body, null, 2));
    
    const { category, title, amount, date, description, images } = req.body;

    // Validation
    if (!category || !title) {
      console.error("❌ Missing required fields");
      return res.status(400).json({ error: "Category & title are required" });
    }

    // Prepare images array (from Cloudinary)
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

    // Create expense
    const expense = new Expense({
      category,
      title,
      amount: parseFloat(amount) || 0,
      date: safeDate(date),
      description: description || "",
      images: imageArray,
    });
=======
const authMiddleware = require("../middleware/authMiddleware");
const expenseController = require("../controllers/expenseController");

// Apply auth middleware to all routes
router.use(authMiddleware);

/**
 * @swagger
 * tags:
 *   name: Expenses
 *   description: Expense management endpoints
 */

/**
 * @swagger
 * /api/expenses:
 *   post:
 *     summary: Create a new expense
 *     description: Create a new expense record in the system
 *     tags: [Expenses]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - amount
 *               - category
 *             properties:
 *               title:
 *                 type: string
 *                 description: Expense title
 *               amount:
 *                 type: number
 *                 description: Expense amount
 *               category:
 *                 type: string
 *                 description: Expense category
 *               description:
 *                 type: string
 *                 description: Additional description
 *               date:
 *                 type: string
 *                 format: date
 *                 description: Expense date
 *               paymentMethod:
 *                 type: string
 *                 description: Payment method used
 *     responses:
 *       201:
 *         description: Expense created successfully
 *       400:
 *         description: Bad request - Invalid input
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
router.post("/", expenseController.createExpense);

/**
 * @swagger
 * /api/expenses:
 *   get:
 *     summary: Get all expenses
 *     description: Retrieve all expenses excluding soft-deleted ones
 *     tags: [Expenses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by start date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by end date
 *     responses:
 *       200:
 *         description: List of expenses retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   title:
 *                     type: string
 *                   amount:
 *                     type: number
 *                   category:
 *                     type: string
 *                   date:
 *                     type: string
 *                     format: date
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
router.get("/", expenseController.getAllExpenses);

/**
 * @swagger
 * /api/expenses/{id}:
 *   get:
 *     summary: Get expense by ID
 *     description: Retrieve a single expense by its ID
 *     tags: [Expenses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Expense ID
 *     responses:
 *       200:
 *         description: Expense retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 title:
 *                   type: string
 *                 amount:
 *                   type: number
 *                 category:
 *                   type: string
 *                 description:
 *                   type: string
 *                 date:
 *                   type: string
 *                   format: date
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       404:
 *         description: Expense not found
 *       500:
 *         description: Internal server error
 */
router.get("/:id", expenseController.getExpenseById);
>>>>>>> swagger

/**
 * @swagger
 * /api/expenses/{id}:
 *   put:
 *     summary: Update an expense
 *     description: Update an existing expense by its ID
 *     tags: [Expenses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Expense ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               amount:
 *                 type: number
 *               category:
 *                 type: string
 *               description:
 *                 type: string
 *               date:
 *                 type: string
 *                 format: date
 *               paymentMethod:
 *                 type: string
 *     responses:
 *       200:
 *         description: Expense updated successfully
 *       400:
 *         description: Bad request - Invalid input
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       404:
 *         description: Expense not found
 *       500:
 *         description: Internal server error
 */
router.put("/:id", expenseController.updateExpense);

<<<<<<< HEAD
// --------------------------------------------------
// GET ALL EXPENSES
// --------------------------------------------------
router.get("/", protect, async (req, res) => {
  try {
    console.log("📋 Fetching all expenses...");
    const list = await Expense.find({ deleted: false }).sort({ createdAt: -1 });
    console.log(`✅ Found ${list.length} expenses`);
    res.json(list);
  } catch (err) {
    console.error("❌ Fetch Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// --------------------------------------------------
// GET SINGLE EXPENSE
// --------------------------------------------------
router.get("/:id", protect, async (req, res) => {
  try {
    console.log("🔍 Fetching expense:", req.params.id);
    const exp = await Expense.findById(req.params.id);
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
});

// --------------------------------------------------
// UPDATE EXPENSE (FIXED - REPLACES IMAGES)
// --------------------------------------------------
router.put("/:id", protect, async (req, res) => {
  try {
    console.log("📝 Updating expense:", req.params.id);
    const exp = await Expense.findById(req.params.id);
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

    // ✅ REPLACE images instead of appending
    if (images && Array.isArray(images)) {
      const newImages = images.map(img => ({
        filename: img.filename || 'image.jpg',
        url: img.url,
        cloudinary_id: img.cloudinary_id || '',
        fileSize: img.fileSize || 0,
        mimeType: img.mimeType || 'image/jpeg',
        uploadedAt: new Date()
      }));
      
      // ⬅️ REPLACE the entire images array (not push!)
      exp.images = newImages;
    }

    const updated = await exp.save();
    console.log("✅ Expense updated");
    res.json(updated);
  } catch (err) {
    console.error("❌ Update Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// --------------------------------------------------
// DELETE EXPENSE (Soft Delete)
// --------------------------------------------------
router.delete("/:id", protect, async (req, res) => {
  try {
    console.log("🗑️ Deleting expense:", req.params.id);
    const exp = await Expense.findById(req.params.id);
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
});
=======
/**
 * @swagger
 * /api/expenses/{id}:
 *   delete:
 *     summary: Delete an expense
 *     description: Soft delete an expense by its ID
 *     tags: [Expenses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Expense ID
 *     responses:
 *       200:
 *         description: Expense deleted successfully
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       404:
 *         description: Expense not found
 *       500:
 *         description: Internal server error
 */
router.delete("/:id", expenseController.deleteExpense);
>>>>>>> swagger

module.exports = router;

