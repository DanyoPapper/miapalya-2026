const router = require('express').Router();
const db     = require('../config/database');
const crypto = require('crypto');
const jwt    = require('jsonwebtoken');
const bcrypt = require('bcrypt');

// Diák belépés (bejáratnál kiosztott QR-kód alapján)
router.post('/register', async (req, res) => {
  try {
    const { entryCode, name } = req.body;
    const { rows } = await db.query(
      'SELECT id FROM entry_codes WHERE code=$1 AND used=FALSE AND expires_at>NOW()',
      [entryCode]
    );
    if (!rows.length)
      return res.status(400).json({ error: 'INVALID_ENTRY_CODE' });

    const sessionToken = crypto.randomBytes(8).toString('hex').toUpperCase();
    await db.query('UPDATE entry_codes SET used=TRUE,used_at=NOW() WHERE code=$1', [entryCode]);
    const result = await db.query(
      'INSERT INTO sessions(token,name) VALUES($1,$2) RETURNING token',
      [sessionToken, name||null]
    );
    res.json({ success: true, sessionToken: result.rows[0].token });
  } catch(e) { console.error(e); res.status(500).json({ error:'INTERNAL_ERROR' }); }
});

// Admin belépés
router.post('/admin-login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const { rows } = await db.query(
      'SELECT id,email,password_hash,role,zone_id FROM admin_users WHERE email=$1',
      [email]
    );
    if (!rows.length || !(await bcrypt.compare(password, rows[0].password_hash)))
      return res.status(401).json({ error: 'INVALID_CREDENTIALS' });

    const token = jwt.sign(
      { id: rows[0].id, email: rows[0].email, role: rows[0].role, zoneId: rows[0].zone_id },
      process.env.JWT_SECRET, { expiresIn: '12h' }
    );
    res.json({ success: true, token, role: rows[0].role });
  } catch(e) { res.status(500).json({ error:'INTERNAL_ERROR' }); }
});

module.exports = router;
