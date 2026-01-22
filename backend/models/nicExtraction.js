const mongoose = require('mongoose');

const validationErrorSchema = new mongoose.Schema({
  field: { type: String, required: true },
  message: { type: String, required: true },
  severity: { type: String, enum: ['error', 'warning'], default: 'warning' }
}, { _id: false });

const fieldsExtractedSchema = new mongoose.Schema({
  name: { type: Boolean, default: false },
  nic: { type: Boolean, default: false },
  dob: { type: Boolean, default: false },
  address: { type: Boolean, default: false }
}, { _id: false });

const nicExtractionSchema = new mongoose.Schema({
  imageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Image',
    required: true
  },
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },
  moduleType: {
    type: String,
    enum: ['Staff', 'StaffDP', 'Booking', 'Reservation'],
    required: true
  },
  moduleId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  fullName: { type: String, default: null },
  nicNumber: { type: String, default: null },
  dateOfBirth: { type: Date, default: null },
  address: { type: String, default: null },
  extractedText: { type: String, default: '' },
  confidence: { type: Number, default: 0, min: 0, max: 1 },
  nicFormat: {
    type: String,
    enum: ['old', 'new', 'unknown'],
    default: 'unknown'
  },
  isValidNIC: { type: Boolean, default: false },
  isValidDOB: { type: Boolean, default: false },
  fieldsExtracted: {
    type: fieldsExtractedSchema,
    default: () => ({})
  },
  errors: {
    type: [validationErrorSchema],
    default: []
  }
}, {
  timestamps: true
});

// Indexes
nicExtractionSchema.index({ imageId: 1 });
nicExtractionSchema.index({ clientId: 1, moduleType: 1, moduleId: 1 });
nicExtractionSchema.index({ nicNumber: 1 });

module.exports = mongoose.model('NICExtraction', nicExtractionSchema);