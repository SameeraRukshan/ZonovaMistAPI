const mongoose = require('mongoose');
const { Schema } = mongoose;

const bookingSchema = new Schema({
  guest_nic: { type: String, required: false },
  guest_name: { type: String, required: true },
  booked_room_no: { type: String, required: true },
  checkin_date: { type: Date, required: true },
  checkout_date: { type: Date, required: true },
  phone_no: { type: String, required: true },
  adult_count: { type: Number, required: true },
  child_count: { type: Number, required: false },
  guest_address: { type: String, required: false },
  total_price: { type: Schema.Types.Decimal128, default: '0' },
  special_notes: { type: String, required: false, default: '' }, 
  advance_amount: { type: Schema.Types.Decimal128, default: '0' },
  status: { type: String, default: 'Pending' },
  reminder_sms_sent: { type: Boolean, default: false },
  reminderSmsSentAt: { type: Date, default: null },
  birthday: { type: Date, required: false },
  birthday_sms_sent: { type: Boolean, default: false },
  birthdaySmsSentAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Booking', bookingSchema);
