const express = require('express');
const router = express.Router();
const { sendInvoiceSMS } = require('../models/smsService');
const Booking = require('../models/booking');

router.post('/send-invoice-sms/:bookingId', async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    const { roomCharge, foodCharge, otherCharge, total, invoiceUrl } = req.body;

    const message = `Dear ${booking.guest_name}, your total bill is LKR ${total}.
Room: ${roomCharge}, Food: ${foodCharge}, Other: ${otherCharge}.
You can view your invoice here: ${invoiceUrl}`;

    const smsResponse = await sendInvoiceSMS(booking.phone_no, message);
    res.json({ success: true, smsResponse });
  } catch (err) {
    console.error('Invoice SMS error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
