const jwt = require('jsonwebtoken');

/**
 * Main Authentication Middleware
 * Verifies JWT token and extracts user information
 * Sets up tenant filter and authorization context
 */
const authMiddleware = function (req, res, next) {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    console.warn(`[AUTH] 🚫 ${req.method} ${req.path} - No token provided`);
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    
    // Automatically add tenant filter if user has clientId (multi-tenancy support)
    if (decoded.clientId) {
      req.tenantFilter = { clientId: decoded.clientId };
    }
    
    // Log successful authentication
    console.log(`[AUTH] ✅ ${req.method} ${req.path} - User: ${decoded.email} (${decoded.role})`);
    
    next();
  } catch (err) {
    console.error(`[AUTH] ❌ ${req.method} ${req.path} - Invalid token: ${err.message}`);
    res.status(401).json({ message: 'Token is not valid' });
  }
};

/**
 * Role-Based Access Control Middleware
 * ADMIN ALWAYS HAS ACCESS - bypasses role checks
 * Other roles must be explicitly listed in the allowed roles
 * 
 * Usage: router.get('/admin-endpoint', requireRoles('admin', 'manager'), controller)
 */
const requireRoles = (...allowedRoles) => (req, res, next) => {
  if (!req.user || !req.user.role) {
    console.warn(`[RBAC] 🚫 ${req.method} ${req.path} - No user role found`);
    return res.status(403).json({ message: 'Insufficient permissions' });
  }

  const userRole = req.user.role.toLowerCase(); // Normalize to lowercase
  const normalizedAllowedRoles = allowedRoles.map(r => r.toLowerCase());

  // ✅ ADMIN BYPASS: Admin always has full access
  if (userRole === 'admin') {
    console.log(`[RBAC] ✅ ${req.method} ${req.path} - Admin access granted to ${req.user.email}`);
    return next();
  }

  // Check if user's role is in the allowed roles list
  if (!normalizedAllowedRoles.includes(userRole)) {
    console.warn(
      `[RBAC] 🚫 ${req.method} ${req.path} - User ${req.user.email} (${userRole}) ` +
      `not in allowed roles: [${normalizedAllowedRoles.join(', ')}]`
    );
    return res.status(403).json({ 
      message: 'Insufficient permissions', 
      required_roles: allowedRoles,
      user_role: userRole 
    });
  }

  console.log(`[RBAC] ✅ ${req.method} ${req.path} - Access granted to ${req.user.email} (${userRole})`);
  return next();
};

/**
 * Admin-Only Middleware
 * Immediate access grant for admin users
 * Denies all non-admin users
 * 
 * Usage: router.post('/admin-only-endpoint', adminOnly, controller)
 */
const adminOnly = (req, res, next) => {
  if (!req.user || !req.user.role) {
    console.warn(`[ADMIN] 🚫 ${req.method} ${req.path} - No user role found`);
    return res.status(403).json({ message: 'Admin access required' });
  }

  const userRole = req.user.role.toLowerCase();
  
  if (userRole !== 'admin') {
    console.warn(
      `[ADMIN] 🚫 ${req.method} ${req.path} - User ${req.user.email} (${userRole}) ` +
      `attempted unauthorized admin endpoint`
    );
    return res.status(403).json({ message: 'Admin access required' });
  }

  console.log(`[ADMIN] ✅ ${req.method} ${req.path} - Admin access granted to ${req.user.email}`);
  return next();
};

/**
 * Helper to add clientId when creating documents
 * Ensures all created documents are scoped to the user's tenant
 */
const addTenantId = (req, data) => {
  if (req.user && req.user.clientId) {
    return { ...data, clientId: req.user.clientId };
  }
  return data;
};

/**
 * Staff Read-Only Middleware
 * ENFORCE: STAFF users can ONLY perform GET/HEAD requests (read-only)
 * BLOCK: STAFF users from POST, PUT, PATCH, DELETE operations
 * ALLOW: ADMIN and MANAGER users full access to all methods
 * 
 * This middleware MUST be applied to all mutation endpoints (POST, PUT, PATCH, DELETE)
 * to prevent staff privilege escalation through unauthorized data modifications.
 * 
 * Usage: router.post('/endpoint', staffReadOnly, controller)
 *        router.patch('/endpoint/:id', staffReadOnly, controller)
 *        router.delete('/endpoint/:id', staffReadOnly, controller)
 */
const staffReadOnly = (req, res, next) => {
  if (!req.user || !req.user.role) {
    console.warn(`[STAFF_RO] 🚫 ${req.method} ${req.path} - No user role found`);
    return res.status(403).json({ 
      message: 'Insufficient permissions',
      reason: 'User role not found'
    });
  }

  const userRole = req.user.role.toLowerCase();
  const method = req.method.toUpperCase();

  // ✅ ADMIN AND MANAGER: Always allowed full access to all methods
  if (userRole === 'admin' || userRole === 'manager') {
    console.log(
      `[STAFF_RO] ✅ ${method} ${req.path} - ${userRole.toUpperCase()} access ` +
      `granted to ${req.user.email} (full permissions)`
    );
    return next();
  }

  // ✅ STAFF: Only allowed GET and HEAD (read-only)
  if (userRole === 'staff') {
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      console.log(
        `[STAFF_RO] ✅ ${method} ${req.path} - STAFF read-only access ` +
        `granted to ${req.user.email}`
      );
      return next();
    } else {
      // ❌ BLOCK: STAFF attempting mutation operation
      console.warn(
        `[STAFF_RO] 🚫 BLOCKED ${method} ${req.path} - User ${req.user.email} (STAFF) ` +
        `attempted unauthorized mutation. STAFF users have read-only access only.`
      );
      return res.status(403).json({
        message: 'Operation not permitted',
        reason: 'Staff users are restricted to read-only access',
        blocked_method: method,
        allowed_methods: ['GET', 'HEAD', 'OPTIONS'],
        user_role: userRole
      });
    }
  }

  // ✅ USER ROLE: Check if user role is allowed to mutate
  // (can be customized per application needs)
  if (userRole === 'user') {
    // By default, users can also only read
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      console.log(
        `[STAFF_RO] ✅ ${method} ${req.path} - USER read-only access ` +
        `granted to ${req.user.email}`
      );
      return next();
    } else {
      console.warn(
        `[STAFF_RO] 🚫 BLOCKED ${method} ${req.path} - User ${req.user.email} (USER) ` +
        `attempted unauthorized mutation`
      );
      return res.status(403).json({
        message: 'Operation not permitted',
        reason: 'Users are restricted to read-only access',
        blocked_method: method,
        user_role: userRole
      });
    }
  }

  // Default deny for unknown roles
  console.warn(`[STAFF_RO] 🚫 ${method} ${req.path} - Unknown role: ${userRole}`);
  return res.status(403).json({
    message: 'Insufficient permissions',
    reason: 'Unknown or unauthorized role'
  });
};

module.exports = authMiddleware;
module.exports.addTenantId = addTenantId;
module.exports.requireRoles = requireRoles;
module.exports.adminOnly = adminOnly;
module.exports.staffReadOnly = staffReadOnly;
