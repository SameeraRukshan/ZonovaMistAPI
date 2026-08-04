const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  // NOT globally unique — see the compound index below. Room numbers only need
  // to be unique within a tenant; two guest houses may both have a "101".
  roomNumber: { type: String, required: true },
  floor: Number,
  type: String,
  bedCount: Number,
  maxOccupancy: Number,
  pricePerNight: Number,
  status: { type: String, enum: ['available', 'occupied', 'maintenance'] },
  amenities: [String],

  // Serialization point for concurrent booking attempts on this room.
  //
  // MongoDB transactions give snapshot isolation, which does NOT by itself
  // prevent write skew: two concurrent transactions can both read "no
  // overlapping booking" and both insert one, and both will commit. Forcing
  // each booking transaction to also $inc this counter gives them a shared
  // document to conflict on, so MongoDB aborts one with a WriteConflict and the
  // retry then sees the other's booking. See services/bookingHoldService.js.
  bookingLockVersion: { type: Number, default: 0 },
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
    index: true
  }
}, { timestamps: true });

// Room numbers are unique PER TENANT, not globally.
//
// The original single-field unique index on roomNumber would have blocked the
// second guest house from ever creating a "Room 101" — a latent blocker for the
// multi-tenant SaaS plan, unrelated to payments but fixed here because the
// migration was touching indexes anyway.
//
// NOTE: the old index must be dropped explicitly; Mongoose will not replace it.
// Handled by migrations/002_payment_foundation.js.
roomSchema.index({ clientId: 1, roomNumber: 1 }, { unique: true });

module.exports = mongoose.model('Room', roomSchema);