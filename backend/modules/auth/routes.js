'use strict';

const express = require('express');
const router = express.Router();
const authController = require('./controller');
const { authLimiter } = require('../../middleware/rateLimiter');

// Traditional authentication routes
router.get('/version', authController.getVersion);
router.get('/registration-status', authController.getRegistrationStatus);
router.post('/register', authController.register);
router.get('/verify-email', authController.verifyEmail);
router.get('/current_user', authController.getCurrentUser);
router.post('/login', authLimiter, authController.login);
router.get('/logout', authController.logout);

// OIDC authentication routes
const oidcRoutes = require('./oidcRoutes');
router.use('/auth', oidcRoutes);

module.exports = router;
