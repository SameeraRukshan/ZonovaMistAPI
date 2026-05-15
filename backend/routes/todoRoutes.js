const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const {
  getAllTodos,
  getMyTodos,
  getTodosByUser,
  getTodoById,
  createTodo,
  updateTodo,
  completeTodo,
  approveTodo,
  rejectTodo,
  deleteTodo
} = require('../controllers/todoController');
const verifyToken = require('../middleware/authMiddleware');
const { staffReadOnly } = require('../middleware/authMiddleware');

// Multer configuration for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads/'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'todo-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    console.log('File received:', {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    });
    
    // Accept all image types and don't validate MIME type too strictly
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    
    if (file.mimetype.startsWith('image/') || allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      console.error('Invalid file type:', file.mimetype, 'ext:', ext);
      cb(new Error('Only image files are allowed'));
    }
  }
});

/**
 * @swagger
 * tags:
 *   name: Todos
 *   description: Todo/Task management endpoints
 */

// All routes require authentication
router.use(verifyToken);

/**
 * @swagger
 * /api/todos:
 *   get:
 *     summary: Get all todos
 *     description: Retrieve all todos for the current tenant
 *     tags: [Todos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, in_progress, completed, approved, rejected]
 *         description: Filter by todo status
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high, urgent]
 *         description: Filter by priority level
 *       - in: query
 *         name: assignedTo
 *         schema:
 *           type: string
 *         description: Filter by assigned user ID
 *     responses:
 *       200:
 *         description: List of todos retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Todo'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
router.get('/', getAllTodos);

/**
 * @swagger
 * /api/todos/my:
 *   get:
 *     summary: Get my todos
 *     description: Retrieve all todos assigned to the current authenticated user
 *     tags: [Todos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, in_progress, completed, approved, rejected]
 *         description: Filter by todo status
 *     responses:
 *       200:
 *         description: List of user's todos retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Todo'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
router.get('/my', getMyTodos);

/**
 * @swagger
 * /api/todos/user/{userId}:
 *   get:
 *     summary: Get todos by user
 *     description: Retrieve all todos assigned to a specific user
 *     tags: [Todos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID to get todos for
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, in_progress, completed, approved, rejected]
 *         description: Filter by todo status
 *     responses:
 *       200:
 *         description: List of user's todos retrieved successfully
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.get('/user/:userId', getTodosByUser);

/**
 * @swagger
 * /api/todos/{id}:
 *   get:
 *     summary: Get todo by ID
 *     description: Retrieve a single todo by its ID
 *     tags: [Todos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Todo ID
 *     responses:
 *       200:
 *         description: Todo retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Todo'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       404:
 *         description: Todo not found
 *       500:
 *         description: Internal server error
 */
router.get('/:id', getTodoById);

/**
 * @swagger
 * /api/todos:
 *   post:
 *     summary: Create a new todo
 *     description: Create a new todo/task and optionally assign it to a user
 *     tags: [Todos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *                 description: Todo title
 *               description:
 *                 type: string
 *                 description: Detailed description
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, urgent]
 *                 default: medium
 *                 description: Priority level
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *                 description: Due date for the task
 *               assignedTo:
 *                 type: string
 *                 description: User ID to assign the todo to
 *               category:
 *                 type: string
 *                 description: Category or type of todo
 *     responses:
 *       201:
 *         description: Todo created successfully
 *       400:
 *         description: Bad request - Invalid input
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
router.post('/', createTodo);

/**
 * @swagger
 * /api/todos/{id}:
 *   put:
 *     summary: Update a todo
 *     description: Update an existing todo's details
 *     tags: [Todos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Todo ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, urgent]
 *               status:
 *                 type: string
 *                 enum: [pending, in_progress, completed, approved, rejected]
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *               assignedTo:
 *                 type: string
 *               category:
 *                 type: string
 *     responses:
 *       200:
 *         description: Todo updated successfully
 *       400:
 *         description: Bad request - Invalid input
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       404:
 *         description: Todo not found
 *       500:
 *         description: Internal server error
 */
router.put('/:id', updateTodo);

/**
 * @swagger
 * /api/todos/{id}/complete:
 *   post:
 *     summary: Mark todo as complete
 *     description: Mark a todo as completed and optionally upload proof images (max 10 images, 10MB each)
 *     tags: [Todos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Todo ID
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Proof images (max 10, .jpg, .jpeg, .png, .gif, .webp)
 *               completionNotes:
 *                 type: string
 *                 description: Notes about the completion
 *     responses:
 *       200:
 *         description: Todo marked as completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 todo:
 *                   $ref: '#/components/schemas/Todo'
 *       400:
 *         description: Bad request - Invalid file type or size exceeded
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       404:
 *         description: Todo not found
 *       500:
 *         description: Internal server error
 */
router.post('/:id/complete', upload.array('images', 10), completeTodo);

/**
 * @swagger
 * /api/todos/{id}/approve:
 *   patch:
 *     summary: Approve a completed todo
 *     description: Approve a todo that has been marked as completed (manager/admin action)
 *     tags: [Todos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Todo ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               approvalNotes:
 *                 type: string
 *                 description: Optional notes for approval
 *     responses:
 *       200:
 *         description: Todo approved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 todo:
 *                   $ref: '#/components/schemas/Todo'
 *       400:
 *         description: Bad request - Todo not in completed status
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       404:
 *         description: Todo not found
 *       500:
 *         description: Internal server error
 */
router.patch('/:id/approve', approveTodo);

/**
 * @swagger
 * /api/todos/{id}/reject:
 *   patch:
 *     summary: Reject a completed todo
 *     description: Reject a todo that has been marked as completed, sending it back for rework
 *     tags: [Todos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Todo ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rejectionReason
 *             properties:
 *               rejectionReason:
 *                 type: string
 *                 description: Reason for rejecting the todo
 *     responses:
 *       200:
 *         description: Todo rejected successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 todo:
 *                   $ref: '#/components/schemas/Todo'
 *       400:
 *         description: Bad request - Todo not in completed status or missing rejection reason
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       404:
 *         description: Todo not found
 *       500:
 *         description: Internal server error
 */
router.patch('/:id/reject', rejectTodo);

/**
 * @swagger
 * /api/todos/{id}:
 *   delete:
 *     summary: Delete a todo
 *     description: Delete a todo from the system
 *     tags: [Todos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Todo ID
 *     responses:
 *       200:
 *         description: Todo deleted successfully
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       404:
 *         description: Todo not found
 *       500:
 *         description: Internal server error
 */
router.delete('/:id', deleteTodo);

/**
 * @swagger
 * components:
 *   schemas:
 *     Todo:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         title:
 *           type: string
 *         description:
 *           type: string
 *         priority:
 *           type: string
 *           enum: [low, medium, high, urgent]
 *         status:
 *           type: string
 *           enum: [pending, in_progress, completed, approved, rejected]
 *         dueDate:
 *           type: string
 *           format: date-time
 *         assignedTo:
 *           type: string
 *         createdBy:
 *           type: string
 *         completionImages:
 *           type: array
 *           items:
 *             type: string
 *         completionNotes:
 *           type: string
 *         approvalNotes:
 *           type: string
 *         rejectionReason:
 *           type: string
 *         completedAt:
 *           type: string
 *           format: date-time
 *         approvedAt:
 *           type: string
 *           format: date-time
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

module.exports = router;