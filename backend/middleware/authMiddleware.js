const jwt = require('jsonwebtoken');

const authMiddleware = function (req, res, next) {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'No token, authorization denied' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    
    // Automatically add tenant filter if user has clientId
    if (decoded.clientId) {
      req.tenantFilter = { clientId: decoded.clientId };
    }
    
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

// Helper to add clientId when creating documents
const addTenantId = (req, data) => {
  if (req.user && req.user.clientId) {
    return { ...data, clientId: req.user.clientId };
  }
  return data;
};

module.exports = authMiddleware;
module.exports.addTenantId = addTenantId;
