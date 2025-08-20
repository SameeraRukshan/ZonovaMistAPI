const axios = require('axios');

async function sendBookingSMS(clientPhone, clientName, roomNo, checkInDate) {
  const userId = process.env.USER_ID;
  const apiKey = process.env.API_KEY;
  const senderId = "NotifyDEMO";
  const message = `Hello ${clientName}, your booking for room ${roomNo} is confirmed for ${checkInDate.toDateString()}.`;

  // Use URLSearchParams for x-www-form-urlencoded
  const params = new URLSearchParams();
  console.log('Preparing to send SMS with params:', {
    userId,
    apiKey,
    senderId,
    to: clientPhone,
    message
  });
  params.append('user_id', userId);
  params.append('api_key', apiKey);
  params.append('sender_id', senderId);
  params.append('to', clientPhone);
  params.append('message', message);

  try {
    const response = await axios.post('https://app.notify.lk/api/v1/send', params.toString(), {
    //   headers: { 'Content-Type': 'application/json' }
    });

    console.log('SMS response:', response.data);
    return response.data;
  } catch (err) {
    console.error('Error sending SMS:', err.response?.data || err.message);
    throw err;
  }
}

module.exports = { sendBookingSMS };
