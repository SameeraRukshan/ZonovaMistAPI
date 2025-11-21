const express = require('express');
const router = express.Router();
const {
  getAllTodos,
  getTodosByUser,
  getTodoById,
  createTodo,
  updateTodo,
  toggleTodoComplete,
  deleteTodo,
  permanentDeleteTodo
} = require('../controllers/todoController');
const verifyToken = require('../middleware/authMiddleware');

// All routes require authentication
router.use(verifyToken);

/**
 * @swagger
 * /todos:
 *   get:
 *     summary: Get all todos
 *     tags: [Todos]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all todos
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/', getAllTodos);

/**
 * @swagger
 * /todos/user/{userId}:
 *   get:
 *     summary: Get todos by assigned user
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
 *     responses:
 *       200:
 *         description: List of user's todos
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/user/:userId', getTodosByUser);

/**
 * @swagger
 * /todos/{id}:
 *   get:
 *     summary: Get single todo by ID
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
 *         description: Todo details
 *       404:
 *         description: Todo not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/:id', getTodoById);

/**
 * @swagger
 * /todos:
 *   post:
 *     summary: Create a new todo
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
 *               - assignedTo
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Complete project documentation"
 *               description:
 *                 type: string
 *                 example: "Write comprehensive API documentation"
 *               dueDate:
 *                 type: string
 *                 format: date
 *                 example: "2025-11-25"
 *               priority:
 *                 type: string
 *                 enum: [High, Medium, Low]
 *                 example: "High"
 *               assignedTo:
 *                 type: string
 *                 example: "64a1234b56c7890d1234ef56"
 *     responses:
 *       201:
 *         description: Todo created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/', createTodo);

/**
 * @swagger
 * /todos/{id}:
 *   put:
 *     summary: Update a todo
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
 *               dueDate:
 *                 type: string
 *                 format: date
 *               priority:
 *                 type: string
 *                 enum: [High, Medium, Low]
 *               assignedTo:
 *                 type: string
 *     responses:
 *       200:
 *         description: Todo updated successfully
 *       404:
 *         description: Todo not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.put('/:id', updateTodo);

/**
 * @swagger
 * /todos/{id}/toggle:
 *   patch:
 *     summary: Toggle todo completion status
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
 *         description: Todo completion status toggled
 *       404:
 *         description: Todo not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.patch('/:id/toggle', toggleTodoComplete);

/**
 * @swagger
 * /todos/{id}:
 *   delete:
 *     summary: Soft delete a todo
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
 *       404:
 *         description: Todo not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.delete('/:id', deleteTodo);

/**
 * @swagger
 * /todos/{id}/permanent:
 *   delete:
 *     summary: Permanently delete a todo (admin only)
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
 *         description: Todo permanently deleted
 *       404:
 *         description: Todo not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.delete('/:id/permanent', permanentDeleteTodo);

module.exports = router;