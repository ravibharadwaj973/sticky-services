const jwt = require('jsonwebtoken');
//middleware/adminAuth

// Admin tokens are minted by the core backend's /api/admin/login and carry
// role: 'admin'. Verified here with the shared JWT_SECRET.
const getAdminTokenFromRequest = (req) => {
  if (req.cookies && req.cookies.admin_token) {
    return req.cookies.admin_token;
  }

  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length);
  }

  return null;
};

const requireAdmin = (req, res, next) => {
  const token = getAdminTokenFromRequest(req);

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    req.admin = decoded;
    next();
  } catch (error) {
    console.error('Admin token verification error:', error);
    return res.status(401).json({ error: 'Unauthorized' });
  }
};

module.exports = { getAdminTokenFromRequest, requireAdmin };
