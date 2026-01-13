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

/**
 * @swagger
 * tags:
 *   name: Images
 *   description: Image upload and management endpoints
 */

/**
 * @swagger
 * /api/images/upload:
 *   post:
 *     summary: Upload images
 *     description: Upload multiple images or files (supports photos, images, or files field names)
 *     tags: [Images]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               photos:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Image files (max 10)
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Image files (max 10)
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Files including PDFs (max 10)
 *               moduleType:
 *                 type: string
 *                 description: Type of module (e.g., booking, hotel, asset)
 *               moduleId:
 *                 type: string
 *                 description: ID of the associated module
 *     responses:
 *       201:
 *         description: Images uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 images:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       public_id:
 *                         type: string
 *                       url:
 *                         type: string
 *                       secure_url:
 *                         type: string
 *       400:
 *         description: Bad request - Invalid file type or size exceeded (max 10MB)
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
router.post("/upload", uploadFields, imageController.uploadImages);

/**
 * @swagger
 * /api/images/{moduleType}/{moduleId}:
 *   get:
 *     summary: Get images by module
 *     description: Retrieve all images associated with a specific module
 *     tags: [Images]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: moduleType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [booking, hotel, asset, expense, user]
 *         description: Type of module
 *       - in: path
 *         name: moduleId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the module
 *     responses:
 *       200:
 *         description: Images retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 images:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       public_id:
 *                         type: string
 *                       url:
 *                         type: string
 *                       secure_url:
 *                         type: string
 *                       moduleType:
 *                         type: string
 *                       moduleId:
 *                         type: string
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       404:
 *         description: No images found for this module
 *       500:
 *         description: Internal server error
 */
router.get("/:moduleType/:moduleId", imageController.getImagesByModule);

/**
 * @swagger
 * /api/images/image:
 *   delete:
 *     summary: Delete image by public ID (body)
 *     description: Delete an image using the public_id provided in the request body
 *     tags: [Images]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - public_id
 *             properties:
 *               public_id:
 *                 type: string
 *                 description: Cloudinary public ID of the image to delete
 *     responses:
 *       200:
 *         description: Image deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Bad request - public_id is required
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       404:
 *         description: Image not found
 *       500:
 *         description: Internal server error
 */
router.delete("/image", express.json(), imageController.deleteImageByBody);

/**
 * @swagger
 * /api/images/{public_id}:
 *   delete:
 *     summary: Delete image by public ID (param)
 *     description: Delete an image using the URL-encoded public_id as a path parameter
 *     tags: [Images]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: public_id
 *         required: true
 *         schema:
 *           type: string
 *         description: URL-encoded Cloudinary public ID of the image
 *     responses:
 *       200:
 *         description: Image deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       404:
 *         description: Image not found
 *       500:
 *         description: Internal server error
 */
router.delete("/:public_id", imageController.deleteImageByParam);

module.exports = router;