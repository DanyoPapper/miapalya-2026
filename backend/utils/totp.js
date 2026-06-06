const crypto = require('crypto');

const WINDOW_SECONDS = 300; // 5 perces ablak
const SECRET = process.env.TOKEN_SECRET || 'miapalya2026defaultsecret';

/**
 * Aktuális időablak száma
 */
function currentWindow() {
  return Math.floor(Date.now() / 1000 / WINDOW_SECONDS);
}

/**
 * Token generálás zónához (aktuális ablak)
 */
function generateToken(zoneId) {
  const window = currentWindow();
  const hash = crypto
    .createHmac('sha256', SECRET)
    .update(`${zoneId}:${window}`)
    .digest('hex');
  return hash.slice(0, 8).toUpperCase();
}

/**
 * Token validálás — elfogadja az aktuális + előző ablakot (grace period)
 */
function validateToken(zoneId, token) {
  if (!token) return false;
  const w = currentWindow();
  for (const offset of [0, -1]) {
    const hash = crypto
      .createHmac('sha256', SECRET)
      .update(`${zoneId}:${w + offset}`)
      .digest('hex');
    if (hash.slice(0, 8).toUpperCase() === token.toUpperCase()) return true;
  }
  return false;
}

/**
 * Hány másodperc van az ablak végéig
 */
function secondsUntilRotation() {
  const elapsed = Math.floor(Date.now() / 1000) % WINDOW_SECONDS;
  return WINDOW_SECONDS - elapsed;
}

module.exports = { generateToken, validateToken, secondsUntilRotation, WINDOW_SECONDS };
