/**
 * Belépési kódok generálása a fesztiválra
 * Használat: node scripts/generate-entry-codes.js 2000 2026-10-15
 */
require('dotenv').config();
const crypto = require('crypto');
const db     = require('../backend/config/database');

const count   = parseInt(process.argv[2]) || 500;
const expDate = process.argv[3] || '2026-10-16';

(async () => {
  console.log(`Generálás: ${count} belépési kód, lejárat: ${expDate}`);
  const codes = [];
  for (let i = 0; i < count; i++) {
    codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
  }
  // Batch insert
  const values = codes.map((c, i) => `($${i*2+1}, $${i*2+2})`).join(',');
  const params = codes.flatMap(c => [c, expDate]);
  await db.query(
    `INSERT INTO entry_codes(code, expires_at) VALUES ${values} ON CONFLICT DO NOTHING`,
    params
  );
  console.log(`✅ ${count} belépési kód generálva`);
  // CSV mentés
  const fs = require('fs');
  fs.writeFileSync('entry_codes.csv', 'Kód\n' + codes.join('\n'));
  console.log('📄 entry_codes.csv mentve — nyomtatáshoz kész');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
