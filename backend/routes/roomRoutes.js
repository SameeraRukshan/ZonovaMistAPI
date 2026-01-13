const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const roomController = require('../controllers/roomController');

// Apply auth middleware to all routes
router.use(authMiddleware);

// GET /rooms - Get all rooms
router.get('/', roomController.getAllRooms);

// GET /rooms/available - Get available rooms for a date range (must be before /:id)
router.get('/available', roomController.getAvailableRooms);

// GET /rooms/:id - Get room by ID
router.get('/:id', roomController.getRoomById);

// POST /rooms - Create room
router.post('/', roomController.createRoom);

// PATCH /rooms/:id - Update room
router.patch('/:id', roomController.updateRoom);

// DELETE /rooms/:id - Delete room
router.delete('/:id', roomController.deleteRoom);

module.exports = router;