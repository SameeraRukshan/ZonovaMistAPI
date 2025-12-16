const express = require("express");
const router = express.Router();
const Expense = require("../models/expense");

// Safe date parse
const safeDate = (d) => {
  const dt = new Date(d);
  return isNaN(dt) ? new Date() : dt;
};

// CREATE EXPENSE (Authentication temporarily disabled)
router.post("/", async (req, res) => {
  try {
    console.log("📥 Received expense data:", JSON.stringify(req.body, null, 2));
    
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

    const expense = new Expense({
      category,
      title,
      amount: parseFloat(amount) || 0,
      date: safeDate(date),
      description: description || "",
      images: imageArray,
    });

    const saved = await expense.save();
    console.log("✅ Expense created:", saved._id);
    
    return res.status(201).json(saved);
  } catch (err) {
    console.error("❌ Create Expense Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// GET ALL EXPENSES
router.get("/", async (req, res) => {
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

// GET SINGLE EXPENSE
router.get("/:id", async (req, res) => {
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

// UPDATE EXPENSE
router.put("/:id", async (req, res) => {
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
});

// DELETE EXPENSE (Soft Delete)
router.delete("/:id", async (req, res) => {
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

module.exports = router;