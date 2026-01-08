const express = require('express');
const router = express.Router();
const Room = require('../models/room');
const Booking = require('../models/booking');
const authMiddleware = require('../middleware/authMiddleware');
const { addTenantId } = require('../middleware/authMiddleware');

// Apply auth middleware to all routes
router.use(authMiddleware);

// GET all rooms
router.get('/', async (req, res) => {
  try {
    const rooms = await Room.find(req.tenantFilter).sort({ roomNumber: 1 });
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * GET /rooms/available - Get available rooms for a date range
 * Query params: checkinDate, checkoutDate, excludeBookingId 
 */
router.get('/available', async (req, res) => {
  try {
    const { checkinDate, checkoutDate, excludeBookingId } = req.query;

    if (!checkinDate || !checkoutDate) {
      return res.status(400).json({ 
        message: 'checkinDate and checkoutDate are required' 
      });
    }

    const checkin = new Date(checkinDate);
    const checkout = new Date(checkoutDate);

    if (isNaN(checkin.getTime()) || isNaN(checkout.getTime())) {
      return res.status(400).json({ 
        message: 'Invalid date format' 
      });
    }

    if (checkin >= checkout) {
      return res.status(400).json({ 
        message: 'Check-out date must be after check-in date' 
      });
    }

    // Get all rooms for this client
    const allRooms = await Room.find(req.tenantFilter).sort({ roomNumber: 1 });

    // Build query for overlapping bookings (only for this client)
    const bookingQuery = {
      ...req.tenantFilter,
      deleted: { $ne: true },
      status: { $ne: 'cancelled' },
      checkin_date: { $lt: checkout },
      checkout_date: { $gt: checkin }
    };

    // Exclude specific booking if editing
    if (excludeBookingId) {
      bookingQuery._id = { $ne: excludeBookingId };
    }

    // Find all overlapping bookings for this client
    const overlappingBookings = await Booking.find(bookingQuery);

    // Extract booked room numbers
    const bookedRoomNumbers = new Set();
    overlappingBookings.forEach(booking => {
      const rooms = booking.booked_room_no.split(',').map(r => r.trim());
      rooms.forEach(room => bookedRoomNumbers.add(room));
    });

    // Categorize rooms
    const availableRooms = [];
    const unavailableRooms = [];

    allRooms.forEach(room => {
      const roomData = {
        _id: room._id,
        roomNumber: room.roomNumber,
        floor: room.floor,
        type: room.type,
        bedCount: room.bedCount,
        maxOccupancy: room.maxOccupancy,
        pricePerNight: room.pricePerNight,
        status: room.status,
        amenities: room.amenities
      };

      // Check if room is available (not booked and not in maintenance)
      if (bookedRoomNumbers.has(room.roomNumber) || room.status === 'maintenance') {
        unavailableRooms.push({
          ...roomData,
          unavailableReason: bookedRoomNumbers.has(room.roomNumber) ? 'booked' : 'maintenance'
        });
      } else {
        availableRooms.push(roomData);
      }
    });

    res.json({
      checkinDate: checkin,
      checkoutDate: checkout,
      available: availableRooms,
      unavailable: unavailableRooms,
      summary: {
        total: allRooms.length,
        available: availableRooms.length,
        unavailable: unavailableRooms.length
      }
    });

  } catch (err) {
    console.error('❌ Error fetching available rooms:', err);
    res.status(500).json({ 
      message: 'Failed to fetch available rooms',
      error: err.message 
    });
  }
});

// GET room by ID
router.get('/:id', async (req, res) => {
  try {
    const room = await Room.findOne({ 
      _id: req.params.id, 
      ...req.tenantFilter 
    });
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }
    res.json(room);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH update room
router.patch('/:id', async (req, res) => {
  try {
    // Prevent clientId modification
    delete req.body.clientId;
    
    const updateData = { ...req.body, updatedAt: new Date() };
    const room = await Room.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter },
      updateData,
      { new: true }
    );
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }
    res.json(room);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update room', error: err.message });
  }
});

// POST create room
router.post('/', async (req, res) => {
  try {
    const { roomNumber, floor, type, bedCount, maxOccupancy, pricePerNight, status, amenities } = req.body;
    
    // Add clientId to room data
    const roomData = addTenantId(req, {
      roomNumber,
      floor,
      type,
      bedCount,
      maxOccupancy,
      pricePerNight,
      status,
      amenities,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    const room = new Room(roomData);
    const newRoom = await room.save();
    res.status(201).json(newRoom);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE room
router.delete('/:id', async (req, res) => {
  try {
    const room = await Room.findOneAndDelete({ 
      _id: req.params.id, 
      ...req.tenantFilter 
    });
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }
    res.json({ message: 'Room deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete room', error: err.message });
  }
});

module.exports = router;