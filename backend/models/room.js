const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  roomNumber: { type: String, required: true, unique: true },
  floor: Number,
  type: String,
  bedCount: Number,
  maxOccupancy: Number,
  pricePerNight: Number,
  status: { type: String, enum: ['available', 'occupied', 'maintenance'] },
  amenities: [String],
}, { timestamps: true });

module.exports = mongoose.model('Room', roomSchema);