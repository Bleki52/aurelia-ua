/**
 * ============================================================================
 * AURELIA UA — Authentication Controller
 * Handles user registration, login, JWT token issuance, and profile check.
 * ============================================================================
 */

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET } = require('../middleware/auth');
const emailService = require('../services/emailService');

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@aurelia.ua').toLowerCase();
const OTP_TTL_MS = 15 * 60 * 1000;

function generateOtpCode() {
  return String(crypto.randomInt(100000, 1000000));
}

function getOtpExpiry() {
  return new Date(Date.now() + OTP_TTL_MS).toISOString();
}

function getSafeRoleForUser(user) {
  if (!user) return 'USER';
  const cleanEmail = String(user.email || '').trim().toLowerCase();
  if (!cleanEmail.endsWith('@aurelia.ua')) {
    return 'USER';
  }
  const role = String(user.role || 'USER').toUpperCase();
  return (role === 'ADMIN' || role === 'QA') ? role : 'USER';
}

function signAuthToken(user) {
  const safeRole = getSafeRoleForUser(user);
  return jwt.sign(
    { id: user.id, email: user.email, role: safeRole, name: user.name },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

function sanitizeUserPayload(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: getSafeRoleForUser(user),
    is_verified: Boolean(user.is_verified)
  };
}

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

    const cleanEmail = String(email).trim().toLowerCase();
    if (cleanEmail.endsWith('@aurelia.ua')) {
      return res.status(403).json({
        error: 'Реєстрація корпоративних адрес @aurelia.ua заборонена. Використовуйте виданий акаунт персоналу.',
        code: 'RESTRICTED_DOMAIN'
      });
    }

    const rawName = typeof name === 'string' ? name.trim() : '';
    if (rawName && rawName.length < 2) {
      return res.status(400).json({
        error: 'Ім’я повинно містити щонайменше 2 символи.',
        code: 'INVALID_NAME'
      });
    }
    const cleanName = rawName || cleanEmail.split('@')[0];

    const reservedNames = Array.isArray(db.STAFF_ACCOUNTS)
      ? db.STAFF_ACCOUNTS.map(s => String(s.name || '').toLowerCase())
      : ['bleki', 'qa1', 'qa2'];
    if (reservedNames.includes(cleanName.toLowerCase())) {
      return res.status(403).json({
        error: 'Це ім’я користувача зарезервоване для персоналу AURELIA UA.',
        code: 'RESERVED_USERNAME'
      });
    }

    const existing = await db.findUserByEmail(cleanEmail);
    if (existing) {
      if (existing.is_verified === false) {
        const code = generateOtpCode();
        const expiresAt = getOtpExpiry();
        await db.setVerificationCode(cleanEmail, code, expiresAt);
        const mailRes = await emailService.sendVerificationEmail(cleanEmail, existing.name, code);

        return res.status(200).json({
          requiresVerification: true,
          email: cleanEmail,
          message: 'Код підтвердження надіслано на ваш Email',
          ...(mailRes && mailRes.devCode ? { devCode: mailRes.devCode } : {})
        });
      }

      return res.status(409).json({
        error: 'Користувач із такою електронною поштою вже зареєстрований.',
        code: 'USER_EXISTS'
      });
    }

    const existingByName = await db.findUserByIdentifier(cleanName);
    if (existingByName) {
      return res.status(409).json({
        error: 'Користувач із таким іменем (логіном) уже існує.',
        code: 'USERNAME_EXISTS'
      });
    }

    const role = 'USER';
    const password_hash = await bcrypt.hash(password, 10);

    const code = generateOtpCode();
    const expiresAt = getOtpExpiry();

    await db.createUser({
      name: cleanName,
      email: cleanEmail,
      password_hash,
      role,
      is_verified: false,
      verification_code: code,
      verification_expires: expiresAt
    });

    const mailRes = await emailService.sendVerificationEmail(cleanEmail, cleanName, code);

    return res.status(201).json({
      requiresVerification: true,
      email: cleanEmail,
      message: 'Код підтвердження надіслано на ваш Email',
      ...(mailRes && mailRes.devCode ? { devCode: mailRes.devCode } : {})
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
 * POST /api/auth/verify-email
 */
async function verifyEmail(req, res) {
  try {
    const { email, code } = req.body || {};
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanCode = String(code || '').trim();

    if (!cleanEmail || !cleanEmail.includes('@') || !/^\d{6}$/.test(cleanCode)) {
      return res.status(400).json({
        error: 'Вкажіть email та коректний 6-значний код підтвердження.',
        code: 'INVALID_OTP_PAYLOAD'
      });
    }

    const user = await db.findUserByEmail(cleanEmail);
    if (!user) {
      return res.status(404).json({
        error: 'Користувача з такою поштою не знайдено.',
        code: 'USER_NOT_FOUND'
      });
    }

    if (user.is_verified === true && !user.verification_code) {
      const token = signAuthToken(user);
      return res.status(200).json({
        message: 'Email вже підтверджено.',
        token,
        user: sanitizeUserPayload(user)
      });
    }

    const expiryMs = user.verification_expires ? new Date(user.verification_expires).getTime() : 0;
    if (!user.verification_code || String(user.verification_code) !== cleanCode) {
      return res.status(400).json({
        error: 'Невірний код підтвердження.',
        code: 'INVALID_VERIFICATION_CODE'
      });
    }
    if (!expiryMs || expiryMs <= Date.now()) {
      return res.status(400).json({
        error: 'Термін дії коду закінчився. Надішліть код повторно.',
        code: 'VERIFICATION_CODE_EXPIRED'
      });
    }

    const verifiedUser = await db.verifyUserEmail(cleanEmail);
    const token = signAuthToken(verifiedUser);

    return res.status(200).json({
      message: 'Email успішно підтверджено.',
      token,
      user: sanitizeUserPayload(verifiedUser)
    });
  } catch (err) {
    console.error('Помилка підтвердження email:', err);
    return res.status(500).json({
      error: 'Внутрішня помилка сервера при підтвердженні email.',
      code: 'SERVER_ERROR'
    });
  }
}

/**
 * POST /api/auth/resend-verification
 */
async function resendVerification(req, res) {
  try {
    const { email } = req.body || {};
    const cleanEmail = String(email || '').trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      return res.status(400).json({
        error: 'Вкажіть коректну адресу електронної пошти.',
        code: 'INVALID_EMAIL'
      });
    }

    const user = await db.findUserByEmail(cleanEmail);
    if (!user) {
      return res.status(404).json({
        error: 'Користувача з такою поштою не знайдено.',
        code: 'USER_NOT_FOUND'
      });
    }

    if (user.is_verified === true) {
      return res.status(400).json({
        error: 'Цей обліковий запис уже підтверджено. Можете увійти.',
        code: 'ALREADY_VERIFIED'
      });
    }

    const code = generateOtpCode();
    const expiresAt = getOtpExpiry();
    await db.setVerificationCode(cleanEmail, code, expiresAt);
    const mailRes = await emailService.sendVerificationEmail(cleanEmail, user.name, code);

    return res.status(200).json({
      requiresVerification: true,
      email: cleanEmail,
      message: 'Новий 6-значний код підтвердження надіслано на ваш Email',
      ...(mailRes && mailRes.devCode ? { devCode: mailRes.devCode } : {})
    });
  } catch (err) {
    console.error('Помилка повторного надсилання коду:', err);
    return res.status(500).json({
      error: 'Не вдалося надіслати код повторно.',
      code: 'SERVER_ERROR'
    });
  }
}

/**
 * POST /api/auth/login
 */
async function login(req, res) {
  try {
    const { identifier, email, password } = req.body || {};
    const loginId = String(identifier || email || '').trim();

    if (!loginId || !password) {
      return res.status(400).json({
        error: 'Введіть Email або ім’я користувача та пароль.',
        code: 'MISSING_CREDENTIALS'
      });
    }

    const user = await db.findUserByIdentifier(loginId);

    if (!user) {
      return res.status(401).json({
        error: 'Невірний логін/Email або пароль.',
        code: 'INVALID_CREDENTIALS'
      });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        error: 'Невірний логін/Email або пароль.',
        code: 'INVALID_CREDENTIALS'
      });
    }

    if (user.is_verified === false) {
      const code = generateOtpCode();
      const expiresAt = getOtpExpiry();
      await db.setVerificationCode(user.email, code, expiresAt);
      const mailRes = await emailService.sendVerificationEmail(user.email, user.name, code);

      return res.status(200).json({
        requiresVerification: true,
        email: user.email,
        message: 'Підтвердіть ваш Email — ми надіслали 6-значний код',
        ...(mailRes && mailRes.devCode ? { devCode: mailRes.devCode } : {})
      });
    }

    const token = signAuthToken(user);

    return res.status(200).json({
      message: 'Вхід успішний.',
      user: sanitizeUserPayload(user),
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
 * POST /api/auth/forgot-password
 */
async function forgotPassword(req, res) {
  try {
    const { email } = req.body || {};
    const cleanEmail = String(email || '').trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      return res.status(400).json({
        error: 'Вкажіть коректну адресу електронної пошти.',
        code: 'INVALID_EMAIL'
      });
    }

    const user = await db.findUserByEmail(cleanEmail);
    if (!user) {
      return res.status(404).json({
        error: 'Користувача з такою електронною поштою не знайдено.',
        code: 'USER_NOT_FOUND'
      });
    }

    const code = generateOtpCode();
    const expiresAt = getOtpExpiry();
    await db.setPasswordResetCode(cleanEmail, code, expiresAt);
    const mailRes = await emailService.sendPasswordResetEmail(cleanEmail, user.name, code);

    return res.status(200).json({
      success: true,
      email: cleanEmail,
      message: 'Код для відновлення пароля надіслано на Email',
      ...(mailRes && mailRes.devCode ? { devCode: mailRes.devCode } : {})
    });
  } catch (err) {
    console.error('Помилка відновлення пароля:', err);
    return res.status(500).json({
      error: 'Не вдалося надіслати код відновлення пароля.',
      code: 'SERVER_ERROR'
    });
  }
}

/**
 * POST /api/auth/reset-password
 */
async function resetPassword(req, res) {
  try {
    const { email, code, newPassword } = req.body || {};
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanCode = String(code || '').trim();

    if (!cleanEmail || !cleanEmail.includes('@') || !/^\d{6}$/.test(cleanCode)) {
      return res.status(400).json({
        error: 'Вкажіть email та коректний 6-значний код відновлення.',
        code: 'INVALID_RESET_PAYLOAD'
      });
    }

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        error: 'Новий пароль повинен містити щонайменше 6 символів.',
        code: 'WEAK_PASSWORD'
      });
    }

    const user = await db.findUserByEmail(cleanEmail);
    if (!user) {
      return res.status(404).json({
        error: 'Користувача з такою поштою не знайдено.',
        code: 'USER_NOT_FOUND'
      });
    }

    const expiryMs = user.reset_expires ? new Date(user.reset_expires).getTime() : 0;
    if (!user.reset_code || String(user.reset_code) !== cleanCode) {
      return res.status(400).json({
        error: 'Невірний код відновлення пароля.',
        code: 'INVALID_RESET_CODE'
      });
    }
    if (!expiryMs || expiryMs <= Date.now()) {
      return res.status(400).json({
        error: 'Термін дії коду закінчився. Запитайте новий код.',
        code: 'RESET_CODE_EXPIRED'
      });
    }

    const password_hash = await bcrypt.hash(newPassword, 10);
    const updatedUser = await db.resetUserPassword(cleanEmail, password_hash);
    const token = signAuthToken(updatedUser);

    return res.status(200).json({
      message: 'Пароль успішно оновлено.',
      token,
      user: sanitizeUserPayload(updatedUser)
    });
  } catch (err) {
    console.error('Помилка скидання пароля:', err);
    return res.status(500).json({
      error: 'Внутрішня помилка сервера при зміні пароля.',
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
  verifyEmail,
  resendVerification,
  login,
  forgotPassword,
  resetPassword,
  me
};

