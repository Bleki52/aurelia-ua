/**
 * ============================================================================
 * AURELIA UA — Authentication & Authorization Middleware
 * Validates JWT tokens and enforces role-based access control (RBAC).
 * ============================================================================
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'aurelia_jwt_super_secret_key_2026';

/**
 * Extracts and verifies JWT from Bearer header.
 */
function extractVerifiedToken(req) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;

  try {
    return jwt.verify(parts[1], JWT_SECRET);
  } catch (err) {
    return null;
  }
}

/**
 * Dual-mode helper / middleware:
 * - When called as verifyToken(req), returns decoded JWT payload or null.
 * - When mounted as Express middleware (req, res, next), enforces authentication.
 */
function verifyToken(req, res, next) {
  if (!res || typeof next !== 'function') {
    return extractVerifiedToken(req);
  }

  const decoded = extractVerifiedToken(req);
  if (!decoded) {
    return res.status(401).json({
      error: 'Необхідна авторизація. Будь ласка, увійдіть до системи.',
      code: 'UNAUTHORIZED'
    });
  }
  req.user = decoded;
  next();
}

/**
 * Middleware: Requires a valid authenticated user.
 */
function requireAuth(req, res, next) {
  return verifyToken(req, res, next);
}

/**
 * Middleware: Requires an authenticated user with ADMIN role.
 */
function requireAdmin(req, res, next) {
  const decoded = extractVerifiedToken(req);
  if (!decoded) {
    return res.status(401).json({
      error: 'Необхідна авторизація для доступу до адміністративної зони.',
      code: 'UNAUTHORIZED'
    });
  }

  if (decoded.role !== 'ADMIN') {
    return res.status(403).json({
      error: 'Доступ заборонено. Потрібні права адміністратора.',
      code: 'FORBIDDEN'
    });
  }

  req.user = decoded;
  next();
}

/**
 * Middleware: Optional authentication (attaches req.user if token valid, but does not block).
 */
function optionalAuth(req, res, next) {
  const decoded = extractVerifiedToken(req);
  if (decoded) {
    req.user = decoded;
  }
  next();
}

module.exports = {
  verifyToken,
  requireAuth,
  requireAdmin,
  optionalAuth,
  JWT_SECRET
};

