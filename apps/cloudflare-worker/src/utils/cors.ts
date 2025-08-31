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
 * @returns CORS headers object
 */
export function corsHeader(env: Env, origin: string): Record<string, string> {
    // Get allowed origins from env.CORS_ORIGIN (comma-separated list)
    const allowedOrigins = env.CORS_ORIGIN ? env.CORS_ORIGIN.split(',').map(o => o.trim()) : ['*'];

    // Check if origin is in the allowed list
    const isAllowed = allowedOrigins.includes('*') || allowedOrigins.includes(origin);

    let allowOrigin: string;
    if (isAllowed) {
        allowOrigin = origin;
    } else {
        // Generate a random hostname and domain
        const randomId = crypto.randomUUID().substring(0, 8);
        allowOrigin = `random-${randomId}.invalid`;
        console.warn('CORS Check:', { origin, isAllowed, allowedOrigins });
    }

    return {
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Origin": allowOrigin,
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
        "Content-Type": "application/json",
    };
}
