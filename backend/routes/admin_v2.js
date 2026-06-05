/**
 * Admin API v2 — új funkciók
 * /api/admin/*  (JWT védett)
 */
const router       = require('express').Router();
const requireAdmin = require('../middleware/auth');
const db           = require('../config/database');
const logger       = require('../utils/logger');

router.use(requireAdmin);

// ── Fesztivál be/ki kapcsoló ──────────────────────────────────────────────
router.post('/festival/toggle', async (req, res) => {
  try {
    const { active } = req.body;
    await db.query(
      "INSERT INTO festival_settings(key,value,updated_at) VALUES('festival_active',$1,NOW()) ON CONFLICT(key) DO UPDATE SET value=$1, updated_at=NOW()",
      [active ? 'true' : 'false']
    );
    await logger.admin({ details: { action: 'festival_toggle', active, by: req.admin.email } });
    res.json({ success: true, active });
  } catch(e) { res.status(500).json({ error: 'INTERNAL_ERROR' }); }
});

router.get('/festival/status', async (_req, res) => {
  try {
    const { rows } = await db.query("SELECT value FROM festival_settings WHERE key='festival_active'");
    res.json({ active: rows[0]?.value === 'true' });
  } catch(e) { res.status(500).json({ error: 'INTERNAL_ERROR' }); }
});

// ── Push üzenetek ─────────────────────────────────────────────────────────
router.get('/push', async (_req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM push_messages ORDER BY created_at DESC LIMIT 20'
    );
    res.json({ messages: rows });
  } catch(e) { res.status(500).json({ error: 'INTERNAL_ERROR' }); }
});

router.post('/push', async (req, res) => {
  try {
    const { message, duration_ms = 10000 } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'MISSING_MESSAGE' });

    // Előző aktív üzeneteket deaktiváljuk
    await db.query("UPDATE push_messages SET active=FALSE WHERE active=TRUE");

    const expiresAt = new Date(Date.now() + duration_ms);
    const { rows } = await db.query(
      'INSERT INTO push_messages(message, duration_ms, active, created_by, expires_at) VALUES($1,$2,TRUE,$3,$4) RETURNING *',
      [message.trim(), duration_ms, req.admin.email, expiresAt]
    );
    await logger.admin({ details: { action: 'push_sent', message, by: req.admin.email } });
    res.json({ success: true, message: rows[0] });
  } catch(e) { res.status(500).json({ error: 'INTERNAL_ERROR' }); }
});

router.delete('/push/:id', async (req, res) => {
  try {
    await db.query('UPDATE push_messages SET active=FALSE WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: 'INTERNAL_ERROR' }); }
});

// ── Fontos dátumok ────────────────────────────────────────────────────────
router.get('/dates', async (_req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM important_dates ORDER BY event_date ASC');
    res.json({ dates: rows });
  } catch(e) { res.status(500).json({ error: 'INTERNAL_ERROR' }); }
});

router.post('/dates', async (req, res) => {
  try {
    const { title, event_date, location, description, category, link } = req.body;
    if (!title || !event_date) return res.status(400).json({ error: 'MISSING_FIELDS' });
    const { rows } = await db.query(
      'INSERT INTO important_dates(title,event_date,location,description,category,link) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',
      [title, event_date, location||null, description||null, category||'egyeb', link||null]
    );
    res.json({ success: true, date: rows[0] });
  } catch(e) { res.status(500).json({ error: 'INTERNAL_ERROR' }); }
});

router.put('/dates/:id', async (req, res) => {
  try {
    const { title, event_date, location, description, category, link, active } = req.body;
    const { rows } = await db.query(
      'UPDATE important_dates SET title=$1,event_date=$2,location=$3,description=$4,category=$5,link=$6,active=$7 WHERE id=$8 RETURNING *',
      [title, event_date, location||null, description||null, category||'egyeb', link||null, active!==false, req.params.id]
    );
    res.json({ success: true, date: rows[0] });
  } catch(e) { res.status(500).json({ error: 'INTERNAL_ERROR' }); }
});

router.delete('/dates/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM important_dates WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: 'INTERNAL_ERROR' }); }
});

// ── Kiállítók ─────────────────────────────────────────────────────────────
router.get('/exhibitors', async (_req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM exhibitors ORDER BY sort_order ASC, name ASC');
    res.json({ exhibitors: rows });
  } catch(e) { res.status(500).json({ error: 'INTERNAL_ERROR' }); }
});

router.post('/exhibitors', async (req, res) => {
  try {
    const { name, zone_id, description, youtube_url, website_url, logo_url } = req.body;
    if (!name) return res.status(400).json({ error: 'MISSING_NAME' });
    const { rows } = await db.query(
      'INSERT INTO exhibitors(name,zone_id,description,youtube_url,website_url,logo_url) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',
      [name, zone_id||null, description||null, youtube_url||null, website_url||null, logo_url||null]
    );
    res.json({ success: true, exhibitor: rows[0] });
  } catch(e) { res.status(500).json({ error: 'INTERNAL_ERROR' }); }
});

router.put('/exhibitors/:id', async (req, res) => {
  try {
    const { name, zone_id, description, youtube_url, website_url, logo_url, active } = req.body;
    const { rows } = await db.query(
      'UPDATE exhibitors SET name=$1,zone_id=$2,description=$3,youtube_url=$4,website_url=$5,logo_url=$6,active=$7 WHERE id=$8 RETURNING *',
      [name, zone_id||null, description||null, youtube_url||null, website_url||null, logo_url||null, active!==false, req.params.id]
    );
    res.json({ success: true, exhibitor: rows[0] });
  } catch(e) { res.status(500).json({ error: 'INTERNAL_ERROR' }); }
});

router.delete('/exhibitors/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM exhibitors WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: 'INTERNAL_ERROR' }); }
});

// ── Térkép feltöltés (URL alapú) ──────────────────────────────────────────
router.post('/map', async (req, res) => {
  try {
    const { image_url, label } = req.body;
    if (!image_url) return res.status(400).json({ error: 'MISSING_URL' });
    await db.query('UPDATE festival_map SET active=FALSE');
    const { rows } = await db.query(
      'INSERT INTO festival_map(image_url, label) VALUES($1,$2) RETURNING *',
      [image_url, label||'Fesztivál térkép']
    );
    res.json({ success: true, map: rows[0] });
  } catch(e) { res.status(500).json({ error: 'INTERNAL_ERROR' }); }
});

router.get('/map', async (_req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM festival_map ORDER BY uploaded_at DESC');
    res.json({ maps: rows });
  } catch(e) { res.status(500).json({ error: 'INTERNAL_ERROR' }); }
});

module.exports = router;
