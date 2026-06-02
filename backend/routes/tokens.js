const router = require('express').Router();
const requireAdmin = require('../middleware/auth');
const { generateToken, secondsUntilRotation } = require('../utils/totp');
const db = require('../config/database');

router.get('/current', requireAdmin, async (_req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id,name,emoji FROM zones WHERE active=TRUE ORDER BY id'
    );
    res.json({
      tokens: rows.map(z => ({
        zoneId: z.id, zoneName: z.name, emoji: z.emoji,
        token: generateToken(z.id),
        expiresIn: secondsUntilRotation(),
      })),
      rotationSeconds: secondsUntilRotation(),
    });
  } catch(e) { res.status(500).json({ error:'INTERNAL_ERROR' }); }
});

module.exports = router;
