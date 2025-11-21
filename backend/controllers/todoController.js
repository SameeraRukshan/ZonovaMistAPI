const Todo = require('../models/todo');

// Get all todos (not deleted)
exports.getAllTodos = async (req, res) => {
  try {
    const todos = await Todo.find({ deleted: false })
      .populate('assignedTo', 'fullName email')
      .populate('createdBy', 'fullName email')
      .sort({ createdDate: -1 });
    
    res.status(200).json({ success: true, todos });
  } catch (error) {
    console.error('Error fetching todos:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Get todos by assignedTo user
exports.getTodosByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const todos = await Todo.find({ 
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
    
    // Validate required fields
    if (!title || !assignedTo) {
      return res.status(400).json({ 
        success: false, 
        message: 'Title and AssignedTo are required fields' 
      });
    }
    
    const todo = new Todo({
      title,
      description,
      dueDate: dueDate || new Date(),
      priority: priority || 'Medium',
      assignedTo,
      createdBy: req.user.id // From auth middleware
    });
    
    await todo.save();
    
    // Populate before sending response
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
    
    // Don't allow updating these fields
    delete updates.createdBy;
    delete updates.createdDate;
    delete updates.deleted;
    
    const todo = await Todo.findOneAndUpdate(
      { _id: id, deleted: false },
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

// Mark todo as completed/incomplete
exports.toggleTodoComplete = async (req, res) => {
  try {
    const { id } = req.params;
    
    const todo = await Todo.findOne({ _id: id, deleted: false });
    
    if (!todo) {
      return res.status(404).json({ success: false, message: 'Todo not found' });
    }
    
    todo.completed = !todo.completed;
    todo.completedAt = todo.completed ? new Date() : null;
    
    await todo.save();
    await todo.populate('assignedTo', 'fullName email');
    await todo.populate('createdBy', 'fullName email');
    
    res.status(200).json({ 
      success: true, 
      message: `Todo marked as ${todo.completed ? 'completed' : 'incomplete'}`, 
      todo 
    });
  } catch (error) {
    console.error('Error toggling todo completion:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Soft delete todo
exports.deleteTodo = async (req, res) => {
  try {
    const { id } = req.params;
    
    const todo = await Todo.findOneAndUpdate(
      { _id: id, deleted: false },
      { 
        deleted: true, 
        deletedAt: new Date(),
        deletedBy: req.user.id // From auth middleware
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

// Permanently delete todo (optional - admin only)
exports.permanentDeleteTodo = async (req, res) => {
  try {
    const { id } = req.params;
    
    const todo = await Todo.findByIdAndDelete(id);
    
    if (!todo) {
      return res.status(404).json({ success: false, message: 'Todo not found' });
    }
    
    res.status(200).json({ 
      success: true, 
      message: 'Todo permanently deleted' 
    });
  } catch (error) {
    console.error('Error permanently deleting todo:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};