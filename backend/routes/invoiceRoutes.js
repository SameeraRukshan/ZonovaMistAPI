const express = require('express');
const router = express.Router();
const { sendInvoiceSMS } = require('../models/smsService');
const Booking = require('../models/booking');

// POST /invoices/send-invoice-sms
router.post('/send-invoice-sms', async (req, res) => {
  try {
    const { bookingId } = req.body;
    const booking = await Booking.findById(bookingId);

    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    const invoiceUrl = `https://zonova.lk/invoice/${bookingId}`;
    const message = `Dear ${booking.guest_name}, your invoice for Zonova Mist is ready. View it here: ${invoiceUrl}`;

    // ✅ Corrected function
    await sendInvoiceSMS(booking.phone_no, message);

    res.json({ success: true, message: 'Invoice sent successfully!' });
  } catch (error) {
    console.error('Error sending invoice:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
