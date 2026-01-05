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
}, { timestamps: true });

module.exports = mongoose.model('Asset', assetSchema);