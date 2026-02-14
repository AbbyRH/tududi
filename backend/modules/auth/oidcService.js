const { getConfig } = require('../../config/config');

/**
 * Determine if user should be admin based on Keycloak roles
 * @param {string[]} roles - Array of role names from OIDC token
 * @returns {boolean} - True if user has admin role
 */
function isAdminRole(roles) {
    const config = getConfig();

    // Default admin roles: admin, realm-admin
    const adminRoles = config.oidc.adminRoles || ['admin', 'realm-admin'];

    // Check if user has any admin role (case-insensitive)
    return roles.some((role) =>
        adminRoles.some(
            (adminRole) => role.toLowerCase() === adminRole.toLowerCase()
        )
    );
}

/**
 * Extract roles from Keycloak ID token
 * Checks both realm_access and resource_access
 * @param {object} idToken - Decoded ID token from Keycloak
 * @returns {string[]} - Array of role names
 */
function extractRoles(idToken) {
    const config = getConfig();
    const roles = [];

    // Realm roles (global)
    if (idToken.realm_access && Array.isArray(idToken.realm_access.roles)) {
        roles.push(...idToken.realm_access.roles);
    }

    // Client-specific roles
    const clientId = config.oidc.clientId;

    if (
        idToken.resource_access &&
        idToken.resource_access[clientId] &&
        Array.isArray(idToken.resource_access[clientId].roles)
    ) {
        roles.push(...idToken.resource_access[clientId].roles);
    }

    return roles;
}

/**
 * Find or create user from OIDC authentication with role mapping
 * Implements just-in-time provisioning with attribute mapping
 * @param {object} params - Parameters for user provisioning
 * @param {string} params.issuer - OIDC issuer URL
 * @param {object} params.profile - User profile from OIDC provider
 * @param {object} params.idToken - Decoded ID token
 * @param {string} params.accessToken - Access token
 * @param {string[]} params.roles - Roles extracted from token
 * @returns {Promise<object>} - User object with role
 */
async function findOrCreateUserFromOidc({
    issuer,
    profile,
    idToken,
    roles = [],
}) {
    const { User, OidcUserLink, Role } = require('../../models');

    // Extract user info from various possible locations
    const email = idToken.email || profile.emails?.[0]?.value || profile.email;
    const givenName =
        idToken.given_name ||
        profile.name?.givenName ||
        profile.givenName ||
        profile.name;
    const familyName =
        idToken.family_name ||
        profile.name?.familyName ||
        profile.familyName ||
        profile.surname;
    const sub =
        typeof idToken.sub === 'function'
            ? idToken.sub
            : idToken.sub || profile.id;
    const emailVerified =
        idToken.email_verified || profile.emails?.[0]?.verified || false;

    console.log('OIDC user provisioning - extracted data:', {
        email,
        givenName,
        familyName,
        sub,
        emailVerified,
        roles,
    });

    // Determine if user should be admin
    const shouldBeAdmin = isAdminRole(roles);

    console.log(
        `OIDC user provisioning: ${email} (roles: ${roles.join(', ')}, admin: ${shouldBeAdmin})`
    );

    // Check if this OIDC identity is already linked
    let oidcLink = await OidcUserLink.findOne({
        where: {
            provider: 'keycloak',
            provider_user_id: sub,
            issuer: issuer,
        },
        include: [
            {
                model: User,
                include: [{ model: Role }],
            },
        ],
    });

    if (oidcLink) {
        // Update existing user
        await oidcLink.User.update({
            email,
            name: givenName,
            surname: familyName,
            email_verified: emailVerified,
        });

        // Update admin role if it exists
        if (oidcLink.User.Role) {
            await oidcLink.User.Role.update({
                is_admin: shouldBeAdmin,
            });
        }

        console.log(`OIDC user updated: ${email}`);
        return oidcLink.User;
    }

    // Check if user exists by email (account linking)
    let user = await User.findOne({
        where: { email },
        include: [{ model: Role }],
    });

    if (!user) {
        // Create new user (just-in-time provisioning)
        user = await User.create({
            email,
            name: givenName,
            surname: familyName,
            email_verified: emailVerified,
            // No password needed for OIDC users - they authenticate via Keycloak
            // Set a dummy password_digest to satisfy NOT NULL constraint
            password_digest: 'oidc_user_no_password',
        });
        if (user.Role) {
            await user.Role.update({
                is_admin: shouldBeAdmin,
            });
        }

        console.log(`OIDC user created: ${email} (admin: ${shouldBeAdmin})`);
    } else {
        // Update admin status for existing user if role exists
        if (user.Role) {
            await user.Role.update({
                is_admin: shouldBeAdmin,
            });
        }

        console.log(`OIDC user linked to existing account: ${email}`);
    }

    // Link OIDC identity to user
    await OidcUserLink.create({
        user_id: user.id,
        provider: 'keycloak',
        provider_user_id: sub,
        issuer: issuer,
    });

    console.log(`OIDC identity linked: ${email}`);

    return user;
}

/**
 * Check if OIDC is enabled
 * @returns {boolean} - True if OIDC is enabled
 */
function isOidcEnabled() {
    const config = getConfig();
    return config.oidc.enabled;
}

module.exports = {
    findOrCreateUserFromOidc,
    isOidcEnabled,
    isAdminRole,
    extractRoles,
};
