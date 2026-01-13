// routes/bookingRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const authMiddleware = require('../middleware/authMiddleware');
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

// GET /bookings/eligible-for-discount - Must be before /:id routes
router.get('/eligible-for-discount', bookingController.getEligibleForDiscount);

// POST /bookings/send-discount-sms-test - Must be before /:id routes
router.post('/send-discount-sms-test', bookingController.sendDiscountSmsTest);

// GET /bookings - Fetch all bookings
router.get('/', bookingController.getAllBookings);

// POST /bookings - Create a new booking
router.post('/', bookingController.createBooking);

// PATCH /bookings/:id - Update booking
router.patch('/:id', bookingController.updateBooking);

// DELETE /bookings/:id - Soft delete a booking
router.delete('/:id', bookingController.deleteBooking);

// POST /bookings/:id/restore - Restore a soft-deleted booking
router.post('/:id/restore', bookingController.restoreBooking);

// DELETE /bookings/:id/permanent - Permanently delete a booking
router.delete('/:id/permanent', bookingController.permanentDeleteBooking);

// POST /bookings/:id/recordings - Upload audio recording
router.post('/:id/recordings', upload.single('audio'), bookingController.uploadRecording);

// DELETE /bookings/:id/recordings/:recordingId - Delete audio recording
router.delete('/:id/recordings/:recordingId', bookingController.deleteRecording);

// GET /bookings/:id/recordings - Get all recordings for a booking
router.get('/:id/recordings', bookingController.getRecordings);

module.exports = router;