const router       = require('express').Router();
const requireAdmin = require('../middleware/auth');
const db           = require('../config/database');
const bcrypt       = require('bcryptjs');
const { generateToken, secondsUntilRotation } = require('../utils/totp');

router.use(requireAdmin);

// ── Fesztivál státusz ─────────────────────────────────────────────────────────
router.post('/festival/toggle', async (req, res) => {
  try {
    const { active } = req.body;
    await db.query(
      "INSERT INTO festival_settings(key,value,updated_at) VALUES('festival_active',$1,NOW()) ON CONFLICT(key) DO UPDATE SET value=$1,updated_at=NOW()",
      [active ? 'true' : 'false']
    );
    res.json({ success: true, active });
  } catch(e) { res.status(500).json({ error:'INTERNAL_ERROR' }); }
});

router.get('/festival/status', async (_req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT key, value FROM festival_settings WHERE key IN ('festival_active','qr_global_enabled')"
    );
    const s = Object.fromEntries(rows.map(r => [r.key, r.value]));
    res.json({
      active:    s['festival_active']    !== 'false',
      qrEnabled: s['qr_global_enabled']  !== 'false',
    });
  } catch(e) { res.status(500).json({ error:'INTERNAL_ERROR' }); }
});

// ── QR globális kapcsoló ──────────────────────────────────────────────────────
router.post('/qr/global', async (req, res) => {
  try {
    const { enabled } = req.body;
    await db.query(
      "INSERT INTO festival_settings(key,value,updated_at) VALUES('qr_global_enabled',$1,NOW()) ON CONFLICT(key) DO UPDATE SET value=$1,updated_at=NOW()",
      [enabled ? 'true' : 'false']
    );
    res.json({ success: true, enabled });
  } catch(e) { res.status(500).json({ error:'INTERNAL_ERROR' }); }
});

// ── QR zóna kapcsoló ──────────────────────────────────────────────────────────
router.post('/qr/zone/:zoneId', async (req, res) => {
  try {
    const { enabled } = req.body;
    const { zoneId }  = req.params;
    const r = await db.query(
      'UPDATE zones SET qr_enabled=$1 WHERE id=$2 RETURNING id, qr_enabled',
      [enabled === true || enabled === 'true', zoneId]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json({ success: true, zoneId, enabled: r.rows[0].qr_enabled });
  } catch(e) { console.error(e); res.status(500).json({ error:'INTERNAL_ERROR' }); }
});

router.get('/qr/zones', async (_req, res) => {
  try {
    // qr_enabled column esetleg hiányzik ha schema_v4 nem futott
    let rows;
    try {
      const result = await db.query('SELECT id, name, emoji, active, qr_enabled FROM zones ORDER BY id');
      rows = result.rows;
    } catch(colErr) {
      // Ha a qr_enabled column hiányzik, default TRUE-val töltjük
      const result = await db.query('SELECT id, name, emoji, active FROM zones ORDER BY id');
      rows = result.rows.map(r => ({ ...r, qr_enabled: true }));
    }
    res.json({ zones: rows });
  } catch(e) { console.error(e); res.status(500).json({ error:'INTERNAL_ERROR' }); }
});

// ── QR token lekérés egy zónához (animátor / kiállító) ───────────────────────
router.get('/qr/token/:zoneId', async (req, res) => {
  try {
    const { zoneId } = req.params;
    const { rows } = await db.query(
      'SELECT id, name, emoji, qr_enabled FROM zones WHERE id=$1', [zoneId]
    );
    if (!rows.length) return res.status(404).json({ error: 'NOT_FOUND' });
    const zone     = rows[0];
    const token    = generateToken(zoneId);
    const expiresIn = secondsUntilRotation();
    const qrData   = `MAP2026:${zoneId}:${token}`;
    res.json({ zone, token, expiresIn, qrData, qrEnabled: zone.qr_enabled });
  } catch(e) { console.error(e); res.status(500).json({ error:'INTERNAL_ERROR' }); }
});

// ── Push ──────────────────────────────────────────────────────────────────────
router.get('/push', async (_req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM push_messages ORDER BY created_at DESC LIMIT 30');
    res.json({ messages: rows });
  } catch(e) { res.status(500).json({ error:'INTERNAL_ERROR' }); }
});

router.post('/push', async (req, res) => {
  try {
    const { message, duration_ms = 10000 } = req.body;
    if (!message?.trim()) return res.status(400).json({ error:'MISSING_MESSAGE' });
    await db.query("UPDATE push_messages SET active=FALSE WHERE active=TRUE");
    const expiresAt = duration_ms > 0 ? new Date(Date.now() + duration_ms) : null;
    const { rows } = await db.query(
      'INSERT INTO push_messages(message,duration_ms,active,created_by,expires_at) VALUES($1,$2,TRUE,$3,$4) RETURNING *',
      [message.trim(), duration_ms, req.admin.email, expiresAt]
    );
    res.json({ success: true, message: rows[0] });
  } catch(e) { res.status(500).json({ error:'INTERNAL_ERROR' }); }
});

router.post('/push/:id/resend', async (req, res) => {
  try {
    const { rows: orig } = await db.query('SELECT * FROM push_messages WHERE id=$1', [req.params.id]);
    if (!orig.length) return res.status(404).json({ error:'NOT_FOUND' });
    const m = orig[0];
    await db.query("UPDATE push_messages SET active=FALSE WHERE active=TRUE");
    const expiresAt = m.duration_ms > 0 ? new Date(Date.now() + m.duration_ms) : null;
    const { rows } = await db.query(
      'INSERT INTO push_messages(message,duration_ms,active,created_by,expires_at) VALUES($1,$2,TRUE,$3,$4) RETURNING *',
      [m.message, m.duration_ms, req.admin.email, expiresAt]
    );
    res.json({ success: true, message: rows[0] });
  } catch(e) { res.status(500).json({ error:'INTERNAL_ERROR' }); }
});

router.delete('/push/:id', async (req, res) => {
  try {
    await db.query('UPDATE push_messages SET active=FALSE WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error:'INTERNAL_ERROR' }); }
});

// ── Dátumok ───────────────────────────────────────────────────────────────────
router.get('/dates', async (_req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM important_dates ORDER BY event_date ASC');
    res.json({ dates: rows });
  } catch(e) { res.status(500).json({ error:'INTERNAL_ERROR' }); }
});
router.post('/dates', async (req, res) => {
  try {
    const { title, event_date, location, description, category, link } = req.body;
    if (!title || !event_date) return res.status(400).json({ error:'MISSING_FIELDS' });
    const { rows } = await db.query(
      'INSERT INTO important_dates(title,event_date,location,description,category,link) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',
      [title, event_date, location||null, description||null, category||'egyeb', link||null]
    );
    res.json({ success: true, date: rows[0] });
  } catch(e) { res.status(500).json({ error:'INTERNAL_ERROR' }); }
});
router.put('/dates/:id', async (req, res) => {
  try {
    const { title, event_date, location, description, category, link, active } = req.body;
    const { rows } = await db.query(
      'UPDATE important_dates SET title=$1,event_date=$2,location=$3,description=$4,category=$5,link=$6,active=$7 WHERE id=$8 RETURNING *',
      [title, event_date, location||null, description||null, category||'egyeb', link||null, active!==false, req.params.id]
    );
    res.json({ success: true, date: rows[0] });
  } catch(e) { res.status(500).json({ error:'INTERNAL_ERROR' }); }
});
router.delete('/dates/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM important_dates WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error:'INTERNAL_ERROR' }); }
});

// ── Kiállítók ─────────────────────────────────────────────────────────────────
router.get('/exhibitors', async (_req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM exhibitors ORDER BY sort_order ASC, name ASC');
    res.json({ exhibitors: rows });
  } catch(e) { res.status(500).json({ error:'INTERNAL_ERROR' }); }
});
router.post('/exhibitors', async (req, res) => {
  try {
    const { name, zone_id, description, youtube_url, website_url, logo_url } = req.body;
    if (!name) return res.status(400).json({ error:'MISSING_NAME' });
    if (req.admin.role === 'exhibitor' && req.admin.zoneId && zone_id !== req.admin.zoneId)
      return res.status(403).json({ error:'FORBIDDEN' });
    const { rows } = await db.query(
      'INSERT INTO exhibitors(name,zone_id,description,youtube_url,website_url,logo_url) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',
      [name, zone_id||null, description||null, youtube_url||null, website_url||null, logo_url||null]
    );
    res.json({ success: true, exhibitor: rows[0] });
  } catch(e) { res.status(500).json({ error:'INTERNAL_ERROR' }); }
});
router.put('/exhibitors/:id', async (req, res) => {
  try {
    if (req.admin.role === 'exhibitor') {
      const { rows: ex } = await db.query('SELECT zone_id FROM exhibitors WHERE id=$1', [req.params.id]);
      if (!ex.length || ex[0].zone_id !== req.admin.zoneId)
        return res.status(403).json({ error:'FORBIDDEN' });
    }
    const { name, zone_id, description, youtube_url, website_url, logo_url, active } = req.body;
    const { rows } = await db.query(
      'UPDATE exhibitors SET name=$1,zone_id=$2,description=$3,youtube_url=$4,website_url=$5,logo_url=$6,active=$7 WHERE id=$8 RETURNING *',
      [name, zone_id||null, description||null, youtube_url||null, website_url||null, logo_url||null, active!==false, req.params.id]
    );
    res.json({ success: true, exhibitor: rows[0] });
  } catch(e) { res.status(500).json({ error:'INTERNAL_ERROR' }); }
});
router.delete('/exhibitors/:id', async (req, res) => {
  if (req.admin.role === 'exhibitor') return res.status(403).json({ error:'FORBIDDEN' });
  try {
    await db.query('DELETE FROM exhibitors WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error:'INTERNAL_ERROR' }); }
});

// ── Térkép ────────────────────────────────────────────────────────────────────
router.post('/map', async (req, res) => {
  try {
    const { image_url, label } = req.body;
    if (!image_url) return res.status(400).json({ error:'MISSING_URL' });
    await db.query('UPDATE festival_map SET active=FALSE');
    const { rows } = await db.query(
      'INSERT INTO festival_map(image_url,label) VALUES($1,$2) RETURNING *',
      [image_url, label||'Fesztivál térkép']
    );
    res.json({ success: true, map: rows[0] });
  } catch(e) { res.status(500).json({ error:'INTERNAL_ERROR' }); }
});
router.delete('/map/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM festival_map WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error:'INTERNAL_ERROR' }); }
});
router.get('/map', async (_req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM festival_map ORDER BY uploaded_at DESC');
    res.json({ maps: rows });
  } catch(e) { res.status(500).json({ error:'INTERNAL_ERROR' }); }
});

// ── Statisztikák ──────────────────────────────────────────────────────────────
router.get('/stats', async (_req, res) => {
  try {
    const [[u],[s],[b],[sus],[p]] = await Promise.all([
      db.query('SELECT COUNT(*) FROM sessions'),
      db.query('SELECT COUNT(*) FROM stamps'),
      db.query('SELECT COUNT(*) FROM blocked_ips'),
      db.query("SELECT COUNT(*) FROM security_log WHERE event_type='token_expired' AND created_at>NOW()-INTERVAL '2 hours'"),
      db.query("SELECT COUNT(*) FROM sessions WHERE profile_id IS NOT NULL"),
    ]).then(rs => rs.map(r => r.rows));
    res.json({ totalUsers:+u.count, totalStamps:+s.count, blockedIPs:+b.count, suspiciousAttempts:+sus.count, totalProfiles:+p.count });
  } catch(e) { res.status(500).json({ error:'INTERNAL_ERROR' }); }
});

router.get('/users/live', async (_req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT s.token, s.nickname, s.profile_id, s.created_at, s.last_seen,
              COUNT(st.id) AS stamp_count,
              CASE WHEN s.last_seen > NOW()-INTERVAL '30 minutes' THEN true ELSE false END AS is_active
       FROM sessions s LEFT JOIN stamps st ON s.id=st.session_id
       GROUP BY s.id ORDER BY s.last_seen DESC NULLS LAST LIMIT 200`
    );
    res.json({ users: rows });
  } catch(e) { res.status(500).json({ error:'INTERNAL_ERROR' }); }
});

router.get('/zones/stats', async (_req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT z.id, z.name, z.emoji, z.qr_enabled,
              COUNT(DISTINCT st.session_id) AS visitors,
              COUNT(st.id) AS total_stamps
       FROM zones z LEFT JOIN stamps st ON z.id=st.zone_id
       GROUP BY z.id ORDER BY visitors DESC`
    );
    res.json({ zones: rows });
  } catch(e) { res.status(500).json({ error:'INTERNAL_ERROR' }); }
});

router.get('/exhibitor/stats', async (req, res) => {
  try {
    const zoneId = req.admin.zoneId;
    if (!zoneId) return res.status(403).json({ error:'NO_ZONE' });
    const [{ rows: ex }, { rows: stats }] = await Promise.all([
      db.query('SELECT * FROM exhibitors WHERE zone_id=$1 AND active=TRUE', [zoneId]),
      db.query('SELECT COUNT(DISTINCT session_id) AS visitors, COUNT(*) AS stamps FROM stamps WHERE zone_id=$1', [zoneId])
    ]);
    res.json({ exhibitors: ex, stats: stats[0] });
  } catch(e) { res.status(500).json({ error:'INTERNAL_ERROR' }); }
});

// ── Admin felhasználók ────────────────────────────────────────────────────────
router.get('/admin-users', async (req, res) => {
  if (req.admin.role !== 'admin') return res.status(403).json({ error:'FORBIDDEN' });
  try {
    const { rows } = await db.query(
      'SELECT id,email,role,zone_id,active,last_login,created_at FROM admin_users ORDER BY created_at DESC'
    );
    res.json({ users: rows });
  } catch(e) { res.status(500).json({ error:'INTERNAL_ERROR' }); }
});

router.post('/admin-users', async (req, res) => {
  if (req.admin.role !== 'admin') return res.status(403).json({ error:'FORBIDDEN' });
  try {
    const { email, password, role, zone_id } = req.body;
    if (!email || !password || !role) return res.status(400).json({ error:'MISSING_FIELDS' });
    if (!['admin','animator','exhibitor'].includes(role)) return res.status(400).json({ error:'INVALID_ROLE' });
    const hash = await bcrypt.hash(password, 12);
    const { rows } = await db.query(
      'INSERT INTO admin_users(email,password_hash,role,zone_id) VALUES($1,$2,$3,$4) ON CONFLICT(email) DO UPDATE SET password_hash=$2,role=$3,zone_id=$4,active=TRUE RETURNING id,email,role,zone_id',
      [email.toLowerCase().trim(), hash, role, zone_id||null]
    );
    res.json({ success: true, user: rows[0] });
  } catch(e) { res.status(500).json({ error:'INTERNAL_ERROR' }); }
});

router.delete('/admin-users/:id', async (req, res) => {
  if (req.admin.role !== 'admin') return res.status(403).json({ error:'FORBIDDEN' });
  try {
    await db.query('UPDATE admin_users SET active=FALSE WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error:'INTERNAL_ERROR' }); }
});

// Felhasználó feloldása
router.post('/admin-users/:id/activate', async (req, res) => {
  if (req.admin.role !== 'admin') return res.status(403).json({ error:'FORBIDDEN' });
  try {
    await db.query('UPDATE admin_users SET active=TRUE WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error:'INTERNAL_ERROR' }); }
});

// ── Biztonsági napló ──────────────────────────────────────────────────────────
router.get('/security-log', async (_req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM security_log ORDER BY created_at DESC LIMIT 100');
    res.json({ events: rows });
  } catch(e) { res.status(500).json({ error:'INTERNAL_ERROR' }); }
});

router.post('/block-ip', async (req, res) => {
  try {
    const { ip, reason } = req.body;
    await db.query(
      'INSERT INTO blocked_ips(ip_address,reason,blocked_by) VALUES($1::inet,$2,$3) ON CONFLICT DO NOTHING',
      [ip, reason||'Manuálisan blokkolva', req.admin.email]
    );
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error:'INTERNAL_ERROR' }); }
});

router.get('/export', async (_req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT s.token, COALESCE(s.nickname,'–') AS nickname, s.profile_id,
              s.created_at::date AS date, COUNT(st.id) AS stamp_count,
              STRING_AGG(st.zone_id,'|') AS zones
       FROM sessions s LEFT JOIN stamps st ON s.id=st.session_id
       GROUP BY s.id ORDER BY s.created_at`
    );
    const csv = 'Token,Becenév,Profil,Dátum,Pecsétek,Zónák\n' +
      rows.map(r=>`${r.token},${r.nickname},${r.profile_id||''},${r.date},${r.stamp_count},${r.zones||''}`).join('\n');
    res.setHeader('Content-Type','text/csv; charset=utf-8');
    res.setHeader('Content-Disposition','attachment; filename="export.csv"');
    res.send('\uFEFF'+csv);
  } catch(e) { res.status(500).json({ error:'INTERNAL_ERROR' }); }
});

module.exports = router;
