const Expense = require("../models/expense");

exports.addExpense = async (req, res) => {
  try {
    const expense = new Expense(req.body);  
    await expense.save();  
    res.json({ msg: "Saved!", expense });
  } catch (e) {
    res.json({ error: e.message });
  }
};
