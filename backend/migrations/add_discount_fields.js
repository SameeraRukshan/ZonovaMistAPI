// migrations/add_discount_fields.js
// Run this once to add discount fields to existing settings
const mongoose = require('mongoose');
const Setting = require('../models/settings');
require('dotenv').config();

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('🔗 Connected to MongoDB');

    const settings = await Setting.findOne({});
    
    if (!settings) {
      console.log('❌ No settings found in database');
      console.log('ℹ️ Settings will be created automatically when you save from the Settings screen');
      process.exit(0);
      return;
    }

    let updated = false;

    // Add discount SMS template if it doesn't exist
    if (!settings.discountSmsTemplate) {
      settings.discountSmsTemplate = 'Missing the cool breeze of {location}? Stay at {guestHouseName} again {validityPeriod} and enjoy LKR {discountAmount} off per night. Call or WhatsApp us at {telephone}';
      updated = true;
      console.log('✅ Added discountSmsTemplate');
    } else {
      console.log('ℹ️ discountSmsTemplate already exists');
    }

    // Add discount amount if it doesn't exist
    if (!settings.discountAmount) {
      settings.discountAmount = 4000;
      updated = true;
      console.log('✅ Added discountAmount (4000)');
    } else {
      console.log('ℹ️ discountAmount already exists');
    }

    // Add validity period if it doesn't exist
    if (!settings.discountValidityPeriod) {
      settings.discountValidityPeriod = 'within a month';
      updated = true;
      console.log('✅ Added discountValidityPeriod');
    } else {
      console.log('ℹ️ discountValidityPeriod already exists');
    }

    // Add location if it doesn't exist
    if (!settings.guestHouseLocation) {
      settings.guestHouseLocation = 'Ambewela';
      updated = true;
      console.log('✅ Added guestHouseLocation (Ambewela)');
    } else {
      console.log('ℹ️ guestHouseLocation already exists');
    }

    // Add days after checkout if it doesn't exist
    if (!settings.discountSmsDaysAfterCheckout) {
      settings.discountSmsDaysAfterCheckout = 10;
      updated = true;
      console.log('✅ Added discountSmsDaysAfterCheckout (10 days)');
    } else {
      console.log('ℹ️ discountSmsDaysAfterCheckout already exists');
    }

    // Also ensure telephone has default value if empty
    if (!settings.telephone || settings.telephone === '') {
      settings.telephone = '94728651815';
      updated = true;
      console.log('✅ Set default telephone (94728651815)');
    }

    if (updated) {
      await settings.save();
      console.log('\n✅ Migration completed successfully - discount fields added to settings');
    } else {
      console.log('\n✅ All discount fields already exist - no migration needed');
    }

    console.log('\n📋 Current discount configuration:');
    console.log(`   - Location: ${settings.guestHouseLocation}`);
    console.log(`   - Discount Amount: Rs. ${settings.discountAmount}`);
    console.log(`   - Validity Period: ${settings.discountValidityPeriod}`);
    console.log(`   - Days After Checkout: ${settings.discountSmsDaysAfterCheckout}`);
    console.log(`   - Telephone: ${settings.telephone}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();