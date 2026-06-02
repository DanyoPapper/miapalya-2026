/**
 * Admin felhasználó létrehozása
 * Használat: node scripts/create-admin.js admin@mee.hu "BiztonságosJelszó123!"
 */
require('dotenv').config();
const bcrypt = require('bcrypt');
const db     = require('../backend/config/database');

const [,, email, password, role = 'admin', zoneId = null] = process.argv;

if (!email || !password) {
  console.log('Használat: node create-admin.js <email> <jelszó> [szerepkör] [zóna_id]');
  console.log('Szerepkörök: admin | animator | exhibitor');
  process.exit(1);
}

(async () => {
  const hash = await bcrypt.hash(password, 12);
  const { rows } = await db.query(
    'INSERT INTO admin_users(email,password_hash,role,zone_id) VALUES($1,$2,$3,$4) ON CONFLICT(email) DO UPDATE SET password_hash=$2,role=$3,zone_id=$4 RETURNING email,role',
    [email, hash, role, zoneId]
  );
  console.log('✅ Admin létrehozva:', rows[0]);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
