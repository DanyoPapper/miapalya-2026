const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 25,                       // fesztiválnapi terheléshez (ellenőrizd a Railway Postgres limitet!)
  min: 2,                        // tartalék kapcsolatok
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000, // ne lógjon végtelenül ha a pool kifut
});
pool.on('error', err => console.error('DB pool hiba:', err.message));
module.exports = pool;
