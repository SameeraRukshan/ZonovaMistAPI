// smsService.js
const axios = require('axios');
const Setting = require('./settings');

function replacePlaceholders(template, data) {
  console.log('Replacing placeholders in template:', template, 'with data:', data);
  const result = template
    .replace('{clientName}', data.clientName || '')
    .replace('{roomNo}', data.roomNo || '')
    .replace('{checkInDate}', data.checkInDate ? new Date(data.checkInDate).toDateString() : '')
    .replace('{guestHouseName}', data.guestHouseName || '')
    .replace('{hostName}', data.hostName || '')
    .replace('{advanceAmount}', data.advanceAmount || '')
    .replace('{invoiceLink}', data.invoiceLink || '');
  console.log('Resulting message:', result);
  return result;
}

async function sendBookingSMS(clientPhone, clientName, roomNo, checkInDate) {
  try {
    console.log('Fetching settings for SMS...');
    const settings = await Setting.findOne({});
    if (!settings) {
      console.error('No settings found in database');
      throw new Error('Settings not found in database');
    }
    console.log('Settings loaded:', settings);

    const userId = process.env.USER_ID;
    const apiKey = process.env.API_KEY;
    if (!userId || !apiKey) {
      console.error('Missing USER_ID or API_KEY');
      throw new Error('Missing Notify.lk credentials');
    }

    const senderId = settings.guestHouseName || 'Zonova Mist';
    const message = replacePlaceholders(settings.newBookingSmsTemplate, {
      clientName,
      roomNo,
      checkInDate,
      guestHouseName: settings.guestHouseName,
      hostName: settings.hostName,
    });

    const params = new URLSearchParams();
    params.append('user_id', userId);
    params.append('api_key', apiKey);
    params.append('sender_id', senderId);
    params.append('to', clientPhone);
    params.append('message', message);

    console.log('Sending SMS with params:', params.toString());
    const response = await axios.post('https://app.notify.lk/api/v1/send', params.toString());
    console.log('SMS response:', response.data);
    return response.data;
  } catch (err) {
    console.error('Error sending booking SMS:', err.message, err.stack);
    throw err;
  }
}

// NEW: Send advance paid SMS with invoice link
async function sendAdvancePaidSMS(clientPhone, clientName, roomNo, advanceAmount, invoiceLink) {
  try {
    console.log('📨 Sending advance paid SMS with invoice link...');
    const settings = await Setting.findOne({});
    if (!settings) {
      console.error('No settings found in database');
      throw new Error('Settings not found in database');
    }

    const userId = process.env.USER_ID;
    const apiKey = process.env.API_KEY;
    if (!userId || !apiKey) {
      console.error('Missing USER_ID or API_KEY');
      throw new Error('Missing Notify.lk credentials');
    }

    const senderId = settings.guestHouseName || 'Zonova Mist';
    
    // Use the advance paid template from settings
    const template = settings.advancePaidSmsTemplate || 
      'Dear {clientName}, advance payment of Rs. {advanceAmount} received for Room {roomNo}. View invoice: {invoiceLink} - {guestHouseName}';
    
    const message = replacePlaceholders(template, {
      clientName,
      roomNo,
      advanceAmount: advanceAmount ? parseFloat(advanceAmount).toFixed(2) : '0.00',
      invoiceLink,
      guestHouseName: settings.guestHouseName,
      hostName: settings.hostName,
    });

    const params = new URLSearchParams();
    params.append('user_id', userId);
    params.append('api_key', apiKey);
    params.append('sender_id', senderId);
    params.append('to', clientPhone);
    params.append('message', message);

    console.log('📤 Sending advance paid SMS:', message);
    const response = await axios.post('https://app.notify.lk/api/v1/send', params.toString());
    console.log('✅ Advance paid SMS sent:', response.data);
    return response.data;
  } catch (err) {
    console.error('❌ Error sending advance paid SMS:', err.message, err.stack);
    throw err;
  }
}

// NEW: Send discount SMS to recent guests
async function sendDiscountSMS(clientPhone, clientName) {
  try {
    console.log('🎁 Sending discount SMS to:', clientPhone);
    const settings = await Setting.findOne({});
    if (!settings) {
      console.error('No settings found in database');
      throw new Error('Settings not found in database');
    }

    const userId = process.env.USER_ID;
    const apiKey = process.env.API_KEY;
    if (!userId || !apiKey) {
      console.error('Missing USER_ID or API_KEY');
      throw new Error('Missing Notify.lk credentials');
    }

    const senderId = settings.guestHouseName || 'Zonova Mist';
    
    // Use the discount template from settings
    const template = settings.discountSmsTemplate || 
      'Missing the cool breeze of {location}? Stay at {guestHouseName} again {validityPeriod} and enjoy LKR {discountAmount} off per night. Call or WhatsApp us at {telephone}';
    
    const telephone = settings.telephone || '94728651815';
    const discountAmount = settings.discountAmount || 4000;
    const validityPeriod = settings.discountValidityPeriod || 'within a month';
    const location = settings.guestHouseLocation || 'Ambewela';
    
    const message = template
      .replace('{clientName}', clientName || '')
      .replace('{location}', location)
      .replace('{guestHouseName}', settings.guestHouseName || 'Zonova Mist')
      .replace('{validityPeriod}', validityPeriod)
      .replace('{discountAmount}', discountAmount.toString())
      .replace('{telephone}', telephone);

    const params = new URLSearchParams();
    params.append('user_id', userId);
    params.append('api_key', apiKey);
    params.append('sender_id', senderId);
    params.append('to', clientPhone);
    params.append('message', message);

    console.log('📤 Sending discount SMS:', message);
    const response = await axios.post('https://app.notify.lk/api/v1/send', params.toString());
    console.log('✅ Discount SMS sent:', response.data);
    return response.data;
  } catch (err) {
    console.error('❌ Error sending discount SMS:', err.message, err.stack);
    throw err;
  }
}

async function sendReminderSMS(clientPhone, clientName, roomNo, checkInDate) {
  try {
    console.log('Fetching settings for reminder SMS...');
    const settings = await Setting.findOne({});
    if (!settings) {
      console.error('No settings found in database');
      throw new Error('Settings not found in database');
    }
    console.log('Settings loaded:', settings);

    const userId = process.env.USER_ID;
    const apiKey = process.env.API_KEY;
    if (!userId || !apiKey) {
      console.error('Missing USER_ID or API_KEY');
      throw new Error('Missing Notify.lk credentials');
    }

    const senderId = settings.guestHouseName || 'Zonova Mist';
    const message = replacePlaceholders(settings.todayBookingSmsTemplate, {
      clientName,
      roomNo,
      checkInDate,
      guestHouseName: settings.guestHouseName,
      hostName: settings.hostName,
    });

    const params = new URLSearchParams();
    params.append('user_id', userId);
    params.append('api_key', apiKey);
    params.append('sender_id', senderId);
    params.append('to', clientPhone);
    params.append('message', message);

    console.log('Sending reminder SMS with params:', params.toString());
    const response = await axios.post('https://app.notify.lk/api/v1/send', params.toString());
    console.log('Reminder SMS response:', response.data);
    return response.data;
  } catch (err) {
    console.error('Error sending reminder SMS:', err.message, err.stack);
    throw err;
  }
}

async function sendBirthdaySMS(clientPhone, clientName) {
  try {
    const settings = await Setting.findOne({});
    if (!settings) throw new Error('Settings not found in database');

    const userId = process.env.USER_ID;
    const apiKey = process.env.API_KEY;
    if (!userId || !apiKey) throw new Error('Missing Notify.lk credentials');

    const senderId = settings.guestHouseName || 'Zonova Mist';

    // Use default template if not set in DB
    const template =
      settings.birthdaySmsTemplate ||
      'Happy Birthday {clientName}! Wishing you a wonderful year ahead from {guestHouseName}. - {hostName}';

    const message = template
      .replace('{clientName}', clientName || '')
      .replace('{guestHouseName}', settings.guestHouseName || 'Zonova Mist')
      .replace('{hostName}', settings.hostName || 'Team');

    const params = new URLSearchParams();
    params.append('user_id', userId);
    params.append('api_key', apiKey);
    params.append('sender_id', senderId);
    params.append('to', clientPhone);
    params.append('message', message);

    const response = await axios.post(
      'https://app.notify.lk/api/v1/send',
      params.toString()
    );

    return response.data;
  } catch (err) {
    console.error('Error sending birthday SMS:', err.message);
    throw err;
  }
}

async function sendInvoiceSMS(clientPhone, message) {
  try {
    console.log('📨 Sending invoice SMS to:', clientPhone);
    
    const userId = process.env.USER_ID;
    const apiKey = process.env.API_KEY;

    if (!userId || !apiKey) {
      console.error('❌ Missing USER_ID or API_KEY in environment');
      throw new Error('Missing Notify.lk credentials');
    }

    // Get sender ID from settings or use default
    let senderId = 'Zonova Mist';
    try {
      const settings = await Setting.findOne({});
      if (settings && settings.guestHouseName) {
        senderId = settings.guestHouseName;
      }
    } catch (settingsErr) {
      console.warn('⚠️ Could not fetch settings, using default sender ID');
    }

    const params = new URLSearchParams();
    params.append('user_id', userId);
    params.append('api_key', apiKey);
    params.append('sender_id', senderId);
    params.append('to', clientPhone);
    params.append('message', message);

    console.log('📤 SMS Params:', {
      user_id: userId,
      sender_id: senderId,
      to: clientPhone,
      message: message.substring(0, 50) + '...'
    });

    const response = await axios.post(
      'https://app.notify.lk/api/v1/send',
      params.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    console.log('✅ Invoice SMS sent successfully:', response.data);
    return response.data;
  } catch (err) {
    console.error('❌ Error sending invoice SMS:', {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status
    });
    throw new Error(`Failed to send SMS: ${err.response?.data?.message || err.message}`);
  }
}

module.exports = { 
  sendBookingSMS, 
  sendReminderSMS, 
  sendBirthdaySMS, 
  sendInvoiceSMS,
  sendAdvancePaidSMS,  // Export the advance paid function
  sendDiscountSMS       // Export the new discount function
};