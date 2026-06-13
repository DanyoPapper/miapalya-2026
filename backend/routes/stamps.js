const router = require('express').Router();
const db     = require('../config/database');
const { validateToken } = require('../utils/totp');
const { stampLimiter }  = require('../middleware/rateLimit');
const logger = require('../utils/logger');

// ── QR kód beolvasás — zóna egyezés kötelező ──────────────────────────────────
router.post('/scan', stampLimiter, async (req, res) => {
  const { sessionToken, qrData, currentZoneId } = req.body;
  const ip = req.ip;

  // QR adat formátuma: "MAP2026:zona_id:TOKEN"
  let zoneId, qrToken;
  try {
    const parts = qrData?.split(':');
    if (parts?.length !== 3 || parts[0] !== 'MAP2026') {
      return res.status(400).json({ error: 'INVALID_QR', message: 'Ez nem Mi a pálya? QR kód.' });
    }
    zoneId  = parts[1];
    qrToken = parts[2];
  } catch {
    return res.status(400).json({ error: 'INVALID_QR', message: 'Érvénytelen QR kód formátum.' });
  }

  // Zóna egyezés — csak a diák aktuális zónájának QR kódja fogadható el
  if (currentZoneId && zoneId !== currentZoneId) {
    return res.status(400).json({
      error: 'WRONG_ZONE',
      message: 'Úgy tűnik, nem ehhez a zónához tartozó QR kódot olvastál be. Kérd az animátort!'
    });
  }

  return collectStamp(req, res, { sessionToken, zoneId, qrToken, ip });
});

// ── Manuális token beküldés — csak az aktuális zóna kódja fogadható el ────────
router.post('/manual', stampLimiter, async (req, res) => {
  const { sessionToken, token: manualToken, currentZoneId } = req.body;
  const ip = req.ip;

  if (!manualToken || manualToken.length < 4) {
    return res.status(400).json({ error: 'INVALID_TOKEN', message: 'Érvénytelen kód.' });
  }

  const cleanToken = manualToken.trim().toUpperCase();

  // Ha van currentZoneId, csak azt a zónát ellenőrzöm
  if (currentZoneId) {
    if (validateToken(currentZoneId, cleanToken)) {
      return collectStamp(req, res, { sessionToken, zoneId: currentZoneId, qrToken: cleanToken, ip });
    } else {
      return res.status(400).json({
        error: 'TOKEN_EXPIRED',
        message: 'Érvénytelen vagy lejárt kód. Kérd az animátortól az aktuális kódot!'
      });
    }
  }

  // Fallback: végigpróbálja az összes zónát (ha nincs currentZoneId)
  const ZONES = ['energia','ipar','kiber','jarmu','feny','smart','halo','print3d'];
  let foundZoneId = null;
  for (const zoneId of ZONES) {
    if (validateToken(zoneId, cleanToken)) {
      foundZoneId = zoneId;
      break;
    }
  }

  if (!foundZoneId) {
    return res.status(400).json({
      error: 'TOKEN_EXPIRED',
      message: 'Érvénytelen vagy lejárt kód. Kérd az animátortól az aktuális kódot!'
    });
  }

  return collectStamp(req, res, { sessionToken, zoneId: foundZoneId, qrToken: cleanToken, ip });
});

// ── Közös logika ──────────────────────────────────────────────────────────────
async function collectStamp(req, res, { sessionToken, zoneId, qrToken, ip }) {
  try {
    // 1. Globális QR kapcsoló
    const { rows: gs } = await db.query(
      "SELECT value FROM festival_settings WHERE key='qr_global_enabled'"
    );
    if (gs[0]?.value === 'false') {
      return res.status(403).json({ error: 'QR_DISABLED', message: 'A pecsétgyűjtés jelenleg szünetel.' });
    }

    // 2. IP blokklista
    const { rows: bl } = await db.query('SELECT 1 FROM blocked_ips WHERE ip_address=$1::inet', [ip]);
    if (bl.length) return res.status(403).json({ error: 'BLOCKED' });

    // 3. Session
    const { rows: sess } = await db.query(
      'SELECT id, created_at FROM sessions WHERE token=$1', [sessionToken]
    );
    if (!sess.length) return res.status(400).json({ error: 'INVALID_SESSION' });
    // Session lejárat — teszt jelleggel 24 óra (created_at-tól számítva)
    const ageMs = Date.now() - new Date(sess[0].created_at).getTime();
    if (ageMs > 24 * 60 * 60 * 1000) {
      return res.status(401).json({
        error: 'SESSION_EXPIRED',
        message: 'A munkameneted lejárt. Töltsd újra az oldalt a folytatáshoz!'
      });
    }
    const sessionId = sess[0].id;

    // 4. Zóna + zóna QR kapcsoló
    let qrEnabled = true;
    try {
      const { rows: zones } = await db.query(
        'SELECT id, qr_enabled FROM zones WHERE id=$1 AND active=TRUE', [zoneId]
      );
      if (!zones.length) return res.status(400).json({ error: 'INVALID_ZONE' });
      qrEnabled = zones[0].qr_enabled;
    } catch(e) {
      // qr_enabled oszlop hiányzik — alapértelmezett: engedélyezett
    }
    if (qrEnabled === false) {
      return res.status(403).json({ error: 'ZONE_QR_DISABLED', message: 'Ennél a zónánál a pecsétgyűjtés szünetel.' });
    }

    // 5. TOTP token validálás
    if (!validateToken(zoneId, qrToken)) {
      await logScan(sessionId, zoneId, qrToken, false, 'TOKEN_EXPIRED', ip);
      await logger.blocked({ ip, zoneId, token: qrToken, sessionId });
      return res.status(400).json({
        error: 'TOKEN_EXPIRED',
        message: 'Ez a QR kód lejárt. Kérd az animátortól az aktuális kódot!'
      });
    }

    // 6. Duplikátum
    const { rows: dup } = await db.query(
      'SELECT id FROM stamps WHERE session_id=$1 AND zone_id=$2', [sessionId, zoneId]
    );
    if (dup.length) return res.status(400).json({ error: 'ALREADY_COLLECTED', message: 'Ebből a zónából már van pecséted!' });

    // 7. Mentés
    await db.query(
      'INSERT INTO stamps(session_id,zone_id,qr_token,ip_address) VALUES($1,$2,$3,$4::inet)',
      [sessionId, zoneId, qrToken, ip]
    );
    await db.query('UPDATE sessions SET last_seen=NOW() WHERE id=$1', [sessionId]);
    await logScan(sessionId, zoneId, qrToken, true, null, ip);
    await logger.stamp({ ip, zoneId, token: qrToken, sessionId });

    const { rows: all } = await db.query('SELECT zone_id FROM stamps WHERE session_id=$1', [sessionId]);

    res.json({
      success: true,
      stamp: { zoneId, collectedAt: new Date().toISOString() },
      totalStamps: all.length,
      collectedStamps: all.map(s => s.zone_id)
    });
  } catch(e) {
    console.error(e);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

async function logScan(sessionId, zoneId, token, success, errorCode, ip) {
  try {
    await db.query(
      'INSERT INTO qr_scans(session_id,zone_id,token_used,success,error_code,ip_address) VALUES($1,$2,$3,$4,$5,$6::inet)',
      [sessionId, zoneId, token, success, errorCode, ip]
    );
  } catch {}
}

// ── Pecsét lekérés ────────────────────────────────────────────────────────────
router.get('/:sessionToken', async (req, res) => {
  try {
    const { rows: sess } = await db.query('SELECT id FROM sessions WHERE token=$1', [req.params.sessionToken]);
    if (!sess.length) return res.status(404).json({ error: 'NOT_FOUND' });
    const { rows } = await db.query(
      'SELECT zone_id, collected_at FROM stamps WHERE session_id=$1 ORDER BY collected_at',
      [sess[0].id]
    );
    res.json({ stamps: rows.map(s => s.zone_id), details: rows });
  } catch(e) { res.status(500).json({ error: 'INTERNAL_ERROR' }); }
});

module.exports = router;
