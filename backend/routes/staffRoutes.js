const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const staffController = require('../controllers/staffController');

// Apply auth middleware to all routes
router.use(authMiddleware);

/**
 * GET /staff/roles - Get all available staff roles
 */
router.get('/roles', staffController.getRoles);

/**
 * GET /staff/stats/summary - Get staff statistics
 * Returns count by role and status
 * Note: This must be defined BEFORE /:id route
 */
router.get('/stats/summary', staffController.getStatsSummary);

/**
 * GET /staff - Fetch all staff with optional filtering
 * Query params:
 * - role: filter by role
 * - status: filter by status (active, inactive, on_leave)
 * - search: search term for name, email, or phone
 */
router.get('/', staffController.getAllStaff);

/**
 * GET /staff/:id - Get single staff member by ID
 */
router.get('/:id', staffController.getStaffById);

/**
 * POST /staff - Create a new staff member
 */
router.post('/', staffController.createStaff);

/**
 * PATCH /staff/:id - Update staff member
 */
router.patch('/:id', staffController.updateStaff);

/**
 * DELETE /staff/:id - Delete a staff member
 */
router.delete('/:id', staffController.deleteStaff);

module.exports = router;