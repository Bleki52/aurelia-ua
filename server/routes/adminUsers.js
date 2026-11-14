/**
 * ============================================================================
 * AURELIA UA — Admin Customer Management Routes (/api/admin/users)
 * Strictly restricted to @aurelia.ua staff:
 *   - GET           : Allowed for ADMIN & QA (read-only view)
 *   - PUT/DELETE/POST : Strictly allowed only for ADMIN (QA gets 403)
 * ============================================================================
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();
const db = require('../db');
const { verifyToken, requireAdmin, JWT_SECRET } = require('../middleware/auth');

function isStaffReadAllowed(req, res, next) {
  const email = String(req.user?.email || '').trim().toLowerCase();
  const role = String(req.user?.role || '').toUpperCase();
  if (!email.endsWith('@aurelia.ua') || (role !== 'ADMIN' && role !== 'QA')) {
    return res.status(403).json({
      error: 'Доступ заборонено. Потрібні права персоналу @aurelia.ua.',
      code: 'FORBIDDEN'
    });
  }
  return next();
}

/**
 * GET /api/admin/users
 * Returns all registered users ordered by id ASC with online status, basket count, & cards.
 */
router.get('/', verifyToken, isStaffReadAllowed, async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const users = await db.getAllUsersForAdmin();
    return res.status(200).json(users);
  } catch (err) {
    console.error('Помилка отримання списку користувачів:', err);
    return res.status(500).json({
      error: 'Не вдалося завантажити список користувачів.',
      code: 'SERVER_ERROR'
    });
  }
});

/**
 * PUT /api/admin/users/:id
 * Allows ADMIN to update a user's name, email, role, is_verified, and optional newPassword.
 */
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { name, email, role, is_verified, newPassword } = req.body || {};

    let password_hash;
    if (typeof newPassword === 'string' && newPassword.trim().length > 0) {
      if (newPassword.trim().length < 6) {
        return res.status(400).json({
          error: 'Новий пароль повинен містити щонайменше 6 символів.',
          code: 'WEAK_PASSWORD'
        });
      }
      password_hash = await bcrypt.hash(newPassword.trim(), 10);
    }

    const updated = await db.updateUserByAdmin(req.params.id, {
      name,
      email,
      role,
      is_verified,
      password_hash
    });

    if (!updated) {
      return res.status(404).json({
        error: 'Користувача не знайдено.',
        code: 'USER_NOT_FOUND'
      });
    }

    return res.status(200).json({
      message: 'Профіль користувача оновлено.',
      user: updated
    });
  } catch (err) {
    console.error('Помилка оновлення користувача адміністратором:', err);
    return res.status(err.status || 500).json({
      error: err.message || 'Не вдалося оновити дані користувача.',
      code: err.code || 'SERVER_ERROR'
    });
  }
});

/**
 * DELETE /api/admin/users/:id/cards/:cardId
 * Deletes a specific loyalty card belonging to user :id.
 */
router.delete('/:id/cards/:cardId', requireAdmin, async (req, res) => {
  try {
    const deleted = await db.deleteUserCardByAdmin(req.params.id, req.params.cardId);
    if (!deleted) {
      return res.status(404).json({
        error: 'Картку користувача не знайдено.',
        code: 'CARD_NOT_FOUND'
      });
    }

    return res.status(200).json({
      message: 'Картку користувача видалено.',
      userId: req.params.id,
      cardId: req.params.cardId
    });
  } catch (err) {
    console.error('Помилка видалення картки користувача:', err);
    return res.status(500).json({
      error: 'Не вдалося видалити картку користувача.',
      code: 'SERVER_ERROR'
    });
  }
});

/**
 * POST /api/admin/users/:id/clear-basket
 * Resets user's basket_data and marks basket_cleared_at so their client empties localStorage on sync.
 */
router.post('/:id/clear-basket', requireAdmin, async (req, res) => {
  try {
    const cleared = await db.clearUserBasketByAdmin(req.params.id);
    if (!cleared) {
      return res.status(404).json({
        error: 'Користувача не знайдено.',
        code: 'USER_NOT_FOUND'
      });
    }

    return res.status(200).json({
      message: `Кошик користувача ${cleared.name || cleared.email} очищено.`,
      userId: cleared.id,
      basketClearedAt: cleared.basket_cleared_at
    });
  } catch (err) {
    console.error('Помилка очищення кошика користувача:', err);
    return res.status(500).json({
      error: 'Не вдалося очистити кошик користувача.',
      code: 'SERVER_ERROR'
    });
  }
});

/**
 * POST /api/admin/users/:id/impersonate
 * Generates a JWT token for target user :id so Admin can inspect and use the app as that customer.
 */
router.post('/:id/impersonate', requireAdmin, async (req, res) => {
  try {
    const targetUser = await db.findUserById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({
        error: 'Цільового користувача не знайдено.',
        code: 'USER_NOT_FOUND'
      });
    }

    const safeRole = db.getEffectiveUserRole(targetUser);
    const token = jwt.sign(
      {
        id: targetUser.id,
        email: targetUser.email,
        role: safeRole,
        name: targetUser.name,
        impersonatedBy: req.user.email
      },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    return res.status(200).json({
      message: `Активний режим перегляду від імені ${targetUser.name || targetUser.email}.`,
      token,
      user: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
        role: safeRole,
        is_verified: Boolean(targetUser.is_verified)
      }
    });
  } catch (err) {
    console.error('Помилка імперсонації користувача:', err);
    return res.status(500).json({
      error: 'Не вдалося виконати імперсонацію користувача.',
      code: 'SERVER_ERROR'
    });
  }
});

module.exports = router;
