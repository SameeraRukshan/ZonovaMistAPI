const express = require('express');
const router = express.Router();
const { sendContact } = require('../controllers/contactController');

// Public route — no authentication (website visitors submit inquiries here).
router.post('/', sendContact);

module.exports = router;
