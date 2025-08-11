const express = require('express');
const router = express.Router();
const { getRooms } = require('../controllers/roomController');
const verifyToken = require('../middleware/authMiddleware');

// Protected route - fetch rooms
router.get('/', verifyToken, getRooms);

module.exports = router;
