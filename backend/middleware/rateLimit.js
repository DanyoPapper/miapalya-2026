const rateLimit = require('express-rate-limit');

// Általános limiter — diák app és publikus endpointok
exports.generalLimiter = rateLimit({
  windowMs: 60000, max: 120,
  standardHeaders: true, legacyHeaders: false,
  validate: { xForwardedForHeader: false },
});

// Admin limiter — magasabb limit az admin műveleteknél
exports.adminLimiter = rateLimit({
  windowMs: 60000, max: 300,
  standardHeaders: true, legacyHeaders: false,
  validate: { xForwardedForHeader: false },
});

// Pecsét limiter — diák pecsétgyűjtésnél
exports.stampLimiter = rateLimit({
  windowMs: 60000, max: 20,
  standardHeaders: true, legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  handler: (_req, res) =>
    res.status(429).json({ error: 'RATE_LIMIT', message: 'Kérj segítséget az animátortól!' })
});
