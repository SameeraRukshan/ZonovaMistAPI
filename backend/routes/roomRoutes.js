const express = require('express');
const router = express.Router();
const Room = require('../models/room'); // create this model
const fs = require('fs');
const path = require('path');

// GET all rooms
/**
 * @swagger
 * /rooms:
 *   get:
 *     summary: Get all rooms
 *     tags: [Rooms]
 *     responses:
 *       200:
 *         description: A list of rooms
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
 *                   roomNumber:
 *                     type: string
 *                     example: "101"
 *                   type:
 *                     type: string
 *                     example: "Deluxe"
 *                   status:
 *                     type: string
 *                     example: "Available"
 *       500:
 *         description: Server error
 */
router.get('/', async (req, res) => {
  try {
    const rooms = await Room.find();
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * @swagger
 * /rooms/{id}:
 *   patch:
 *     summary: Update room status
 *     tags: [Rooms]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Room ID
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 example: "Occupied"
 *     responses:
 *       200:
 *         description: Room updated successfully
 *       400:
 *         description: Invalid input
 *       500:
 *         description: Failed to update room
 */
router.patch('/:id', async (req, res) => {
  try {
    const updateData = { ...req.body, updatedAt: new Date() };

    const room = await Room.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    res.json(room);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update room', error: err.message });
  }
});

// POST create a new room
/**
 * @swagger
 * /rooms:
 *   post:
 *     summary: Create a new room
 *     tags: [Rooms]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - roomNumber
 *               - type
 *               - pricePerNight
 *             properties:
 *               roomNumber:
 *                 type: string
 *                 example: "201"
 *               floor:
 *                 type: number
 *                 example: 2
 *               type:
 *                 type: string
 *                 example: "Suite"
 *               bedCount:
 *                 type: number
 *                 example: 2
 *               maxOccupancy:
 *                 type: number
 *                 example: 4
 *               pricePerNight:
 *                 type: number
 *                 example: 150
 *               status:
 *                 type: string
 *                 example: "Available"
 *               amenities:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["WiFi", "AC", "Mini Bar"]
 *     responses:
 *       201:
 *         description: Room created successfully
 *       400:
 *         description: Invalid input
 *       500:
 *         description: Server error
 */
router.post('/', async (req, res) => {
  try {
    const { roomNumber, floor, type, bedCount, maxOccupancy, pricePerNight, status, amenities } = req.body;

    const room = new Room({
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

    const newRoom = await room.save();
    res.status(201).json(newRoom);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/image/:filename', (req, res) => {
  const fileName = req.params.filename; // extract filename from URL
  const imagePath = path.join(__dirname,"../uploads", fileName);
  console.log('Serving image from path:', imagePath);

  if (!fs.existsSync(imagePath)) {
    return res.status(404).send('Image not found');
  }

  // Get file stats
  const stat = fs.statSync(imagePath);
  res.writeHead(200, {
    'Content-Type': 'image/jpeg', // you can make this dynamic
    'Content-Length': stat.size,
  });

  // Stream file
  const readStream = fs.createReadStream(imagePath);
  readStream.pipe(res);
});

// DELETE room
router.delete('/:id', async (req, res) => {
  try {
    const room = await Room.findByIdAndDelete(req.params.id);

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    res.json({ message: 'Room deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete room', error: err.message });
  }
});

module.exports = router;
