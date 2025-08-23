/**
 * @copyright Copyright (c) 2024-2025 Ronan LE MEILLAT
 * @license MIT
 */

import { AUTH0_MANAGEMENT_SCOPES } from '../constants/auth0-scopes';

/**
 * Service for managing Auth0 Management API tokens with caching
 * Handles token generation using machine-to-machine credentials
 */
export class Auth0ManagementTokenService {
    private cache: KVNamespace;
    private env: Env;

    // Cache key for the management token
    private readonly CACHE_KEY = "auth0:management_token";

    // Buffer time before token expiration (5 minutes)
    private readonly EXPIRATION_BUFFER = 5 * 60;

    constructor(cache: KVNamespace, env: Env) {
        this.cache = cache;
        this.env = env;
    }

    /**
     * Get a valid Management API token, using cache when possible
     */
    async getManagementToken(): Promise<string | null> {
        try {
            // Try to get token from cache first
            const cachedToken = await this.getCachedToken();
            if (cachedToken) {
                return cachedToken;
            }

            // Generate new token if not cached or expired
            const newToken = await this.generateManagementToken();
            if (newToken) {
                await this.cacheToken(newToken);
                return newToken.access_token;
            }

            return null;
        } catch (error) {
            console.error("Error getting Management API token:", error);
            return null;
        }
    }

    /**
     * Get token from cache if valid and not expired
     */
    private async getCachedToken(): Promise<string | null> {
        try {
            const cachedData = await this.cache.get(this.CACHE_KEY, "json") as {
                access_token: string;
                expires_at: number;
            } | null;

            if (!cachedData) {
                return null;
            }

            const currentTime = Math.floor(Date.now() / 1000);
            const expiresAt = cachedData.expires_at;

            // Check if token is still valid (with buffer)
            if (currentTime < (expiresAt - this.EXPIRATION_BUFFER)) {
                console.log("Using cached Management API token");
                return cachedData.access_token;
            }

            // Token expired or about to expire, remove from cache
            await this.cache.delete(this.CACHE_KEY);
            console.log("Cached Management API token expired");
            return null;
        } catch (error) {
            console.error("Error reading cached token:", error);
            return null;
        }
    }

    /**
     * Generate a new Management API token using machine-to-machine credentials
     */
    private async generateManagementToken(): Promise<{
        access_token: string;
        expires_in: number;
        token_type: string;
    } | null> {
        try {
            const response = await fetch(`https://${this.env.AUTH0_DOMAIN}/oauth/token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    client_id: this.env.AUTH0_MANAGEMENT_CLIENT_ID,
                    client_secret: this.env.AUTH0_MANAGEMENT_CLIENT_SECRET,
                    audience: this.env.AUTH0_MANAGEMENT_AUDIENCE,
                    grant_type: 'client_credentials',
                    scope: AUTH0_MANAGEMENT_SCOPES
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Failed to generate Management API token:', response.status, errorText);
                return null;
            }

            const tokenData = await response.json() as {
                access_token: string;
                expires_in: number;
                token_type: string;
            };

            console.log("Generated new Management API token");
            return tokenData;
        } catch (error) {
            console.error('Error generating Management API token:', error);
            return null;
        }
    }

    /**
     * Cache the token with its expiration time
     */
    private async cacheToken(tokenData: {
        access_token: string;
        expires_in: number;
        token_type: string;
    }): Promise<void> {
        try {
            const currentTime = Math.floor(Date.now() / 1000);
            const expiresAt = currentTime + tokenData.expires_in;

            const cacheData = {
                access_token: tokenData.access_token,
                expires_at: expiresAt,
            };

            // Cache for the full token lifetime
            const ttl = tokenData.expires_in;

            await this.cache.put(
                this.CACHE_KEY,
                JSON.stringify(cacheData),
                { expirationTtl: ttl }
            );

            console.log(`Cached Management API token, expires in ${tokenData.expires_in} seconds`);
        } catch (error) {
            console.error("Error caching token:", error);
        }
    }

    /**
     * Clear the cached token (useful for testing or forced refresh)
     */
    async clearCache(): Promise<void> {
        try {
            await this.cache.delete(this.CACHE_KEY);
            console.log("Cleared Management API token cache");
        } catch (error) {
            console.error("Error clearing token cache:", error);
        }
    }

    /**
     * Get cache statistics for debugging
     */
    async getCacheInfo(): Promise<{
        cached: boolean;
        expires_at?: number;
        remaining_time?: number;
    }> {
        try {
            const cachedData = await this.cache.get(this.CACHE_KEY, "json") as {
                access_token: string;
                expires_at: number;
            } | null;

            if (!cachedData) {
                return { cached: false };
            }

            const currentTime = Math.floor(Date.now() / 1000);
            const remainingTime = cachedData.expires_at - currentTime;

            return {
                cached: true,
                expires_at: cachedData.expires_at,
                remaining_time: remainingTime,
            };
        } catch (error) {
            console.error("Error getting cache info:", error);
            return { cached: false };
        }
    }
}
