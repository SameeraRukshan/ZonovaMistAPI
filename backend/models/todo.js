const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema({
  url: { type: String, required: true },
  public_id: { type: String, required: true }
});

const todoSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: true,
    trim: true
  },
  description: { 
    type: String, 
    default: '',
    trim: true
  },
  dueDate: { 
    type: Date, 
    default: () => new Date()
  },
  priority: { 
    type: String, 
    enum: ['High', 'Medium', 'Low'],
    default: 'Medium'
  },
  assignedTo: { 
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['New', 'Completed', 'Approved'],
    default: 'New'
  },
  images: [imageSchema],
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdDate: { 
    type: Date, 
    default: Date.now
  },
  completedAt: {
    type: Date,
    default: null
  },
  approvedAt: {
    type: Date,
    default: null
  },
  rating: {
    type: Number,
    min: 1,
    max: 5,
    default: null
  },
  ratingComment: {
    type: String,
    default: '',
    trim: true,
    maxlength: 500
  },
  ratedAt: {
    type: Date,
    default: null
  },
  ratedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
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
  },
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
    index: true
  }
}, {
  timestamps: true
});

// Add indexes for better query performance
todoSchema.index({ deleted: 1, assignedTo: 1 });
todoSchema.index({ deleted: 1, createdBy: 1 });
todoSchema.index({ deleted: 1, dueDate: 1 });
todoSchema.index({ deleted: 1, priority: 1 });
todoSchema.index({ deleted: 1, status: 1 });

module.exports = mongoose.model('Todo', todoSchema);
