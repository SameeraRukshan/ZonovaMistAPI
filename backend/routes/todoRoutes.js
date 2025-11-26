const express = require('express');
const router = express.Router();
const multer = require('multer');
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

// Multer configuration for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// All routes require authentication
router.use(verifyToken);

/**
 * @swagger
 * /todos:
 *   get:
 *     summary: Get all todos created by logged-in user
 *     tags: [Todos]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', getAllTodos);

/**
 * @swagger
 * /todos/my:
 *   get:
 *     summary: Get todos assigned to logged-in user
 *     tags: [Todos]
 *     security:
 *       - bearerAuth: []
 */
router.get('/my', getMyTodos);

/**
 * @swagger
 * /todos/user/{userId}:
 *   get:
 *     summary: Get todos by assigned user
 *     tags: [Todos]
 *     security:
 *       - bearerAuth: []
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
 */
router.put('/:id', updateTodo);

/**
 * @swagger
 * /todos/{id}/complete:
 *   post:
 *     summary: Complete todo with images
 *     tags: [Todos]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/complete', upload.array('images', 10), completeTodo);

/**
 * @swagger
 * /todos/{id}/approve:
 *   patch:
 *     summary: Approve a completed todo
 *     tags: [Todos]
 *     security:
 *       - bearerAuth: []
 */
router.patch('/:id/approve', approveTodo);

/**
 * @swagger
 * /todos/{id}/reject:
 *   patch:
 *     summary: Reject a completed todo
 *     tags: [Todos]
 *     security:
 *       - bearerAuth: []
 */
router.patch('/:id/reject', rejectTodo);

/**
 * @swagger
 * /todos/{id}:
 *   delete:
 *     summary: Soft delete a todo
 *     tags: [Todos]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id', deleteTodo);

module.exports = router;