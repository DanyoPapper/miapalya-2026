/**
 * Publikus API végpontok — diák app
 * /api/public/*
 */
const router = require('express').Router();
const db     = require('../config/database');

// Fesztivál státusz (aktív-e?)
router.get('/status', async (_req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT key, value FROM festival_settings WHERE key IN ('festival_active','festival_name','festival_date')"
    );
    const settings = Object.fromEntries(rows.map(r => [r.key, r.value]));
    res.json({
      active:  settings.festival_active === 'true',
      name:    settings.festival_name   || 'Mi a pálya? 2026',
      date:    settings.festival_date   || null,
    });
  } catch(e) { res.status(500).json({ error: 'INTERNAL_ERROR' }); }
});

// Aktív push üzenet lekérése (polling)
router.get('/push', async (_req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, message, duration_ms FROM push_messages
       WHERE active = TRUE
         AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY created_at DESC LIMIT 1`
    );
    res.json({ message: rows[0] || null });
  } catch(e) { res.status(500).json({ error: 'INTERNAL_ERROR' }); }
});

// Fontos dátumok
router.get('/dates', async (_req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, title, event_date, location, description, category, link
       FROM important_dates
       WHERE active = TRUE
       ORDER BY event_date ASC`
    );
    res.json({ dates: rows });
  } catch(e) { res.status(500).json({ error: 'INTERNAL_ERROR' }); }
});

// Kiállítók
router.get('/exhibitors', async (_req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, name, zone_id, description, youtube_url, website_url, logo_url
       FROM exhibitors
       WHERE active = TRUE
       ORDER BY sort_order ASC, name ASC`
    );
    res.json({ exhibitors: rows });
  } catch(e) { res.status(500).json({ error: 'INTERNAL_ERROR' }); }
});

// Térkép
router.get('/map', async (_req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, image_url, label FROM festival_map WHERE active = TRUE ORDER BY uploaded_at DESC LIMIT 1`
    );
    res.json({ map: rows[0] || null });
  } catch(e) { res.status(500).json({ error: 'INTERNAL_ERROR' }); }
});

// Zónák
router.get('/zones', async (_req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, name, emoji, location FROM zones WHERE active = TRUE ORDER BY id'
    );
    res.json({ zones: rows });
  } catch(e) { res.status(500).json({ error: 'INTERNAL_ERROR' }); }
});

module.exports = router;
