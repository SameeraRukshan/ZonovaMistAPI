const mongoose = require('mongoose');

const hotelSchema = new mongoose.Schema({
  // NOT globally unique — see the compound index below. Two tenants may
  // legitimately track partner hotels with the same name.
  name: { type: String, required: true },
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

// Hotel names are unique PER TENANT, not globally. Same reasoning as Room —
// see models/room.js. The old single-field index is dropped by
// migrations/002_payment_foundation.js.
hotelSchema.index({ clientId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Hotel', hotelSchema);