// backend/models/auditLog.js
//
// Append-only record of who changed what.
//
// Mandatory for: booking status transitions, payment status transitions,
// refunds, and any manual edit to a monetary field by an admin.
//
// This exists partly because of a known weakness elsewhere: the admin API is
// role-gated but not field-gated beyond BOOKING_UPDATABLE_FIELDS, and an admin
// can legitimately edit amounts. Auditing makes such edits *detectable* even
// where they are not *preventable*, which is the right trade-off for a system
// whose operators are trusted but whose actions still need to be reconstructable
// during a payment dispute.

const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    default: null,
    index: true,
  },

  actor_type: {
    type: String,
    enum: ['USER', 'SYSTEM', 'GATEWAY', 'CRON'],
    required: true,
  },
  actor_id: { type: String, default: null },
  actor_email: { type: String, default: null },

  // Dotted verb, e.g. 'booking.confirmed', 'payment.succeeded', 'refund.issued'.
  action: { type: String, required: true, index: true },

  entity_type: { type: String, required: true },   // 'Booking' | 'Payment' | 'Refund'
  entity_id: { type: String, required: true, index: true },

  // Changed fields only — not whole documents. Keeps the log readable and
  // avoids duplicating guest PII across thousands of rows.
  before: { type: Object, default: null },
  after: { type: Object, default: null },

  ip_address: { type: String, default: null },
  user_agent: { type: String, default: null },
  note: { type: String, default: null },
}, { timestamps: { createdAt: true, updatedAt: false } });

auditLogSchema.index({ entity_type: 1, entity_id: 1, createdAt: -1 });
auditLogSchema.index({ clientId: 1, createdAt: -1 });

/**
 * Convenience writer. Deliberately never throws: an audit failure must not roll
 * back the business operation it was recording. Failures are logged loudly so
 * they surface in monitoring instead of vanishing.
 */
auditLogSchema.statics.record = async function record(entry) {
  try {
    return await this.create(entry);
  } catch (err) {
    console.error('⚠️ AuditLog write failed (operation itself unaffected):', err.message);
    return null;
  }
};

module.exports = mongoose.model('AuditLog', auditLogSchema);
