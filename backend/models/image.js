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
      enum: ["Room", "Hotel", "Booking"],
    },
    uploadedBy: {
      type: String,
      default: "admin",
    },
  },
  { timestamps: true }
);

// ✅ Export properly
module.exports = mongoose.model("Image", imageSchema);
