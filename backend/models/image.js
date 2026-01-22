// models/image.js
const mongoose = require("mongoose");

const imageSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
    },
    public_id: {
      type: String,
      required: true,
    },
    moduleId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "moduleType", // Dynamic reference
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
      index: true
    },
    // NEW FIELDS FOR NIC DETECTION
    labels: [{
      type: String
    }],
    isNICDetected: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

// Index for faster queries
imageSchema.index({ moduleId: 1, moduleType: 1 });
imageSchema.index({ public_id: 1 });
imageSchema.index({ isNICDetected: 1 });

module.exports = mongoose.model("Image", imageSchema);