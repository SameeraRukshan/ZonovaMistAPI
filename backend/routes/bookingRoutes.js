// routes/bookingRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const authMiddleware = require('../middleware/authMiddleware');
const { staffReadOnly } = require('../middleware/authMiddleware');
const bookingController = require('../controllers/bookingController');

// Apply auth middleware to all routes
router.use(authMiddleware);

// Multer configuration for audio uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB max file size
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/m4a'];
    const allowedExts = ['.mp3', '.m4a', '.wav'];
    
    const ext = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
    
    if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only .mp3, .m4a, and .wav files are allowed.'));
    }
  }
});

/**
 * @swagger
 * tags:
 *   name: Bookings
 *   description: Booking management endpoints
 */

/**
 * @swagger
 * /api/bookings/eligible-for-discount:
 *   get:
 *     summary: Get bookings eligible for discount
 *     description: Retrieve all bookings that are eligible for discount offers
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of eligible bookings retrieved successfully
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
router.get('/eligible-for-discount', bookingController.getEligibleForDiscount);

/**
 * @swagger
 * /api/bookings/send-discount-sms-test:
 *   post:
 *     summary: Send discount SMS test
 *     description: Send a test discount SMS to eligible customers
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               phoneNumber:
 *                 type: string
 *                 description: Phone number to send test SMS
 *               message:
 *                 type: string
 *                 description: SMS message content
 *     responses:
 *       200:
 *         description: Test SMS sent successfully
 *       400:
 *         description: Bad request - Invalid input
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
router.post('/send-discount-sms-test', bookingController.sendDiscountSmsTest);

/**
 * @swagger
 * /api/bookings:
 *   get:
 *     summary: Get all bookings
 *     description: Retrieve all bookings excluding soft-deleted ones
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of bookings retrieved successfully
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
router.get('/', bookingController.getAllBookings);

/**
 * @swagger
 * /api/bookings:
 *   post:
 *     summary: Create a new booking
 *     description: Create a new booking in the system
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               customerName:
 *                 type: string
 *                 description: Customer name
 *               phoneNumber:
 *                 type: string
 *                 description: Customer phone number
 *               date:
 *                 type: string
 *                 format: date-time
 *                 description: Booking date and time
 *               service:
 *                 type: string
 *                 description: Service type
 *               notes:
 *                 type: string
 *                 description: Additional notes
 *     responses:
 *       201:
 *         description: Booking created successfully
 *       400:
 *         description: Bad request - Invalid input
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
router.post('/', bookingController.createBooking);

/**
 * @swagger
 * /api/bookings/{id}:
 *   patch:
 *     summary: Update a booking
 *     description: Partially update an existing booking
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               customerName:
 *                 type: string
 *               phoneNumber:
 *                 type: string
 *               date:
 *                 type: string
 *                 format: date-time
 *               service:
 *                 type: string
 *               notes:
 *                 type: string
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: Booking updated successfully
 *       400:
 *         description: Bad request - Invalid input
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       404:
 *         description: Booking not found
 *       500:
 *         description: Internal server error
 */
router.patch('/:id', bookingController.updateBooking);

/**
 * @swagger
 * /api/bookings/{id}:
 *   delete:
 *     summary: Soft delete a booking
 *     description: Soft delete a booking by its ID (can be restored later)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     responses:
 *       200:
 *         description: Booking soft deleted successfully
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       404:
 *         description: Booking not found
 *       500:
 *         description: Internal server error
 */
router.delete('/:id', bookingController.deleteBooking);

/**
 * @swagger
 * /api/bookings/{id}/restore:
 *   post:
 *     summary: Restore a soft-deleted booking
 *     description: Restore a previously soft-deleted booking
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     responses:
 *       200:
 *         description: Booking restored successfully
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       404:
 *         description: Booking not found
 *       500:
 *         description: Internal server error
 */
router.post('/:id/restore', bookingController.restoreBooking);

/**
 * @swagger
 * /api/bookings/{id}/permanent:
 *   delete:
 *     summary: Permanently delete a booking
 *     description: Permanently delete a booking (cannot be restored)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     responses:
 *       200:
 *         description: Booking permanently deleted successfully
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       404:
 *         description: Booking not found
 *       500:
 *         description: Internal server error
 */
router.delete('/:id/permanent', bookingController.permanentDeleteBooking);

/**
 * @swagger
 * /api/bookings/{id}/recordings:
 *   post:
 *     summary: Upload audio recording
 *     description: Upload an audio recording for a booking
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               audio:
 *                 type: string
 *                 format: binary
 *                 description: Audio file (.mp3, .m4a, or .wav, max 25MB)
 *     responses:
 *       201:
 *         description: Recording uploaded successfully
 *       400:
 *         description: Bad request - Invalid file type or size
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       404:
 *         description: Booking not found
 *       500:
 *         description: Internal server error
 */
router.post('/:id/recordings', upload.single('audio'), bookingController.uploadRecording);

/**
 * @swagger
 * /api/bookings/{id}/recordings/{recordingId}:
 *   delete:
 *     summary: Delete audio recording
 *     description: Delete a specific audio recording from a booking
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *       - in: path
 *         name: recordingId
 *         required: true
 *         schema:
 *           type: string
 *         description: Recording ID
 *     responses:
 *       200:
 *         description: Recording deleted successfully
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       404:
 *         description: Booking or recording not found
 *       500:
 *         description: Internal server error
 */
router.delete('/:id/recordings/:recordingId', bookingController.deleteRecording);

/**
 * @swagger
 * /api/bookings/{id}/recordings:
 *   get:
 *     summary: Get all recordings for a booking
 *     description: Retrieve all audio recordings associated with a booking
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     responses:
 *       200:
 *         description: List of recordings retrieved successfully
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       404:
 *         description: Booking not found
 *       500:
 *         description: Internal server error
 */
router.get('/:id/recordings', bookingController.getRecordings);

module.exports = router;