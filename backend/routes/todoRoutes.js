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

// Multer configuration for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
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

// All routes require authentication
router.use(verifyToken);

router.get('/', getAllTodos);
router.get('/my', getMyTodos);
router.get('/user/:userId', getTodosByUser);
router.get('/:id', getTodoById);
router.post('/', createTodo);
router.put('/:id', updateTodo);
router.post('/:id/complete', upload.array('images', 10), completeTodo);
router.patch('/:id/approve', approveTodo);
router.patch('/:id/reject', rejectTodo);
router.delete('/:id', deleteTodo);

module.exports = router;