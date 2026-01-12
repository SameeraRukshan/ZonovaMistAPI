const mongoose = require('mongoose');

const hotelSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  location: {
    address: String,
    city: String,
    state: String,
    country: String,
  },
  starRating: { type: Number, min: 1, max: 5 },
  description: String,
  phone: String,
  email: String,
  website: String,
  amenities: [String],
  price: { type: Number, default: 0 },         
  status: { type: String, enum: ['available', 'booked', 'maintenance'], default: 'available' },
  
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
    index: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Hotel', hotelSchema);