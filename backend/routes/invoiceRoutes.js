const express = require('express');
const router = express.Router();
const { sendInvoiceSMS } = require('../models/smsService');
const Booking = require('../models/booking');
const authMiddleware = require('../middleware/authMiddleware');

// POST /api/invoices/send-invoice-sms (protected route)
router.post('/send-invoice-sms', authMiddleware, async (req, res) => {
  try {
    console.log('📋 Invoice SMS Request received:', req.body);
    
    const { bookingId, total, food, notes } = req.body;
    
    // Validate required fields
    if (!bookingId) {
      return res.status(400).json({ success: false, error: 'Booking ID is required' });
    }
    
    if (!total || isNaN(total)) {
      return res.status(400).json({ success: false, error: 'Valid total amount is required' });
    }

    // ✅ Find booking with tenant filter
    const booking = await Booking.findOne({ 
      _id: bookingId, 
      ...req.tenantFilter 
    });
    if (!booking) {
      console.error('❌ Booking not found:', bookingId);
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    console.log('✅ Booking found:', booking.guest_name);

    // Update booking with invoice details
    booking.total_price = total;
    booking.food = food || 0;
    if (notes) {
      booking.special_notes = notes;
    }
    await booking.save();
    console.log('✅ Booking updated with invoice details');

    // Use production URL - hardcoded for now, can be from env
    const baseUrl = process.env.BASE_URL || 'https://zonovamistapi-uke8.onrender.com';
    const invoiceUrl = `${baseUrl}/invoice/${bookingId}`;
    
    console.log('🔗 Invoice URL:', invoiceUrl);

    // Format the message
    const message = `Dear ${booking.guest_name}, your invoice for Zonova Mist is ready. Total: Rs. ${parseFloat(total).toFixed(2)}. View it here: ${invoiceUrl}`;

    console.log('📨 Sending SMS...');
    const smsResponse = await sendInvoiceSMS(booking.phone_no, message);
    
    console.log('✅ SMS sent successfully');

    res.json({ 
      success: true, 
      message: 'Invoice sent successfully!', 
      invoiceUrl,
      smsResponse 
    });
  } catch (error) {
    console.error('❌ Error in send-invoice-sms:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: error.response?.data || 'No additional details'
    });
  }
});

// GET /api/invoices/:bookingId - Returns invoice data as JSON (public route for guests)
router.get('/:bookingId', async (req, res) => {
  try {
    // Note: This is a public route so guests can view their invoice
    // No tenant filter here - accessed via direct link
    const booking = await Booking.findById(req.params.bookingId);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    res.json({
      guest_name: booking.guest_name,
      guest_nic: booking.guest_nic,
      guest_address: booking.guest_address,
      phone_no: booking.phone_no,
      booked_room_no: booking.booked_room_no,
      checkin_date: booking.checkin_date,
      checkout_date: booking.checkout_date,
      adult_count: booking.adult_count,
      child_count: booking.child_count,
      total_price: booking.total_price,
      advance_amount: booking.advance_amount,
      food: booking.food || 0,
      special_notes: booking.special_notes,
      status: booking.status,
    });
  } catch (error) {
    console.error('Error fetching invoice:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;