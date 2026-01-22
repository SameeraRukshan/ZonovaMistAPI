// models/image.js
const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true
  },
  public_id: {
    type: String,
    required: true
  },
  moduleId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  moduleType: {
    type: String,
    enum: ['Room', 'Hotel', 'Booking', 'Staff', 'StaffDP', 'Asset'],
    required: true
  },
  uploadedBy: {
    type: String,
    default: 'admin'
  },
  imageType: {
    type: String,
    default: 'general'
  },
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },
  // New fields for label detection
  labels: [{
    type: String
  }],
  isNICDetected: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes
imageSchema.index({ moduleId: 1, moduleType: 1 });
imageSchema.index({ public_id: 1 });
imageSchema.index({ clientId: 1 });
imageSchema.index({ isNICDetected: 1 });

module.exports = mongoose.model('Image', imageSchema);