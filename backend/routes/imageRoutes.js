const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const multer = require('multer'); 

// Models
const Room = require('../models/room');
const Hotel = require('../models/hotel'); 

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
    const entityId = req.body.roomId || req.body.hotelId; // works for both
    const extension = path.extname(file.originalname);
    cb(null, `${entityId}_${Date.now()}${extension}`);
  }
});

const upload = multer({ storage: storage });

/**
 * ===============================
 * ROOM IMAGE UPLOAD
 * ===============================
 */
router.post('/upload/room', upload.array('photos', 10), async (req, res) => {
  try {
    const roomId = req.body.roomId;
    const files = req.files;

    if (!roomId || !files || files.length === 0) {
      return res.status(400).json({ message: 'Room ID and at least one image are required.' });
    }

    if (!mongoose.Types.ObjectId.isValid(roomId)) {
      return res.status(400).json({ message: 'Invalid Room ID.' });
    }

    const photoPaths = files.map(file => file.filename);

    const room = await Room.findByIdAndUpdate(
      roomId,
      { $push: { photos: { $each: photoPaths } } },
      { new: true, runValidators: true }
    );

    if (!room) {
      return res.status(404).json({ message: 'Room not found.' });
    }

    res.status(200).json({ 
      message: 'Room images uploaded successfully',
      photoUrls: photoPaths
    });

  } catch (error) {
    console.error('Error uploading room images:', error);
    res.status(500).json({ message: 'Server error occurred.' });
  }
});

/**
 * ===============================
 * HOTEL IMAGE UPLOAD
 * ===============================
 */
router.post('/upload/hotel', upload.array('photos', 10), async (req, res) => {
  console.log('Received request to /api/images/upload/hotel');
  console.log('Body:', req.body);
  console.log('Files:', req.files);
  console.log('Hotel ID:', req.body.hotelId);
  try {
    const hotelId = req.body.hotelId;
    console.log('Hotel ID:', hotelId);
    const files = req.files;

    if (!hotelId || !files || files.length === 0) {
      return res.status(400).json({ message: 'Hotel ID and at least one image are required.' });
    }

    if (!mongoose.Types.ObjectId.isValid(hotelId)) {
      return res.status(400).json({ message: 'Invalid Hotel ID.' });
    }

    const photoPaths = files.map(file => file.filename);

    const hotel = await Hotel.findByIdAndUpdate(
      hotelId,
      { $push: { photos: { $each: photoPaths } } },
      { new: true, runValidators: true }
    );

    if (!hotel) {
      return res.status(404).json({ message: 'Hotel not found.' });
    }

    res.status(200).json({ 
      message: 'Hotel images uploaded successfully',
      photoUrls: photoPaths
    });

  } catch (error) {
    console.error('Error uploading hotel images:', error);
    res.status(500).json({ message: 'Server error occurred.' });
  }
});

module.exports = router;