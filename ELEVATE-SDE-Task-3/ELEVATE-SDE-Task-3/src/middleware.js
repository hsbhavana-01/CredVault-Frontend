const jwt = require('jsonwebtoken');

function requireAdmin(req, res, next) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ success: false, message: 'Admin authentication required.' });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'development-only-change-me');
    if (payload.role !== 'admin') throw new Error('Invalid role');
    req.admin = { username: payload.sub };
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired admin token.' });
  }
}

module.exports = { requireAdmin };
