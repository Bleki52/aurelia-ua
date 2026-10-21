/**
 * ============================================================================
 * AURELIA UA — Node.js & Express REST API Server
 * Backend for Ukrainian supermarket loyalty cards, price comparison, & store sync.
 * ============================================================================
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');
const apiRoutes = require('./routes');

const app = express();
const PORT = process.env.PORT || 5000;

/* ─── Security & Parsing Middleware ────────────────────────────────────────── */
// Enable CORS for all origins (including *.github.io and localhost)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Generous body limit to support base64 encoded QR screenshot images
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Lightweight request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
    }
  });
  next();
});

/* ─── Cloud Health Check Endpoints ────────────────────────────────────────── */
const handleHealthCheck = (req, res) => {
  res.status(200).json({
    status: 'ok',
    database: process.env.DATABASE_URL ? 'supabase-postgresql' : 'local-json',
    timestamp: new Date().toISOString()
  });
};

app.get('/api/health', handleHealthCheck);
app.get('/health', handleHealthCheck);

/* ─── Route Mounting ───────────────────────────────────────────────────────── */
app.use('/api', apiRoutes);

// Health check endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    name: 'AURELIA UA API Server',
    status: 'online',
    version: '1.0.0',
    database: db.isPostgresConnected() ? 'PostgreSQL' : 'Local JSON Fallback',
    endpoints: {
      auth: '/api/auth',
      cards: '/api/cards',
      products: '/api/products'
    }
  });
});

/* ─── 404 Catch-All ────────────────────────────────────────────────────────── */
app.use((req, res) => {
  res.status(404).json({
    error: `Маршрут ${req.method} ${req.originalUrl} не знайдено на сервері AURELIA UA.`,
    code: 'NOT_FOUND'
  });
});

/* ─── Global Error Handler ─────────────────────────────────────────────────── */
app.use((err, req, res, next) => {
  console.error('[SERVER_ERROR]', err);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Сталася внутрішня помилка сервера.',
    code: err.code || 'SERVER_ERROR'
  });
});

/* ─── Server Bootstrap ─────────────────────────────────────────────────────── */
async function startServer() {
  try {
    console.log('Ініціалізація бази даних AURELIA UA...');
    await db.initDatabase();

    const server = app.listen(PORT, () => {
      console.log(`====================================================`);
      console.log(` AURELIA UA API Server запущено на порту ${PORT}`);
      console.log(` Режим БД: ${db.isPostgresConnected() ? 'PostgreSQL' : 'Локальне сховище (local-store.json)'}`);
      console.log(` Ендпоінти: http://localhost:${PORT}/api`);
      console.log(`====================================================`);
    });

    return server;
  } catch (err) {
    console.error('Критична помилка запуску сервера:', err);
    process.exit(1);
  }
}

// Start server when executed directly
if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
