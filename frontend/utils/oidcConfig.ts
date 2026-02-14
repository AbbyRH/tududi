import { AuthProviderProps } from 'react-oidc-context';
import { WebStorageStateStore } from 'oidc-client-ts';

export interface OidcStatus {
    enabled: boolean;
    provider: string | null;
    issuer: string | null;
}

/**
 * Check if OIDC is enabled on the backend
 * @returns Promise<boolean> - True if OIDC is enabled
 */
export async function checkOidcEnabled(): Promise<boolean> {
    try {
        const response = await fetch('/api/auth/oidc/status', {
            credentials: 'include',
        });

        if (!response.ok) {
            console.error('Failed to check OIDC status:', response.statusText);
            return false;
        }

        const data: OidcStatus = await response.json();
        return data.enabled === true;
    } catch (error) {
        console.error('Failed to check OIDC status:', error);
        return false;
    }
}

/**
 * Get OIDC status from backend
 * @returns Promise<OidcStatus> - OIDC status object
 */
export async function getOidcStatus(): Promise<OidcStatus> {
    try {
        const response = await fetch('/api/auth/oidc/status', {
            credentials: 'include',
        });

        if (!response.ok) {
            return { enabled: false, provider: null, issuer: null };
        }

        return await response.json();
    } catch (error) {
        console.error('Failed to get OIDC status:', error);
        return { enabled: false, provider: null, issuer: null };
    }
}

/**
 * Get OIDC configuration for AuthProvider
 * Fetches configuration from backend and creates AuthProviderProps
 * @returns Promise<AuthProviderProps | null> - OIDC configuration or null if not available
 */
export async function getOidcConfig(): Promise<AuthProviderProps | null> {
    try {
        const status = await getOidcStatus();

        if (!status.enabled || !status.issuer) {
            return null;
        }

        // Fetch OIDC discovery document to get client_id
        // In production, this could be stored in config or fetched from backend
        const discoveryUrl = `${status.issuer}/.well-known/openid-configuration`;
        const discoveryResponse = await fetch(discoveryUrl);

        if (!discoveryResponse.ok) {
            console.error('Failed to fetch OIDC discovery document');
            return null;
        }

        const discovery = await discoveryResponse.json();

        // For now, we'll use a default client ID
        // This should be configured in environment variables or fetched from backend
        const clientId =
            (window as any).OIDC_CLIENT_ID ||
            process.env.REACT_APP_OIDC_CLIENT_ID ||
            'tududi-client';

        const config: AuthProviderProps = {
            authority: status.issuer,
            client_id: clientId,
            redirect_uri: window.location.origin + '/auth/oidc/callback',
            post_logout_redirect_uri: window.location.origin,
            scope: 'openid profile email roles',

            // Store tokens in localStorage (as per user preference)
            userStore: new WebStorageStateStore({
                store: window.localStorage,
            }),

            // Automatic silent renew
            automaticSilentRenew: true,

            // Handle redirect callback
            onSigninCallback: (user) => {
                // Clear URL parameters after authentication
                window.history.replaceState(
                    {},
                    document.title,
                    window.location.pathname
                );

                console.log('OIDC sign-in successful:', user?.profile?.email);
            },
        };

        return config;
    } catch (error) {
        console.error('Failed to get OIDC config:', error);
        return null;
    }
}
