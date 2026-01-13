// routes/settingsRoutes.js
const express = require('express');
const router = express.Router();
const { getSettings, updateSettings } = require('../controllers/settingsController');
const authMiddleware = require('../middleware/authMiddleware');

// Apply auth middleware to all routes
router.use(authMiddleware);

/**
 * @swagger
 * tags:
 *   name: Settings
 *   description: Application settings and configuration endpoints
 */

/**
 * @swagger
 * /api/settings:
 *   get:
 *     summary: Get application settings
 *     description: Retrieve all application settings and configuration values
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Settings retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 settings:
 *                   type: object
 *                   properties:
 *                     siteName:
 *                       type: string
 *                       example: Zonova Mist
 *                     siteDescription:
 *                       type: string
 *                     maintenanceMode:
 *                       type: boolean
 *                       example: false
 *                     currency:
 *                       type: string
 *                       example: LKR
 *                     timezone:
 *                       type: string
 *                       example: Asia/Colombo
 *                     dateFormat:
 *                       type: string
 *                       example: DD/MM/YYYY
 *                     smsEnabled:
 *                       type: boolean
 *                     emailEnabled:
 *                       type: boolean
 *                     checkInTime:
 *                       type: string
 *                       example: "14:00"
 *                     checkOutTime:
 *                       type: string
 *                       example: "11:00"
 *                     taxRate:
 *                       type: number
 *                       example: 10
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
router.get('/', getSettings);

/**
 * @swagger
 * /api/settings:
 *   post:
 *     summary: Update application settings
 *     description: Update one or more application settings
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               siteName:
 *                 type: string
 *                 description: Application/site name
 *                 example: Zonova Mist
 *               siteDescription:
 *                 type: string
 *                 description: Site description
 *               maintenanceMode:
 *                 type: boolean
 *                 description: Enable/disable maintenance mode
 *                 example: false
 *               currency:
 *                 type: string
 *                 description: Default currency code
 *                 example: LKR
 *               timezone:
 *                 type: string
 *                 description: Application timezone
 *                 example: Asia/Colombo
 *               dateFormat:
 *                 type: string
 *                 description: Date display format
 *                 example: DD/MM/YYYY
 *               smsEnabled:
 *                 type: boolean
 *                 description: Enable/disable SMS notifications
 *               emailEnabled:
 *                 type: boolean
 *                 description: Enable/disable email notifications
 *               checkInTime:
 *                 type: string
 *                 description: Default check-in time
 *                 example: "14:00"
 *               checkOutTime:
 *                 type: string
 *                 description: Default check-out time
 *                 example: "11:00"
 *               taxRate:
 *                 type: number
 *                 description: Tax rate percentage
 *                 example: 10
 *               birthdaySmsTemplate:
 *                 type: string
 *                 description: Template for birthday SMS messages
 *               checkinReminderTemplate:
 *                 type: string
 *                 description: Template for check-in reminder SMS
 *     responses:
 *       200:
 *         description: Settings updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                   example: Settings updated successfully
 *                 settings:
 *                   type: object
 *       400:
 *         description: Bad request - Invalid input
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
router.post('/', updateSettings);

module.exports = router;
