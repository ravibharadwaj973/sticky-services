const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../lib/config');
//middleware/auth

// This service does not issue tokens — the core backend does. Both share
// JWT_SECRET, so the token is verified here locally with no call across the
// network. Same two transports as the core backend: httpOnly cookie for
// same-origin setups, Authorization: Bearer for cross-origin over plain HTTP.
const getTokenFromRequest = (req) => {
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }

  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length);
  }

  return null;
};

const requireAuth = (req, res, next) => {
  const token = getTokenFromRequest(req);

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());

    if (!decoded.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    req.userId = decoded.userId;
    req.userName = decoded.userName || '';
    req.userEmail = decoded.userEmail || '';
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(401).json({ error: 'Unauthorized' });
  }
};

module.exports = { getTokenFromRequest, requireAuth };
