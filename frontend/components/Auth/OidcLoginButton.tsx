import React from 'react';

interface OidcLoginButtonProps {
    onLogin: () => void;
    loading?: boolean;
}

export function OidcLoginButton({
    onLogin,
    loading = false,
}: OidcLoginButtonProps): JSX.Element {
    return (
        <button
            onClick={onLogin}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        >
            {loading ? (
                <span>Loading...</span>
            ) : (
                <>
                    <svg
                        className="w-5 h-5 mr-2"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" />
                    </svg>
                    Sign in with Keycloak
                </>
            )}
        </button>
    );
}
