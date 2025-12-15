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
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
    index: true
  }
}, { timestamps: true });

module.exports = mongoose.model("Settings", SettingsSchema);