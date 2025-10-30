// routes/bookingRoutes.js
const express = require('express');
const router = express.Router();
const Booking = require('../models/booking');
const { sendBookingSMS } = require('../models/smsService');

/**
 * GET /bookings - Fetch bookings with filtering
 * Query params:
 * - filter: 'recent' | 'all' | 'today' | 'week' | 'month' | 'upcoming' | 'past'
 * - status: 'pending' | 'paid' | 'cancelled'
 * - search: search term for guest name or room number
 */
router.get('/', async (req, res) => {
  try {
    const { filter = 'recent', status, search } = req.query;
    
    let query = {};
    const now = new Date();
    
    // Date-based filtering
    switch (filter) {
      case 'upcoming':
        // Upcoming check-ins (including today and future)
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        query.checkin_date = { $gte: startOfToday };
        break;
        
      case 'recent':
        // Last 7 days bookings
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        query.createdAt = { $gte: sevenDaysAgo };
        break;
        
      case 'today':
        // Check-ins today
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        query.checkin_date = { $gte: todayStart, $lte: todayEnd };
        break;
        
      case 'week':
        // Current week bookings
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        query.createdAt = { $gte: startOfWeek };
        break;
        
      case 'month':
        // Current month bookings
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        query.createdAt = { $gte: startOfMonth };
        break;
        
      case 'past':
        // Past check-outs
        query.checkout_date = { $lt: new Date() };
        break;
        
      case 'all':
      default:
        // No date filter
        break;
    }
    
    // Status filtering
    if (status && ['pending', 'paid', 'cancelled'].includes(status.toLowerCase())) {
      query.status = status.toLowerCase();
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
    
    const bookings = await Booking.find(query).sort({ createdAt: -1 });
    
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
    // ✅ Validate only required fields
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

    // ✅ Validate status
    const validStatuses = ['pending', 'paid', 'cancelled'];
    if (req.body.status && !validStatuses.includes(req.body.status.toLowerCase())) {
      console.error('Invalid status:', req.body.status);
      return res.status(400).json({ message: 'Invalid status. Must be pending, paid, or cancelled.' });
    }

    // ✅ Create booking (optional fields safely handled)
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
      status: req.body.status ? req.body.status.toLowerCase() : 'pending'
    });

    await booking.save();
    console.log('Booking saved:', booking);

    // ✅ Optional: send SMS if status = paid
    if (booking.status === 'paid') {
      console.log('Triggering SMS for new booking:', booking.phone_no);
      await sendBookingSMS(
        booking.phone_no,
        booking.guest_name,
        booking.booked_room_no,
        booking.checkin_date
      );
      console.log('SMS sent for new booking:', booking._id);
    }

    res.status(201).json(booking);
  } catch (err) {
    console.error('Booking creation error:', err.message);
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

    const validStatuses = ['pending', 'paid', 'cancelled'];
    if (req.body.status && !validStatuses.includes(req.body.status.toLowerCase())) {
      console.error('Invalid status:', req.body.status);
      return res.status(400).json({ message: 'Invalid status. Must be pending, paid, or cancelled.' });
    }

    const previousStatus = booking.status;
    Object.assign(booking, {
      ...req.body,
      status: req.body.status ? req.body.status.toLowerCase() : booking.status,
    });

    await booking.save();
    console.log('Booking updated:', booking);

    if (booking.status === 'paid' && previousStatus !== 'paid') {
      console.log('Triggering SMS for booking ID:', req.params.id);
      await sendBookingSMS(
        booking.phone_no,
        booking.guest_name,
        booking.booked_room_no,
        booking.checkin_date
      );
      console.log('SMS sent successfully for booking ID:', req.params.id);
    }

    res.json(booking);
  } catch (err) {
    console.error('Booking update error:', err.message);
    res.status(400).json({ message: err.message });
  }
});

/**
 * DELETE /bookings/:id - Delete a booking
 */
router.delete('/:id', async (req, res) => {
  try {
    const booking = await Booking.findByIdAndDelete(req.params.id);
    if (!booking) {
      console.error('Booking not found for ID:', req.params.id);
      return res.status(404).json({ message: 'Booking not found' });
    }
    console.log('Booking deleted:', booking);
    res.json({ message: 'Booking deleted successfully' });
  } catch (err) {
    console.error('Booking deletion error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;