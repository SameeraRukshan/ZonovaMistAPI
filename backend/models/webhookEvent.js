// backend/models/webhookEvent.js
//
// Raw, append-only log of everything the gateway sends us.
//
// Written BEFORE the signature is checked and before anything is interpreted,
// so that forged and malformed attempts are captured too. Two reasons this
// matters:
//
//   1. Forensics. PayHere confirmed that in a chargeback dispute they "request
//      supporting documents such as payment proofs, service confirmations".
//      This collection is that evidence.
//   2. Replay. If the handler crashes mid-processing, the event is still here
//      and can be re-run rather than lost.
//
// PayHere provides no fixed source-IP list, so IP allowlisting is not available
// as a control (their guidance: validate using the returned data). That makes
// this log the main after-the-fact detection surface for forgery attempts.

const mongoose = require('mongoose');

const webhookEventSchema = new mongoose.Schema({
  // Nullable: the tenant may be unknown until the payload has been parsed, and
  // for a forged request it may never be resolvable at all.
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    default: null,
    index: true,
  },

  gateway: { type: String, default: 'PAYHERE' },

  event_type: {
    type: String,
    enum: ['NOTIFY', 'RETURN', 'CANCEL', 'RETRIEVAL', 'REFUND'],
    required: true,
    index: true,
  },

  order_id: { type: String, default: null, index: true },
  payment_id: { type: String, default: null },

  raw_body: { type: Object, default: null },
  raw_headers: { type: Object, default: null },
  source_ip: { type: String, default: null },

  signature_valid: { type: Boolean, default: null },   // null = not yet checked

  processing_status: {
    type: String,
    enum: [
      'RECEIVED',   // persisted, nothing checked yet
      'VERIFIED',   // signature + business checks passed
      'REJECTED',   // failed a check — see rejection_reason
      'PROCESSED',  // state successfully applied
      'DUPLICATE',  // valid, but the state had already been applied
      'ERROR',      // unexpected failure during processing
    ],
    default: 'RECEIVED',
    index: true,
  },

  rejection_reason: { type: String, default: null },
  processed_at: { type: Date, default: null },
  error: { type: String, default: null },
}, { timestamps: true });

webhookEventSchema.index({ order_id: 1, createdAt: -1 });
webhookEventSchema.index({ processing_status: 1, createdAt: -1 });

// Retain ~400 days: comfortably longer than card scheme chargeback windows
// (typically 120–540 days depending on reason code), while bounding growth.
// Revisit if a dispute ever needs older evidence.
webhookEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 400 * 24 * 60 * 60 });

module.exports = mongoose.model('WebhookEvent', webhookEventSchema);
