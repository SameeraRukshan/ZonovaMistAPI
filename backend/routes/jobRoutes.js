const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const jobController = require('../controllers/jobController');

// Apply auth middleware to all routes
router.use(authMiddleware);

/**
 * @swagger
 * tags:
 *   name: Jobs
 *   description: Scheduled jobs and automated tasks endpoints
 */

/**
 * @swagger
 * /api/jobs/send-checkin-reminders-now:
 *   post:
 *     summary: Send check-in reminder SMS now
 *     description: |
 *       Finds all bookings for today with status "Confirmed" that haven't received a check-in reminder SMS yet, 
 *       sends an SMS to each guest, and updates the booking record.
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Reminders processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
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
 *                         example: sent
 *                       api:
 *                         type: object
 *                         description: Response from SMS API when status is sent
 *                       error:
 *                         type: string
 *                         description: Error message if sending failed
 *                         example: Invalid phone number
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Server error
 */
router.post('/send-checkin-reminders-now', jobController.sendCheckinRemindersNow);

/**
 * @swagger
 * /api/jobs/send-birthday-sms-now:
 *   post:
 *     summary: Send birthday wishes SMS now
 *     description: |
 *       Finds all customers with birthdays today who haven't received a birthday SMS yet this year,
 *       sends a birthday greeting SMS to each customer, and updates their record.
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Birthday wishes processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 count:
 *                   type: integer
 *                   description: Number of birthday messages sent
 *                   example: 5
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       customerId:
 *                         type: string
 *                         example: 64a1234b56c7890d1234ef56
 *                       customerName:
 *                         type: string
 *                         example: John Doe
 *                       phone:
 *                         type: string
 *                         example: "+94771234567"
 *                       status:
 *                         type: string
 *                         enum: [sent, failed]
 *                         example: sent
 *                       api:
 *                         type: object
 *                         description: Response from SMS API when status is sent
 *                       error:
 *                         type: string
 *                         description: Error message if sending failed
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Server error
 */
router.post('/send-birthday-sms-now', jobController.sendBirthdaySmsNow);

module.exports = router;
