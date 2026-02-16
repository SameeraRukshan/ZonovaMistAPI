const Todo = require('../models/todo');
const cloudinary = require('../config/cloudinary');
const { addTenantId } = require('../middleware/authMiddleware');

// Get all todos created by logged in user
exports.getAllTodos = async (req, res) => {
  try {
    const todos = await Todo.find({ 
      ...req.tenantFilter,
      createdBy: req.user.id,
      deleted: false 
    })
      .populate('assignedTo', 'fullName email')
      .populate('createdBy', 'fullName email')
      .sort({ createdDate: -1 });
    
    res.status(200).json({ success: true, todos });
  } catch (error) {
    console.error('Error fetching todos:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Get todos assigned to logged in user (My Todos)
exports.getMyTodos = async (req, res) => {
  try {
    const todos = await Todo.find({ 
      ...req.tenantFilter,
      assignedTo: req.user.id,
      deleted: false 
    })
      .populate('assignedTo', 'fullName email')
      .populate('createdBy', 'fullName email')
      .sort({ createdDate: -1 });
    
    res.status(200).json({ success: true, todos });
  } catch (error) {
    console.error('Error fetching my todos:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Get todos by user
exports.getTodosByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const todos = await Todo.find({ 
      ...req.tenantFilter,
      assignedTo: userId,
      deleted: false 
    })
      .populate('assignedTo', 'fullName email')
      .populate('createdBy', 'fullName email')
      .sort({ createdDate: -1 });
    
    res.status(200).json({ success: true, todos });
  } catch (error) {
    console.error('Error fetching user todos:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Get single todo by ID
exports.getTodoById = async (req, res) => {
  try {
    const todo = await Todo.findOne({ 
      _id: req.params.id,
      ...req.tenantFilter,
      deleted: false 
    })
      .populate('assignedTo', 'fullName email')
      .populate('createdBy', 'fullName email');
    
    if (!todo) {
      return res.status(404).json({ success: false, message: 'Todo not found' });
    }
    
    res.status(200).json({ success: true, todo });
  } catch (error) {
    console.error('Error fetching todo:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Create new todo
exports.createTodo = async (req, res) => {
  try {
    const { title, description, dueDate, priority, assignedTo } = req.body;
    
    if (!title || !assignedTo) {
      return res.status(400).json({ 
        success: false, 
        message: 'Title and AssignedTo are required fields' 
      });
    }
    
    // Add clientId using addTenantId helper
    const todoData = addTenantId(req, {
      title,
      description,
      dueDate: dueDate || new Date(),
      priority: priority || 'Medium',
      assignedTo,
      createdBy: req.user.id,
      status: 'New'
    });
    
    const todo = new Todo(todoData);
    
    await todo.save();
    
    await todo.populate('assignedTo', 'fullName email');
    await todo.populate('createdBy', 'fullName email');
    
    res.status(201).json({ 
      success: true, 
      message: 'Todo created successfully', 
      todo 
    });
  } catch (error) {
    console.error('Error creating todo:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Update todo
exports.updateTodo = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    delete updates.createdBy;
    delete updates.createdDate;
    delete updates.deleted;
    delete updates.images;
    delete updates.clientId; // Prevent clientId modification
    delete updates.rating;
    delete updates.ratingComment;
    delete updates.ratedAt;
    delete updates.ratedBy;
    
    const todo = await Todo.findOneAndUpdate(
      { _id: id, ...req.tenantFilter, deleted: false },
      updates,
      { new: true, runValidators: true }
    )
      .populate('assignedTo', 'fullName email')
      .populate('createdBy', 'fullName email');
    
    if (!todo) {
      return res.status(404).json({ success: false, message: 'Todo not found' });
    }
    
    res.status(200).json({ 
      success: true, 
      message: 'Todo updated successfully', 
      todo 
    });
  } catch (error) {
    console.error('Error updating todo:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Complete todo with images
exports.completeTodo = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'At least one image is required to complete the todo' 
      });
    }

    const todo = await Todo.findOne({ 
      _id: id, 
      ...req.tenantFilter, 
      deleted: false 
    });
    
    if (!todo) {
      return res.status(404).json({ success: false, message: 'Todo not found' });
    }

    // Upload images to Cloudinary
    const uploadPromises = req.files.map(file => 
      cloudinary.uploader.upload(file.path, {
        folder: 'todos',
      })
    );

    const uploadResults = await Promise.all(uploadPromises);
    
    // Add images to todo
    const images = uploadResults.map(result => ({
      url: result.secure_url,
      public_id: result.public_id
    }));

    todo.images.push(...images);
    todo.status = 'Completed';
    todo.completedAt = new Date();
    
    await todo.save();
    await todo.populate('assignedTo', 'fullName email');
    await todo.populate('createdBy', 'fullName email');
    
    res.status(200).json({ 
      success: true, 
      message: 'Todo completed successfully', 
      todo 
    });
  } catch (error) {
    console.error('Error completing todo:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Approve todo
exports.approveTodo = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, ratingComment } = req.body || {};
    const parsedRating = Number(rating);

    if (rating === undefined || rating === null || Number.isNaN(parsedRating)) {
      return res.status(400).json({
        success: false,
        message: 'Rating is required and must be a number between 1 and 5'
      });
    }

    if (parsedRating < 1 || parsedRating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    if (
      ratingComment !== undefined &&
      ratingComment !== null &&
      typeof ratingComment !== 'string'
    ) {
      return res.status(400).json({
        success: false,
        message: 'Rating comment must be a string'
      });
    }

    const trimmedComment = typeof ratingComment === 'string'
      ? ratingComment.trim()
      : '';
    
    const todo = await Todo.findOneAndUpdate(
      { _id: id, ...req.tenantFilter, deleted: false, status: 'Completed' },
      { 
        status: 'Approved',
        approvedAt: new Date(),
        rating: parsedRating,
        ratingComment: trimmedComment,
        ratedAt: new Date(),
        ratedBy: req.user.id
      },
      { new: true, runValidators: true }
    )
      .populate('assignedTo', 'fullName email')
      .populate('createdBy', 'fullName email')
      .populate('ratedBy', 'fullName email');
    
    if (!todo) {
      return res.status(404).json({ 
        success: false, 
        message: 'Todo not found or not in Completed status' 
      });
    }
    
    res.status(200).json({ 
      success: true, 
      message: 'Todo approved successfully', 
      todo 
    });
  } catch (error) {
    console.error('Error approving todo:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Reject todo (set back to New)
exports.rejectTodo = async (req, res) => {
  try {
    const { id } = req.params;
    
    const todo = await Todo.findOneAndUpdate(
      { _id: id, ...req.tenantFilter, deleted: false, status: 'Completed' },
      { 
        status: 'New',
        completedAt: null,
        images: [] // Clear images on reject
      },
      { new: true }
    )
      .populate('assignedTo', 'fullName email')
      .populate('createdBy', 'fullName email');
    
    if (!todo) {
      return res.status(404).json({ 
        success: false, 
        message: 'Todo not found or not in Completed status' 
      });
    }

    // Delete images from Cloudinary
    if (todo.images && todo.images.length > 0) {
      const deletePromises = todo.images.map(img => 
        cloudinary.uploader.destroy(img.public_id)
      );
      await Promise.all(deletePromises);
    }
    
    res.status(200).json({ 
      success: true, 
      message: 'Todo rejected and reset to New', 
      todo 
    });
  } catch (error) {
    console.error('Error rejecting todo:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Soft delete todo
exports.deleteTodo = async (req, res) => {
  try {
    const { id } = req.params;
    
    const todo = await Todo.findOneAndUpdate(
      { _id: id, ...req.tenantFilter, deleted: false },
      { 
        deleted: true, 
        deletedAt: new Date(),
        deletedBy: req.user.id
      },
      { new: true }
    );
    
    if (!todo) {
      return res.status(404).json({ success: false, message: 'Todo not found' });
    }
    
    res.status(200).json({ 
      success: true, 
      message: 'Todo deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting todo:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};
