const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const expenseController = require("../controllers/expenseController");

// Apply auth middleware to all routes
router.use(authMiddleware);

// POST /api/expenses - Create expense
router.post("/", expenseController.createExpense);

// GET /api/expenses - Get all expenses
router.get("/", expenseController.getAllExpenses);

// GET /api/expenses/:id - Get single expense
router.get("/:id", expenseController.getExpenseById);

// PUT /api/expenses/:id - Update expense
router.put("/:id", expenseController.updateExpense);

// DELETE /api/expenses/:id - Delete expense (soft delete)
router.delete("/:id", expenseController.deleteExpense);

module.exports = router;