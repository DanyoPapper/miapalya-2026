require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const path    = require('path');

// ── Kötelező titkok ellenőrzése induláskor ───────────────────────────────────
// Ha hiányoznak, a szerver el sem indul — így sosem fut le nem biztonságos
// alapértelmezett titokkal (QR token hamisítás / JWT hamisítás ellen).
for (const key of ['JWT_SECRET', 'TOKEN_SECRET']) {
  if (!process.env[key]) {
    console.error(`❌ HIBA: a(z) ${key} környezeti változó hiányzik! Állítsd be a Railway Variables fülön.`);
    process.exit(1);
  }
}

const authRoutes    = require('./routes/auth');
const stampsRoutes  = require('./routes/stamps');
const profileRoutes = require('./routes/profile');
const adminRoutes   = require('./routes/admin');
const adminV2Routes = require('./routes/admin_v2');
const tokensRoutes  = require('./routes/tokens');
const publicRoutes  = require('./routes/public');
const { generalLimiter, adminLimiter } = require('./middleware/rateLimit');
const auditLog = require('./middleware/auditLog');
const logger   = require('./utils/logger');

const app  = express();
const PORT = process.env.PORT || 3000;

// Trust Railway/Cloudflare proxy
app.set('trust proxy', 1);

app.use(helmet({ contentSecurityPolicy: false }));

// ── CORS — pontos allowlista, soha nem wildcard ──────────────────────────────
// A frontend ezekről a domainekről hívhatja az API-t. Ha kell több domain,
// vesszővel elválasztva add meg a FRONTEND_URL env változóban.
const ALLOWED_ORIGINS = [
  'https://miapalya-2026.pages.dev',
  'http://localhost:3000',
  'http://localhost:5173',
  ...(process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',').map(s => s.trim()) : []),
];
app.use(cors({
  origin: (origin, cb) => {
    // origin nélküli kérés (pl. mobil app, curl, same-origin) → engedjük
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    return cb(null, false); // nem dobunk hibát, csak nem küldünk CORS fejlécet
  },
  methods: ['GET','POST','PUT','DELETE'],
  allowedHeaders: ['Content-Type','Authorization']
}));
app.use(generalLimiter);
app.use(express.json({ limit: '2mb' })); // base64 képekhez
app.use(express.static(path.join(__dirname, '../frontend')));

// Audit log minden /api/admin hívásra
app.use('/api/admin', auditLog);

app.use('/api/admin',   adminLimiter);
app.use('/api/tokens',  adminLimiter);
app.use('/api/auth',    authRoutes);
app.use('/api/stamps',  stampsRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/admin',   adminRoutes);
app.use('/api/admin',   adminV2Routes);
app.use('/api/tokens',  tokensRoutes);
app.use('/api/public',  publicRoutes);

app.get('/api/health', (_req, res) =>
  res.json({ status: 'ok', time: new Date().toISOString(), version: '4.3.0' })
);

app.use((_req, res) => res.status(404).json({ error: 'NOT_FOUND' }));
app.use((err, _req, res, _next) => {
  logger.error('Unhandled error', { error: err.message });
  res.status(500).json({ error: 'INTERNAL_ERROR' });
});

app.listen(PORT, () => console.log(`✅ Mi a pálya? v4: http://localhost:${PORT}`));
module.exports = app;
