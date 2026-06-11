/**
 * Publikus API végpontok — diák app
 * /api/public/*
 *
 * TELJESÍTMÉNY: a gyakran pollozott végpontok (status, push, dates) eredménye
 * szerveroldali memóriában cache-elve van. Több ezer diák 10-15 mp-es pollingja
 * így nem terheli az adatbázist — minden cache-ablakban csak EGY DB-lekérdezés fut.
 */
const router = require('express').Router();
const db     = require('../config/database');

// ── Egyszerű időalapú cache segéd ────────────────────────────────────────────
function makeCache(ttlMs, loader) {
  let value = null;
  let expires = 0;
  let inflight = null;
  return async function get() {
    const now = Date.now();
    if (value !== null && now < expires) return value;     // friss cache
    if (inflight) return inflight;                          // épp tölt más kérés — várjunk rá
    inflight = (async () => {
      try {
        value = await loader();
        expires = Date.now() + ttlMs;
        return value;
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  };
}

// ── Cache-elt lekérdezések ───────────────────────────────────────────────────
const getStatus = makeCache(10000, async () => {
  const { rows } = await db.query(
    "SELECT key, value FROM festival_settings WHERE key IN ('festival_active','festival_name','festival_date')"
  );
  const s = Object.fromEntries(rows.map(r => [r.key, r.value]));
  return {
    active: s.festival_active === 'true',
    name:   s.festival_name   || 'Mi a pálya? 2026',
    date:   s.festival_date   || null,
  };
});

const getPush = makeCache(5000, async () => {
  const { rows } = await db.query(
    `SELECT id, message, duration_ms FROM push_messages
     WHERE active = TRUE AND (expires_at IS NULL OR expires_at > NOW())
     ORDER BY created_at DESC LIMIT 1`
  );
  return rows[0] || null;
});

const getDates = makeCache(30000, async () => {
  const { rows } = await db.query(
    `SELECT id, title, event_date, location, description, category, link
     FROM important_dates WHERE active = TRUE ORDER BY event_date ASC`
  );
  return rows;
});

const getExhibitors = makeCache(30000, async () => {
  const { rows } = await db.query(
    `SELECT id, name, zone_id, description, youtube_url, website_url, logo_url
     FROM exhibitors WHERE active = TRUE ORDER BY sort_order ASC, name ASC`
  );
  return rows;
});

const getMap = makeCache(30000, async () => {
  const { rows } = await db.query(
    `SELECT id, image_url, label FROM festival_map WHERE active = TRUE ORDER BY uploaded_at DESC LIMIT 1`
  );
  return rows[0] || null;
});

const getZones = makeCache(60000, async () => {
  const { rows } = await db.query(
    'SELECT id, name, emoji, location FROM zones WHERE active = TRUE ORDER BY id'
  );
  return rows;
});

// ── Végpontok ────────────────────────────────────────────────────────────────
router.get('/status', async (_req, res) => {
  try { res.json(await getStatus()); }
  catch(e) { res.status(500).json({ error: 'INTERNAL_ERROR' }); }
});

router.get('/push', async (_req, res) => {
  try { res.json({ message: await getPush() }); }
  catch(e) { res.status(500).json({ error: 'INTERNAL_ERROR' }); }
});

router.get('/dates', async (_req, res) => {
  try { res.json({ dates: await getDates() }); }
  catch(e) { res.status(500).json({ error: 'INTERNAL_ERROR' }); }
});

router.get('/exhibitors', async (_req, res) => {
  try { res.json({ exhibitors: await getExhibitors() }); }
  catch(e) { res.status(500).json({ error: 'INTERNAL_ERROR' }); }
});

router.get('/map', async (_req, res) => {
  try { res.json({ map: await getMap() }); }
  catch(e) { res.status(500).json({ error: 'INTERNAL_ERROR' }); }
});

router.get('/zones', async (_req, res) => {
  try { res.json({ zones: await getZones() }); }
  catch(e) { res.status(500).json({ error: 'INTERNAL_ERROR' }); }
});

module.exports = router;
