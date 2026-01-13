const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const invoiceController = require('../controllers/invoiceController');

/**
 * @swagger
 * tags:
 *   name: Invoices
 *   description: Invoice generation and management endpoints
 */

/**
 * @swagger
 * /api/invoices/send-invoice-sms:
 *   post:
 *     summary: Send invoice via SMS
 *     description: Send an invoice link to the customer via SMS
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - bookingId
 *               - phoneNumber
 *             properties:
 *               bookingId:
 *                 type: string
 *                 description: ID of the booking to generate invoice for
 *               phoneNumber:
 *                 type: string
 *                 description: Customer phone number to send SMS
 *               message:
 *                 type: string
 *                 description: Custom message to include with the invoice link
 *     responses:
 *       200:
 *         description: Invoice SMS sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 invoiceUrl:
 *                   type: string
 *       400:
 *         description: Bad request - Missing required fields
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       404:
 *         description: Booking not found
 *       500:
 *         description: Internal server error
 */
router.post('/send-invoice-sms', authMiddleware, invoiceController.sendInvoiceSMS);

/**
 * @swagger
 * /api/invoices/{bookingId}:
 *   get:
 *     summary: Get invoice by booking ID
 *     description: Retrieve invoice data for a specific booking (public route for guests)
 *     tags: [Invoices]
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID to get invoice for
 *     responses:
 *       200:
 *         description: Invoice data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 invoice:
 *                   type: object
 *                   properties:
 *                     invoiceNumber:
 *                       type: string
 *                     bookingId:
 *                       type: string
 *                     customerName:
 *                       type: string
 *                     customerPhone:
 *                       type: string
 *                     services:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           name:
 *                             type: string
 *                           price:
 *                             type: number
 *                     totalAmount:
 *                       type: number
 *                     date:
 *                       type: string
 *                       format: date-time
 *                     status:
 *                       type: string
 *                       enum: [paid, pending, cancelled]
 *       404:
 *         description: Booking or invoice not found
 *       500:
 *         description: Internal server error
 */
router.get('/:bookingId', invoiceController.getInvoiceByBookingId);

module.exports = router;