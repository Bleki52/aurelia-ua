/**
 * ============================================================================
 * AURELIA UA — Authentication Controller
 * Handles user registration, login, JWT token issuance, and profile check.
 * ============================================================================
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@aurelia.ua').toLowerCase();

/**
 * POST /api/auth/register
 */
async function register(req, res) {
  try {
    const { name, email, password } = req.body || {};

    if (!email || !email.includes('@')) {
      return res.status(400).json({
        error: 'Вкажіть коректну адресу електронної пошти.',
        code: 'INVALID_EMAIL'
      });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({
        error: 'Пароль повинен містити щонайменше 6 символів.',
        code: 'WEAK_PASSWORD'
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = await db.findUserByEmail(cleanEmail);
    if (existing) {
      return res.status(409).json({
        error: 'Користувач із такою електронною поштою вже зареєстрований.',
        code: 'USER_EXISTS'
      });
    }

    const role = cleanEmail === ADMIN_EMAIL ? 'ADMIN' : 'USER';
    const password_hash = await bcrypt.hash(password, 10);
    const cleanName = (name || cleanEmail.split('@')[0]).trim();

    const user = await db.createUser({
      name: cleanName,
      email: cleanEmail,
      password_hash,
      role
    });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      message: 'Реєстрація успішна.',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      token
    });
  } catch (err) {
    console.error('Помилка реєстрації:', err);
    return res.status(500).json({
      error: 'Внутрішня помилка сервера при реєстрації.',
      code: 'SERVER_ERROR'
    });
  }
}

/**
 * POST /api/auth/login
 */
async function login(req, res) {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        error: 'Введіть email та пароль.',
        code: 'MISSING_CREDENTIALS'
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await db.findUserByEmail(cleanEmail);

    if (!user) {
      return res.status(401).json({
        error: 'Невірний email або пароль.',
        code: 'INVALID_CREDENTIALS'
      });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        error: 'Невірний email або пароль.',
        code: 'INVALID_CREDENTIALS'
      });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      message: 'Вхід успішний.',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      token
    });
  } catch (err) {
    console.error('Помилка авторизації:', err);
    return res.status(500).json({
      error: 'Внутрішня помилка сервера при вході.',
      code: 'SERVER_ERROR'
    });
  }
}

/**
 * GET /api/auth/me
 */
async function me(req, res) {
  try {
    const user = await db.findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({
        error: 'Користувача не знайдено.',
        code: 'USER_NOT_FOUND'
      });
    }

    return res.status(200).json({ user });
  } catch (err) {
    console.error('Помилка отримання профілю:', err);
    return res.status(500).json({
      error: 'Помилка отримання даних облікового запису.',
      code: 'SERVER_ERROR'
    });
  }
}

module.exports = {
  register,
  login,
  me
};

