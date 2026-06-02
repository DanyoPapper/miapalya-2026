const router = require('express').Router();
const db     = require('../config/database');
const { validateToken } = require('../utils/totp');
const { stampLimiter }  = require('../middleware/rateLimit');
const logger = require('../utils/logger');

router.post('/collect', stampLimiter, async (req, res) => {
  const { sessionToken, zoneId, qrToken } = req.body;
  const ip = req.ip;

  // 1. IP blokklista
  const { rows: bl } = await db.query(
    'SELECT 1 FROM blocked_ips WHERE ip_address=$1::inet', [ip]
  );
  if (bl.length) return res.status(403).json({ error:'BLOCKED' });

  // 2. Session
  const { rows: sess } = await db.query(
    'SELECT id FROM sessions WHERE token=$1', [sessionToken]
  );
  if (!sess.length) return res.status(400).json({ error:'INVALID_SESSION' });
  const sessionId = sess[0].id;

  // 3. Zóna
  const { rows: zones } = await db.query(
    'SELECT id FROM zones WHERE id=$1 AND active=TRUE', [zoneId]
  );
  if (!zones.length) return res.status(400).json({ error:'INVALID_ZONE' });

  // 4. QR token validálás (TOTP-elvű, 5 perces ablakok)
  if (!validateToken(zoneId, qrToken)) {
    await logger.blocked({ ip, zoneId, token: qrToken, sessionId });
    return res.status(400).json({
      error: 'TOKEN_EXPIRED',
      message: 'Lejárt vagy érvénytelen token. Kérd az animátortól az aktuális kódot!'
    });
  }

  // 5. Duplikátum
  const { rows: dup } = await db.query(
    'SELECT id FROM stamps WHERE session_id=$1 AND zone_id=$2', [sessionId, zoneId]
  );
  if (dup.length) return res.status(400).json({ error:'ALREADY_COLLECTED' });

  // 6. Mentés
  await db.query(
    'INSERT INTO stamps(session_id,zone_id,qr_token,ip_address) VALUES($1,$2,$3,$4::inet)',
    [sessionId, zoneId, qrToken, ip]
  );
  await db.query('UPDATE sessions SET last_seen=NOW() WHERE id=$1', [sessionId]);
  await logger.stamp({ ip, zoneId, token: qrToken, sessionId });

  const { rows: all } = await db.query(
    'SELECT zone_id FROM stamps WHERE session_id=$1', [sessionId]
  );
  res.json({
    success: true,
    stamp: { zoneId, collectedAt: new Date().toISOString() },
    totalStamps: all.length,
    collectedStamps: all.map(s => s.zone_id)
  });
});

router.get('/:sessionToken', async (req, res) => {
  try {
    const { rows: sess } = await db.query(
      'SELECT id FROM sessions WHERE token=$1', [req.params.sessionToken]
    );
    if (!sess.length) return res.status(404).json({ error:'NOT_FOUND' });
    const { rows } = await db.query(
      'SELECT zone_id,collected_at FROM stamps WHERE session_id=$1 ORDER BY collected_at',
      [sess[0].id]
    );
    res.json({ stamps: rows.map(s=>s.zone_id), details: rows });
  } catch(e) { res.status(500).json({ error:'INTERNAL_ERROR' }); }
});

module.exports = router;
