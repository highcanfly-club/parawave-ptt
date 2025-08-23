/**
 * @copyright Copyright (c) 2024-2025 Ronan LE MEILLAT
 * @license MIT
 */

/**
 * Auth0 Management API token response data
 */
export interface Auth0ManagementTokenData {
    /** The access token for Auth0 Management API */
    access_token: string;

    /** Token type, typically "Bearer" */
    token_type: string;

    /** Whether the token was retrieved from cache */
    cached: boolean;

    /** Token expiration time in seconds (optional, only if not expired) */
    expires_in?: number;
}

/**
 * Complete API response for Auth0 Management token endpoint
 */
export interface Auth0ManagementTokenResponse {
    success: boolean;
    data?: Auth0ManagementTokenData;
    error?: string;
    timestamp: string;
    version: string;
}
