const Asset = require('../models/asset');
const Image = require('../models/image');
const cloudinary = require('../config/cloudinary');
const { addTenantId } = require('../middleware/authMiddleware');

/**
 * GET /assets - Get all assets (exclude soft-deleted)
 */
const getAllAssets = async (req, res) => {
  try {
    const baseFilter = { deleted: false };
    const assets = await Asset.find({ 
      ...baseFilter, 
      ...req.tenantFilter 
    }).sort({ createdAt: -1 });
    res.json(assets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /assets - Create new asset
 */
const createAsset = async (req, res) => {
  try {
    const assetData = addTenantId(req, req.body);
    const asset = new Asset(assetData);
    await asset.save();
    res.status(201).json(asset);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

/**
 * GET /assets/:id - Get single asset (404 if soft-deleted)
 */
const getAssetById = async (req, res) => {
  try {
    const asset = await Asset.findOne({ 
      _id: req.params.id, 
      ...req.tenantFilter 
    });
    if (!asset || asset.deleted) {
      return res.status(404).json({ message: 'Asset not found' });
    }
    // Return the full asset object, including any stored photo URLs
    res.json(asset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * Helper function to validate and extract allowed updates
 */
const extractAllowedUpdates = (body) => {
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
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      updates[key] = body[key];
    }
  }

  return updates;
};

/**
 * Helper function to validate update fields
 */
const validateUpdates = (updates) => {
  if (updates.purchasePrice !== undefined && Number(updates.purchasePrice) < 0) {
    return { valid: false, message: 'purchasePrice cannot be negative' };
  }
  if (updates.quantity !== undefined && Number(updates.quantity) < 0) {
    return { valid: false, message: 'quantity cannot be negative' };
  }
  return { valid: true };
};

/**
 * PATCH /assets/:id - Update asset
 */
const updateAsset = async (req, res) => {
  try {
    const updates = extractAllowedUpdates(req.body);
    const validation = validateUpdates(updates);
    
    if (!validation.valid) {
      return res.status(400).json({ message: validation.message });
    }

    const asset = await Asset.findOne({ 
      _id: req.params.id, 
      ...req.tenantFilter 
    });
    
    if (!asset || asset.deleted) {
      return res.status(404).json({ message: 'Asset not found' });
    }

    Object.assign(asset, updates);
    const saved = await asset.save();
    res.json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

/**
 * PUT /assets/:id - Update asset (alias to support clients using PUT)
 */
const updateAssetPut = async (req, res) => {
  try {
    const updates = extractAllowedUpdates(req.body);
    const validation = validateUpdates(updates);
    
    if (!validation.valid) {
      return res.status(400).json({ message: validation.message });
    }

    const asset = await Asset.findOne({ 
      _id: req.params.id, 
      ...req.tenantFilter 
    });
    
    if (!asset || asset.deleted) {
      return res.status(404).json({ message: 'Asset not found' });
    }

    Object.assign(asset, updates);
    const saved = await asset.save();
    res.json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

/**
 * DELETE /assets/:id - Soft delete asset
 */
const deleteAsset = async (req, res) => {
  try {
    const asset = await Asset.findOne({ 
      _id: req.params.id, 
      ...req.tenantFilter 
    });
    
    if (!asset || asset.deleted) {
      return res.status(404).json({ message: 'Asset not found' });
    }

    asset.deleted = true;
    asset.deletedAt = new Date();
    asset.deletedBy = (req.user && (req.user.email || req.user.id)) || null;
    await asset.save();

    // Note: We do NOT delete Cloudinary images on soft delete, preserving history.
    res.json({ message: 'Asset deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getAllAssets,
  createAsset,
  getAssetById,
  updateAsset,
  updateAssetPut,
  deleteAsset
};