const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const assetController = require('../controllers/assetController');

// Apply auth middleware to all routes
router.use(authMiddleware);

// GET /assets - Get all assets (exclude soft-deleted)
router.get('/', assetController.getAllAssets);

// POST /assets - Create new asset
router.post('/', assetController.createAsset);

// GET /assets/:id - Get single asset (404 if soft-deleted)
router.get('/:id', assetController.getAssetById);

// PATCH /assets/:id - Update asset
router.patch('/:id', assetController.updateAsset);

// PUT /assets/:id - Update asset (alias to support clients using PUT)
router.put('/:id', assetController.updateAssetPut);

// DELETE /assets/:id - Soft delete asset
router.delete('/:id', assetController.deleteAsset);

module.exports = router;
