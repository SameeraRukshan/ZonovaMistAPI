const express = require('express');
const router = express.Router();
const { register, login, getProfile, getTest } = require('../controllers/authController');
const verifyToken = require('../middleware/authMiddleware');

// Routes

/**
 * @swagger
 * /register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fullName
 *               - email
 *               - password
 *             properties:
 *               fullName:
 *                 type: string
 *                 example: "Shan Wijesooriya"
 *               email:
 *                 type: string
 *                 example: "shan@example.com"
 *               password:
 *                 type: string
 *                 example: "strongPassword123"
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Email already exists
 *       500:
 *         description: Server error
 */
router.post('/register', register);

/**
 * @swagger
 * /login:
 *   post:
 *     summary: Log in a user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 example: "shan@example.com"
 *               password:
 *                 type: string
 *                 example: "strongPassword123"
 *     responses:
 *       200:
 *         description: Login successful and JWT returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "64a1234b56c7890d1234ef56"
 *                     fullName:
 *                       type: string
 *                       example: "Shan Wijesooriya"
 *                     email:
 *                       type: string
 *                       example: "shan@example.com"
 *       400:
 *         description: Invalid credentials
 *       500:
 *         description: Server error
 */
router.post('/login', login);

/**
 * @swagger
 * /profile:
 *   get:
 *     summary: Get profile of the logged-in user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []  # JWT token required
 *     responses:
 *       200:
 *         description: Returns user profile information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: "64a1234b56c7890d1234ef56"
 *                 fullName:
 *                   type: string
 *                   example: "Shan Wijesooriya"
 *                 email:
 *                   type: string
 *                   example: "shan@example.com"
 *       401:
 *         description: Unauthorized (invalid or missing token)
 *       500:
 *         description: Server error
 */
router.get('/profile', verifyToken, getProfile);

/**
 * @swagger
 * /:
 *   get:
 *     summary: Test endpoint
 *     tags: [Test]
 *     responses:
 *       200:
 *         description: Returns a test response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Test successful"
 *       500:
 *         description: Server error
 */
router.get('/',getTest);

module.exports = router;
