const express = require('express');
const router = express.Router();
const { register, login, getProfile, getTest } = require('../controllers/authController');
const verifyToken = require('../middleware/authMiddleware');

// Routes
router.post('/register', register);
router.post('/login', login);
router.get('/profile', verifyToken, getProfile);
router.get('/',getTest);

module.exports = router;
