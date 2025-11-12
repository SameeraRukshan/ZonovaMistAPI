const mongoose = require("mongoose");

const SettingsSchema = new mongoose.Schema({
  guestHouseName: { type: String, required: true },
  guestHouseAddress: { type: String, required: true },
  hostName: { type: String, required: true },
  telephone: { type: String, required: true },
  newBookingSmsTemplate: { type: String, required: true },
  todayBookingSmsTemplate: { type: String, required: true },
  // NEW: Template for advance paid invoice SMS
  advancePaidSmsTemplate: { 
    type: String, 
    default: 'Dear {clientName}, advance payment of Rs. {advanceAmount} received for Room {roomNo}. View invoice: {invoiceLink} - {guestHouseName}'
  },
}, { timestamps: true });

module.exports = mongoose.model("Settings", SettingsSchema);