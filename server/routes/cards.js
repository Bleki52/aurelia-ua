/**
 * ============================================================================
 * AURELIA UA — Loyalty Cards Routes (Entity 1: CRUD & Validation)
 * ============================================================================
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../middleware/auth');

/**
 * GET /api/cards
 * Returns all personal loyalty cards belonging strictly to the authenticated user.
 */
router.get('/', verifyToken, async (req, res) => {
  try {
    const cards = await db.getCardsByUser(req.user.id);
    return res.status(200).json(cards);
  } catch (err) {
    console.error('Помилка отримання карток:', err);
    return res.status(500).json({
      error: 'Помилка завантаження карток лояльності.',
      code: 'SERVER_ERROR'
    });
  }
});

/**
 * GET /api/cards/:id
 * Returns a specific card belonging to the authenticated user.
 */
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const card = await db.getCardById(req.user.id, req.params.id);
    if (!card) {
      return res.status(404).json({
        error: 'Картку не знайдено.',
        code: 'NOT_FOUND'
      });
    }
    return res.status(200).json(card);
  } catch (err) {
    console.error('Помилка пошуку картки:', err);
    return res.status(500).json({
      error: 'Помилка сервера при пошуку картки.',
      code: 'SERVER_ERROR'
    });
  }
});

/**
 * POST /api/cards
 * Creates a new loyalty card scoped to the authenticated user.
 */
router.post('/', verifyToken, async (req, res) => {
  try {
    const { store, card_number, number, qr_payload, qrPayload, program, points, note, cashback, screenshot_data, screenshotDataUrl } = req.body || {};

    const resolvedQrPayload = (qr_payload || qrPayload || '').toString();
    const cardNumber = (card_number || number || resolvedQrPayload || '').toString().trim();
    const storeSlug = (store || '').toString().trim();

    if (!storeSlug) {
      return res.status(400).json({
        error: 'Оберіть мережу супермаркетів (поле store є обов’язковим).',
        code: 'VALIDATION_ERROR'
      });
    }

    if (!cardNumber || cardNumber.length < 4) {
      return res.status(400).json({
        error: 'Вкажіть коректний номер картки або QR-код (щонайменше 4 символи).',
        code: 'VALIDATION_ERROR'
      });
    }

    const cardPayload = {
      store: storeSlug,
      program: program || '',
      card_number: cardNumber,
      qr_payload: resolvedQrPayload || cardNumber,
      points: points || note || '',
      cashback: cashback || '',
      screenshot_data: screenshot_data || screenshotDataUrl || null
    };

    const created = await db.createCard(req.user.id, cardPayload);
    try { await db.touchUserActivity(req.user.id); } catch (_) {}
    return res.status(201).json({
      message: 'Картку лояльності успішно додано.',
      card: created
    });
  } catch (err) {
    console.error('Помилка додавання картки:', err);
    return res.status(500).json({
      error: 'Внутрішня помилка сервера при створенні картки.',
      code: 'SERVER_ERROR'
    });
  }
});

/**
 * PUT /api/cards/:id
 * Updates an existing loyalty card belonging to the authenticated user.
 */
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const id = req.params.id;
    const existing = await db.getCardById(req.user.id, id);
    if (!existing) {
      return res.status(404).json({
        error: 'Картку для оновлення не знайдено.',
        code: 'NOT_FOUND'
      });
    }

    const updated = await db.updateCard(req.user.id, id, req.body);
    return res.status(200).json({
      message: 'Картку лояльності оновлено.',
      card: updated
    });
  } catch (err) {
    console.error('Помилка оновлення картки:', err);
    return res.status(500).json({
      error: 'Внутрішня помилка сервера при оновленні картки.',
      code: 'SERVER_ERROR'
    });
  }
});

/**
 * DELETE /api/cards/:id
 * Deletes a loyalty card belonging to the authenticated user.
 */
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const id = req.params.id;
    const success = await db.deleteCard(req.user.id, id);
    if (!success) {
      return res.status(404).json({
        error: 'Картку для видалення не знайдено.',
        code: 'NOT_FOUND'
      });
    }

    return res.status(200).json({
      message: 'Картку лояльності успішно видалено.',
      id
    });
  } catch (err) {
    console.error('Помилка видалення картки:', err);
    return res.status(500).json({
      error: 'Помилка сервера при видаленні картки.',
      code: 'SERVER_ERROR'
    });
  }
});

module.exports = router;

