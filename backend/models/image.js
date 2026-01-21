const mongoose = require("mongoose");

// NIC Data Sub-schema
const nicDataSchema = new mongoose.Schema({
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
    name: { type: Boolean, default: false },
    nic: { type: Boolean, default: false },
    dob: { type: Boolean, default: false },
    address: { type: Boolean, default: false },
  },
  errors: [{
    field: String,
    message: String,
    severity: { type: String, enum: ['error', 'warning'] },
  }],
}, { _id: false });

const imageSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
    },
    public_id: {
      type: String,
      required: true,
      unique: true,
    },
    moduleId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "moduleType",
    },
    moduleType: {
      type: String,
      required: true,
      enum: ["Room", "Hotel", "Booking", "Staff", "StaffDP", "Asset"],
    },
    uploadedBy: {
      type: String,
      default: "admin",
    },
    imageType: {
      type: String,
      enum: ["general", "profile", "document", "nic", "license"],
      default: "general",
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
      index: true,
    },
    
    //Label detection fields
    labels: [{ 
      type: String 
    }],
    
    //NIC detection flag
    isNICDetected: { 
      type: Boolean, 
      default: false,
      index: true, // For querying NIC images
    },
    
    //Extracted NIC data
    nicData: { 
      type: nicDataSchema, 
      default: null 
    },
    
    //Processing status
    processingStatus: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'completed',
    },
    
    //Processing error (if any)
    processingError: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// Indexes for efficient queries
imageSchema.index({ moduleId: 1, moduleType: 1, clientId: 1 });
imageSchema.index({ public_id: 1 });
imageSchema.index({ isNICDetected: 1, clientId: 1 });
imageSchema.index({ imageType: 1, clientId: 1 });

module.exports = mongoose.model("Image", imageSchema);