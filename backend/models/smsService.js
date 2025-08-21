const axios = require('axios');

async function sendBookingSMS(clientPhone, clientName, roomNo, checkInDate) {
  const userId = process.env.USER_ID;
  const apiKey = process.env.API_KEY;
  const senderId = "Zonova Mist";
  const message = `Hello ${clientName}, your booking for room ${roomNo} is confirmed for ${checkInDate.toDateString()}.`;

  const params = new URLSearchParams();
  params.append('user_id', userId);
  params.append('api_key', apiKey);
  params.append('sender_id', senderId);
  params.append('to', clientPhone);
  params.append('message', message);

  try {
    const response = await axios.post('https://app.notify.lk/api/v1/send', params.toString());
    console.log('SMS response:', response.data);
    return response.data;
  } catch (err) {
    console.error('Error sending SMS:', err.response?.data || err.message);
    throw err;
  }
}

async function sendReminderSMS(clientPhone, clientName, roomNo, checkInDate) {
  const userId = process.env.USER_ID;
  const apiKey = process.env.API_KEY;
  const senderId = "Zonova Mist";
  const message = `Good morning ${clientName}, just a reminder of your check-in today for room ${roomNo} at Zonova Mist. We look forward to hosting you!`;

  const params = new URLSearchParams();
  params.append('user_id', userId);
  params.append('api_key', apiKey);
  params.append('sender_id', senderId);
  params.append('to', clientPhone);
  params.append('message', message);

  try {
    const response = await axios.post('https://app.notify.lk/api/v1/send', params.toString());
    console.log('Reminder SMS response:', response.data);
    return response.data;
  } catch (err) {
    console.error('Error sending reminder SMS:', err.response?.data || err.message);
    throw err;
  }
}

module.exports = { sendBookingSMS, sendReminderSMS };
