require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const path    = require('path');

const authRoutes    = require('./routes/auth');
const stampsRoutes  = require('./routes/stamps');
const profileRoutes = require('./routes/profile');
const adminRoutes   = require('./routes/admin');
const adminV2Routes = require('./routes/admin_v2');
const tokensRoutes  = require('./routes/tokens');
const publicRoutes  = require('./routes/public');
const { generalLimiter } = require('./middleware/rateLimit');
const logger = require('./utils/logger');

const app  = express();
app.set("trust proxy", 1);
const PORT = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.FRONTEND_URL || '*', methods: ['GET','POST','PUT','DELETE'], allowedHeaders: ['Content-Type','Authorization'] }));
app.use(generalLimiter);
app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, '../frontend')));

app.use('/api/auth',    authRoutes);
app.use('/api/stamps',  stampsRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/admin',   adminRoutes);
app.use('/api/admin',   adminV2Routes);
app.use('/api/tokens',  tokensRoutes);
app.use('/api/public',  publicRoutes);

app.get('/api/health', (_req, res) =>
  res.json({ status: 'ok', time: new Date().toISOString(), version: '3.0.0' })
);

app.use((_req, res) => res.status(404).json({ error: 'NOT_FOUND' }));
app.use((err, _req, res, _next) => {
  logger.error('Unhandled error', { error: err.message });
  res.status(500).json({ error: 'INTERNAL_ERROR' });
});

app.listen(PORT, () => console.log(`✅ Mi a pálya? v3: http://localhost:${PORT}`));
module.exports = app;
