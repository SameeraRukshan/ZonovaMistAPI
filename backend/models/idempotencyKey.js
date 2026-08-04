// backend/models/idempotencyKey.js
//
// Stores the outcome of a mutating public request so a repeat of the same
// request returns the ORIGINAL result instead of doing the work twice.
//
// The case this exists for is mundane and common: a guest on a patchy mobile
// connection taps "Confirm booking", sees nothing happen, and taps again. Two
// identical POSTs arrive. Without this they get two bookings and, shortly
// after, two payment requests.
//
// Concurrency is handled by the unique index on `key`: the middleware inserts
// the row BEFORE doing the work, so a simultaneous duplicate hits a duplicate-key
// error and waits for the first to finish rather than racing it.

const mongoose = require('mongoose');

const idempotencyKeySchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, index: true },

  // Scope: the same key sent to a different route must not replay an unrelated
  // response. Both are recorded and checked.
  method: { type: String, required: true },
  path: { type: String, required: true },

  // Fingerprint of the request body. A client reusing one key for genuinely
  // different payloads is a bug on their side, and replaying the first response
  // would hide it — so that case is rejected loudly instead.
  request_hash: { type: String, required: true },

  status: {
    type: String,
    enum: ['IN_PROGRESS', 'COMPLETED'],
    default: 'IN_PROGRESS',
    index: true,
  },

  response_status: { type: Number, default: null },
  response_body: { type: Object, default: null },

  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', default: null },
}, { timestamps: true });

// 24h retention: long enough to cover any plausible retry (including a guest
// returning to a stale tab), short enough that the collection stays small.
idempotencyKeySchema.index({ createdAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

module.exports = mongoose.model('IdempotencyKey', idempotencyKeySchema);
