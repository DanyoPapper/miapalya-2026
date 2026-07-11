const rateLimit = require('express-rate-limit');

// Általános limiter — diák app és publikus endpointok
exports.generalLimiter = rateLimit({
  windowMs: 60000, max: 240,
  standardHeaders: true, legacyHeaders: false,
  validate: { xForwardedForHeader: false },
});

// Admin limiter — magasabb limit az admin műveleteknél
exports.adminLimiter = rateLimit({
  windowMs: 60000, max: 300,
  standardHeaders: true, legacyHeaders: false,
  validate: { xForwardedForHeader: false },
});

// Pecsét limiter — SESSION alapú, hogy a közös fesztivál-WiFi (NAT) ne lássa
// az egész termet egyetlen IP-nek. Ha nincs sessionToken, IP-re esik vissza.
exports.stampLimiter = rateLimit({
  windowMs: 60000, max: 30,
  standardHeaders: true, legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  keyGenerator: (req) => {
    const st = req.body && req.body.sessionToken;
    return st ? 'sess:' + st : 'ip:' + req.ip;
  },
  handler: (_req, res) =>
    res.status(429).json({ error: 'RATE_LIMIT', message: 'Egy kicsit lassíts — próbáld pár másodperc múlva!' })
});

// Becenév limiter — SESSION alapú, a korlátlan fake-session létrehozás ellen.
exports.nicknameLimiter = rateLimit({
  windowMs: 60000, max: 15,
  standardHeaders: true, legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  keyGenerator: (req) => {
    const st = req.body && req.body.sessionToken;
    return st ? 'sess:' + st : 'ip:' + req.ip;
  },
  handler: (_req, res) =>
    res.status(429).json({ error: 'RATE_LIMIT', message: 'Túl sok próbálkozás — várj egy kicsit!' })
});

// Profil mentés limiter — SESSION alapú, a profil-spam ellen.
exports.profileLimiter = rateLimit({
  windowMs: 60000, max: 20,
  standardHeaders: true, legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  keyGenerator: (req) => {
    const st = req.body && req.body.sessionToken;
    return st ? 'sess:' + st : 'ip:' + req.ip;
  },
  handler: (_req, res) =>
    res.status(429).json({ error: 'RATE_LIMIT', message: 'Túl sok mentés — várj egy kicsit!' })
});
