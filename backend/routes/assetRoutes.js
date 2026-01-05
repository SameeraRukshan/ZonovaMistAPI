const express = require('express');
const router = express.Router();
const Asset = require('../models/asset');
const Image = require('../models/image');
const cloudinary = require('../config/cloudinary');
const protect = require('../middleware/authMiddleware');

// GET all assets (exclude soft-deleted)
router.get('/', async (req, res) => {
  try {
    const assets = await Asset.find({ deleted: false }).sort({ createdAt: -1 });
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

// GET single asset (404 if soft-deleted)
router.get('/:id', async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id);
    if (!asset || asset.deleted) return res.status(404).json({ message: 'Asset not found' });
    res.json(asset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH update asset
router.patch('/:id', async (req, res) => {
  try {
    const allowed = [
      'name',
      'category',
      'purchasePrice',
      'purchaseDate',
      'description',
      'quantity',
      'brand',
      'warrantyEndDate',
      'warrantyDetails',
      'photos',
    ];

    const updates = {};
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        updates[key] = req.body[key];
      }
    }

    if (updates.purchasePrice !== undefined && Number(updates.purchasePrice) < 0) {
      return res.status(400).json({ message: 'purchasePrice cannot be negative' });
    }
    if (updates.quantity !== undefined && Number(updates.quantity) < 0) {
      return res.status(400).json({ message: 'quantity cannot be negative' });
    }

    const asset = await Asset.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
    if (!asset) return res.status(404).json({ message: 'Asset not found' });
    res.json(asset);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT update asset (alias to support clients using PUT)
router.put('/:id', async (req, res) => {
  try {
    const allowed = [
      'name',
      'category',
      'purchasePrice',
      'purchaseDate',
      'description',
      'quantity',
      'brand',
      'warrantyEndDate',
      'warrantyDetails',
      'photos',
    ];

    const updates = {};
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        updates[key] = req.body[key];
      }
    }

    if (updates.purchasePrice !== undefined && Number(updates.purchasePrice) < 0) {
      return res.status(400).json({ message: 'purchasePrice cannot be negative' });
    }
    if (updates.quantity !== undefined && Number(updates.quantity) < 0) {
      return res.status(400).json({ message: 'quantity cannot be negative' });
    }

    const asset = await Asset.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
    if (!asset) return res.status(404).json({ message: 'Asset not found' });
    res.json(asset);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE asset (Soft Delete for consistency)
router.delete('/:id', protect, async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id);
    if (!asset || asset.deleted) return res.status(404).json({ message: 'Asset not found' });

    asset.deleted = true;
    asset.deletedAt = new Date();
    asset.deletedBy = (req.user && (req.user.email || req.user.id)) || null;
    await asset.save();

    // Note: We do NOT delete Cloudinary images on soft delete, preserving history.
    res.json({ message: 'Asset deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;