const Hotel = require('../models/hotel');

// ✅ Get all hotels (with optional filters)
const getHotels = async (req, res) => {
  try {
    const { city, starRating } = req.query;
    let query = {};

    if (city) query['location.city'] = city;
    if (starRating) query.starRating = starRating;

    const hotels = await Hotel.find(query).sort({ createdAt: -1 });
    res.json(hotels);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch hotels', error: err.message });
  }
};

// ✅ Get a single hotel by ID
const getHotelById = async (req, res) => {
  try {
    const hotel = await Hotel.findById(req.params.id);
    if (!hotel) return res.status(404).json({ message: 'Hotel not found' });
    res.json(hotel);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch hotel', error: err.message });
  }
};

// ✅ Create a new hotel
const createHotel = async (req, res) => {
  try {
    const newHotel = new Hotel(req.body);
    const savedHotel = await newHotel.save();
    res.status(201).json(savedHotel);
  } catch (err) {
    res.status(400).json({ message: 'Failed to create hotel', error: err.message });
  }
};

// ✅ Update an existing hotel
const updateHotel = async (req, res) => {
  try {
    const updatedHotel = await Hotel.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!updatedHotel) return res.status(404).json({ message: 'Hotel not found' });
    res.json(updatedHotel);
  } catch (err) {
    res.status(400).json({ message: 'Failed to update hotel', error: err.message });
  }
};

// ✅ Delete a hotel
const deleteHotel = async (req, res) => {
  try {
    const deletedHotel = await Hotel.findByIdAndDelete(req.params.id);
    if (!deletedHotel) return res.status(404).json({ message: 'Hotel not found' });
    res.json({ message: 'Hotel deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete hotel', error: err.message });
  }
};

module.exports = {
  getHotels,
  getHotelById,
  createHotel,
  updateHotel,
  deleteHotel,
};
