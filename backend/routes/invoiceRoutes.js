const express = require('express');
const router = express.Router();
const { sendInvoiceSMS } = require('../models/smsService');
const Booking = require('../models/booking');

// POST /api/invoices/send-invoice-sms
router.post('/send-invoice-sms', async (req, res) => {
  try {
    const { bookingId, total } = req.body;
    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    // You can store total or other charges in DB if needed
    booking.total_price = total;
    await booking.save();

    const invoiceUrl = `https://zonova.lk/invoice/${bookingId}`;
    const message = `Dear ${booking.guest_name}, your invoice for Zonova Mist is ready. View it here: ${invoiceUrl}`;

    await sendInvoiceSMS(booking.phone_no, message);

    res.json({ success: true, message: 'Invoice sent successfully!' });
  } catch (error) {
    console.error('Error sending invoice SMS:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/invoices/:bookingId
router.get('/:bookingId', async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    res.json({
      guest_name: booking.guest_name,
      booked_room_no: booking.booked_room_no,
      total_price: booking.total_price,
      advance_amount: booking.advance_amount,
      special_notes: booking.special_notes,
      
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
