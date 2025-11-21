const mongoose = require('mongoose');

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
    default: () => new Date() // Default to today
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
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdDate: { 
    type: Date, 
    default: Date.now
  },
  // Additional useful fields
  completed: {
    type: Boolean,
    default: false
  },
  completedAt: {
    type: Date,
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
  }
}, {
  timestamps: true
});

// Add indexes for better query performance
todoSchema.index({ deleted: 1, assignedTo: 1 });
todoSchema.index({ deleted: 1, createdBy: 1 });
todoSchema.index({ deleted: 1, dueDate: 1 });
todoSchema.index({ deleted: 1, priority: 1 });

module.exports = mongoose.model('Todo', todoSchema);