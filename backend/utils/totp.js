const crypto = require('crypto');
const WINDOW_MS = 5 * 60 * 1000;
const TOKEN_LEN = 8;

function generateToken(zoneId, windowOverride) {
  const w = windowOverride ?? Math.floor(Date.now() / WINDOW_MS);
  const secret = process.env.TOKEN_SECRET || 'dev-secret-CHANGE-IN-PRODUCTION';
  return crypto.createHmac('sha256', secret)
    .update(`${zoneId}:${w}`)
    .digest('hex').toUpperCase().slice(0, TOKEN_LEN);
}

function validateToken(zoneId, submitted) {
  const now = Math.floor(Date.now() / WINDOW_MS);
  return [generateToken(zoneId, now), generateToken(zoneId, now - 1)]
    .includes(submitted?.toUpperCase());
}

function secondsUntilRotation() {
  return Math.ceil((WINDOW_MS - (Date.now() % WINDOW_MS)) / 1000);
}

module.exports = { generateToken, validateToken, secondsUntilRotation };
