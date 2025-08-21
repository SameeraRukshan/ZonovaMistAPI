const cron = require('node-cron');
const Booking = require('../models/booking');
const { sendReminderSMS } = require('../models/smsService');

// Runs everyday at 8:00 AM
cron.schedule('0 8 * * *', async () => {   // change to '0 8 * * *' for real use

  /*
 * Cron schedule format: '* * * * *'
 *
 * Fields (in order):
 * ┌───────────── minute (0 - 59)
 * │ ┌───────────── hour (0 - 23)
 * │ │ ┌───────────── day of month (1 - 31)
 * │ │ │ ┌───────────── month (1 - 12)
 * │ │ │ │ ┌───────────── day of week (0 - 7) (Sunday = 0 or 7)
 * │ │ │ │ │
 * │ │ │ │ │
 * * * * * *  <- example: runs every minute
 */

  console.log("⏰ Running daily reminder job...");

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const bookings = await Booking.find({
      checkin_date: { $gte: today, $lt: tomorrow },
      reminder_sms_sent: false
    });

    console.log(`📌 Found ${bookings.length} check-in(s) for today`);

    for (const booking of bookings) {
      try {
        await sendReminderSMS(
          booking.phone_no,
          booking.guest_name,
          booking.booked_room_no,
          booking.checkin_date
        );

        console.log(`✅ Reminder SMS sent to ${booking.phone_no}`);

        booking.reminder_sms_sent = true;
        booking.reminderSmsSentAt = new Date();
        await booking.save();
      } catch (err) {
        console.error(`❌ Failed to send SMS to ${booking.phone_no}`, err);
      }
    }
  } catch (err) {
    console.error("Error in reminder job:", err);
  }
});
