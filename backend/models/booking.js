// models/booking.js
const mongoose = require('mongoose');

const recordingSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  url: { type: String, required: true },
  cloudinary_id: { type: String, required: true },
  fileSize: { type: Number }, // in bytes
  mimeType: { type: String }, // e.g., 'audio/mpeg'
  uploadedAt: { type: Date, default: Date.now }
});

const bookingSchema = new mongoose.Schema({
  guest_nic: { type: String, default: null },
  guest_name: { type: String, required: true },
  booked_room_no: { type: String, required: true },
  checkin_date: { type: Date, required: true },
  checkout_date: { type: Date, required: true },
  phone_no: { type: String, required: true },
  adult_count: { type: Number, required: true },
  child_count: { type: Number, default: 0 },
  guest_address: { type: String, default: '' },
  total_price: { type: Number, default: 0 },
  special_notes: { type: String, default: '' },
  advance_amount: { type: Number, default: 0 },
  birthday: { type: Date, default: null },
  food: { type: Number, default: 0 },
  // DEPRECATED — kept so the existing admin app (Android + web) keeps working
  // unchanged during the PayHere rollout. It conflates two different questions:
  // "is the room held?" and "has money arrived?". Those are now answered by
  // booking_status and payment_status below.
  //
  // Controllers dual-write all three. Remove this only once the Flutter app has
  // been migrated to read the new fields and no client depends on it.
  status: {
    type: String,
    enum: ['pending', 'paid', 'cancelled', 'advance_paid'],
    default: 'pending'
  },

  // --- Booking lifecycle: is the room held / occupied / released? ---------
  booking_status: {
    type: String,
    enum: [
      'HOLD',         // provisional; released at hold_expires_at unless paid
      'CONFIRMED',
      'CHECKED_IN',
      'CHECKED_OUT',
      'CANCELLED',
      'EXPIRED',      // hold lapsed without payment
      'DISPUTED',     // chargeback raised — never auto-release
      'NO_SHOW',
    ],
    default: 'HOLD',
    index: true,
  },

  // --- Payment state: has money arrived? ---------------------------------
  payment_status: {
    type: String,
    enum: [
      'UNPAID',
      'PENDING',
      'PARTIALLY_PAID',   // deposit received, balance outstanding
      'PAID',
      'REFUNDED',
      'PARTIALLY_REFUNDED',
      'CHARGEBACK',
      'FAILED',
    ],
    default: 'UNPAID',
    index: true,
  },

  // Public-safe identifier. Everything guest-facing uses this instead of _id:
  // it appears in URLs, SMS and the payment return page, and a Mongo ObjectId
  // leaks creation time and is trivially enumerable.
  booking_ref: { type: String, unique: true, sparse: true, index: true },

  source: {
    type: String,
    enum: ['ADMIN', 'WEB', 'PHONE', 'WALKIN', 'OTA'],
    default: 'ADMIN',
  },

  // PayHere's checkout requires an email address; the original schema had no
  // field for one, since staff-entered bookings only ever captured a phone.
  guest_email: { type: String, default: null },
  guest_city: { type: String, default: '' },
  guest_country: { type: String, default: 'Sri Lanka' },

  // --- Money, as INTEGER CENTS (see helpers/money.js) ---------------------
  // The float fields above (total_price, advance_amount, food) remain for the
  // admin app. These are authoritative for anything touching the gateway.
  total_amount_cents: { type: Number, default: 0 },
  deposit_amount_cents: { type: Number, default: 0 },   // what PayHere actually charges
  paid_amount_cents: { type: Number, default: 0 },      // sum of successful payments
  refunded_amount_cents: { type: Number, default: 0 },
  currency: { type: String, default: 'LKR' },

  // Set to true by the IPN handler the first time a gateway payment succeeds.
  //
  // Guards an otherwise nasty interaction: the admin app writes rupees into the
  // legacy `advance_amount` float, and the controller mirrors that into
  // paid_amount_cents. Without this flag, any later admin edit — even changing
  // a guest's phone number — would recompute paid_amount_cents from
  // advance_amount and silently erase money actually collected through PayHere.
  //
  // Once true, paid_amount_cents is owned exclusively by the payment layer.
  has_gateway_payment: { type: Boolean, default: false },

  // --- Hold lifecycle ----------------------------------------------------
  hold_expires_at: { type: Date, default: null, index: true },
  confirmed_at: { type: Date, default: null },
  cancelled_at: { type: Date, default: null },
  cancellation_reason: { type: String, default: null },

  // Set by the public booking endpoint so a double-submitted form returns the
  // original booking instead of creating a second one.
  idempotency_key: { type: String, default: null, index: true, sparse: true },

  // Consumer-protection evidence: when the guest accepted the booking terms.
  terms_accepted_at: { type: Date, default: null },
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
    index: true
  },
  reminder_sms_sent: { type: Boolean, default: false },
  reminderSmsSentAt: { type: Date, default: null },
  birthday_sms_sent: { type: Boolean, default: false },
  birthdaySmsSentAt: { type: Date, default: null },
  
  // Discount SMS tracking
  discount_sms_sent: { type: Boolean, default: false },
  discountSmsSentAt: { type: Date, default: null },
  
  // NEW: Audio recordings
  recordings: [recordingSchema],
  
  // Soft delete fields
  deleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },
  deletedBy: { type: String, default: null }
}, {
  timestamps: true
});

// Add indexes for better query performance
bookingSchema.index({ deleted: 1, checkin_date: 1 });
bookingSchema.index({ deleted: 1, status: 1 });
bookingSchema.index({ deleted: 1, checkout_date: 1, discount_sms_sent: 1 });

// Availability / overlap detection — the query the system currently lacks.
bookingSchema.index({ clientId: 1, booked_room_no: 1, checkin_date: 1, checkout_date: 1 });
// Reconciliation job: find holds that have lapsed.
bookingSchema.index({ clientId: 1, booking_status: 1, hold_expires_at: 1 });

module.exports = mongoose.model('Booking', bookingSchema);