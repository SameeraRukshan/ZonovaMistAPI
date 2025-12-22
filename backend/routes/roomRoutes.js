const express = require('express');
const router = express.Router();
const Room = require('../models/room');
<<<<<<< HEAD
const authMiddleware = require('../middleware/authMiddleware');
const { addTenantId } = require('../middleware/authMiddleware');

// Apply auth middleware to all routes
router.use(authMiddleware);

// GET all rooms
=======
>>>>>>> room-rate-new
router.get('/', async (req, res) => {
  try {
    const rooms = await Room.find(req.tenantFilter).sort({ roomNumber: 1 });
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ message: err.message });
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