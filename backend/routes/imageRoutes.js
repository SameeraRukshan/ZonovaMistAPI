// routes/imageRoutes.js

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const Room = require('../models/room');
const mongoose = require('mongoose');
const multer = require('multer'); 

// Configure Multer for file storage
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir);
    }
    cb(null, 'uploads/');
  },
  filename: function(req, file, cb) {
    // Generate a unique filename using the room ID and a timestamp
    const roomId = req.body.roomId;
    const extension = path.extname(file.originalname);
    cb(null, `${roomId}_${Date.now()}${extension}`);
  }
});

const upload = multer({ storage: storage });

// @route   POST /api/images/upload
// @desc    Upload multiple images for a specific room
// @access  Public
router.post('/upload', upload.array('photos', 10), async (req, res) => { // 'photos' is the field name, 10 is the max count
  try {
    const roomId = req.body.roomId;
    const files = req.files;

    if (!roomId || !files || files.length === 0) {
      return res.status(400).json({ message: 'Room ID and at least one image are required.' });
    }

    if (!mongoose.Types.ObjectId.isValid(roomId)) {
      return res.status(400).json({ message: 'Invalid Room ID.' });
    }

    const photoPaths = files.map(file => `/uploads/${file.filename}`);

    const room = await Room.findByIdAndUpdate(
      roomId,
      { $push: { photos: { $each: photoPaths } } },
      { new: true, runValidators: true }
    );

    if (!room) {
      return res.status(404).json({ message: 'Room not found.' });
    }

    res.status(200).json({ 
      message: 'Images uploaded successfully',
      photoUrls: photoPaths
    });

  } catch (error) {
    console.error('Error uploading images:', error);
    res.status(500).json({ message: 'Server error occurred.' });
  }
});

module.exports = router;