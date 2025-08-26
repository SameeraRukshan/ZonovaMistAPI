// smsService.js
const axios = require('axios');
const Setting = require('./settings');

// Helper function to replace placeholders in the template
function replacePlaceholders(template, data) {
  return template
    .replace('{clientName}', data.clientName || '')
    .replace('{roomNo}', data.roomNo || '')
    .replace('{checkInDate}', data.checkInDate ? new Date(data.checkInDate).toDateString() : '')
    .replace('{date}', data.checkInDate ? new Date(data.checkInDate).toDateString() : '') // Support {date}
    .replace('{guestHouseName}', data.guestHouseName || '')
    .replace('{hostName}', data.hostName || '');
}

async function sendBookingSMS(clientPhone, clientName, roomNo, checkInDate) {
  try {
    const settings = await Setting.findOne({});
    if (!settings) throw new Error('Settings not found in database');

    const userId = process.env.USER_ID;
    const apiKey = process.env.API_KEY;
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

    const response = await axios.post('https://app.notify.lk/api/v1/send', params.toString());
    console.log('SMS response:', response.data);
    return response.data;
  } catch (err) {
    console.error('Error sending booking SMS:', err.message);
    throw err;
  }
}

async function sendReminderSMS(clientPhone, clientName, roomNo, checkInDate) {
  try {
    const settings = await Setting.findOne({});
    if (!settings) throw new Error('Settings not found in database');

    const userId = process.env.USER_ID;
    const apiKey = process.env.API_KEY;
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

    const response = await axios.post('https://app.notify.lk/api/v1/send', params.toString());
    console.log('Reminder SMS response:', response.data);
    return response.data;
  } catch (err) {
    console.error('Error sending reminder SMS:', err.message);
    throw err;
  }
}

module.exports = { sendBookingSMS, sendReminderSMS };