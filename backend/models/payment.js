// backend/models/payment.js
//
// One row per payment ATTEMPT (not per booking). A booking may have several:
// a failed card, a retry, a deposit, then a balance payment.
//
// Payment state is owned exclusively by the payment/webhook layer. There is
// deliberately NO generic update endpoint for this collection — see the note at
// the bottom of this file, and BOOKING_UPDATABLE_FIELDS in bookingController.js
// for the equivalent guard on bookings.

const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
    index: true,
  },
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true,
    index: true,
  },

  // Our reference, sent to PayHere as `order_id`.
  //
  // Always prefixed (ZM-<clientCode>-<seq>). PayHere recommends unique order_id
  // values per transaction; the prefix also keeps IDs readable in the merchant
  // portal and distinct per tenant if several guest houses ever share one
  // merchant account. The IPN handler rejects anything not matching the prefix
  // before it attempts a lookup.
  order_id: { type: String, required: true, unique: true, index: true },

  gateway: { type: String, default: 'PAYHERE' },

  purpose: {
    type: String,
    enum: ['DEPOSIT', 'BALANCE', 'FULL', 'EXTRA'],
    default: 'DEPOSIT',
  },

  status: {
    type: String,
    enum: [
      'INITIATED',   // we created it; customer has not reached the gateway yet
      'PENDING',     // gateway reports in-progress (status_code 0)
      'SUCCESS',     // status_code 2, signature + amount verified
      'FAILED',      // status_code -2
      'CANCELLED',   // status_code -1, customer backed out
      'CHARGEBACK',  // status_code -3
      'REFUNDED',
      'PARTIALLY_REFUNDED',
    ],
    default: 'INITIATED',
    index: true,
  },

  // What WE believe is owed. Authoritative — never taken from the client.
  amount_cents: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'LKR' },

  // What the GATEWAY reported. Kept separately and on purpose: divergence
  // between these two is a red flag worth alerting on, and collapsing them into
  // one field would hide it.
  gateway_payment_id: { type: String, default: null, index: true, sparse: true },
  gateway_amount_cents: { type: Number, default: null },
  gateway_currency: { type: String, default: null },

  payment_method: { type: String, default: null },   // VISA / MASTER / EZCASH / ...
  card_holder_name: { type: String, default: null },
  card_no_masked: { type: String, default: null },   // masked by PayHere; never a full PAN
  card_expiry: { type: String, default: null },

  status_code: { type: Number, default: null },
  status_message: { type: String, default: null },

  initiated_at: { type: Date, default: Date.now },
  paid_at: { type: Date, default: null },
  failed_at: { type: Date, default: null },
  refunded_at: { type: Date, default: null },

  attempt_no: { type: Number, default: 1 },

  ip_address: { type: String, default: null },
  user_agent: { type: String, default: null },

  // Last VERIFIED notification. The full unverified event stream lives in
  // WebhookEvent; this is a convenience copy for debugging a single payment.
  raw_notification: { type: Object, default: null },
}, { timestamps: true });

paymentSchema.index({ bookingId: 1, status: 1 });
paymentSchema.index({ clientId: 1, status: 1, createdAt: -1 });
// Drives the reconciliation job: find non-terminal payments that have gone stale.
paymentSchema.index({ status: 1, initiated_at: 1 });

/** Terminal states never transition further (except SUCCESS → CHARGEBACK). */
paymentSchema.methods.isTerminal = function isTerminal() {
  return ['SUCCESS', 'FAILED', 'CANCELLED', 'CHARGEBACK', 'REFUNDED'].includes(this.status);
};

// ---------------------------------------------------------------------------
// DO NOT add a generic update route for this collection.
//
// Payment status may only change through:
//   1. the verified IPN handler (webhookController)
//   2. the reconciliation job (Retrieval API)
//   3. the admin-only refund endpoint
//
// Anything else — including a well-meaning admin "fix payment" screen —
// reintroduces exactly the class of bug that BOOKING_UPDATABLE_FIELDS exists to
// prevent, except with money attached.
// ---------------------------------------------------------------------------

module.exports = mongoose.model('Payment', paymentSchema);
