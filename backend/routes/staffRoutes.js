const express = require('express');
const router = express.Router();
const Staff = require('../models/staff');

/**
 * GET /staff/roles - Get all available staff roles
 */
router.get('/roles', async (req, res) => {
  try {
    const roles = ['Admin', 'Owner', 'Manager', 'Technician', 'Reception', 'Cleaning'];
    res.json(roles);
  } catch (err) {
    console.error('❌ Error fetching roles:', err.message);
    res.status(500).json({ message: err.message });
  }
});

/**
 * GET /staff - Fetch all staff with optional filtering
 * Query params:
 * - role: filter by role
 * - status: filter by status (active, inactive, on_leave)
 * - search: search term for name, email, or phone
 */
router.get('/', async (req, res) => {
  try {
    const { role, status, search } = req.query;
    
    let query = {};
    
    // Role filtering
    if (role && ['Admin', 'Owner', 'Manager', 'Technician', 'Reception', 'Cleaning'].includes(role)) {
      query.role = role;
    }
    
    // Status filtering
    if (status && ['active', 'inactive', 'on_leave'].includes(status)) {
      query.status = status;
    }
    
    // Search filtering
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
});

/**
 * GET /staff/:id - Get single staff member by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const staff = await Staff.findById(req.params.id);
    
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
});

/**
 * POST /staff - Create a new staff member
 */
router.post('/', async (req, res) => {
  try {
    // Validate required fields
    const requiredFields = ['name', 'role'];
    for (const field of requiredFields) {
      if (!req.body[field]) {
        return res.status(400).json({ message: `Missing required field: ${field}` });
      }
    }

    // Validate role
    const validRoles = ['Admin', 'Owner', 'Manager', 'Technician', 'Reception', 'Cleaning'];
    if (!validRoles.includes(req.body.role)) {
      return res.status(400).json({ 
        message: `Invalid role. Must be one of: ${validRoles.join(', ')}` 
      });
    }

    // Validate email format if provided
    if (req.body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(req.body.email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    // Check if email already exists (if provided)
    if (req.body.email) {
      const existingStaff = await Staff.findOne({ email: req.body.email });
      if (existingStaff) {
        return res.status(400).json({ message: 'Email already exists' });
      }
    }

    // Create staff member
    const staff = new Staff({
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

    await staff.save();
    console.log('✅ Staff member created:', staff.name);

    res.status(201).json(staff);
  } catch (err) {
    console.error('❌ Staff creation error:', err.message);
    
    // Handle duplicate email error
    if (err.code === 11000 && err.keyPattern && err.keyPattern.email) {
      return res.status(400).json({ message: 'Email already exists' });
    }
    
    res.status(400).json({ message: err.message });
  }
});

/**
 * PATCH /staff/:id - Update staff member
 */
router.patch('/:id', async (req, res) => {
  try {
    const staff = await Staff.findById(req.params.id);
    
    if (!staff) {
      console.error('Staff member not found for ID:', req.params.id);
      return res.status(404).json({ message: 'Staff member not found' });
    }

    // Validate role if provided
    if (req.body.role) {
      const validRoles = ['Admin', 'Owner', 'Manager', 'Technician', 'Reception', 'Cleaning'];
      if (!validRoles.includes(req.body.role)) {
        return res.status(400).json({ 
          message: `Invalid role. Must be one of: ${validRoles.join(', ')}` 
        });
      }
    }

    // Validate email format if provided
    if (req.body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(req.body.email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    // Check if email already exists (if changing email)
    if (req.body.email && req.body.email !== staff.email) {
      const existingStaff = await Staff.findOne({ 
        email: req.body.email,
        _id: { $ne: req.params.id }
      });
      if (existingStaff) {
        return res.status(400).json({ message: 'Email already exists' });
      }
    }

    // Validate status if provided
    if (req.body.status) {
      const validStatuses = ['active', 'inactive', 'on_leave'];
      if (!validStatuses.includes(req.body.status)) {
        return res.status(400).json({ 
          message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
        });
      }
    }

    // Update fields
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
    
    // Handle duplicate email error
    if (err.code === 11000 && err.keyPattern && err.keyPattern.email) {
      return res.status(400).json({ message: 'Email already exists' });
    }
    
    res.status(400).json({ message: err.message });
  }
});

/**
 * DELETE /staff/:id - Delete a staff member
 */
router.delete('/:id', async (req, res) => {
  try {
    const staff = await Staff.findByIdAndDelete(req.params.id);
    
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
});

/**
 * GET /staff/stats/summary - Get staff statistics
 * Returns count by role and status
 */
router.get('/stats/summary', async (req, res) => {
  try {
    const stats = await Staff.aggregate([
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
      // Count by role
      stats[0].byRole.forEach(item => {
        roleCount[item.role] = (roleCount[item.role] || 0) + 1;
      });

      // Count by status
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
});

module.exports = router;