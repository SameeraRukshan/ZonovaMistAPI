// routes/imageRoutes.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const cloudinary = require("../config/cloudinary");
const mongoose = require("mongoose");
const path = require("path");

const Image = require("../models/image");
const Room = require("../models/room");
const Hotel = require("../models/hotel");
const Booking = require("../models/booking");
const Staff = require("../models/staff");
const authMiddleware = require("../middleware/authMiddleware");
const { addTenantId } = require("../middleware/authMiddleware");

// Apply auth middleware to all routes
router.use(authMiddleware);

// ✅ Multer config (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowedExtensions = /\.(jpg|jpeg|png|webp|pdf)$/i;
    const allowedMimes = [
      "image/jpeg", 
      "image/jpg", 
      "image/png", 
      "image/webp",
      "application/pdf"
    ];

    if (allowedMimes.includes(file.mimetype) || allowedExtensions.test(file.originalname)) {
      cb(null, true);
    } else {
      console.warn("❌ Rejected file:", file.originalname, "type:", file.mimetype);
      cb(new Error("Only .jpg, .jpeg, .png, .webp, and .pdf files are allowed"), false);
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

// ✅ Helper to upload to Cloudinary
async function uploadToCloudinary(fileBuffer, originalName, folderName) {
  return new Promise((resolve, reject) => {
    const baseName = path
      .parse(originalName)
      .name.replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9_\-]/g, "")
      .toLowerCase()
      .slice(0, 60);

    const publicId = `${baseName}_${Date.now()}`;
    const isPDF = originalName.toLowerCase().endsWith('.pdf');

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `zonova_mist/${folderName}`,
        public_id: publicId,
        resource_type: isPDF ? "raw" : "image",
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({
          url: result.secure_url,
          public_id: result.public_id,
        });
      }
    );

    uploadStream.end(fileBuffer);
  });
}

// ✅ POST /api/images/upload
router.post("/upload", upload.array("photos", 10), async (req, res) => {
  try {
    console.log("📸 Upload endpoint hit");

    const { moduleId, moduleType, uploadedBy, imageType } = req.body;

    if (!moduleId || !moduleType)
      return res.status(400).json({ message: "moduleId and moduleType are required" });

    if (!mongoose.Types.ObjectId.isValid(moduleId))
      return res.status(400).json({ message: "Invalid moduleId format" });

    const normalizedType = String(moduleType).trim();
    
    if (!["Room", "Hotel", "Booking", "Staff", "StaffDP"].includes(normalizedType))
      return res.status(400).json({ 
        message: "Invalid moduleType (Room | Hotel | Booking | Staff | StaffDP)" 
      });

    const Model =
      normalizedType === "Room"
        ? Room
        : normalizedType === "Hotel"
        ? Hotel
        : normalizedType === "Booking"
        ? Booking
        : normalizedType === "Staff" || normalizedType === "StaffDP"
        ? Staff
        : null;

    if (!Model) {
      return res.status(400).json({ message: "Invalid module type" });
    }

    // ✅ Verify target belongs to user's tenant
    const target = await Model.findOne({ 
      _id: moduleId, 
      ...req.tenantFilter 
    });
    if (!target)
      return res.status(404).json({ message: `${normalizedType} not found` });

    if (!req.files || req.files.length === 0)
      return res.status(400).json({ message: "No images uploaded" });

    const results = [];

    for (const file of req.files) {
      try {
        const folder = normalizedType.toLowerCase();
        const uploaded = await uploadToCloudinary(file.buffer, file.originalname, folder);

        // ✅ Add clientId to image document
        const imgData = addTenantId(req, {
          url: uploaded.url,
          public_id: uploaded.public_id,
          moduleId,
          moduleType: normalizedType,
          uploadedBy: uploadedBy || "admin",
          imageType: imageType || "general",
        });

        const imgDoc = await Image.create(imgData);

        results.push({
          url: uploaded.url,
          public_id: uploaded.public_id,
          dbId: imgDoc._id,
        });
        
        console.log(`✅ Uploaded ${file.originalname} for ${normalizedType}`);
      } catch (fileErr) {
        console.error("❌ Error uploading a file:", fileErr);
        results.push({
          file: file.originalname,
          error: fileErr.message || "Upload failed",
        });
      }
    }

    res.status(200).json({
      message: "Upload completed",
      results,
    });
  } catch (err) {
    console.error("💥 Upload failed:", err);
    res.status(500).json({ message: "Upload failed", error: err.message });
  }
});

// ✅ GET /api/images/:moduleType/:moduleId
router.get("/:moduleType/:moduleId", async (req, res) => {
  try {
    const { moduleType, moduleId } = req.params;
    const normalizedType = String(moduleType).trim();

    if (!["Room", "Hotel", "Booking", "Staff", "StaffDP"].includes(normalizedType))
      return res.status(400).json({ 
        message: "Invalid moduleType (Room | Hotel | Booking | Staff | StaffDP)" 
      });

    if (!mongoose.Types.ObjectId.isValid(moduleId))
      return res.status(400).json({ message: "Invalid moduleId format" });

    // ✅ Filter images by tenant
    const images = await Image.find({
      ...req.tenantFilter,
      moduleId,
      moduleType: normalizedType,
    }).sort({ createdAt: -1 });

    console.log(`✅ Found ${images.length} images for ${normalizedType} ${moduleId}`);
    res.json(images);
  } catch (err) {
    console.error("💥 Fetch images error:", err);
    res.status(500).json({ message: "Failed to fetch images", error: err.message });
  }
});

// ✅ DELETE by public_id (in body)
router.delete("/image", express.json(), async (req, res) => {
  try {
    const { public_id } = req.body;
    if (!public_id) return res.status(400).json({ message: "public_id required" });

    // ✅ Find image with tenant filter
    const image = await Image.findOne({ 
      public_id, 
      ...req.tenantFilter 
    });
    if (!image) return res.status(404).json({ message: "Image not found" });

    const resourceType = image.url.includes('.pdf') ? 'raw' : 'image';
    
    await cloudinary.uploader.destroy(public_id, { resource_type: resourceType });
    await image.deleteOne();

    console.log(`✅ Deleted image: ${public_id}`);
    res.json({ message: "Image deleted successfully" });
  } catch (err) {
    console.error("💥 Delete image error:", err);
    res.status(500).json({ message: "Image deletion failed", error: err.message });
  }
});

// ✅ DELETE fallback (by encoded param)
router.delete("/:public_id", async (req, res) => {
  try {
    const decoded = decodeURIComponent(req.params.public_id);
    
    // ✅ Find image with tenant filter
    const image = await Image.findOne({ 
      public_id: decoded, 
      ...req.tenantFilter 
    });
    if (!image) return res.status(404).json({ message: "Image not found" });

    const resourceType = image.url.includes('.pdf') ? 'raw' : 'image';
    
    await cloudinary.uploader.destroy(decoded, { resource_type: resourceType });
    await image.deleteOne();

    console.log(`✅ Deleted image: ${decoded}`);
    res.json({ message: "Image deleted successfully" });
  } catch (err) {
    console.error("💥 Param delete error:", err);
    res.status(500).json({ message: "Image deletion failed", error: err.message });
  }
});

module.exports = router;