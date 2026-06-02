const jwt = require('jsonwebtoken');
module.exports = function requireAdmin(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer '))
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  try {
    req.admin = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    next();
  } catch { res.status(401).json({ error: 'TOKEN_INVALID' }); }
};
