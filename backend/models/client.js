const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  code: { 
    type: String, 
    required: true, 
    unique: true 
  },
  isActive: { 
    type: Boolean, 
    default: true 
  }
}, { timestamps: true });

// Index for faster queries
clientSchema.index({ code: 1 }, { unique: true });
clientSchema.index({ isActive: 1 });

module.exports = mongoose.model('Client', clientSchema);