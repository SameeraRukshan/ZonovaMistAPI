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
const Asset = require("../models/asset");
const authMiddleware = require("../middleware/authMiddleware");
const { addTenantId } = require("../middleware/authMiddleware");

// Import NIC extraction utilities
const {
  getImageLabels,
  isNICDocument,
  extractNICData,
} = require("../utils/nicExtractor");

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
  staff: "Staff",
  staffdp: "StaffDP",
  asset: "Asset",
};

// Helper to upload to Cloudinary
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

// Helper to process image for NIC detection
async function processImageForNIC(imageUrl) {
  try {
    // Step 1: Get image labels
    const detectedLabels = await getImageLabels(imageUrl);
    const labels = detectedLabels.map(l => l.description);

    console.log('🏷️ Detected labels:', labels);

    // Step 2: Check if it's a NIC document
    const isNIC = isNICDocument(detectedLabels);

    let nicData = null;
    let imageType = 'general';

    if (isNIC) {
      console.log('🆔 NIC detected! Extracting data...');
      imageType = 'nic';

      // Step 3: Extract NIC data
      nicData = await extractNICData(imageUrl);

      console.log('✅ NIC extraction complete:', {
        name: nicData.fullName,
        nic: nicData.nicNumber,
        fieldsExtracted: nicData.fieldsExtracted,
      });
    }

    return {
      labels,
      isNICDetected: isNIC,
      nicData,
      imageType,
      processingStatus: 'completed',
    };
  } catch (error) {
    console.error('⚠️ NIC processing error:', error.message);
    return {
      labels: [],
      isNICDetected: false,
      nicData: null,
      imageType: 'general',
      processingStatus: 'failed',
      processingError: error.message,
    };
  }
}

// POST /api/images/upload (supports photos | images | files)
const uploadFields = upload.fields([
  { name: "photos", maxCount: 10 },
  { name: "images", maxCount: 10 },
  { name: "files", maxCount: 10 },
]);

router.post("/upload", uploadFields, async (req, res) => {
  try {
    console.log("📸 Upload endpoint hit");

    const { moduleId, moduleType, uploadedBy, imageType, enableNICDetection } = req.body;

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
      normalizedType === "Room" ? Room
      : normalizedType === "Hotel" ? Hotel
      : normalizedType === "Booking" ? Booking
      : normalizedType === "Staff" || normalizedType === "StaffDP" ? Staff
      : normalizedType === "Asset" ? Asset
      : null;

    if (!Model) {
      return res.status(400).json({ message: "Invalid module type" });
    }

    // Verify target belongs to user's tenant
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
    const nicDetections = []; // Store NIC detections

    // Check if NIC detection is enabled (default: true for Booking, Staff)
    const shouldDetectNIC = enableNICDetection === 'true' || 
                           enableNICDetection === true ||
                           ['Booking', 'Staff'].includes(normalizedType);

    for (const file of allFiles) {
      try {
        const folder = normalizedType.toLowerCase();
        const uploaded = await uploadToCloudinary(file.buffer, file.originalname, folder);

        console.log(`✅ Uploaded ${file.originalname} to Cloudinary`);

        // Process image for NIC detection (only for images, not PDFs)
        let processingResult = {
          labels: [],
          isNICDetected: false,
          nicData: null,
          imageType: imageType || 'general',
          processingStatus: 'completed',
        };

        const isImage = !file.originalname.toLowerCase().endsWith('.pdf');
        
        if (isImage && shouldDetectNIC) {
          console.log('🔍 Processing image for NIC detection...');
          processingResult = await processImageForNIC(uploaded.url);
        }

        // Create image document with NIC data
        const imgData = addTenantId(req, {
          url: uploaded.url,
          public_id: uploaded.public_id,
          moduleId,
          moduleType: normalizedType,
          uploadedBy: uploadedBy || "admin",
          imageType: processingResult.imageType,
          labels: processingResult.labels,
          isNICDetected: processingResult.isNICDetected,
          nicData: processingResult.nicData,
          processingStatus: processingResult.processingStatus,
          processingError: processingResult.processingError || null,
        });

        const imgDoc = await Image.create(imgData);

        // ✨ NEW: If NIC detected, add to results
        if (processingResult.isNICDetected && processingResult.nicData) {
          nicDetections.push({
            imageUrl: uploaded.url,
            imageId: imgDoc._id,
            nicData: processingResult.nicData,
          });
        }

        results.push({
          url: uploaded.url,
          public_id: uploaded.public_id,
          dbId: imgDoc._id,
          isNICDetected: processingResult.isNICDetected,
          labels: processingResult.labels,
        });
        
        console.log(`✅ Saved to DB with ID: ${imgDoc._id}`);
      } catch (fileErr) {
        console.error("❌ Error uploading a file:", fileErr);
        results.push({
          file: file.originalname,
          error: fileErr.message || "Upload failed",
        });
      }
    }

    //Include NIC detections in response
    res.status(200).json({
      message: "Upload completed",
      results,
      nicDetections: nicDetections.length > 0 ? nicDetections : null,
    });
  } catch (err) {
    console.error("💥 Upload failed:", err);
    res.status(500).json({ message: "Upload failed", error: err.message });
  }
});

// GET /api/images/:moduleType/:moduleId
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

    //Filter images by tenant
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

//POST /api/images/extract-nic - Re-process existing image for NIC extraction
router.post("/extract-nic", express.json(), async (req, res) => {
  try {
    const { imageId, imageUrl } = req.body;

    if (!imageId && !imageUrl) {
      return res.status(400).json({
        message: 'Either imageId or imageUrl is required',
      });
    }

    let image;
    let urlToProcess;

    if (imageId) {
      // Find image by ID with tenant filter
      image = await Image.findOne({
        _id: imageId,
        ...req.tenantFilter,
      });

      if (!image) {
        return res.status(404).json({ message: 'Image not found' });
      }

      urlToProcess = image.url;
    } else {
      urlToProcess = imageUrl;
    }

    console.log('🔍 Extracting NIC from:', urlToProcess);

    // Process image for NIC
    const processingResult = await processImageForNIC(urlToProcess);

    // Update database if image ID provided
    if (imageId && image) {
      image.labels = processingResult.labels;
      image.isNICDetected = processingResult.isNICDetected;
      image.nicData = processingResult.nicData;
      image.imageType = processingResult.imageType;
      image.processingStatus = processingResult.processingStatus;
      image.processingError = processingResult.processingError;
      
      await image.save();
      console.log('✅ Updated image record in database');
    }

    res.json({
      success: true,
      imageUrl: urlToProcess,
      isNICDetected: processingResult.isNICDetected,
      nicData: processingResult.nicData,
      labels: processingResult.labels,
    });
  } catch (error) {
    console.error('❌ NIC extraction error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to extract NIC data',
      error: error.message,
    });
  }
});

//GET /api/images/nic/:moduleType/:moduleId - Get only NIC images
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

    // Find only NIC images
    const nicImages = await Image.find({
      ...req.tenantFilter,
      moduleId,
      moduleType: normalizedType,
      isNICDetected: true,
    }).sort({ createdAt: -1 });

    console.log(`✅ Found ${nicImages.length} NIC images`);
    res.json(nicImages);
  } catch (err) {
    console.error("💥 Fetch NIC images error:", err);
    res.status(500).json({ message: "Failed to fetch NIC images", error: err.message });
  }
});

// DELETE by public_id (in body)
router.delete("/image", express.json(), async (req, res) => {
  try {
    const { public_id } = req.body;
    if (!public_id) return res.status(400).json({ message: "public_id required" });

    // Find image with tenant filter
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

// DELETE fallback (by encoded param)
router.delete("/:public_id", async (req, res) => {
  try {
    const decoded = decodeURIComponent(req.params.public_id);
    
    // Find image with tenant filter
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