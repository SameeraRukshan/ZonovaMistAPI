const mongoose = require("mongoose");

const SettingsSchema = new mongoose.Schema({
  guestHouseName: { type: String, required: true },
  guestHouseAddress: { type: String, required: true },
  hostName: { type: String, required: true },
  telephone: { type: String, required: true },
  newBookingSmsTemplate: { type: String, required: true },
  todayBookingSmsTemplate: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model("Settings", SettingsSchema);
