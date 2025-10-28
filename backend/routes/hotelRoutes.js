const express = require('express');
const router = express.Router();
const Hotel = require('../models/hotel');

// GET all hotels
router.get('/', async (req, res) => {
  try {
    const { city, starRating } = req.query;
    let query = {};
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
    const hotel = await Hotel.findById(req.params.id);
    if (!hotel) return res.status(404).json({ message: 'Hotel not found' });
    res.json(hotel);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST add hotel
router.post('/', async (req, res) => {
  try {
    const { name, city, phone, address, email, description } = req.body;

    // ✅ Required fields validation
    if (!name || !city || !phone) {
      return res.status(400).json({ message: 'Name, City, and Phone are required' });
    }

    const hotel = new Hotel({
      name: name.trim(),
      location: {
        city: city.trim(),
        address: address?.trim() || '', // optional
      },
      phone: phone.trim(),
      email: email?.trim() || '',       // optional
      description: description?.trim() || '', // optional
      price: 0,
      status: 'available',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

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

    // If location is being updated, ensure city/address keys
    if (updateData.location) {
      updateData.location.city = updateData.location.city || '';
      updateData.location.address = updateData.location.address || '';
    }

    const hotel = await Hotel.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!hotel) return res.status(404).json({ message: 'Hotel not found' });
    res.json(hotel);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update hotel', error: err.message });
  }
});

// DELETE hotel
router.delete('/:id', async (req, res) => {
  try {
    const hotel = await Hotel.findByIdAndDelete(req.params.id);
    if (!hotel) return res.status(404).json({ message: 'Hotel not found' });
    res.json({ message: 'Hotel deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete hotel', error: err.message });
  }
});

module.exports = router;
