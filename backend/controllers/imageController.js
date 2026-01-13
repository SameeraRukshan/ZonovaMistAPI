const mongoose = require("mongoose");
const path = require("path");
const cloudinary = require("../config/cloudinary");

const Image = require("../models/image");
const Room = require("../models/room");
const Hotel = require("../models/hotel");
const Booking = require("../models/booking");
const Staff = require("../models/staff");
const Asset = require("../models/asset");
const { addTenantId } = require("../middleware/authMiddleware");

// Case-insensitive module type mapping
const TYPE_MAP = {
  room: "Room",
  hotel: "Hotel",
  booking: "Booking",
  staff: "Staff",
  staffdp: "StaffDP",
  asset: "Asset",
};

/**
 * Helper to upload to Cloudinary
 */
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

/**
 * Get model by normalized type
 */
function getModelByType(normalizedType) {
  switch (normalizedType) {
    case "Room":
      return Room;
    case "Hotel":
      return Hotel;
    case "Booking":
      return Booking;
    case "Staff":
    case "StaffDP":
      return Staff;
    case "Asset":
      return Asset;
    default:
      return null;
  }
}

/**
 * POST /api/images/upload
 * Upload images (supports photos | images | files)
 */
const uploadImages = async (req, res) => {
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

    const Model = getModelByType(normalizedType);

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

    for (const file of allFiles) {
      try {
        const folder = normalizedType.toLowerCase();
        const uploaded = await uploadToCloudinary(file.buffer, file.originalname, folder);

        // Add clientId to image document
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
};

/**
 * GET /api/images/:moduleType/:moduleId
 * Get images by module type and ID
 */
const getImagesByModule = async (req, res) => {
  try {
    const { moduleType, moduleId } = req.params;
    const normalizedType = TYPE_MAP[String(moduleType).trim().toLowerCase()];

    if (!normalizedType)
      return res.status(400).json({ 
        message: "Invalid moduleType (Room | Hotel | Booking | Staff | StaffDP | Asset)" 
      });

    if (!mongoose.Types.ObjectId.isValid(moduleId))
      return res.status(400).json({ message: "Invalid moduleId format" });

    // Filter images by tenant
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
};

/**
 * DELETE /api/images/image
 * Delete image by public_id (in body)
 */
const deleteImageByBody = async (req, res) => {
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
};

/**
 * DELETE /api/images/:public_id
 * Delete image by encoded param (fallback)
 */
const deleteImageByParam = async (req, res) => {
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
};

module.exports = {
  uploadImages,
  getImagesByModule,
  deleteImageByBody,
  deleteImageByParam,
  TYPE_MAP
};