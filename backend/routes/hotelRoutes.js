const express = require('express');
const router = express.Router();
const Hotel = require('../models/hotel');
const fs = require('fs');
const path = require('path');

/**
 * @swagger
 * tags:
 *   name: Hotels
 *   description: Hotel management
 */

// GET all hotels
/**
 * @swagger
 * /hotels:
 *   get:
 *     summary: Get all hotels
 *     tags: [Hotels]
 *     parameters:
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *         description: Filter by city
 *       - in: query
 *         name: starRating
 *         schema:
 *           type: number
 *         description: Filter by star rating
 *     responses:
 *       200:
 *         description: A list of hotels
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Hotel'
 *       500:
 *         description: Server error
 */
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

// GET single hotel
/**
 * @swagger
 * /hotels/{id}:
 *   get:
 *     summary: Get a hotel by ID
 *     tags: [Hotels]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Hotel details
 *       404:
 *         description: Hotel not found
 */
router.get('/:id', async (req, res) => {
  try {
    const hotel = await Hotel.findById(req.params.id);
    if (!hotel) return res.status(404).json({ message: 'Hotel not found' });
    res.json(hotel);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST create a new hotel
/**
 * @swagger
 * /hotels:
 *   post:
 *     summary: Create a new hotel
 *     tags: [Hotels]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Hotel'
 *     responses:
 *       201:
 *         description: Hotel created successfully
 *       400:
 *         description: Invalid input
 */
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

// PATCH update hotel
/**
 * @swagger
 * /hotels/{id}:
 *   patch:
 *     summary: Update hotel details
 *     tags: [Hotels]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Hotel'
 *     responses:
 *       200:
 *         description: Hotel updated successfully
 *       404:
 *         description: Hotel not found
 */
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

// DELETE hotel
/**
 * @swagger
 * /hotels/{id}:
 *   delete:
 *     summary: Delete a hotel
 *     tags: [Hotels]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Hotel deleted successfully
 *       404:
 *         description: Hotel not found
 */
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

// OPTIONAL: serve hotel images
router.get('/image/:filename', (req, res) => {
  const fileName = req.params.filename;
  const imagePath = path.join(__dirname, "../uploads", fileName);
  console.log('Serving image from path:', imagePath);

  if (!fs.existsSync(imagePath)) {
    return res.status(404).send('Image not found');
  }

  const stat = fs.statSync(imagePath);
  res.writeHead(200, {
    'Content-Type': 'image/jpeg',
    'Content-Length': stat.size,
  });

  const readStream = fs.createReadStream(imagePath);
  readStream.pipe(res);
});

module.exports = router;
