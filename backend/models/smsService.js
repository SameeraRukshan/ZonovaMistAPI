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
    .replace('{hostName}', data.hostName || '');
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

module.exports = { sendBookingSMS, sendReminderSMS, sendBirthdaySMS };