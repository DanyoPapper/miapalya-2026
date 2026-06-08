const router = require('express').Router();
const db     = require('../config/database');
const crypto = require('crypto');
const jwt    = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// ── Diák session regisztrálás ─────────────────────────────────────────────────
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

// ── Becenév mentése (diák appból hívódik) ────────────────────────────────────
router.post('/nickname', async (req, res) => {
  try {
    const { sessionToken, nickname } = req.body;
    if (!nickname?.trim()) return res.status(400).json({ error:'MISSING_NICKNAME' });

    // Ha van session token, frissítjük
    if (sessionToken) {
      await db.query(
        'UPDATE sessions SET nickname=$1, last_seen=NOW() WHERE token=$2',
        [nickname.trim().slice(0,20), sessionToken]
      );
      return res.json({ success: true });
    }

    // Ha nincs session token, létrehozunk egy anonim sessiont
    const newToken = crypto.randomBytes(8).toString('hex').toUpperCase();
    await db.query(
      'INSERT INTO sessions(token, nickname) VALUES($1,$2) ON CONFLICT(token) DO UPDATE SET nickname=$2',
      [newToken, nickname.trim().slice(0,20)]
    );
    res.json({ success: true, sessionToken: newToken });
  } catch(e) { console.error(e); res.status(500).json({ error:'INTERNAL_ERROR' }); }
});

// ── Admin bejelentkezés — VALÓS, nincs demo ───────────────────────────────────
router.post('/admin-login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'MISSING_FIELDS' });

    const { rows } = await db.query(
      'SELECT id,email,password_hash,role,zone_id,active FROM admin_users WHERE email=$1',
      [email.toLowerCase().trim()]
    );

    if (!rows.length)
      return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Hibás email vagy jelszó.' });

    if (!rows[0].active)
      return res.status(401).json({ error: 'ACCOUNT_DISABLED', message: 'Ez a fiók le van tiltva.' });

    const valid = await bcrypt.compare(password, rows[0].password_hash);
    if (!valid)
      return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Hibás email vagy jelszó.' });

    // Last login frissítés
    await db.query('UPDATE admin_users SET last_login=NOW() WHERE id=$1', [rows[0].id]);

    const token = jwt.sign(
      { id: rows[0].id, email: rows[0].email, role: rows[0].role, zoneId: rows[0].zone_id },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({ success: true, token, role: rows[0].role, zoneId: rows[0].zone_id, email: rows[0].email });
  } catch(e) { console.error(e); res.status(500).json({ error:'INTERNAL_ERROR' }); }
});

module.exports = router;
