# Keycloak OIDC Authentication Setup Guide

This guide provides step-by-step instructions for setting up Keycloak OIDC authentication with tududi.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Keycloak Setup](#keycloak-setup)
4. [Tududi Configuration](#tududi-configuration)
5. [Role Mapping](#role-mapping)
6. [Testing](#testing)
7. [Troubleshooting](#troubleshooting)

## Overview

Tududi supports OpenID Connect (OIDC) authentication with Keycloak, allowing users to log in using their Keycloak credentials. This integration provides:

- **Single Sign-On (SSO)**: Users can authenticate once and access multiple applications
- **Centralized User Management**: Manage users, roles, and permissions in Keycloak
- **Just-in-Time Provisioning**: Users are automatically created in tududi on first login
- **Role Mapping**: Keycloak roles are mapped to tududi admin/user roles
- **Coexistence**: OIDC works alongside traditional email/password authentication

## Prerequisites

- Keycloak server (version 20.0 or later recommended)
- tududi application with backend and frontend running
- Admin access to both Keycloak and tududi

## Keycloak Setup

### Step 1: Install Keycloak (if not already installed)

**Using Docker:**

```bash
docker run -d -p 8080:8080 \
  -e KEYCLOAK_ADMIN=admin \
  -e KEYCLOAK_ADMIN_PASSWORD=admin \
  quay.io/keycloak/keycloak:latest \
  start-dev
```

**Using Binary:**
Download from [keycloak.org](https://www.keycloak.org/downloads) and run:

```bash
bin/kc.sh start-dev
```

Access Keycloak admin console at: `http://localhost:8080`

### Step 2: Create a Realm

1. Log in to Keycloak admin console
2. Click **Create Realm** (top-left dropdown)
3. Enter realm name: `myrealm` (or any name you prefer)
4. Click **Create**

### Step 3: Create a Client

1. In your realm, navigate to **Clients** → **Create client**
2. Configure the client:

    **General Settings:**
    - **Client type**: OpenID Connect
    - **Client ID**: `tududi-client`
    - Click **Next**

    **Capability config:**
    - **Client authentication**: ON (for confidential client)
    - **Authorization**: OFF
    - **Standard flow**: ON (Authorization Code Flow)
    - **Direct access grants**: OFF (recommended for security)
    - **Implicit flow**: OFF (deprecated, not recommended)
    - Click **Next**

    **Login settings:**
    - **Root URL**: `http://localhost:8080`
    - **Home URL**: `http://localhost:8080`
    - **Valid redirect URIs**:
        - `http://localhost:3002/api/auth/oidc/callback`
        - `http://localhost:8080/*`
    - **Valid post logout redirect URIs**: `http://localhost:8080/*`
    - **Web origins**: `http://localhost:8080`
    - Click **Save**

3. Note the **Client Secret**:
    - Go to **Credentials** tab
    - Copy the **Client Secret** (you'll need this for tududi configuration)

### Step 4: Create Client Scope for Roles

1. Navigate to **Client Scopes** → **Create client scope**
2. Configure:
    - **Name**: `roles`
    - **Type**: Optional
    - **Protocol**: openid-connect
    - **Display on consent screen**: OFF
    - **Include in token scope**: ON
    - Click **Save**

3. Add mappers for roles:

    **Realm Roles Mapper:**
    - Go to **Mappers** tab → **Add mapper** → **By configuration**
    - Select **User Realm Role**
    - Configure:
        - **Name**: `realm-roles`
        - **Token Claim Name**: `realm_access.roles`
        - **Claim JSON Type**: String
        - **Add to ID token**: ON
        - **Add to access token**: ON
        - **Add to userinfo**: ON
        - Click **Save**

    **Client Roles Mapper:**
    - **Add mapper** → **By configuration**
    - Select **User Client Role**
        - **Name**: `client-roles`
        - **Client ID**: `tududi-client`
        - **Token Claim Name**: `resource_access.${client_id}.roles`
        - **Claim JSON Type**: String
        - **Add to ID token**: ON
        - **Add to access token**: ON
        - **Add to userinfo**: ON
        - Click **Save**

### Step 5: Assign Client Scope to Client

1. Go to **Clients** → **tududi-client**
2. Go to **Client scopes** tab
3. Click **Add client scope**
4. Select `roles` scope
5. Choose **Default** (to include it automatically)
6. Click **Add**

### Step 6: Create Roles

1. Navigate to **Realm roles** → **Create role**
2. Create admin role:
    - **Role name**: `admin`
    - **Description**: `tududi Administrator`
    - Click **Save**

3. Create user role (optional):
    - **Role name**: `user`
    - **Description**: `tududi User`
    - Click **Save**

### Step 7: Create a Test User

1. Navigate to **Users** → **Add user**
2. Configure:
    - **Username**: `testuser`
    - **Email**: `[[email protected]]`
    - **First name**: `Test`
    - **Last name**: `User`
    - **Email verified**: ON
    - **Enabled**: ON
    - Click **Create**

3. Set password:
    - Go to **Credentials** tab
    - Click **Set password**
    - Enter password (e.g., `password123`)
    - **Temporary**: OFF
    - Click **Save**

4. Assign role:
    - Go to **Role mapping** tab
    - Click **Assign role**
    - Select `admin` role
    - Click **Assign**

## Tududi Configuration

### Step 1: Update Backend Environment Variables

Edit `backend/.env`:

```bash
# Enable OIDC authentication
OIDC_ENABLED=true

# Keycloak realm URL (must include /realms/your-realm-name)
OIDC_ISSUER=http://localhost:8080/realms/myrealm

# Client ID from Keycloak
OIDC_CLIENT_ID=tududi-client

# Client Secret from Keycloak (from Step 3 above)
OIDC_CLIENT_SECRET=your-client-secret-here

# Optional: Override default URLs if needed
# OIDC_CALLBACK_URL=http://localhost:3002/api/auth/oidc/callback
# OIDC_LOGOUT_REDIRECT_URL=http://localhost:8080

# Optional: Customize admin roles (default: admin,realm-admin)
# OIDC_ADMIN_ROLES=admin,realm-admin
```

### Step 2: Run Database Migration

```bash
cd backend
npm run db:migrate
```

This creates the `oidc_user_links` table for linking Keycloak identities to tududi users.

### Step 3: Restart Tududi

```bash
# In project root
npm run start
```

Check the backend console for:

```
Discovering OIDC configuration from: http://localhost:8080/realms/myrealm
OIDC Issuer discovered:
  - Issuer: http://localhost:8080/realms/myrealm
  - Authorization endpoint: http://localhost:8080/realms/myrealm/protocol/openid-connect/auth
  - Token endpoint: http://localhost:8080/realms/myrealm/protocol/openid-connect/token
  ...
OIDC strategy configured successfully
```

## Role Mapping

### How Roles Work

Tududi maps Keycloak roles to user permissions:

- **Admin Roles**: Users with `admin` or `realm-admin` role in Keycloak become administrators in tududi
- **Regular Users**: All other users have standard user permissions

### Configuring Admin Roles

You can customize which Keycloak roles grant admin access by setting `OIDC_ADMIN_ROLES`:

```bash
# Multiple roles separated by comma
OIDC_ADMIN_ROLES=admin,superuser,realm-admin
```

### Role Priority

If a user has multiple roles, admin roles take precedence:

- If user has `admin` → tududi admin
- If user has `user` → tududi regular user
- If user has both → tududi admin (admin wins)

## Testing

### Test OIDC Login Flow

1. **Navigate to tududi login page**: `http://localhost:8080/login`

2. **Verify OIDC button appears**:
    - You should see "Sign in with Keycloak" button below the email/password form
    - If not visible, check backend logs for OIDC configuration errors

3. **Click "Sign in with Keycloak"**:
    - You'll be redirected to Keycloak login page
    - URL should be: `http://localhost:8080/realms/myrealm/protocol/openid-connect/auth?...`

4. **Enter Keycloak credentials**:
    - Username: `testuser`
    - Password: `password123` (or what you set)

5. **Grant consent** (if prompted):
    - Click **Yes** to grant permissions

6. **Verify successful login**:
    - You should be redirected back to tududi at `/today`
    - Check backend logs for:
        ```
        OIDC authentication callback for: [[email protected]]
        Roles: admin
        OIDC user provisioned: [[email protected]] (admin: true)
        ```

7. **Verify user in database**:
    ```bash
    sqlite3 backend/db/development.sqlite3
    SELECT * FROM users WHERE email = '[[email protected]]';
    SELECT * FROM oidc_user_links;
    ```

### Test Role Mapping

1. **Check admin access**:
    - Navigate to `/profile`
    - Verify "API Keys" tab is visible (admin only)
    - Try accessing `/admin/users` (should work for admin)

2. **Test non-admin user**:
    - Create another Keycloak user without admin role
    - Login with that user
    - Verify limited permissions

### Test Account Linking

1. **Create tududi user with same email**:
    - Use traditional registration: `/register`
    - Email: `[[email protected]]`

2. **Login with Keycloak**:
    - Use Keycloak credentials for same email
    - User should be automatically linked

3. **Verify in database**:
    ```sql
    SELECT u.email, o.provider, o.issuer
    FROM users u
    JOIN oidc_user_links o ON u.id = o.user_id;
    ```

## Troubleshooting

### OIDC Button Not Appearing

**Symptoms**: "Sign in with Keycloak" button missing on login page

**Solutions**:

1. Check backend environment:

    ```bash
    echo $OIDC_ENABLED  # Should be "true"
    ```

2. Check backend logs:

    ```
    OIDC authentication is disabled
    ```

    → Set `OIDC_ENABLED=true` in `.env`

3. Verify OIDC status endpoint:
    ```bash
    curl http://localhost:3002/api/auth/oidc/status
    # Should return: {"enabled":true,"provider":"Keycloak","issuer":"..."}
    ```

### Discovery Failed

**Symptoms**: Backend logs show discovery errors

**Error**: `Failed to setup OIDC strategy: Error: Discovery failed`

**Solutions**:

1. Verify Keycloak is running:

    ```bash
    curl http://localhost:8080/realms/myrealm/.well-known/openid-configuration
    ```

2. Check OIDC_ISSUER format:
    - ✅ Correct: `http://localhost:8080/realms/myrealm`
    - ❌ Wrong: `http://localhost:8080` (missing realm)
    - ❌ Wrong: `http://localhost:8080/realms/myrealm/` (trailing slash)

3. Check network connectivity:
    ```bash
    # From backend container/environment
    curl -v http://localhost:8080/realms/myrealm/.well-known/openid-configuration
    ```

### Authentication Fails

**Symptoms**: Redirected to login with error

**Error**: `oidc_failed` in URL

**Solutions**:

1. Check Valid Redirect URIs in Keycloak:
    - Must include: `http://localhost:3002/api/auth/oidc/callback`
    - Wildcard OK: `http://localhost:3002/*`

2. Check Client Secret:
    - Verify `OIDC_CLIENT_SECRET` matches Keycloak
    - Regenerate if unsure (Keycloak → Client → Credentials → Regenerate secret)

3. Check backend logs:
    ```
    OIDC authentication error: <error details>
    ```

### User Not Created

**Symptoms**: Authentication succeeds but user not in tududi

**Solutions**:

1. Check backend logs for errors:

    ```
    OIDC user provisioning: [[email protected]]
    OIDC user created: [[email protected]] (admin: true)
    ```

2. Verify email claim in token:
    - Keycloak → Client Scopes → `profile` → Mappers
    - Ensure `email` mapper exists and is enabled

3. Check database migration:
    ```bash
    npm run db:status
    # Verify oidc_user_links migration ran
    ```

### Roles Not Working

**Symptoms**: User should be admin but isn't

**Solutions**:

1. Verify role assignment in Keycloak:
    - Users → `testuser` → Role mapping
    - Should show `admin` role

2. Check roles in token:
    - Use JWT decoder: [jwt.io](https://jwt.io)
    - Look for `realm_access.roles` or `resource_access.tududi-client.roles`

3. Verify client scope includes roles:
    - Clients → `tududi-client` → Client scopes
    - `roles` scope should be in "Assigned default client scopes"

4. Check backend logs:
    ```
    OIDC user provisioning: ... (roles: admin, user, admin: true)
    ```

### Session Issues

**Symptoms**: User logged out unexpectedly

**Solutions**:

1. Check session cookie:
    - Browser DevTools → Application → Cookies
    - Should have `connect.sid` cookie

2. Verify session secret:
    - Ensure `TUDUDI_SESSION_SECRET` is set and not changing

3. Check session store:
    ```bash
    sqlite3 backend/db/development.sqlite3
    SELECT * FROM Sessions;
    ```

## Production Considerations

### Security Best Practices

1. **Use HTTPS**:

    ```bash
    OIDC_ISSUER=https://keycloak.yourdomain.com/realms/production
    OIDC_CALLBACK_URL=https://tududi.yourdomain.com/api/auth/oidc/callback
    ```

2. **Secure client secret**:
    - Use environment variables, not hardcoded values
    - Rotate regularly
    - Never commit to version control

3. **Restrict redirect URIs**:
    - Use exact URLs, not wildcards
    - Example: `https://tududi.yourdomain.com/api/auth/oidc/callback`

4. **Enable PKCE** (handled automatically by tududi)

5. **Configure CORS properly**:
    ```bash
    TUDUDI_ALLOWED_ORIGINS=https://tududi.yourdomain.com
    ```

### Performance Optimization

1. **Token caching**: OIDC tokens are stored in localStorage (frontend)

2. **Session management**: Sessions persist for 30 days by default

3. **JWKS caching**: Public keys are cached automatically by `openid-client`

### High Availability

1. **Keycloak clustering**: Set up multiple Keycloak instances

2. **Database replication**: Use PostgreSQL for Keycloak (not H2)

3. **Session store**: Consider Redis for session storage

## Additional Resources

- [Keycloak Documentation](https://www.keycloak.org/documentation)
- [OpenID Connect Specification](https://openid.net/specs/openid-connect-core-1_0.html)
- [OAuth 2.0 Security Best Practices](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics)
- [tududi GitHub Issues](https://github.com/yourusername/tududi/issues)

## Support

If you encounter issues not covered in this guide:

1. Check backend logs: `backend/logs/` or console output
2. Check browser console for frontend errors
3. Enable debug mode: `DEBUG=oidc:* npm run backend:dev`
4. Create an issue on GitHub with:
    - Steps to reproduce
    - Backend/frontend logs
    - Environment details (Keycloak version, Node version, etc.)
