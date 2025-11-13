// jobs/discountJob.js
const cron = require('node-cron');
const Booking = require('../models/booking');
const Setting = require('../models/settings');
const { sendDiscountSMS } = require('../models/smsService');

/**
 * Discount SMS Job
 * Runs daily at 9:00 AM
 * Sends discount SMS to guests X days after checkout (configurable in settings)
 * 
 * Cron schedule format: '* * * * *'
 * ┌───────────── minute (0 - 59)
 * │ ┌───────────── hour (0 - 23)
 * │ │ ┌───────────── day of month (1 - 31)
 * │ │ │ ┌───────────── month (1 - 12)
 * │ │ │ │ ┌───────────── day of week (0 - 7) (Sunday = 0 or 7)
 * │ │ │ │ │
 * * * * * *
 */

// Run daily at 9:00 AM
cron.schedule('0 9 * * *', async () => {
  console.log("🎁 Running discount SMS job...");

  try {
    // Get settings to check the days configuration
    const settings = await Setting.findOne({});
    const daysAfterCheckout = settings?.discountSmsDaysAfterCheckout || 10;
    
    console.log(`⚙️ Configuration: Send SMS ${daysAfterCheckout} days after checkout`);
    
    // Calculate the target date (e.g., 10 days ago)
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - daysAfterCheckout);
    targetDate.setHours(0, 0, 0, 0);
    
    const endOfTargetDay = new Date(targetDate);
    endOfTargetDay.setHours(23, 59, 59, 999);
    
    console.log(`📅 Looking for bookings with checkout date: ${targetDate.toDateString()}`);
    
    // Find eligible bookings:
    // - Checkout date is exactly X days ago
    // - Status is 'paid' (successfully completed)
    // - Not soft deleted
    // - Discount SMS not already sent
    const eligibleBookings = await Booking.find({
      checkout_date: {
        $gte: targetDate,
        $lte: endOfTargetDay
      },
      status: 'paid',
      deleted: { $ne: true },
      discount_sms_sent: { $ne: true }
    });
    
    console.log(`📌 Found ${eligibleBookings.length} eligible booking(s) for discount SMS`);
    
    if (eligibleBookings.length === 0) {
      console.log('ℹ️ No bookings eligible for discount SMS today');
      return;
    }
    
    // Send SMS to each eligible guest
    let successCount = 0;
    let failCount = 0;
    
    for (const booking of eligibleBookings) {
      try {
        console.log(`📨 Sending discount SMS to ${booking.guest_name} (${booking.phone_no})`);
        
        await sendDiscountSMS(booking.phone_no, booking.guest_name);
        
        // Mark as sent
        booking.discount_sms_sent = true;
        booking.discountSmsSentAt = new Date();
        await booking.save();
        
        successCount++;
        console.log(`✅ Discount SMS sent to ${booking.guest_name}`);
        
        // Add delay between SMS to avoid rate limiting (1 second)
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (smsError) {
        failCount++;
        console.error(`❌ Failed to send discount SMS to ${booking.guest_name}:`, smsError.message);
        // Don't mark as sent if it failed, so it can be retried next day
      }
    }
    
    console.log(`🎁 Discount SMS job completed: ${successCount} sent, ${failCount} failed`);
    
  } catch (error) {
    console.error('❌ Error in discount SMS job:', error.message);
  }
});

console.log('✅ Discount SMS cron job scheduled (daily at 9:00 AM)');