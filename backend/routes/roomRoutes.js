const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { staffReadOnly } = require('../middleware/authMiddleware');
const roomController = require('../controllers/roomController');

// Apply auth middleware to all routes
router.use(authMiddleware);

/**
 * @swagger
 * tags:
 *   name: Rooms
 *   description: Room management endpoints
 */

/**
 * @swagger
 * /api/rooms:
 *   get:
 *     summary: Get all rooms
 *     description: Retrieve all rooms excluding soft-deleted ones
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: hotelId
 *         schema:
 *           type: string
 *         description: Filter rooms by hotel ID
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [single, double, suite, deluxe, family]
 *         description: Filter by room type
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [available, occupied, maintenance, reserved]
 *         description: Filter by room status
 *     responses:
 *       200:
 *         description: List of rooms retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   roomNumber:
 *                     type: string
 *                   type:
 *                     type: string
 *                   price:
 *                     type: number
 *                   status:
 *                     type: string
 *                   hotelId:
 *                     type: string
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
router.get('/', roomController.getAllRooms);

/**
 * @swagger
 * /api/rooms/available:
 *   get:
 *     summary: Get available rooms for a date range
 *     description: Retrieve all rooms that are available for booking within the specified date range
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: checkIn
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Check-in date (YYYY-MM-DD)
 *       - in: query
 *         name: checkOut
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Check-out date (YYYY-MM-DD)
 *       - in: query
 *         name: hotelId
 *         schema:
 *           type: string
 *         description: Filter by hotel ID
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [single, double, suite, deluxe, family]
 *         description: Filter by room type
 *       - in: query
 *         name: guests
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Minimum guest capacity required
 *     responses:
 *       200:
 *         description: List of available rooms retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   roomNumber:
 *                     type: string
 *                   type:
 *                     type: string
 *                   price:
 *                     type: number
 *                   capacity:
 *                     type: integer
 *                   amenities:
 *                     type: array
 *                     items:
 *                       type: string
 *       400:
 *         description: Bad request - checkIn and checkOut dates are required
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
router.get('/available', roomController.getAvailableRooms);

/**
 * @swagger
 * /api/rooms/{id}:
 *   get:
 *     summary: Get room by ID
 *     description: Retrieve a single room by its ID
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Room ID
 *     responses:
 *       200:
 *         description: Room retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 roomNumber:
 *                   type: string
 *                 type:
 *                   type: string
 *                 price:
 *                   type: number
 *                 status:
 *                   type: string
 *                 capacity:
 *                   type: integer
 *                 amenities:
 *                   type: array
 *                   items:
 *                     type: string
 *                 description:
 *                   type: string
 *                 hotelId:
 *                   type: string
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       404:
 *         description: Room not found
 *       500:
 *         description: Internal server error
 */
router.get('/:id', roomController.getRoomById);

/**
 * @swagger
 * /api/rooms:
 *   post:
 *     summary: Create a new room
 *     description: Create a new room in the system
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - roomNumber
 *               - type
 *               - price
 *             properties:
 *               roomNumber:
 *                 type: string
 *                 description: Unique room number/identifier
 *               type:
 *                 type: string
 *                 enum: [single, double, suite, deluxe, family]
 *                 description: Room type
 *               price:
 *                 type: number
 *                 description: Price per night
 *               capacity:
 *                 type: integer
 *                 description: Maximum number of guests
 *               status:
 *                 type: string
 *                 enum: [available, occupied, maintenance, reserved]
 *                 default: available
 *                 description: Current room status
 *               amenities:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: List of room amenities
 *               description:
 *                 type: string
 *                 description: Room description
 *               hotelId:
 *                 type: string
 *                 description: Associated hotel ID
 *     responses:
 *       201:
 *         description: Room created successfully
 *       400:
 *         description: Bad request - Invalid input or room number already exists
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - STAFF users have read-only access
 *       500:
 *         description: Internal server error
 */
// ⚠️ STAFF READ-ONLY: Block STAFF from creating rooms
router.post('/', staffReadOnly, roomController.createRoom);

/**
 * @swagger
 * /api/rooms/{id}:
 *   patch:
 *     summary: Update a room
 *     description: Partially update an existing room
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Room ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               roomNumber:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [single, double, suite, deluxe, family]
 *               price:
 *                 type: number
 *               capacity:
 *                 type: integer
 *               status:
 *                 type: string
 *                 enum: [available, occupied, maintenance, reserved]
 *               amenities:
 *                 type: array
 *                 items:
 *                   type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Room updated successfully
 *       400:
 *         description: Bad request - Invalid input
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - STAFF users have read-only access
 *       404:
 *         description: Room not found
 *       500:
 *         description: Internal server error
 */
// ⚠️ STAFF READ-ONLY: Block STAFF from updating rooms
router.patch('/:id', staffReadOnly, roomController.updateRoom);

/**
 * @swagger
 * /api/rooms/{id}:
 *   delete:
 *     summary: Delete a room
 *     description: Soft delete a room by its ID
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Room ID
 *     responses:
 *       200:
 *         description: Room deleted successfully
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - STAFF users have read-only access
 *       404:
 *         description: Room not found
 *       500:
 *         description: Internal server error
 */
// ⚠️ STAFF READ-ONLY: Block STAFF from deleting rooms
router.delete('/:id', staffReadOnly, roomController.deleteRoom);

module.exports = router;