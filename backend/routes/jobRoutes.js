const express = require('express');
const router = express.Router();
const Booking = require('../models/booking');
const { DateTime } = require('luxon');
const { sendCheckinReminderSMS } = require('../models/smsService');

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
