const express = require('express');
const router = express.Router();
const Booking = require('../models/booking');
const { sendBookingSMS } = require('../models/smsService'); // <-- Correct import

// Get all bookings

/**
 * @swagger
 * /bookings:
 *   get:
 *     summary: Get all bookings
 *     tags: [Bookings]
 *     responses:
 *       200:
 *         description: List of all bookings
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                     example: 64a1234b56c7890d1234ef56
 *                   guest_name:
 *                     type: string
 *                     example: "Shan Wijesooriya"
 *                   phone_no:
 *                     type: string
 *                     example: "+94771234567"
 *                   booked_room_no:
 *                     type: string
 *                     example: "101"
 *                   checkin_date:
 *                     type: string
 *                     format: date
 *                     example: "2025-08-25"
 *                   status:
 *                     type: string
 *                     example: "Confirmed"
 *       500:
 *         description: Server error
 */
router.get('/', async (req, res) => {
  try {
    const bookings = await Booking.find();
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create new booking and send SMS

/**
 * @swagger
 * /bookings:
 *   post:
 *     summary: Create a new booking and send SMS to guest
 *     tags: [Bookings]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - guest_name
 *               - phone_no
 *               - booked_room_no
 *               - checkin_date
 *             properties:
 *               guest_name:
 *                 type: string
 *                 example: "Shan Wijesooriya"
 *               phone_no:
 *                 type: string
 *                 example: "+94771234567"
 *               booked_room_no:
 *                 type: string
 *                 example: "101"
 *               checkin_date:
 *                 type: string
 *                 format: date
 *                 example: "2025-08-25"
 *               status:
 *                 type: string
 *                 example: "Confirmed"
 *     responses:
 *       201:
 *         description: Booking created successfully and SMS sent
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Booking'
 *       400:
 *         description: Invalid input / Booking creation failed
 */
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

/**
 * @swagger
 * /bookings/{id}:
 *   patch:
 *     summary: Update an existing booking
 *     tags: [Bookings]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Booking ID
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               guest_name:
 *                 type: string
 *               phone_no:
 *                 type: string
 *               booked_room_no:
 *                 type: string
 *               checkin_date:
 *                 type: string
 *                 format: date
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: Booking updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Booking'
 *       400:
 *         description: Invalid input / Update failed
 */
router.patch('/:id', async (req, res) => {
  try {
    const booking = await Booking.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(booking);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
