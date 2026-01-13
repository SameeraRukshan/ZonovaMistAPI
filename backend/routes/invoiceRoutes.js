const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const invoiceController = require('../controllers/invoiceController');

// POST /api/invoices/send-invoice-sms (protected route)
router.post('/send-invoice-sms', authMiddleware, invoiceController.sendInvoiceSmS);

// GET /api/invoices/:bookingId - Returns invoice data as JSON (public route for guests)
router.get('/:bookingId', invoiceController.getInvoiceByBookingId);

module.exports = router;