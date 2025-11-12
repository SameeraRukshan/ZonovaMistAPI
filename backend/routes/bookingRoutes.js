// routes/bookingRoutes.js
const express = require('express');
const router = express.Router();
const Booking = require('../models/booking');
const { sendBookingSMS, sendAdvancePaidSMS } = require('../models/smsService');

/**
 * GET /bookings - Fetch bookings with filtering and proper sorting
 */
router.get('/', async (req, res) => {
  try {
    const { filter = 'recent', status, search, includeDeleted = 'false' } = req.query;
    
    let query = {};
    let sortOrder = {};
    const now = new Date();
    
    // Exclude soft-deleted bookings by default
    if (includeDeleted !== 'true') {
      query.deleted = { $ne: true };
    }
    
    // Date-based filtering with appropriate sorting
    switch (filter) {
      case 'upcoming':
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        query.checkin_date = { $gte: startOfToday };
        sortOrder = { checkin_date: 1 };
        break;
        
      case 'recent':
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        query.createdAt = { $gte: sevenDaysAgo };
        sortOrder = { checkin_date: 1 };
        break;
        
      case 'today':
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        query.checkin_date = { $gte: todayStart, $lte: todayEnd };
        sortOrder = { checkin_date: 1 };
        break;
        
      case 'week':
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        query.createdAt = { $gte: startOfWeek };
        sortOrder = { checkin_date: 1 };
        break;
        
      case 'month':
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        query.createdAt = { $gte: startOfMonth };
        sortOrder = { checkin_date: 1 };
        break;
        
      case 'past':
        query.checkout_date = { $lt: new Date() };
        sortOrder = { checkout_date: -1 };
        break;
        
      case 'all':
      default:
        sortOrder = { checkin_date: -1 };
        break;
    }
    
    // Status filtering
    if (status && ['pending', 'paid', 'cancelled', 'advance_paid'].includes(status.toLowerCase())) {
      query.status = status.toLowerCase();
    } else if (!status || status === 'null' || status === '') {
      query.status = { $ne: 'cancelled' };
    }
    
    // Search filtering
    if (search) {
      query.$or = [
        { guest_name: { $regex: search, $options: 'i' } },
        { booked_room_no: { $regex: search, $options: 'i' } },
        { phone_no: { $regex: search, $options: 'i' } },
        { guest_nic: { $regex: search, $options: 'i' } }
      ];
    }
    
    console.log('📊 Fetching bookings with query:', JSON.stringify(query));
    console.log('📊 Sort order:', JSON.stringify(sortOrder));
    
    const bookings = await Booking.find(query).sort(sortOrder);
    
    console.log(`✅ Found ${bookings.length} bookings`);
    res.json(bookings);
  } catch (err) {
    console.error('❌ Error fetching bookings:', err.message);
    res.status(500).json({ message: err.message });
  }
});

/**
 * POST /bookings - Create a new booking
 */
router.post('/', async (req, res) => {
  try {
    // Validate required fields
    const requiredFields = [
      'guest_name',
      'booked_room_no',
      'checkin_date',
      'checkout_date',
      'phone_no',
      'adult_count'
    ];
    for (const field of requiredFields) {
      if (!req.body[field]) {
        return res.status(400).json({ message: `Missing required field: ${field}` });
      }
    }

    // Validate status
    const validStatuses = ['pending', 'paid', 'cancelled', 'advance_paid'];
    if (req.body.status && !validStatuses.includes(req.body.status.toLowerCase())) {
      console.error('Invalid status:', req.body.status);
      return res.status(400).json({ message: 'Invalid status. Must be pending, paid, cancelled, or advance_paid.' });
    }

    // Create booking
    const booking = new Booking({
      guest_nic: req.body.guest_nic || null,
      guest_name: req.body.guest_name,
      booked_room_no: req.body.booked_room_no,
      checkin_date: req.body.checkin_date,
      checkout_date: req.body.checkout_date,
      phone_no: req.body.phone_no,
      adult_count: req.body.adult_count,
      child_count: req.body.child_count || 0,
      guest_address: req.body.guest_address || '',
      total_price: req.body.total_price || 0,
      special_notes: req.body.special_notes || '',
      advance_amount: req.body.advance_amount || 0,
      birthday: req.body.birthday || null,
      food: req.body.food || 0,
      status: req.body.status ? req.body.status.toLowerCase() : 'pending',
      deleted: false
    });

    await booking.save();
    console.log('✅ Booking saved:', booking._id);

    // Send SMS if status is advance_paid
    if (booking.status === 'advance_paid') {
      console.log('📨 Triggering advance paid SMS for new booking');
      
      // Get base URL from environment - use production URL
      const baseUrl = process.env.BASE_URL || 'https://zonova-mist.onrender.com';
      
      const invoiceLink = `${baseUrl}/invoice/${booking._id}`;
      
      try {
        await sendAdvancePaidSMS(
          booking.phone_no,
          booking.guest_name,
          booking.booked_room_no,
          booking.advance_amount,
          invoiceLink
        );
        console.log('✅ Advance paid SMS sent for new booking');
      } catch (smsErr) {
        console.error('⚠️ Failed to send SMS, but booking created:', smsErr.message);
        // Don't fail the booking creation if SMS fails
      }
    }

    res.status(201).json(booking);
  } catch (err) {
    console.error('❌ Booking creation error:', err.message);
    res.status(400).json({ message: err.message });
  }
});

/**
 * PATCH /bookings/:id - Update booking
 */
router.patch('/:id', async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      console.error('Booking not found for ID:', req.params.id);
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Prevent updating deleted bookings
    if (booking.deleted) {
      return res.status(400).json({ message: 'Cannot update a deleted booking' });
    }

    // Validate status
    const validStatuses = ['pending', 'paid', 'cancelled', 'advance_paid'];
    if (req.body.status && !validStatuses.includes(req.body.status.toLowerCase())) {
      console.error('Invalid status:', req.body.status);
      return res.status(400).json({ message: 'Invalid status. Must be pending, paid, cancelled, or advance_paid.' });
    }

    const previousStatus = booking.status;
    
    // Update booking fields
    Object.assign(booking, {
      ...req.body,
      status: req.body.status ? req.body.status.toLowerCase() : booking.status,
    });

    await booking.save();
    console.log('✅ Booking updated:', booking._id);

    // Send SMS when status changes TO advance_paid FROM any other status
    if (booking.status === 'advance_paid' && previousStatus !== 'advance_paid') {
      console.log('📨 Status changed to advance_paid, sending invoice SMS');
      
      // Get base URL from environment
      const baseUrl = process.env.BASE_URL || 
                      process.env.BACKEND_URL || 
                      `http://localhost:${process.env.PORT || 3000}`;
      
      const invoiceLink = `${baseUrl}/invoice/${booking._id}`;
      
      try {
        await sendAdvancePaidSMS(
          booking.phone_no,
          booking.guest_name,
          booking.booked_room_no,
          booking.advance_amount,
          invoiceLink
        );
        console.log('✅ Advance paid invoice SMS sent successfully');
      } catch (smsErr) {
        console.error('⚠️ Failed to send SMS:', smsErr.message);
        // Don't fail the update if SMS fails
      }
    }

    res.json(booking);
  } catch (err) {
    console.error('❌ Booking update error:', err.message);
    res.status(400).json({ message: err.message });
  }
});

/**
 * DELETE /bookings/:id - Soft delete a booking
 */
router.delete('/:id', async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      console.error('Booking not found for ID:', req.params.id);
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (booking.deleted) {
      return res.status(400).json({ message: 'Booking is already deleted' });
    }

    booking.deleted = true;
    booking.deletedAt = new Date();

    await booking.save();
    console.log('✅ Booking soft deleted:', booking._id);
    
    res.json({ 
      message: 'Booking deleted successfully',
      booking: booking 
    });
  } catch (err) {
    console.error('❌ Booking deletion error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

/**
 * POST /bookings/:id/restore - Restore a soft-deleted booking
 */
router.post('/:id/restore', async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (!booking.deleted) {
      return res.status(400).json({ message: 'Booking is not deleted' });
    }

    booking.deleted = false;
    booking.deletedAt = null;
    booking.deletedBy = null;

    await booking.save();
    console.log('✅ Booking restored:', booking._id);
    
    res.json({ 
      message: 'Booking restored successfully',
      booking: booking 
    });
  } catch (err) {
    console.error('❌ Booking restoration error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

/**
 * DELETE /bookings/:id/permanent - Permanently delete a booking
 */
router.delete('/:id/permanent', async (req, res) => {
  try {
    const booking = await Booking.findByIdAndDelete(req.params.id);
    if (!booking) {
      console.error('Booking not found for ID:', req.params.id);
      return res.status(404).json({ message: 'Booking not found' });
    }
    console.log('✅ Booking permanently deleted:', booking._id);
    res.json({ message: 'Booking permanently deleted' });
  } catch (err) {
    console.error('❌ Booking permanent deletion error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;