// routes/imageRoutes.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const cloudinary = require("../config/cloudinary");
const mongoose = require("mongoose");
const path = require("path");

const Image = require("../models/image");
const NICExtraction = require("../models/nicExtraction");
const Room = require("../models/room");
const Hotel = require("../models/hotel");
const Booking = require("../models/booking");
const Staff = require("../models/staff");
const Asset = require("../models/asset");
const authMiddleware = require("../middleware/authMiddleware");
const { addTenantId } = require("../middleware/authMiddleware");
const { extractNICData } = require("../helpers/nicExtractionHelper");

// Apply auth middleware to all routes
router.use(authMiddleware);

// Multer config (memory storage)
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

// Case-insensitive module type mapping
const TYPE_MAP = {
  room: "Room",
  hotel: "Hotel",
  booking: "Booking",
  reservation: "Booking", // Support both booking and reservation
  staff: "Staff",
  staffdp: "StaffDP",
  asset: "Asset",
};

// Module types that should trigger NIC detection
const NIC_ENABLED_MODULES = ['Staff', 'StaffDP', 'Booking'];

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

// ✅ POST /api/images/upload (supports photos | images | files)
const uploadFields = upload.fields([
  { name: "photos", maxCount: 10 },
  { name: "images", maxCount: 10 },
  { name: "files", maxCount: 10 },
]);

router.post("/upload", uploadFields, async (req, res) => {
  try {
    console.log("📸 Upload endpoint hit");

    const { moduleId, moduleType, uploadedBy, imageType } = req.body;

    if (!moduleId || !moduleType)
      return res.status(400).json({ message: "moduleId and moduleType are required" });

    if (!mongoose.Types.ObjectId.isValid(moduleId))
      return res.status(400).json({ message: "Invalid moduleId format" });

    const normalizedType = TYPE_MAP[String(moduleType).trim().toLowerCase()];
    
    if (!normalizedType)
      return res.status(400).json({ 
        message: "Invalid moduleType (Room | Hotel | Booking | Staff | StaffDP | Asset)" 
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
        : normalizedType === "Asset"
        ? Asset
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

    const allFiles = [
      ...(req.files?.photos || []),
      ...(req.files?.images || []),
      ...(req.files?.files || []),
    ];
    if (allFiles.length === 0)
      return res.status(400).json({ message: "No images uploaded. Use fields: photos | images | files" });

    const results = [];
    const nicDetections = [];
    
    // Check if NIC detection should be enabled for this module
    const shouldDetectNIC = NIC_ENABLED_MODULES.includes(normalizedType);

    for (const file of allFiles) {
      try {
        // Skip NIC detection for PDFs
        const isPDF = file.originalname.toLowerCase().endsWith('.pdf');
        let nicExtractionResult = null;
        
        // Perform NIC detection if enabled and not a PDF
        if (shouldDetectNIC && !isPDF) {
          console.log(`🔍 Checking for NIC in: ${file.originalname}`);
          nicExtractionResult = await extractNICData(file.buffer);
        }

        // Upload to Cloudinary
        const folder = normalizedType.toLowerCase();
        const uploaded = await uploadToCloudinary(file.buffer, file.originalname, folder);

        // ✅ Create image document with labels and NIC detection flag
        const imgData = addTenantId(req, {
          url: uploaded.url,
          public_id: uploaded.public_id,
          moduleId,
          moduleType: normalizedType,
          uploadedBy: uploadedBy || "admin",
          imageType: imageType || "general",
          labels: nicExtractionResult?.labels || [],
          isNICDetected: nicExtractionResult?.isNICDetected || false
        });

        const imgDoc = await Image.create(imgData);

        // If NIC was detected, save extraction data
        if (nicExtractionResult?.isNICDetected && nicExtractionResult?.nicData) {
          const nicData = nicExtractionResult.nicData;
          
          const nicExtractionDoc = addTenantId(req, {
            imageId: imgDoc._id,
            moduleType: normalizedType,
            moduleId,
            fullName: nicData.fullName,
            nicNumber: nicData.nicNumber,
            dateOfBirth: nicData.dateOfBirth,
            address: nicData.address,
            extractedText: nicData.extractedText,
            confidence: nicData.confidence,
            nicFormat: nicData.nicFormat,
            isValidNIC: nicData.isValidNIC,
            isValidDOB: nicData.isValidDOB,
            fieldsExtracted: nicData.fieldsExtracted,
            errors: nicData.errors
          });

          await NICExtraction.create(nicExtractionDoc);
          
          console.log(`✅ NIC detected and saved for ${file.originalname}`);
          
          // Add to NIC detections array for response
          nicDetections.push({
            imageUrl: uploaded.url,
            nicData: {
              fullName: nicData.fullName,
              nicNumber: nicData.nicNumber,
              dateOfBirth: nicData.dateOfBirth,
              address: nicData.address,
              extractedText: nicData.extractedText,
              confidence: nicData.confidence,
              nicFormat: nicData.nicFormat,
              isValidNIC: nicData.isValidNIC,
              isValidDOB: nicData.isValidDOB,
              fieldsExtracted: nicData.fieldsExtracted,
              errors: nicData.errors
            }
          });
        }

        results.push({
          url: uploaded.url,
          public_id: uploaded.public_id,
          dbId: imgDoc._id,
          labels: imgData.labels,
          isNICDetected: imgData.isNICDetected
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

    // Send response with NIC detections if any
    const response = {
      message: "Upload completed",
      images: results
    };

    if (nicDetections.length > 0) {
      response.nicDetections = nicDetections;
      console.log(`🆔 Returning ${nicDetections.length} NIC detection(s)`);
    }

    res.status(200).json(response);
  } catch (err) {
    console.error("💥 Upload failed:", err);
    res.status(500).json({ message: "Upload failed", error: err.message });
  }
});

// ✅ GET /api/images/:moduleType/:moduleId
router.get("/:moduleType/:moduleId", async (req, res) => {
  try {
    const { moduleType, moduleId } = req.params;
    const normalizedType = TYPE_MAP[String(moduleType).trim().toLowerCase()];

    if (!normalizedType)
      return res.status(400).json({ 
        message: "Invalid moduleType (Room | Hotel | Booking | Staff | StaffDP | Asset)" 
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

// ✅ GET /api/images/nic/:moduleType/:moduleId - Get NIC extractions for a module
router.get("/nic/:moduleType/:moduleId", async (req, res) => {
  try {
    const { moduleType, moduleId } = req.params;
    const normalizedType = TYPE_MAP[String(moduleType).trim().toLowerCase()];

    if (!normalizedType)
      return res.status(400).json({ 
        message: "Invalid moduleType" 
      });

    if (!mongoose.Types.ObjectId.isValid(moduleId))
      return res.status(400).json({ message: "Invalid moduleId format" });

    // Get NIC extractions with image details
    const nicExtractions = await NICExtraction.find({
      ...req.tenantFilter,
      moduleId,
      moduleType: normalizedType,
    })
    .populate('imageId', 'url public_id')
    .sort({ createdAt: -1 });

    console.log(`✅ Found ${nicExtractions.length} NIC extractions for ${normalizedType} ${moduleId}`);
    res.json(nicExtractions);
  } catch (err) {
    console.error("💥 Fetch NIC extractions error:", err);
    res.status(500).json({ message: "Failed to fetch NIC extractions", error: err.message });
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

    // Delete associated NIC extraction if exists
    if (image.isNICDetected) {
      await NICExtraction.deleteOne({ 
        imageId: image._id,
        ...req.tenantFilter 
      });
      console.log(`🗑️ Deleted associated NIC extraction`);
    }

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

    // Delete associated NIC extraction if exists
    if (image.isNICDetected) {
      await NICExtraction.deleteOne({ 
        imageId: image._id,
        ...req.tenantFilter 
      });
      console.log(`🗑️ Deleted associated NIC extraction`);
    }

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