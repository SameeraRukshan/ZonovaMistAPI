const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  roomNumber: { type: String, required: true, unique: true },
  floor: Number,
  type: String,
  bedCount: Number,
  maxOccupancy: Number,
  pricePerNight: Number,
  status: { type: String, enum: ['available', 'occupied', 'maintenance'], default: 'available' },
  amenities: [String],
  photos: [String],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Room', roomSchema);