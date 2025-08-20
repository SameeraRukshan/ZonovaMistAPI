const express = require('express');
const router = express.Router();
const Booking = require('../models/booking');
const { sendBookingSMS } = require('../models/smsService'); // <-- Correct import

// Get all bookings
router.get('/', async (req, res) => {
  try {
    const bookings = await Booking.find();
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create new booking and send SMS
router.post('/', async (req, res) => {
  try {
    const booking = new Booking(req.body);
    await booking.save();

    console.log("Booking saved:", booking);

    // Send SMS immediately after booking
    console.log("Sending SMS to:", booking.phone_no);
    sendBookingSMS(
      booking.phone_no,
      booking.guest_name,
      booking.booked_room_no,
      booking.checkin_date
    )
      .then(response => console.log("SMS response:", response))
      .catch(err => console.error("SMS error:", err));

    res.status(201).json(booking);
  } catch (err) {
    console.error("Booking creation error:", err);
    res.status(400).json({ message: err.message });
  }
});

// Update booking
router.patch('/:id', async (req, res) => {
  try {
    const booking = await Booking.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(booking);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
