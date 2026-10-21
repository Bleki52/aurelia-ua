/**
 * ============================================================================
 * AURELIA UA — Central API Route Registry
 * Mounts:
 *   /api/auth     ← Authentication (register, login, me)
 *   /api/cards    ← Loyalty Cards (CRUD & server-side validation)
 *   /api/products ← Products, Promotions & Live Store Sync
 * ============================================================================
 */

const express = require('express');
const router = express.Router();

const authRoutes = require('./auth');
const cardsRoutes = require('./cards');
const productsRoutes = require('./products');
const db = require('../db');

// Lightweight health check endpoint: GET /api/health
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    database: process.env.DATABASE_URL ? 'supabase-postgresql' : 'local-json',
    timestamp: new Date().toISOString()
  });
});

router.use('/auth', authRoutes);
router.use('/cards', cardsRoutes);
router.use('/products', productsRoutes);

module.exports = router;
