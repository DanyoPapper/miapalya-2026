const rateLimit = require('express-rate-limit');

exports.generalLimiter = rateLimit({
  windowMs: 60000, max: 60,
  standardHeaders: true, legacyHeaders: false,
  validate: { xForwardedForHeader: false },
});

exports.stampLimiter = rateLimit({
  windowMs: 60000, max: 15,
  standardHeaders: true, legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  handler: (_req, res) =>
    res.status(429).json({ error: 'RATE_LIMIT', message: 'Kérj segítséget az animátortól!' })
});
