const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  guest_nic: { type: String, required: true },
  guest_name: { type: String, required: true },
  booked_room_no: { type: String, required: true },
  checkin_date: { type: Date, required: true },
  checkout_date: { type: Date, required: true },
  phone_no: { type: String, required: true },
  adualt_count:{type: Number, required: true },
  child_count: { type: Number, required: true },
  guest_address: { type: String, required: true },
  total_price: { type: Decimal128, required: true },
  special_notes: { type: String, default: ''},
  advance_amount: { type: Decimal128, default: '0' },
  status: { type: String, default: 'Pending'},


  }, { timestamps: true });

module.exports = mongoose.model('Booking', bookingSchema);
