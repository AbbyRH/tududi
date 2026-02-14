const passport = require('passport');
const OpenIDConnectStrategy = require('passport-openidconnect');
const { getConfig } = require('../config/config');
const oidcService = require('../modules/auth/oidcService');

let oidcConfiguration = null;

/**
 * Setup OIDC strategy with automatic discovery
 * Fetches configuration from .well-known/openid-configuration
 * @returns {Promise<void>}
 */
async function setupOidcStrategy() {
    const config = getConfig();

    if (!config.oidc.enabled) {
        console.log('OIDC authentication is disabled');
        return;
    }

    if (!config.oidc.issuer) {
        console.error(
            'OIDC_ISSUER is required when OIDC_ENABLED=true. Skipping OIDC setup.'
        );
        return;
    }

    if (!config.oidc.clientId) {
        console.error(
            'OIDC_CLIENT_ID is required when OIDC_ENABLED=true. Skipping OIDC setup.'
        );
        return;
    }

    try {
        console.log(
            `Discovering OIDC configuration from: ${config.oidc.issuer}`
        );

        // Dynamic import for ESM module openid-client (v6+)
        const oidcClient = await import('openid-client');

        // Automatic discovery using new v6 API - fetches everything from .well-known/openid-configuration
        oidcConfiguration = await oidcClient.discovery(
            new URL(config.oidc.issuer),
            config.oidc.clientId,
            config.oidc.clientSecret
        );

        console.log('OIDC Configuration discovered:');
        console.log(`  - Issuer: ${oidcConfiguration.serverMetadata().issuer}`);
        console.log(
            `  - Authorization endpoint: ${oidcConfiguration.serverMetadata().authorization_endpoint}`
        );
        console.log(
            `  - Token endpoint: ${oidcConfiguration.serverMetadata().token_endpoint}`
        );
        console.log(
            `  - UserInfo endpoint: ${oidcConfiguration.serverMetadata().userinfo_endpoint}`
        );
        console.log(
            `  - JWKS URI: ${oidcConfiguration.serverMetadata().jwks_uri}`
        );

        console.log(`OIDC Client configured: ${config.oidc.clientId}`);

        // Configure Passport strategy
        const metadata = oidcConfiguration.serverMetadata();
        passport.use(
            'oidc',
            new OpenIDConnectStrategy(
                {
                    issuer: metadata.issuer,
                    authorizationURL: metadata.authorization_endpoint,
                    tokenURL: metadata.token_endpoint,
                    userInfoURL: metadata.userinfo_endpoint,
                    clientID: config.oidc.clientId,
                    clientSecret: config.oidc.clientSecret,
                    callbackURL: config.oidc.callbackUrl,
                    scope: 'openid profile email roles', // Request roles scope
                },
                async (
                    issuer,
                    profile,
                    context,
                    idToken,
                    accessToken,
                    refreshToken,
                    done
                ) => {
                    try {
                        // Debug: log what we receive
                        console.log(
                            'OIDC callback - profile:',
                            JSON.stringify(profile, null, 2)
                        );
                        console.log(
                            'OIDC callback - context:',
                            JSON.stringify(context, null, 2)
                        );

                        // passport-openidconnect provides claims in different places
                        // idToken might be the raw token string, profile has the claims
                        // context.tokens has the parsed tokens

                        // Try to get claims from the right place
                        let claims = profile._json || profile._raw || profile;

                        // If context has tokens with claims, use those
                        if (
                            context &&
                            context.tokens &&
                            context.tokens.claims
                        ) {
                            claims = context.tokens.claims();
                        }

                        console.log(
                            'OIDC callback - claims:',
                            JSON.stringify(claims, null, 2)
                        );

                        // Extract roles from claims
                        const roles = oidcService.extractRoles(claims);

                        console.log(
                            `OIDC authentication callback for: ${claims.email || profile.emails?.[0]?.value}`
                        );
                        console.log(`Roles: ${roles.join(', ')}`);

                        // Just-in-time user provisioning with role mapping
                        const user = await oidcService.findOrCreateUserFromOidc(
                            {
                                issuer,
                                profile,
                                idToken: claims,
                                accessToken,
                                roles,
                            }
                        );

                        return done(null, user);
                    } catch (error) {
                        console.error('OIDC authentication error:', error);
                        console.error('Error stack:', error.stack);
                        return done(error);
                    }
                }
            )
        );

        console.log('OIDC strategy configured successfully');
    } catch (error) {
        console.error('Failed to setup OIDC strategy:', error);
        console.error(
            'OIDC authentication will not be available. Check your OIDC_ISSUER configuration.'
        );
    }
}

/**
 * Get OIDC configuration instance
 * @returns {object|null} - OIDC configuration or null if not configured
 */
function getOidcConfiguration() {
    return oidcConfiguration;
}

/**
 * Get OIDC issuer metadata
 * @returns {object|null} - OIDC issuer metadata or null if not configured
 */
function getOidcIssuer() {
    if (!oidcConfiguration) {
        return null;
    }
    return {
        metadata: oidcConfiguration.serverMetadata(),
    };
}

module.exports = {
    setupOidcStrategy,
    getOidcConfiguration,
    getOidcIssuer,
};
