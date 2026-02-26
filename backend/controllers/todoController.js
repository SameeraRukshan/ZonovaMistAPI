const Todo = require('../models/todo');
const cloudinary = require('../config/cloudinary');
const { addTenantId } = require('../middleware/authMiddleware');

// Get all todos (Admins/Managers see all for tenant, others see what they created)
exports.getAllTodos = async (req, res) => {
  try {
    const isManagement = ['admin', 'manager', 'owner'].includes(req.user.role.toLowerCase());

    const query = {
      ...req.tenantFilter,
      deleted: false
    };

    // If not management, only show tasks they created 
    // (Note: They might also want to see tasks assigned to them, but we have getMyTodos for that)
    if (!isManagement) {
      query.createdBy = req.user.id;
    }

    const todos = await Todo.find(query)
      .populate('assignedTo', 'fullName email')
      .populate('createdBy', 'fullName email')
      .sort({ createdDate: -1 });

    res.status(200).json({ success: true, count: todos.length, todos });
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
    delete updates.rejectionComment;
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

    // Upload files to Cloudinary
    const uploadPromises = req.files.map(file =>
      cloudinary.uploader.upload(file.path, {
        folder: 'todos',
        resource_type: 'auto' // Automatically detect if it's an image or video
      })
    );

    const uploadResults = await Promise.all(uploadPromises);

    // Add media to todo
    const images = uploadResults.map(result => ({
      url: result.secure_url,
      public_id: result.public_id,
      resourceType: result.resource_type // 'image' or 'video'
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
    const { rating, ratingComment } = req.body;

    // Convert rating to number and validate
    const parsedRating = parseFloat(rating);

    if (isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return res.status(400).json({
        success: false,
        message: 'A valid rating between 1 and 5 is required for approval'
      });
    }

    const trimmedComment = (ratingComment || '').toString().trim();

    // Find first to verify existence and current status
    const todo = await Todo.findOne({
      _id: id,
      ...req.tenantFilter,
      deleted: false
    });

    if (!todo) {
      return res.status(404).json({ success: false, message: 'Todo not found' });
    }

    // Update status, rating and metadata
    todo.status = 'Approved';
    todo.approvedAt = new Date();
    todo.rating = parsedRating;
    todo.ratingComment = trimmedComment;
    todo.rejectionComment = ''; // Clear any previous rejection
    todo.ratedAt = new Date();
    todo.ratedBy = req.user.id;

    await todo.save();

    // Population for response
    await todo.populate('assignedTo', 'fullName email');
    await todo.populate('createdBy', 'fullName email');
    await todo.populate('ratedBy', 'fullName email');

    res.status(200).json({
      success: true,
      message: 'Todo approved and rated successfully',
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
    const { comment } = req.body;

    // 1. Find the todo first. Allowed to reject from Completed or Approved status.
    const todo = await Todo.findOne({
      _id: id,
      ...req.tenantFilter,
      deleted: false,
      status: { $in: ['Completed', 'Approved'] }
    });

    if (!todo) {
      return res.status(404).json({
        success: false,
        message: 'Todo not found or not in a states that can be rejected (Completed/Approved)'
      });
    }

    // 2. Delete images from Cloudinary if they exist
    if (todo.images && todo.images.length > 0) {
      try {
        const deletePromises = todo.images.map(img =>
          cloudinary.uploader.destroy(img.public_id, {
            resource_type: img.resourceType || 'image'
          })
        );
        await Promise.all(deletePromises);
        console.log(`[DELETE] Deleted ${todo.images.length} images from Cloudinary for todo ${id}`);
      } catch (cloudErr) {
        console.error('Error deleting images from Cloudinary:', cloudErr);
        // We continue anyway so the todo state is updated, but log the error
      }
    }

    // 3. Update the todo status and clear media
    todo.status = 'New';
    todo.completedAt = null;
    todo.images = [];
    todo.rejectionComment = comment || '';
    todo.rating = null;
    todo.ratingComment = '';

    await todo.save();

    await todo.populate('assignedTo', 'fullName email');
    await todo.populate('createdBy', 'fullName email');

    res.status(200).json({
      success: true,
      message: 'Todo rejected and reset to New. Media proof has been cleared.',
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
