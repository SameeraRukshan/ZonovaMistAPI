const Staff = require('../models/staff');
const Todo = require('../models/todo');
const User = require('../models/user');
const { addTenantId } = require('../middleware/authMiddleware');
const { startOfMonth, subMonths } = require('date-fns');

/**
 * Get all available staff roles
 */
const getRoles = async (req, res) => {
  try {
    const roles = ['Admin', 'Owner', 'Manager', 'Technician', 'Reception', 'Cleaning'];
    res.json(roles);
  } catch (err) {
    console.error('❌ Error fetching roles:', err.message);
    res.status(500).json({ message: err.message });
  }
};

/**
 * Get staff statistics - count by role and status
 */
const getStatsSummary = async (req, res) => {
  try {
    const stats = await Staff.aggregate([
      {
        $match: req.tenantFilter || {}
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          byRole: {
            $push: { role: '$role' }
          },
          byStatus: {
            $push: { status: '$status' }
          }
        }
      }
    ]);

    const roleCount = {};
    const statusCount = {};

    if (stats.length > 0) {
      stats[0].byRole.forEach(item => {
        roleCount[item.role] = (roleCount[item.role] || 0) + 1;
      });

      stats[0].byStatus.forEach(item => {
        statusCount[item.status] = (statusCount[item.status] || 0) + 1;
      });
    }

    res.json({
      total: stats.length > 0 ? stats[0].total : 0,
      byRole: roleCount,
      byStatus: statusCount
    });
  } catch (err) {
    console.error('❌ Error fetching staff stats:', err.message);
    res.status(500).json({ message: err.message });
  }
};

/**
 * Fetch all staff with optional filtering
 */
const getAllStaff = async (req, res) => {
  try {
    const { role, status, search } = req.query;

    let query = { ...req.tenantFilter };

    if (role && ['Admin', 'Owner', 'Manager', 'Technician', 'Reception', 'Cleaning'].includes(role)) {
      query.role = role;
    }

    if (status && ['active', 'inactive', 'on_leave'].includes(status)) {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    console.log('📊 Fetching staff with query:', JSON.stringify(query));

    const staff = await Staff.find(query).sort({ createdAt: -1 });

    console.log(`✅ Found ${staff.length} staff members`);
    res.json(staff);
  } catch (err) {
    console.error('❌ Error fetching staff:', err.message);
    res.status(500).json({ message: err.message });
  }
};

/**
 * Get single staff member by ID
 */
const getStaffById = async (req, res) => {
  try {
    const staff = await Staff.findOne({
      _id: req.params.id,
      ...req.tenantFilter
    });

    if (!staff) {
      console.error('Staff member not found for ID:', req.params.id);
      return res.status(404).json({ message: 'Staff member not found' });
    }

    console.log('✅ Staff member found:', staff.name);
    res.json(staff);
  } catch (err) {
    console.error('❌ Error fetching staff member:', err.message);
    res.status(500).json({ message: err.message });
  }
};

/**
 * Create a new staff member
 */
const createStaff = async (req, res) => {
  try {
    const requiredFields = ['name', 'role'];
    for (const field of requiredFields) {
      if (!req.body[field]) {
        return res.status(400).json({ message: `Missing required field: ${field}` });
      }
    }

    const validRoles = ['Admin', 'Owner', 'Manager', 'Technician', 'Reception', 'Cleaning'];
    if (!validRoles.includes(req.body.role)) {
      return res.status(400).json({
        message: `Invalid role. Must be one of: ${validRoles.join(', ')}`
      });
    }

    if (req.body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(req.body.email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    if (req.body.email) {
      const existingStaff = await Staff.findOne({
        email: req.body.email,
        ...req.tenantFilter
      });
      if (existingStaff) {
        return res.status(400).json({ message: 'Email already exists' });
      }
    }

    const staffData = addTenantId(req, {
      name: req.body.name,
      profile_picture: req.body.profile_picture || null,
      birthday: req.body.birthday || null,
      email: req.body.email || null,
      phone: req.body.phone || null,
      joined_date: req.body.joined_date || null,
      current_salary: req.body.current_salary || null,
      role: req.body.role,
      status: req.body.status || 'active',
      emergency_contact: req.body.emergency_contact || {},
      notes: req.body.notes || ''
    });

    const staff = new Staff(staffData);

    await staff.save();
    console.log('✅ Staff member created:', staff.name);

    res.status(201).json(staff);
  } catch (err) {
    console.error('❌ Staff creation error:', err.message);

    if (err.code === 11000 && err.keyPattern && err.keyPattern.email) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    res.status(400).json({ message: err.message });
  }
};

/**
 * Update staff member
 */
const updateStaff = async (req, res) => {
  try {
    const staff = await Staff.findOne({
      _id: req.params.id,
      ...req.tenantFilter
    });

    if (!staff) {
      console.error('Staff member not found for ID:', req.params.id);
      return res.status(404).json({ message: 'Staff member not found' });
    }

    if (req.body.role) {
      const validRoles = ['Admin', 'Owner', 'Manager', 'Technician', 'Reception', 'Cleaning'];
      if (!validRoles.includes(req.body.role)) {
        return res.status(400).json({
          message: `Invalid role. Must be one of: ${validRoles.join(', ')}`
        });
      }
    }

    if (req.body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(req.body.email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    if (req.body.email && req.body.email !== staff.email) {
      const existingStaff = await Staff.findOne({
        email: req.body.email,
        _id: { $ne: req.params.id },
        ...req.tenantFilter
      });
      if (existingStaff) {
        return res.status(400).json({ message: 'Email already exists' });
      }
    }

    if (req.body.status) {
      const validStatuses = ['active', 'inactive', 'on_leave'];
      if (!validStatuses.includes(req.body.status)) {
        return res.status(400).json({
          message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        });
      }
    }

    const allowedUpdates = [
      'name', 'profile_picture', 'birthday', 'email', 'phone',
      'joined_date', 'current_salary', 'role', 'status',
      'emergency_contact', 'notes'
    ];

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        staff[field] = req.body[field];
      }
    });

    await staff.save();
    console.log('✅ Staff member updated:', staff.name);

    res.json(staff);
  } catch (err) {
    console.error('❌ Staff update error:', err.message);

    if (err.code === 11000 && err.keyPattern && err.keyPattern.email) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    res.status(400).json({ message: err.message });
  }
};

/**
 * Delete a staff member
 */
const deleteStaff = async (req, res) => {
  try {
    const staff = await Staff.findOneAndDelete({
      _id: req.params.id,
      ...req.tenantFilter
    });

    if (!staff) {
      console.error('Staff member not found for ID:', req.params.id);
      return res.status(404).json({ message: 'Staff member not found' });
    }

    console.log('✅ Staff member deleted:', staff.name);
    res.json({ message: 'Staff member deleted successfully' });
  } catch (err) {
    console.error('❌ Staff deletion error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

/**
   * Get staff performance metrics and reviews
   */
const getStaffPerformance = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Find the Staff member
    const staff = await Staff.findOne({
      _id: id,
      ...req.tenantFilter
    });

    if (!staff) {
      return res.status(404).json({ message: 'Staff member not found' });
    }

    // 2. Find the corresponding User account using email
    // This assumes staff.email matches user.email
    if (!staff.email) {
      return res.json({
        averageRating: 0,
        totalTasksCompleted: 0,
        totalRatings: 0,
        recentReviews: []
      });
    }

    const user = await User.findOne({ email: staff.email });

    if (!user) {
      return res.json({
        averageRating: 0,
        totalTasksCompleted: 0,
        totalRatings: 0,
        recentReviews: []
      });
    }

    // 3. Aggregate performance data from Todos assigned to this user
    const stats = await Todo.aggregate([
      {
        $match: {
          assignedTo: user._id,
          status: 'Approved', // Only count approved tasks for ratings
          rating: { $ne: null }, // Only tasks with ratings
          deleted: false
        }
      },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalRatings: { $sum: 1 }
        }
      }
    ]);

    // 4. Get total completed tasks (Approved or Completed)
    const completedCount = await Todo.countDocuments({
      assignedTo: user._id,
      status: { $in: ['Completed', 'Approved'] },
      deleted: false
    });

    // 5. Get recent reviews
    const recentReviews = await Todo.find({
      assignedTo: user._id,
      status: 'Approved',
      ratingComment: { $ne: null, $ne: '' },
      deleted: false
    })
      .sort({ ratedAt: -1 })
      .limit(5)
      .select('rating ratingComment ratedAt title ratedBy')
      .populate('ratedBy', 'fullName');

    res.json({
      averageRating: stats.length > 0 ? parseFloat(stats[0].averageRating.toFixed(1)) : 0,
      totalRatings: stats.length > 0 ? stats[0].totalRatings : 0,
      totalTasksCompleted: completedCount,
      recentReviews
    });

  } catch (err) {
    console.error('❌ Error fetching staff performance:', err.message);
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getRoles,
  getStatsSummary,
  getAllStaff,
  getStaffById,
  createStaff,
  updateStaff,
  deleteStaff,
  getStaffPerformance
};