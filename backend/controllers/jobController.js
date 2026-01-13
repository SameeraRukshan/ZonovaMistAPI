const Booking = require('../models/booking');
const { DateTime } = require('luxon');
const { sendCheckinReminderSMS, sendBirthdaySMS } = require('../models/smsService');

/**
 * Send check-in reminder SMS for all bookings scheduled for today
 * Finds all bookings for today with status "Confirmed" that haven't received a check-in reminder SMS yet,
 * sends an SMS to each guest, and updates the booking record.
 */
const sendCheckinRemindersNow = async (req, res) => {
  try {
    const tz = process.env.TIMEZONE || 'Asia/Colombo';
    const now = DateTime.now().setZone(tz);
    const start = now.startOf('day').toUTC().toJSDate();
    const end = now.endOf('day').toUTC().toJSDate();

    // Add tenant filter to query
    const candidates = await Booking.find({
      ...req.tenantFilter,
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
        
        // Update with tenant filter
        await Booking.updateOne(
          { _id: b._id, ...req.tenantFilter },
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
};

/**
 * Send birthday wishes SMS
 * Finds all bookings with birthdays today that haven't received a birthday SMS yet,
 * sends an SMS to each guest, and updates the booking record.
 */
const sendBirthdaySmsNow = async (req, res) => {
  try {
    const tz = process.env.TIMEZONE || 'Asia/Colombo';
    const now = DateTime.now().setZone(tz);

    const start = now.startOf('day').toUTC().toJSDate();
    const end = now.endOf('day').toUTC().toJSDate();

    // Add tenant filter to query
    const candidates = await Booking.find({
      ...req.tenantFilter,
      birthday: { $gte: start, $lte: end },
      $or: [
        { birthday_sms_sent: { $exists: false } },
        { birthday_sms_sent: false }
      ]
    });

    const results = [];
    for (const b of candidates) {
      try {
        const r = await sendBirthdaySMS(b.phone_no, b.guest_name);
        
        // Update with tenant filter
        await Booking.updateOne(
          { _id: b._id, ...req.tenantFilter },
          { $set: { birthday_sms_sent: true, birthdaySmsSentAt: new Date() } }
        );
        results.push({ bookingId: b._id, phone: b.phone_no, status: 'sent', api: r });
      } catch (err) {
        results.push({ bookingId: b._id, phone: b.phone_no, status: 'failed', error: err.message });
      }
    }

    res.json({ count: results.length, results });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  sendCheckinRemindersNow,
  sendBirthdaySmsNow
};