const express = require('express');
const router = express.Router();
const Asset = require('../models/asset');

// GET all assets
router.get('/', async (req, res) => {
  try {
    const assets = await Asset.find();
    res.json(assets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create new asset
router.post('/', async (req, res) => {
  try {
    const asset = new Asset(req.body);
    await asset.save();
    res.status(201).json(asset);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;