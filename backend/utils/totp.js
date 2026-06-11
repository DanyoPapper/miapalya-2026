const crypto = require('crypto');

const WINDOW_SECONDS = 300; // 5 perces ablak

// A QR tokenek titka KÖTELEZŐ — fallback nélkül, különben bárki hamisíthatna
// érvényes tokent a repóban látható alapértelmezett titokból.
const SECRET = process.env.TOKEN_SECRET;
if (!SECRET) {
  throw new Error('TOKEN_SECRET környezeti változó hiányzik! Állítsd be a Railway-en (Variables fül).');
}

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
