const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  guest_nic: { type: String, required: true },
  guest_name: { type: String, required: true },
  booked_room_no: { type: String, required: true },
  checkin_date: { type: Date, required: true },
  checkout_date: { type: Date, required: true },
  phone_no: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Booking', bookingSchema);
