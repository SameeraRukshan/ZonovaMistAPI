const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  url: { type: String, required: true },
  cloudinary_id: String,
  fileSize: { type: Number },
  mimeType: { type: String },
  uploadedAt: { type: Date, default: Date.now }
});

const expenseSchema = new mongoose.Schema({
  category: {
    type: String,
    enum: ['Light Bill', 'Water Bill', 'Internet Bill', 'Salary', 'Cleaning', 'Rent', 'Purchases'],
    required: true
  },
  title: { type: String, required: true, trim: true },
  amount: { type: mongoose.Schema.Types.Decimal128, required: true, default: 0 },
  date: { type: Date, required: true, default: Date.now },
  description: { type: String, default: '', trim: true },
  images: [imageSchema],
  deleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },
  deletedBy: { type: String, default: null }
}, { timestamps: true });

expenseSchema.index({ deleted: 1, date: -1 });
expenseSchema.index({ deleted: 1, category: 1 });
expenseSchema.index({ deleted: 1, createdAt: -1 });

expenseSchema.virtual('amountValue').get(function() {
  return this.amount ? parseFloat(this.amount.toString()) : 0;
});

expenseSchema.set('toJSON', { virtuals: true });
expenseSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Expense', expenseSchema);