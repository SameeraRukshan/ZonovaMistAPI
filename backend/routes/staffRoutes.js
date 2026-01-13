const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const staffController = require('../controllers/staffController');

// Apply auth middleware to all routes
router.use(authMiddleware);

/**
 * @swagger
 * tags:
 *   name: Staff
 *   description: Staff management endpoints
 */

/**
 * @swagger
 * /api/staff/roles:
 *   get:
 *     summary: Get all available staff roles
 *     description: Retrieve a list of all available roles that can be assigned to staff members
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of roles retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 roles:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: [manager, receptionist, housekeeper, chef, security, maintenance]
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
router.get('/roles', staffController.getRoles);

/**
 * @swagger
 * /api/staff/stats/summary:
 *   get:
 *     summary: Get staff statistics summary
 *     description: Retrieve statistics including count by role and status
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Staff statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 stats:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       example: 25
 *                     byRole:
 *                       type: object
 *                       additionalProperties:
 *                         type: integer
 *                       example:
 *                         manager: 2
 *                         receptionist: 5
 *                         housekeeper: 10
 *                     byStatus:
 *                       type: object
 *                       properties:
 *                         active:
 *                           type: integer
 *                           example: 20
 *                         inactive:
 *                           type: integer
 *                           example: 3
 *                         on_leave:
 *                           type: integer
 *                           example: 2
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
router.get('/stats/summary', staffController.getStatsSummary);

/**
 * @swagger
 * /api/staff:
 *   get:
 *     summary: Get all staff members
 *     description: Retrieve all staff members with optional filtering by role, status, or search term
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [manager, receptionist, housekeeper, chef, security, maintenance]
 *         description: Filter by staff role
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, on_leave]
 *         description: Filter by staff status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for name, email, or phone
 *     responses:
 *       200:
 *         description: List of staff members retrieved successfully
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
 *                   email:
 *                     type: string
 *                   phone:
 *                     type: string
 *                   role:
 *                     type: string
 *                   status:
 *                     type: string
 *                   joiningDate:
 *                     type: string
 *                     format: date
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
router.get('/', staffController.getAllStaff);

/**
 * @swagger
 * /api/staff/{id}:
 *   get:
 *     summary: Get staff member by ID
 *     description: Retrieve a single staff member by their ID
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Staff member ID
 *     responses:
 *       200:
 *         description: Staff member retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 email:
 *                   type: string
 *                 phone:
 *                   type: string
 *                 role:
 *                   type: string
 *                 status:
 *                   type: string
 *                 joiningDate:
 *                   type: string
 *                   format: date
 *                 salary:
 *                   type: number
 *                 address:
 *                   type: string
 *                 emergencyContact:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     phone:
 *                       type: string
 *                     relationship:
 *                       type: string
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       404:
 *         description: Staff member not found
 *       500:
 *         description: Internal server error
 */
router.get('/:id', staffController.getStaffById);

/**
 * @swagger
 * /api/staff:
 *   post:
 *     summary: Create a new staff member
 *     description: Add a new staff member to the system
 *     tags: [Staff]
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
 *               - email
 *               - phone
 *               - role
 *             properties:
 *               name:
 *                 type: string
 *                 description: Full name of the staff member
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email address
 *               phone:
 *                 type: string
 *                 description: Phone number
 *               role:
 *                 type: string
 *                 enum: [manager, receptionist, housekeeper, chef, security, maintenance]
 *                 description: Staff role
 *               status:
 *                 type: string
 *                 enum: [active, inactive, on_leave]
 *                 default: active
 *                 description: Employment status
 *               joiningDate:
 *                 type: string
 *                 format: date
 *                 description: Date of joining
 *               salary:
 *                 type: number
 *                 description: Monthly salary
 *               address:
 *                 type: string
 *                 description: Home address
 *               emergencyContact:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                   phone:
 *                     type: string
 *                   relationship:
 *                     type: string
 *     responses:
 *       201:
 *         description: Staff member created successfully
 *       400:
 *         description: Bad request - Invalid input or email already exists
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
router.post('/', staffController.createStaff);

/**
 * @swagger
 * /api/staff/{id}:
 *   patch:
 *     summary: Update a staff member
 *     description: Partially update an existing staff member's information
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Staff member ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               phone:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [manager, receptionist, housekeeper, chef, security, maintenance]
 *               status:
 *                 type: string
 *                 enum: [active, inactive, on_leave]
 *               salary:
 *                 type: number
 *               address:
 *                 type: string
 *               emergencyContact:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                   phone:
 *                     type: string
 *                   relationship:
 *                     type: string
 *     responses:
 *       200:
 *         description: Staff member updated successfully
 *       400:
 *         description: Bad request - Invalid input
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       404:
 *         description: Staff member not found
 *       500:
 *         description: Internal server error
 */
router.patch('/:id', staffController.updateStaff);

/**
 * @swagger
 * /api/staff/{id}:
 *   delete:
 *     summary: Delete a staff member
 *     description: Remove a staff member from the system
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Staff member ID
 *     responses:
 *       200:
 *         description: Staff member deleted successfully
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       404:
 *         description: Staff member not found
 *       500:
 *         description: Internal server error
 */
router.delete('/:id', staffController.deleteStaff);

module.exports = router;