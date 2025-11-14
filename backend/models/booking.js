// models/booking.js
const mongoose = require('mongoose');

const recordingSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  url: { type: String, required: true },
  cloudinary_id: { type: String, required: true },
  fileSize: { type: Number }, // in bytes
  mimeType: { type: String }, // e.g., 'audio/mpeg'
  uploadedAt: { type: Date, default: Date.now }
});

const bookingSchema = new mongoose.Schema({
  guest_nic: { type: String, default: null },
  guest_name: { type: String, required: true },
  booked_room_no: { type: String, required: true },
  checkin_date: { type: Date, required: true },
  checkout_date: { type: Date, required: true },
  phone_no: { type: String, required: true },
  adult_count: { type: Number, required: true },
  child_count: { type: Number, default: 0 },
  guest_address: { type: String, default: '' },
  total_price: { type: Number, default: 0 },
  special_notes: { type: String, default: '' },
  advance_amount: { type: Number, default: 0 },
  birthday: { type: Date, default: null },
  food: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['pending', 'paid', 'cancelled', 'advance_paid'],
    default: 'pending'
  },
  reminder_sms_sent: { type: Boolean, default: false },
  reminderSmsSentAt: { type: Date, default: null },
  birthday_sms_sent: { type: Boolean, default: false },
  birthdaySmsSentAt: { type: Date, default: null },
  
  // Discount SMS tracking
  discount_sms_sent: { type: Boolean, default: false },
  discountSmsSentAt: { type: Date, default: null },
  
  // NEW: Audio recordings
  recordings: [recordingSchema],
  
  // Soft delete fields
  deleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },
  deletedBy: { type: String, default: null }
}, {
  timestamps: true
});

// Add indexes for better query performance
bookingSchema.index({ deleted: 1, checkin_date: 1 });
bookingSchema.index({ deleted: 1, status: 1 });
bookingSchema.index({ deleted: 1, checkout_date: 1, discount_sms_sent: 1 });

module.exports = mongoose.model('Booking', bookingSchema);