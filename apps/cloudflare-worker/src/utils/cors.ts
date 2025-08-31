/**
 * MIT License
 *
 * Copyright (c) 2025 Ronan LE MEILLAT
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

/**
 * Generate CORS headers based on the request origin and allowed origins
 * @param env Environment variables containing CORS_ORIGIN
 * @param origin The origin from the request
 * @returns CORS headers object or null if origin is not allowed
 */
export function corsHeader(env: Env, origin: string): Record<string, string> | null {
    // Validate origin format
    if (!origin || typeof origin !== 'string') {
        return null;
    }

    // Basic URL validation
    try {
        new URL(origin);
    } catch {
        return null;
    }

    // Get allowed origins from env.CORS_ORIGIN (comma-separated list)
    const allowedOrigins = env.CORS_ORIGIN ? env.CORS_ORIGIN.split(',').map(o => o.trim()) : [];

    // Check if origin is in the allowed list
    const isAllowed = allowedOrigins.includes('*') || allowedOrigins.includes(origin);

    if (!isAllowed) {
        // Log security event without exposing sensitive data
        console.warn(`CORS: Origin ${origin} not in allowed list`);
        return null; // Don't return headers for unauthorized origins
    }

    return {
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
        "Access-Control-Allow-Credentials": "true", // Only if credentials are needed
        "Content-Type": "application/json",
    };
}
