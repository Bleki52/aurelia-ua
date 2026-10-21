/**
 * ============================================================================
 * AURELIA UA — Products & Promotions Routes (Entity 2: CRUD, RBAC, Sync)
 * ============================================================================
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');
const { syncLivePromotions, getStoresStatus } = require('../services/storeScraper');

/**
 * GET /api/products
 * Query params: ?category=, ?search=, ?sort=
 */
router.get('/', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const { category, search, sort, city } = req.query;
    const products = await db.getProducts({ category, search, sort, city });

    // Strictly filter out any product whose prices array is empty
    const validProducts = (Array.isArray(products) ? products : []).filter(
      p => p && Array.isArray(p.prices) && p.prices.length > 0
    );

    return res.status(200).json(validProducts);
  } catch (err) {
    console.error('Помилка завантаження товарів:', err);
    return res.status(500).json({
      error: 'Помилка завантаження каталогу товарів.',
      code: 'SERVER_ERROR'
    });
  }
});

/**
 * GET /api/products/cities
 * Supported Ukrainian cities configuration (prioritizing Western Ukraine)
 */
router.get('/cities', (req, res) => {
  try {
    const { getAllCities, DEFAULT_CITY } = require('../config/cities');
    return res.status(200).json({
      success: true,
      defaultCity: DEFAULT_CITY,
      cities: getAllCities()
    });
  } catch (err) {
    console.error('Помилка отримання міст:', err);
    return res.status(500).json({
      success: false,
      error: 'Помилка списку міст',
      code: 'SERVER_ERROR'
    });
  }
});

/**
 * GET /api/products/stores-status
 * Diagnostics & transparent status of all 18 supported retail chains
 */
router.get('/stores-status', (req, res) => {
  try {
    const city = req.query.city || 'ivano-frankivsk';
    const stores = getStoresStatus(city);
    return res.status(200).json({
      success: true,
      city,
      timestamp: new Date().toISOString(),
      stores
    });
  } catch (err) {
    console.error('Помилка отримання статусу мереж:', err);
    return res.status(500).json({
      success: false,
      error: 'Помилка отримання статусу мереж',
      code: 'SERVER_ERROR'
    });
  }
});

/**
 * GET /api/products/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const product = await db.getProductById(req.params.id);
    if (!product || !Array.isArray(product.prices) || product.prices.length === 0) {
      return res.status(404).json({
        error: 'Товар не знайдено або ціни відсутні.',
        code: 'NOT_FOUND'
      });
    }
    return res.status(200).json(product);
  } catch (err) {
    console.error('Помилка пошуку товару:', err);
    return res.status(500).json({
      error: 'Помилка сервера при отриманні товару.',
      code: 'SERVER_ERROR'
    });
  }
});

/**
 * POST /api/products/sync
 * Triggers live price synchronisation with public Ukrainian supermarket endpoints.
 */
router.post('/sync', async (req, res) => {
  try {
    const city = req.query.city || (req.body && req.body.city) || 'ivano-frankivsk';
    const liveItems = await syncLivePromotions(city);
    const updatedCatalog = await db.syncProducts(liveItems, city);
    const syncedAt = new Date().toISOString();

    return res.status(200).json({
      message: `Синхронізацію актуальних цін для міста ${city} успішно завершено. Каталог оновлено на свіжі промо-акції.`,
      city,
      syncedCount: liveItems.length,
      totalCount: updatedCatalog.length,
      syncedAt,
      products: updatedCatalog
    });
  } catch (err) {
    console.error('Помилка синхронізації цін:', err);
    return res.status(500).json({
      error: 'Помилка під час синхронізації цін з мережами магазинів.',
      code: 'SYNC_ERROR'
    });
  }
});

/**
 * POST /api/products
 * Protected: Requires ADMIN role.
 */
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { name, title, category, mainCategory, subCategory, city, unit, promo_tag, promoTag, prices } = req.body || {};
    const prodName = (name || title || '').toString().trim();
    const mainCat = (mainCategory || '').toString().trim();
    const subCat = (subCategory || category || '').toString().trim();
    const cat = (category || subCat || mainCat || '').toString().trim();

    if (!prodName) {
      return res.status(400).json({
        error: 'Вкажіть назву товару (поле name є обов’язковим).',
        code: 'VALIDATION_ERROR'
      });
    }

    if (!cat && !subCat) {
      return res.status(400).json({
        error: 'Оберіть категорію товару.',
        code: 'VALIDATION_ERROR'
      });
    }

    const created = await db.createProduct({
      name: prodName,
      title: prodName,
      mainCategory: mainCat || 'Продукти',
      main_category: mainCat || 'Продукти',
      subCategory: subCat || 'Бакалія',
      sub_category: subCat || 'Бакалія',
      category: cat || subCat,
      city: city || 'ivano-frankivsk',
      unit: unit || 'шт',
      promo_tag: promoTag || promo_tag || 'Акція',
      promoTag: promoTag || promo_tag || 'Акція',
      prices: Array.isArray(prices) ? prices : []
    });

    return res.status(201).json({
      message: 'Товар успішно додано до каталогу.',
      product: created
    });
  } catch (err) {
    console.error('Помилка додавання товару:', err);
    return res.status(500).json({
      error: 'Помилка створення товару.',
      code: 'SERVER_ERROR'
    });
  }
});

/**
 * PUT /api/products/:id
 * Protected: Requires ADMIN role.
 */
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const existing = await db.getProductById(id);
    if (!existing) {
      return res.status(404).json({
        error: 'Товар для оновлення не знайдено.',
        code: 'NOT_FOUND'
      });
    }

    const updated = await db.updateProduct(id, req.body);
    return res.status(200).json({
      message: 'Дані товару та ціни успішно оновлено.',
      product: updated
    });
  } catch (err) {
    console.error('Помилка оновлення товару:', err);
    return res.status(500).json({
      error: 'Помилка оновлення товару.',
      code: 'SERVER_ERROR'
    });
  }
});

/**
 * DELETE /api/products/:id
 * Protected: Requires ADMIN role.
 */
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const success = await db.deleteProduct(id);
    if (!success) {
      return res.status(404).json({
        error: 'Товар для видалення не знайдено.',
        code: 'NOT_FOUND'
      });
    }

    return res.status(200).json({
      message: 'Товар успішно видалено з каталогу.',
      id
    });
  } catch (err) {
    console.error('Помилка видалення товару:', err);
    return res.status(500).json({
      error: 'Помилка сервера при видаленні товару.',
      code: 'SERVER_ERROR'
    });
  }
});

module.exports = router;

