const express = require('express');
const router = express.Router();
const { sendInvoiceSMS } = require('../models/smsService');
const Booking = require('../models/booking');

// POST /invoices/send-invoice-sms
router.post('/send-invoice-sms', async (req, res) => {
  const { bookingId } = req.body;
  const booking = await Booking.findById(bookingId);

  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  const invoiceUrl = `https://zonova.lk/invoice/${bookingId}`;
  const message = `Dear ${booking.guest_name}, your invoice for Zonova Mist is ready. View it here: ${invoiceUrl}`;

  // Send SMS through Notify.lk
  await sendSMSWithNotify(booking.phone, message);

  res.json({ success: true, message: 'Invoice sent successfully!' });
});


module.exports = router;
