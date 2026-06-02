require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const path    = require('path');

const authRoutes    = require('./routes/auth');
const stampsRoutes  = require('./routes/stamps');
const profileRoutes = require('./routes/profile');
const adminRoutes   = require('./routes/admin');
const tokensRoutes  = require('./routes/tokens');
const { generalLimiter } = require('./middleware/rateLimit');
const logger = require('./utils/logger');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:8080',
  methods: ['GET','POST'],
  allowedHeaders: ['Content-Type','Authorization']
}));
app.use(generalLimiter);
app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, '../frontend')));

app.use('/api/auth',    authRoutes);
app.use('/api/stamps',  stampsRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/admin',   adminRoutes);
app.use('/api/tokens',  tokensRoutes);

app.get('/api/health', (_req, res) =>
  res.json({ status: 'ok', time: new Date().toISOString() })
);

app.use((_req, res) => res.status(404).json({ error: 'NOT_FOUND' }));
app.use((err, _req, res, _next) => {
  logger.error('Unhandled error', { error: err.message });
  res.status(500).json({ error: 'INTERNAL_ERROR' });
});

app.listen(PORT, () => console.log(`Server: http://localhost:${PORT}`));
module.exports = app;
