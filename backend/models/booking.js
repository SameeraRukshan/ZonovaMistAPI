const mongoose = require('mongoose');
const { Schema } = mongoose; // Destructure Schema for cleaner usage
const { Decimal128 } = Schema.Types; // Optional: Destructure Decimal128 if used frequently

const bookingSchema = new Schema({
  guest_nic: { type: String, required: true },
  guest_name: { type: String, required: true },
  booked_room_no: { type: String, required: true },
  checkin_date: { type: Date, required: true },
  checkout_date: { type: Date, required: true },
  phone_no: { type: String, required: true },
  adult_count: { type: Number, required: true }, 
  child_count: { type: Number, required: true },
  guest_address: { type: String, required: true },
  total_price: { type: Decimal128, default: '0' }, 
  special_notes: { type: String, default: '' },
  advance_amount: { type: Decimal128, default: '0' }, 
  status: { type: String, default: 'Pending' },
  reminder_sms_sent: { type: Boolean, default: false },
  reminderSmsSentAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Booking', bookingSchema);