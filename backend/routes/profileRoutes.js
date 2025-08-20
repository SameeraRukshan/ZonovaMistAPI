const express = require('express');
const router = express.Router();
const { createOrUpdateProfile, getMyProfile } = require('../controllers/profileController');
const authMiddleware = require('../middleware/authMiddleware');

// Protected routes
router.post('/', authMiddleware, createOrUpdateProfile);
router.get('/me', authMiddleware, getMyProfile);

module.exports = router;
