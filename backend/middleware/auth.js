const jwt = require('jsonwebtoken');

// JWT ellenőrzés — minden admin route alapvédelme
function requireAdmin(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer '))
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  try {
    req.admin = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    next();
  } catch { res.status(401).json({ error: 'TOKEN_INVALID' }); }
}

// Szerepkör ellenőrzés — csak a megadott szerepkörök férhetnek hozzá
// Használat: router.post('/x', requireRole('admin'), handler)
// requireAdmin UTÁN kell futnia (req.admin már be van állítva)
function requireRole(...allowedRoles) {
  return function (req, res, next) {
    if (!req.admin || !allowedRoles.includes(req.admin.role)) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Nincs jogosultságod ehhez a művelethez.' });
    }
    next();
  };
}

module.exports = requireAdmin;
module.exports.requireAdmin = requireAdmin;
module.exports.requireRole = requireRole;
