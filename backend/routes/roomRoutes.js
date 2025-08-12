const express = require('express');
const router = express.Router();
const Room = require('../models/room'); // create this model

// GET all rooms
router.get('/', async (req, res) => {
  try {
    const rooms = await Room.find();
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
