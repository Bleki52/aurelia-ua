/**
 * ============================================================================
 * AURELIA UA — Authentication Routes
 * Endpoints for user registration, login, and profile check.
 * ============================================================================
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');

/**
 * POST /api/auth/register
 * Register a new user account.
 */
router.post('/register', authController.register);

/**
 * POST /api/auth/verify-email
 * Verify a 6-digit registration code and issue JWT token.
 */
router.post('/verify-email', authController.verifyEmail);

/**
 * POST /api/auth/resend-verification
 * Re-generate and send a 6-digit verification code.
 */
router.post('/resend-verification', authController.resendVerification);

/**
 * POST /api/auth/login
 * Log in with email and password, receives JWT token (or verification prompt).
 */
router.post('/login', authController.login);

/**
 * POST /api/auth/forgot-password
 * Send a 6-digit password reset code via Brevo HTTPS API.
 */
router.post('/forgot-password', authController.forgotPassword);

/**
 * POST /api/auth/reset-password
 * Verify 6-digit reset code, update password, and return JWT token.
 */
router.post('/reset-password', authController.resetPassword);

/**
 * GET /api/auth/me
 * Protected endpoint returning the profile of the authenticated user.
 */
router.get('/me', verifyToken, authController.me);

/**
 * POST /api/auth/heartbeat
 * Updates last_seen_at and syncs basket state for admin tracking / remote basket clearing.
 */
router.post('/heartbeat', verifyToken, authController.heartbeat);

module.exports = router;

