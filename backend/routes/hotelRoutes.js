const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const hotelController = require('../controllers/hotelController');

// Apply auth middleware to all routes
router.use(authMiddleware);

// GET /hotels - Get all hotels
router.get('/', hotelController.getHotels);

// GET /hotels/:id - Get hotel by ID
router.get('/:id', hotelController.getHotelById);

// POST /hotels - Create hotel
router.post('/', hotelController.createHotel);

// PATCH /hotels/:id - Update hotel
router.patch('/:id', hotelController.updateHotel);

// DELETE /hotels/:id - Delete hotel
router.delete('/:id', hotelController.deleteHotel);

module.exports = router;
