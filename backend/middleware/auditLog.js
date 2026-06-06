/**
 * Audit log middleware — minden /api/admin hívást naplóz
 * Ki, mit, mikor, melyik IP-ről
 */
const db = require('../config/database');
const jwt = require('jsonwebtoken');

module.exports = async function auditLog(req, res, next) {
  // JWT-ből kiolvassuk a felhasználót (ha van)
  let adminInfo = null;
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      adminInfo = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    } catch {}
  }

  // Response befejezése után naplózunk
  const originalJson = res.json.bind(res);
  res.json = function(data) {
    // Csak sikeres (2xx) admin műveleteket naplózzuk részletesen
    const statusCode = res.statusCode;
    if (adminInfo && statusCode >= 200 && statusCode < 300) {
      const action = `${req.method} ${req.path}`;
      const details = {
        method: req.method,
        path: req.path,
        statusCode,
        body: sanitizeBody(req.body),
      };
      db.query(
        `INSERT INTO security_log(event_type, session_id, ip_address, details)
         VALUES('admin_action', NULL, $1::inet, $2)`,
        [req.ip, JSON.stringify({
          ...details,
          admin_email: adminInfo.email,
          admin_role: adminInfo.role,
          action,
        })]
      ).catch(() => {});
    }
    return originalJson(data);
  };
  next();
};

// Jelszavakat kiszűrjük a logból
function sanitizeBody(body) {
  if (!body) return {};
  const safe = { ...body };
  if (safe.password) safe.password = '***';
  if (safe.password_hash) safe.password_hash = '***';
  return safe;
}
