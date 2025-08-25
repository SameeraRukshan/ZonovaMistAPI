const express = require('express');
const router = express.Router();
const Booking = require('../models/booking');
const { DateTime } = require('luxon');
const { sendCheckinReminderSMS } = require('../models/smsService');

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
router.post('/send-checkin-reminders-now', async (req, res) => {
  try {
    const tz = process.env.TIMEZONE || 'Asia/Colombo';
    const now = DateTime.now().setZone(tz);
    const start = now.startOf('day').toUTC().toJSDate();
    const end = now.endOf('day').toUTC().toJSDate();

    const candidates = await Booking.find({
      checkin_date: { $gte: start, $lte: end },
      status: { $in: ['Confirmed'] },
      $or: [
        { reminder_sms_sent: { $exists: false } },
        { reminder_sms_sent: false }
      ],
    });

    const results = [];
    for (const b of candidates) {
      try {
        const r = await sendCheckinReminderSMS({
          clientPhone: b.phone_no,
          clientName: b.guest_name,
          roomNo: b.booked_room_no,
          checkInDate: b.checkin_date,
        });
        await Booking.updateOne(
          { _id: b._id },
          { $set: { reminder_sms_sent: true, reminderSmsSentAt: new Date() } }
        );
        results.push({ bookingId: b._id, phone: b.phone_no, status: 'sent', api: r });
      } catch (err) {
        results.push({ bookingId: b._id, phone: b.phone_no, status: 'failed', error: err?.response?.data || err.message });
      }
    }

    res.json({ count: results.length, results });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
