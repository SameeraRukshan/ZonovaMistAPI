const express = require("express");
const router = express.Router();
const { addExpense } = require("../controllers/expenseController");

router.post("/add-expense", addExpense);

module.exports = router;
