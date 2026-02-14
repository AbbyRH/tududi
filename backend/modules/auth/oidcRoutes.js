const express = require('express');
const passport = require('passport');
const router = express.Router();
const oidcService = require('./oidcService');
const { getConfig } = require('../../config/config');
const { getOidcIssuer } = require('../../middleware/oidcStrategy');

/**
 * Check if OIDC is enabled and configured
 * GET /api/auth/oidc/status
 */
router.get('/oidc/status', (req, res) => {
    const enabled = oidcService.isOidcEnabled();
    const config = getConfig();

    res.json({
        enabled,
        provider: enabled ? 'Keycloak' : null,
        issuer: enabled ? config.oidc.issuer : null,
    });
});

/**
 * Initiate OIDC authentication
 * GET /api/auth/oidc/login
 */
router.get('/oidc/login', (req, res, next) => {
    if (!oidcService.isOidcEnabled()) {
        return res.status(404).json({
            error: 'OIDC authentication not enabled',
        });
    }

    // Store return URL in session if provided
    if (req.query.returnTo) {
        req.session.oidcReturnTo = req.query.returnTo;
    }

    // Initiate OIDC authentication
    passport.authenticate('oidc')(req, res, next);
});

/**
 * OIDC callback handler
 * GET /api/auth/oidc/callback
 */
router.get(
    '/oidc/callback',
    passport.authenticate('oidc', {
        failureRedirect: '/login?error=oidc_failed',
        session: false, // We'll handle session manually
    }),
    async (req, res) => {
        try {
            // Set session user ID (compatible with existing auth)
            req.session.userId = req.user.id;
            req.session.authMethod = 'oidc';

            // Save session before redirect
            req.session.save((err) => {
                if (err) {
                    console.error('Session save error:', err);
                    return res.redirect('/login?error=session_error');
                }

                // Get return URL from session
                const returnTo = req.session.oidcReturnTo || '/today';
                delete req.session.oidcReturnTo;

                // Redirect to frontend
                const config = getConfig();
                const frontendUrl = config.frontendUrl;
                res.redirect(`${frontendUrl}${returnTo}?oidc=success`);
            });
        } catch (error) {
            console.error('OIDC callback error:', error);
            res.redirect('/login?error=oidc_callback_error');
        }
    }
);

/**
 * OIDC logout
 * POST /api/auth/oidc/logout
 */
router.post('/oidc/logout', async (req, res) => {
    const config = getConfig();
    const oidcIssuer = getOidcIssuer();

    // Get ID token for logout (if available)
    const idTokenHint = req.body.id_token;

    // Destroy session
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
        }

        // Build Keycloak logout URL if issuer is available
        let keycloakLogoutUrl = null;

        if (oidcIssuer && oidcIssuer.metadata.end_session_endpoint) {
            const logoutUrl = oidcIssuer.metadata.end_session_endpoint;
            const params = new URLSearchParams({
                post_logout_redirect_uri: config.oidc.logoutRedirectUrl,
                client_id: config.oidc.clientId,
            });

            if (idTokenHint) {
                params.append('id_token_hint', idTokenHint);
            }

            keycloakLogoutUrl = `${logoutUrl}?${params.toString()}`;
        }

        res.json({
            success: true,
            keycloakLogoutUrl,
        });
    });
});

module.exports = router;
