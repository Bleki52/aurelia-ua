/**
 * ============================================================================
 * AURELIA UA — Authentication Routes
 * Endpoints for user registration, login, and profile check.
 * ============================================================================
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');

/**
 * POST /api/auth/register
 * Register a new user account.
 */
router.post('/register', authController.register);

/**
 * POST /api/auth/login
 * Log in with email and password, receives JWT token.
 */
router.post('/login', authController.login);

/**
 * GET /api/auth/me
 * Protected endpoint returning the profile of the authenticated user.
 */
router.get('/me', requireAuth, authController.me);

module.exports = router;

