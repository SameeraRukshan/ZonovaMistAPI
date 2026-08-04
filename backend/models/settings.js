const mongoose = require("mongoose");

const SettingsSchema = new mongoose.Schema({
  guestHouseName: { type: String, required: true },
  guestHouseAddress: { type: String, required: true },
  hostName: { type: String, required: true },
  telephone: { type: String, required: true },
  newBookingSmsTemplate: { type: String, required: true },
  todayBookingSmsTemplate: { type: String, required: true },
  // Template for advance paid invoice SMS
  advancePaidSmsTemplate: { 
    type: String, 
    default: 'Dear {clientName}, advance payment of Rs. {advanceAmount} received for Room {roomNo}. View invoice: {invoiceLink} - {guestHouseName}'
  },
  // NEW: Template for discount SMS to recent guests
  discountSmsTemplate: {
    type: String,
    default: 'Missing the cool breeze of {location}? Stay at {guestHouseName} again {validityPeriod} and enjoy LKR {discountAmount} off per night. Call or WhatsApp us at {telephone}'
  },
  // NEW: Discount SMS configuration
  discountAmount: { type: Number, default: 4000 },
  discountValidityPeriod: { type: String, default: 'within a month' },
  guestHouseLocation: { type: String, default: 'Ambewela' },
  discountSmsDaysAfterCheckout: { type: Number, default: 10 },
  // --- Public booking configuration (M3) --------------------------------
  //
  // Defaults to OFF. The public booking API is built before the guest site and
  // before PayHere is live, so it must not become reachable simply because the
  // code shipped. Turn it on deliberately, per tenant.
  publicBookingEnabled: { type: Boolean, default: false },

  // How long a provisional HOLD survives without payment. Long enough to
  // complete a card payment including a bank OTP round trip; short enough that
  // an abandoned checkout does not sit on a room all evening.
  holdDurationMinutes: { type: Number, default: 20, min: 5, max: 120 },

  // Percentage of the total charged up front. 100 = full payment at booking.
  // Anything less leaves a balance to collect at check-in.
  depositPercentage: { type: Number, default: 100, min: 1, max: 100 },

  currency: { type: String, default: 'LKR' },

  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
    index: true
  }
}, { timestamps: true });

module.exports = mongoose.model("Settings", SettingsSchema);