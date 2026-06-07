const router       = require('express').Router();
const requireAdmin = require('../middleware/auth');
const { generateToken, secondsUntilRotation } = require('../utils/totp');

const ZONES = [
  { id:'energia', name:'Zöld Energia',      emoji:'⚡' },
  { id:'ipar',    name:'Ipar 4.0',           emoji:'🤖' },
  { id:'kiber',   name:'Kiberbiztonság',      emoji:'🔐' },
  { id:'jarmu',   name:'Jármű',              emoji:'🚗' },
  { id:'feny',    name:'Fény & Világítás',   emoji:'💡' },
  { id:'smart',   name:'Okos Otthon',        emoji:'🏠' },
  { id:'halo',    name:'Hálózat & Telekom',  emoji:'📡' },
  { id:'print3d', name:'3D Világ',           emoji:'🖨'  },
];

router.get('/current', requireAdmin, (_req, res) => {
  const expiresIn = secondsUntilRotation();
  const tokens = ZONES.map(z => {
    const token = generateToken(z.id);
    return {
      zoneId:   z.id,
      zoneName: z.name,
      emoji:    z.emoji,
      token,
      expiresIn,
      qrData:   `MAP2026:${z.id}:${token}`,
    };
  });
  res.json({ tokens, rotationSeconds: expiresIn });
});

module.exports = router;
