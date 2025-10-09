const express = require('express');
const router = express.Router();
const Hotel = require('../models/hotel');

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

router.get('/:id', async (req, res) => {
  try {
    const hotel = await Hotel.findById(req.params.id);
    if (!hotel) return res.status(404).json({ message: 'Hotel not found' });
    res.json(hotel);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const hotel = new Hotel({
      ...req.body,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const newHotel = await hotel.save();
    res.status(201).json(newHotel);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const updateData = { ...req.body, updatedAt: new Date() };
    const hotel = await Hotel.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );
    if (!hotel) {
      return res.status(404).json({ message: 'Hotel not found' });
    }
    res.json(hotel);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update hotel', error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const hotel = await Hotel.findByIdAndDelete(req.params.id);
    if (!hotel) {
      return res.status(404).json({ message: 'Hotel not found' });
    }
    res.json({ message: 'Hotel deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete hotel', error: err.message });
  }
});

module.exports = router;