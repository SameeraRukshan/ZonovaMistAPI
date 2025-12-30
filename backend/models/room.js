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
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
    index: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Room', roomSchema);