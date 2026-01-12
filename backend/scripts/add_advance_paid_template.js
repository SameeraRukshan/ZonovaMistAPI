// migrations/add_advance_paid_template.js
// Run this once to add the new field to existing settings
const mongoose = require('mongoose');
const Setting = require('./models/settings');
require('dotenv').config();

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('🔗 Connected to MongoDB');

    const settings = await Setting.findOne({});
    
    if (!settings) {
      console.log('❌ No settings found in database');
      return;
    }

    // Add the new field if it doesn't exist
    if (!settings.advancePaidSmsTemplate) {
      settings.advancePaidSmsTemplate = 'Dear {clientName}, advance payment of Rs. {advanceAmount} received for Room {roomNo}. View invoice: {invoiceLink} - {guestHouseName}';
      await settings.save();
      console.log('✅ Added advancePaidSmsTemplate to settings');
    } else {
      console.log('ℹ️ advancePaidSmsTemplate already exists');
    }

    console.log('✅ Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();