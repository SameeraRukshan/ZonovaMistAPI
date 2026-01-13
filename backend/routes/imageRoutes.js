// routes/imageRoutes.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const authMiddleware = require("../middleware/authMiddleware");
const imageController = require("../controllers/imageController");

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

// Upload fields configuration
const uploadFields = upload.fields([
  { name: "photos", maxCount: 10 },
  { name: "images", maxCount: 10 },
  { name: "files", maxCount: 10 },
]);

// POST /api/images/upload (supports photos | images | files)
router.post("/upload", uploadFields, imageController.uploadImages);

// GET /api/images/:moduleType/:moduleId
router.get("/:moduleType/:moduleId", imageController.getImagesByModule);

// DELETE by public_id (in body)
router.delete("/image", express.json(), imageController.deleteImageByBody);

// DELETE fallback (by encoded param)
router.delete("/:public_id", imageController.deleteImageByParam);

module.exports = router;