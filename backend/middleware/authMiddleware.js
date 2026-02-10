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

module.exports = authMiddleware;
module.exports.addTenantId = addTenantId;
module.exports.requireRoles = requireRoles;
module.exports.adminOnly = adminOnly;
