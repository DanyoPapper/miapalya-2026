const router = require('express').Router();
const requireAdmin = require('../middleware/auth');
const db = require('../config/database');
const logger = require('../utils/logger');

router.use(requireAdmin);

router.get('/stats', async (_req, res) => {
  try {
    const [[u],[s],[b],[sus]] = await Promise.all([
      db.query('SELECT COUNT(*) FROM sessions'),
      db.query('SELECT COUNT(*) FROM stamps'),
      db.query('SELECT COUNT(*) FROM blocked_ips'),
      db.query("SELECT COUNT(*) FROM security_log WHERE event_type='token_expired' AND created_at>NOW()-INTERVAL '2 hours'"),
    ]).then(rs => rs.map(r => r.rows));
    res.json({
      totalUsers: +u.count, totalStamps: +s.count,
      blockedIPs: +b.count, suspiciousAttempts: +sus.count,
    });
  } catch(e) { res.status(500).json({ error:'INTERNAL_ERROR' }); }
});

router.get('/users', async (_req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT s.token,s.name,s.profile_id,s.created_at,COUNT(st.id) AS stamp_count
       FROM sessions s LEFT JOIN stamps st ON s.id=st.session_id
       GROUP BY s.id ORDER BY s.created_at DESC LIMIT 200`
    );
    res.json({ users: rows });
  } catch(e) { res.status(500).json({ error:'INTERNAL_ERROR' }); }
});

router.get('/security-log', async (_req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM security_log ORDER BY created_at DESC LIMIT 100'
    );
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
    await logger.admin({ details: { action:'block_ip', ip, by: req.admin.email } });
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error:'INTERNAL_ERROR' }); }
});

router.post('/zones/:zoneId/toggle', async (req, res) => {
  try {
    const { rows } = await db.query(
      'UPDATE zones SET active=NOT active WHERE id=$1 RETURNING id,active',
      [req.params.zoneId]
    );
    if (!rows.length) return res.status(404).json({ error:'NOT_FOUND' });
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error:'INTERNAL_ERROR' }); }
});

router.get('/export', async (_req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT s.token,s.name,s.profile_id,s.created_at::date AS date,
              COUNT(st.id) AS stamp_count, STRING_AGG(st.zone_id,'|') AS zones
       FROM sessions s LEFT JOIN stamps st ON s.id=st.session_id
       GROUP BY s.id ORDER BY s.created_at`
    );
    const csv = 'Token,Nev,Profil,Datum,Pecset,Zonak\n' +
      rows.map(r=>`${r.token},${r.name||''},${r.profile_id||''},${r.date},${r.stamp_count},${r.zones||''}`).join('\n');
    res.setHeader('Content-Type','text/csv; charset=utf-8');
    res.setHeader('Content-Disposition','attachment; filename="export.csv"');
    res.send('\uFEFF' + csv);
  } catch(e) { res.status(500).json({ error:'INTERNAL_ERROR' }); }
});

module.exports = router;
