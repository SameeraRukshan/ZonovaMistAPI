// models/expense.js
const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  url: { type: String, required: true },
  cloudinary_id:   String,
  fileSize: { type: Number }, // in bytes
  mimeType: { type: String }, // e.g., 'image/jpeg'
  uploadedAt: { type: Date, default: Date.now }
});

const expenseSchema = new mongoose.Schema({
  category: {
    type: String,
    enum: [
      'Light Bill',
      'Water Bill',
      'Internet Bill',
      'Salary',
      'Cleaning',
      'Rent',
      'Purchases'
    ],
    required: true
  },
  title: { type: String, required: true, trim: true },
  amount: { type: mongoose.Schema.Types.Decimal128, required: true, default: 0 },
  date: { type: Date, required: true, default: Date.now },
  description: { type: String, default: '', trim: true },
  images: [imageSchema],
  clientId: {  // ⭐⭐⭐ Add this field
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Client', 
    required: false  // Optional for backward compatibility
  },
  amount: {
    type: mongoose.Schema.Types.Decimal128,
    required: true,
    default: 0
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  description: {
    type: String,
    default: '',
    trim: true
  },
  images: [imageSchema],
  
  // Soft delete fields
  deleted: { 
    type: Boolean, 
    default: false 
  },
  deletedAt: { 
    type: Date, 
    default: null 
  },
  deletedBy: { 
    type: String, 
    default: null 
  }
}, {
  timestamps: true
});

// Add indexes for better query performance
expenseSchema.index({ deleted: 1, date: -1 });
expenseSchema.index({ deleted: 1, category: 1 });
expenseSchema.index({ deleted: 1, createdAt: -1 });

// Virtual for getting amount as plain number
expenseSchema.virtual('amountValue').get(function() {
  return this.amount ? parseFloat(this.amount.toString()) : 0;
});

// Ensure virtuals are included in JSON
expenseSchema.set('toJSON', { virtuals: true });
expenseSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Expense', expenseSchema,);
