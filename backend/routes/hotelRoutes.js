const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { staffReadOnly } = require('../middleware/authMiddleware');
const hotelController = require('../controllers/hotelController');

// Apply auth middleware to all routes
router.use(authMiddleware);

/**
 * @swagger
 * tags:
 *   name: Hotels
 *   description: Hotel management endpoints
 */

/**
 * @swagger
 * /api/hotels:
 *   get:
 *     summary: Get all hotels
 *     description: Retrieve all hotels excluding soft-deleted ones
 *     tags: [Hotels]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of hotels retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   address:
 *                     type: string
 *                   city:
 *                     type: string
 *                   phoneNumber:
 *                     type: string
 *                   email:
 *                     type: string
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
router.get('/', hotelController.getHotels);

/**
 * @swagger
 * /api/hotels/{id}:
 *   get:
 *     summary: Get hotel by ID
 *     description: Retrieve a single hotel by its ID
 *     tags: [Hotels]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Hotel ID
 *     responses:
 *       200:
 *         description: Hotel retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 address:
 *                   type: string
 *                 city:
 *                   type: string
 *                 phoneNumber:
 *                   type: string
 *                 email:
 *                   type: string
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       404:
 *         description: Hotel not found
 *       500:
 *         description: Internal server error
 */
router.get('/:id', hotelController.getHotelById);

/**
 * @swagger
 * /api/hotels:
 *   post:
 *     summary: Create a new hotel
 *     description: Create a new hotel in the system
 *     tags: [Hotels]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 description: Hotel name
 *               address:
 *                 type: string
 *                 description: Hotel address
 *               city:
 *                 type: string
 *                 description: City where hotel is located
 *               state:
 *                 type: string
 *                 description: State or province
 *               country:
 *                 type: string
 *                 description: Country
 *               postalCode:
 *                 type: string
 *                 description: Postal/ZIP code
 *               phoneNumber:
 *                 type: string
 *                 description: Contact phone number
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Contact email
 *               website:
 *                 type: string
 *                 description: Hotel website URL
 *               starRating:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 5
 *                 description: Hotel star rating
 *     responses:
 *       201:
 *         description: Hotel created successfully
 *       400:
 *         description: Bad request - Invalid input
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
router.post('/', staffReadOnly, hotelController.createHotel);

/**
 * @swagger
 * /api/hotels/{id}:
 *   patch:
 *     summary: Update a hotel
 *     description: Partially update an existing hotel
 *     tags: [Hotels]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Hotel ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               address:
 *                 type: string
 *               city:
 *                 type: string
 *               state:
 *                 type: string
 *               country:
 *                 type: string
 *               postalCode:
 *                 type: string
 *               phoneNumber:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               website:
 *                 type: string
 *               starRating:
 *                 type: number
 *     responses:
 *       200:
 *         description: Hotel updated successfully
 *       400:
 *         description: Bad request - Invalid input
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       404:
 *         description: Hotel not found
 *       500:
 *         description: Internal server error
 */
router.patch('/:id', staffReadOnly, hotelController.updateHotel);

/**
 * @swagger
 * /api/hotels/{id}:
 *   delete:
 *     summary: Delete a hotel
 *     description: Soft delete a hotel by its ID
 *     tags: [Hotels]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Hotel ID
 *     responses:
 *       200:
 *         description: Hotel deleted successfully
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       404:
 *         description: Hotel not found
 *       500:
 *         description: Internal server error
 */
router.delete('/:id', staffReadOnly, hotelController.deleteHotel);

module.exports = router;
