// routes/bookingRoutes.js
const express = require('express');
const router = express.Router();
const Booking = require('../models/booking');
const { sendBookingSMS } = require('../models/smsService');

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
 *                     example: "paid"
 *       500:
 *         description: Server error
 */
router.get('/', async (req, res) => {
  try {
    const bookings = await Booking.find();
    res.json(bookings);
  } catch (err) {
    console.error('Error fetching bookings:', err.message);
    res.status(500).json({ message: err.message });
  }
});

/**
 * @swagger
 * /bookings:
 *   post:
 *     summary: Create a new booking
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
 *                 example: "pending"
 *     responses:
 *       201:
 *         description: Booking created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Booking'
 *       400:
 *         description: Invalid input / Booking creation failed
 */
router.post('/', async (req, res) => {
  try {
    const validStatuses = ['pending', 'paid', 'cancelled'];
    if (req.body.status && !validStatuses.includes(req.body.status.toLowerCase())) {
      console.error('Invalid status:', req.body.status);
      return res.status(400).json({ message: 'Invalid status. Must be pending, paid, or cancelled.' });
    }
    const booking = new Booking({
      ...req.body,
      status: req.body.status ? req.body.status.toLowerCase() : 'pending',
    });
    await booking.save();
    console.log('Booking saved:', booking);
    if (booking.status === 'paid') {
      console.log('Triggering SMS for new booking:', booking.phone_no);
      await sendBookingSMS(
        booking.phone_no,
        booking.guest_name,
        booking.booked_room_no,
        booking.checkin_date
      );
      console.log('SMS sent for new booking:', booking._id);
    }
    res.status(201).json(booking);
  } catch (err) {
    console.error('Booking creation error:', err.message);
    res.status(400).json({ message: err.message });
  }
});

/**
 * @swagger
 * /bookings/{id}:
 *   patch:
 *     summary: Update an existing booking and send SMS if status changes to paid
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
 *       404:
 *         description: Booking not found
 */
router.patch('/:id', async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      console.error('Booking not found for ID:', req.params.id);
      return res.status(404).json({ message: 'Booking not found' });
    }

    const validStatuses = ['pending', 'paid', 'cancelled'];
    if (req.body.status && !validStatuses.includes(req.body.status.toLowerCase())) {
      console.error('Invalid status:', req.body.status);
      return res.status(400).json({ message: 'Invalid status. Must be pending, paid, or cancelled.' });
    }

    const updates = {
      ...req.body,
      status: req.body.status ? req.body.status.toLowerCase() : booking.status,
    };
    const previousStatus = booking.status;

    Object.assign(booking, updates);
    await booking.save();
    console.log('Booking updated:', booking);

    if (updates.status === 'paid' && previousStatus !== 'paid') {
      console.log('Triggering SMS for booking ID:', req.params.id, 'to:', booking.phone_no);
      await sendBookingSMS(
        booking.phone_no,
        booking.guest_name,
        booking.booked_room_no,
        booking.checkin_date
      );
      console.log('SMS sent successfully for booking ID:', req.params.id);
    }

    res.json(booking);
  } catch (err) {
    console.error('Booking update error:', err.message);
    res.status(400).json({ message: err.message });
  }
});

/**
 * @swagger
 * /bookings/{id}:
 *   delete:
 *     summary: Delete a booking
 *     tags: [Bookings]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Booking ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Booking deleted successfully
 *       404:
 *         description: Booking not found
 *       500:
 *         description: Server error
 */
router.delete('/:id', async (req, res) => {
  try {
    const booking = await Booking.findByIdAndDelete(req.params.id);
    if (!booking) {
      console.error('Booking not found for ID:', req.params.id);
      return res.status(404).json({ message: 'Booking not found' });
    }
    console.log('Booking deleted:', booking);
    res.json({ message: 'Booking deleted successfully' });
  } catch (err) {
    console.error('Booking deletion error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;