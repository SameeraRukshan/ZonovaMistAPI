const express = require('express');
const router = express.Router();
const Hotel = require('../models/hotel');
const authMiddleware = require('../middleware/authMiddleware');
const { addTenantId } = require('../middleware/authMiddleware');

// Apply auth middleware to all routes
router.use(authMiddleware);

// GET all hotels
router.get('/', async (req, res) => {
  try {
    const { city, starRating } = req.query;
    
    // Start with tenant filter
    let query = { ...req.tenantFilter };
    
    if (city) query['location.city'] = city;
    if (starRating) query.starRating = starRating;
    
    const hotels = await Hotel.find(query).sort({ createdAt: -1 });
    res.json(hotels);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET hotel by ID
router.get('/:id', async (req, res) => {
  try {
    const hotel = await Hotel.findOne({ 
      _id: req.params.id, 
      ...req.tenantFilter 
    });
    if (!hotel) return res.status(404).json({ message: 'Hotel not found' });
    res.json(hotel);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST add hotel
router.post('/', async (req, res) => {
  try {
    const { name, location, phone } = req.body;

    if (!name || !location?.city || !phone) {
      return res.status(400).json({ message: 'Name, City, and Phone are required' });
    }

    // Add clientId to hotel data
    const hotelData = addTenantId(req, {
      ...req.body,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const hotel = new Hotel(hotelData);
    const newHotel = await hotel.save();
    res.status(201).json(newHotel);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PATCH update hotel
router.patch('/:id', async (req, res) => {
  try {
    const updateData = { ...req.body, updatedAt: new Date() };

    // Prevent clientId modification
    delete updateData.clientId;

    // If location is being updated, ensure city/address keys
    if (updateData.location) {
      updateData.location.city = updateData.location.city || '';
      updateData.location.address = updateData.location.address || '';
    }

    const hotel = await Hotel.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter },
      updateData,
      { new: true }
    );
    if (!hotel) return res.status(404).json({ message: 'Hotel not found' });
    res.json(hotel);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update hotel', error: err.message });
  }
});

// DELETE hotel
router.delete('/:id', async (req, res) => {
  try {
    const hotel = await Hotel.findOneAndDelete({ 
      _id: req.params.id, 
      ...req.tenantFilter 
    });
    if (!hotel) return res.status(404).json({ message: 'Hotel not found' });
    res.json({ message: 'Hotel deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete hotel', error: err.message });
  }
});

module.exports = router;
