// backend/models/refund.js
//
// Refunds are a two-step process by design: a request is recorded, then an
// admin approves it and the gateway call is made.
//
// There is no automated guest-initiated refund path. A guest cancelling creates
// a REQUESTED row for a human to act on. This is deliberate — an automatic
// refund endpoint reachable from a public booking flow is a way to lose money
// to abuse, and refund policy (forfeit windows, partial amounts) is a business
// decision that lives in per-tenant Settings rather than in code.

const mongoose = require('mongoose');

const refundSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
    index: true,
  },
  paymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
    required: true,
    index: true,
  },
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true,
    index: true,
  },

  // Partial refunds are supported: this may be less than the payment amount.
  amount_cents: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'LKR' },

  reason: { type: String, required: true },

  status: {
    type: String,
    enum: [
      'REQUESTED',   // raised (often by a guest cancelling); awaiting a human
      'APPROVED',    // admin approved; not yet sent to the gateway
      'PROCESSING',  // gateway call in flight
      'COMPLETED',
      'FAILED',      // gateway rejected it
      'REJECTED',    // a human declined it
    ],
    default: 'REQUESTED',
    index: true,
  },

  gateway_refund_id: { type: String, default: null },
  gateway_response: { type: Object, default: null },

  requested_by: { type: String, default: null },   // user id, or null when guest-initiated
  approved_by: { type: String, default: null },

  requested_at: { type: Date, default: Date.now },
  approved_at: { type: Date, default: null },
  completed_at: { type: Date, default: null },

  failure_reason: { type: String, default: null },
}, { timestamps: true });

refundSchema.index({ clientId: 1, status: 1, createdAt: -1 });
refundSchema.index({ paymentId: 1, status: 1 });

module.exports = mongoose.model('Refund', refundSchema);
