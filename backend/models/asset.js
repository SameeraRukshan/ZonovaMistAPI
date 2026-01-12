const mongoose = require('mongoose');

const assetSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, required: true },
  purchasePrice: { type: Number, required: true },
  purchaseDate: { type: Date, required: true },
  description: { type: String },
  quantity: { type: Number, default: 1 },
  brand: { type: String },
  warrantyEndDate: { type: Date },
  warrantyDetails: { type: String },
  photos: { type: [String], default: [] },
  // Tenant scoping
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
    index: true
  },
  // Soft delete fields
  deleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },
  deletedBy: { type: String, default: null },
}, { timestamps: true });

// Indexes for common queries
assetSchema.index({ deleted: 1, category: 1 });
assetSchema.index({ deleted: 1, createdAt: -1 });
assetSchema.index({ deleted: 1, clientId: 1, createdAt: -1 });

module.exports = mongoose.model('Asset', assetSchema);

