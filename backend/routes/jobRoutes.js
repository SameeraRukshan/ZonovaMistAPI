const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const jobController = require('../controllers/jobController');

// Apply auth middleware to all routes
router.use(authMiddleware);

/**
 * @swagger
 * /send-checkin-reminders-now:
 *   post:
 *     summary: Send check-in reminder SMS for all bookings scheduled for today
 *     tags: [Bookings]
 *     description: |
 *       This endpoint finds all bookings for today with status "Confirmed" that haven't received a check-in reminder SMS yet, 
 *       sends an SMS to each guest, and updates the booking record.
 *     responses:
 *       200:
 *         description: Reminders processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: integer
 *                   description: Number of bookings processed
 *                   example: 3
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       bookingId:
 *                         type: string
 *                         example: 64a1234b56c7890d1234ef56
 *                       phone:
 *                         type: string
 *                         example: "+94771234567"
 *                       status:
 *                         type: string
 *                         enum: [sent, failed]
 *                         example: "sent"
 *                       api:
 *                         type: object
 *                         description: Response from SMS API when status is sent
 *                       error:
 *                         type: string
 *                         description: Error message if sending failed
 *                         example: "Invalid phone number"
 *       500:
 *         description: Server error
 */
router.post('/send-checkin-reminders-now', jobController.sendCheckinRemindersNow);

// Send birthday wishes
router.post('/send-birthday-sms-now', jobController.sendBirthdaySmsNow);

module.exports = router;
