const router   = require('express').Router();
const requireAdmin = require('../middleware/auth');
const db       = require('../config/database');
const { generateToken, secondsUntilRotation, WINDOW_SECONDS } = require('../utils/totp');

const ZONES = [
  { id: 'energia',  name: 'Zöld Energia',       emoji: '⚡' },
  { id: 'ipar',     name: 'Ipar 4.0',            emoji: '🤖' },
  { id: 'kiber',    name: 'Kiberbiztonság',       emoji: '🔐' },
  { id: 'jarmu',    name: 'Jármű',                emoji: '🚗' },
  { id: 'feny',     name: 'Fény & Világítás',     emoji: '💡' },
  { id: 'smart',    name: 'Okos Otthon',          emoji: '🏠' },
  { id: 'halo',     name: 'Hálózat & Telekom',    emoji: '📡' },
  { id: 'print3d',  name: '3D Világ',             emoji: '🖨'  },
];

router.get('/current', requireAdmin, async (req, res) => {
  try {
    const expiresIn = secondsUntilRotation();
    const tokens = ZONES.map(z => ({
      zoneId:    z.id,
      zoneName:  z.name,
      emoji:     z.emoji,
      token:     generateToken(z.id),
      expiresIn,
      qrData:    `MAP2026:${z.id}:${generateToken(z.id)}`,
    }));
    res.json({ tokens, rotationSeconds: expiresIn, windowSeconds: WINDOW_SECONDS });
  } catch(e) {
    console.error(e);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

module.exports = router;
