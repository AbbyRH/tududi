import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * OIDC Callback component
 * Handles the OAuth callback after Keycloak authentication
 * Since we're using backend-based OIDC flow, this component just shows a loading state
 * The actual callback is handled by the backend at /api/auth/oidc/callback
 */
export function OidcCallback(): JSX.Element {
    const navigate = useNavigate();

    useEffect(() => {
        // Check if we were redirected here with success
        const params = new URLSearchParams(window.location.search);
        const oidcSuccess = params.get('oidc');

        if (oidcSuccess === 'success') {
            // Dispatch event to notify App component
            window.dispatchEvent(new Event('userLoggedIn'));

            // Redirect to home
            setTimeout(() => {
                navigate('/today');
            }, 100);
        } else {
            // If no success param, redirect to login
            setTimeout(() => {
                navigate('/login');
            }, 2000);
        }
    }, [navigate]);

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    Completing sign-in...
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                    Please wait while we finalize your authentication.
                </p>
            </div>
        </div>
    );
}
