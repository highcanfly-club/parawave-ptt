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

import { checkPermissions } from "./auth0";
import { PTTAPIHandler } from "./handlers/api-handler";
import { PTTChannelDurableObject } from "./durable-objects/ptt-channel-do";
import { corsHeader } from "./utils/cors";

// Export Durable Object class
export { PTTChannelDurableObject };

/**
 * Handle requests to channel Durable Objects for real-time operations
 * Path: /channel/{uuid}/{operation}
 */
async function handleChannelDurableObjectRequest(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url);
	const pathParts = url.pathname.split('/').filter(Boolean);

	// Expected path: /channel/{uuid}/{operation}
	if (pathParts.length < 2 || pathParts[0] !== 'channel') {
		return new Response('Invalid channel path', { status: 400 });
	}

	const channelUuid = pathParts[1];
	const operation = pathParts[2] || 'status';

	// Get Durable Object instance for this channel
	const durableObjectId = env.CHANNEL_OBJECTS.idFromName(channelUuid);
	const durableObject = env.CHANNEL_OBJECTS.get(durableObjectId);

	// Forward request to Durable Object with adjusted path
	const forwardUrl = new URL(request.url);
	forwardUrl.pathname = '/' + pathParts.slice(2).join('/') || '/status';

	const forwardedRequest = new Request(forwardUrl.toString(), {
		method: request.method,
		headers: request.headers,
		body: request.body,
	});

	const response = await durableObject.fetch(forwardedRequest);

	// Add CORS headers to response
	const origin = request.headers.get('Origin') || '';
	const corsHeaders = corsHeader(env, origin);

	if (!corsHeaders) {
		// Origin not allowed - return 403
		return new Response('CORS policy violation', { status: 403 });
	}

	const newHeaders = new Headers(response.headers);
	Object.entries(corsHeaders).forEach(([key, value]) => {
		newHeaders.set(key, value);
	});

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers: newHeaders,
	});
}

/**
 * Legacy request handler for backward compatibility
 * Used for initial testing and simple authentication validation
 */
async function handleLegacyRequest(request: Request, env: Env): Promise<Response> {
	const token = request.headers.get("Authorization")?.split(" ")[1];
	const origin = request.headers.get('Origin') || '';
	const corsHeaders = corsHeader(env, origin);

	if (!token) {
		return new Response(
			JSON.stringify({
				error: "Missing Authorization token",
				code: 'MISSING_TOKEN'
			}),
			{
				status: 401,
				headers: {
					...corsHeaders,
					'Content-Type': 'application/json'
				},
			}
		);
	}

	try {
		const { access, payload } = await checkPermissions(
			token,
			env.READ_PERMISSION || 'read:api',
			env,
		);

		if (access) {
			return new Response(
				JSON.stringify({
					service: "ParaWave PTT Backend",
					message: "Authentication successful",
					authenticatedUser: payload.sub,
					permissions: payload.permissions,
					timestamp: new Date().toISOString(),
					deprecated: true,
					migration: {
						notice: "This endpoint is deprecated. Please use /api/v1/ endpoints instead.",
						new_endpoints: {
							channels: "/api/v1/channels",
							health: "/api/v1/health"
						}
					}
				}),
				{
					headers: {
						...corsHeaders,
						'Content-Type': 'application/json'
					},
				}
			);
		}

		return new Response(
			JSON.stringify({
				error: "Access denied - insufficient permissions",
				code: 'INSUFFICIENT_PERMISSIONS'
			}),
			{
				status: 403,
				headers: {
					...corsHeaders,
					'Content-Type': 'application/json'
				},
			}
		);

	} catch (error) {
		console.error('Legacy authentication error:', error);
		return new Response(
			JSON.stringify({
				error: "Authentication failed",
				code: 'AUTH_FAILED'
			}),
			{
				status: 401,
				headers: {
					...corsHeaders,
					'Content-Type': 'application/json'
				},
			}
		);
	}
}

/**
 * Handle PTT WebSocket connections
 * Routes WebSocket connections for PTT audio transmission to appropriate channel Durable Objects
 */
async function handlePTTWebSocketRequest(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url);
	const pathParts = url.pathname.split('/');

	// Expected path: /ptt/channel/{channelId}
	if (pathParts.length < 4 || pathParts[1] !== 'ptt' || pathParts[2] !== 'channel') {
		return new Response('Invalid PTT WebSocket path', { status: 400 });
	}

	const channelId = pathParts[3];

	if (!channelId) {
		return new Response('Channel ID required', { status: 400 });
	}

	// Validate WebSocket upgrade
	if (request.headers.get('Upgrade') !== 'websocket') {
		return new Response('WebSocket upgrade required', { status: 400 });
	}

	// Get the channel Durable Object
	const channelId32 = env.CHANNEL_OBJECTS.idFromName(channelId);
	const channelObj = env.CHANNEL_OBJECTS.get(channelId32);

	// Forward WebSocket connection to the channel Durable Object
	return channelObj.fetch(request);
}

/**
 * Main Cloudflare Worker entry point
 * Handles PTT API requests and channel management
 */
export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const { pathname } = new URL(request.url);

		// Rate limiting
		const { success } = await env.RATE_LIMITER.limit({ key: pathname });
		if (!success) {
			const origin = request.headers.get('Origin') || '';
			const corsHeaders = corsHeader(env, origin);
			if (!corsHeaders) {
				return new Response('CORS policy violation', { status: 403 });
			}
			return new Response(
				JSON.stringify({
					error: `Rate limit exceeded for ${pathname}`,
					code: 'RATE_LIMIT_EXCEEDED'
				}),
				{
					status: 429,
					headers: {
						...corsHeaders,
						'Content-Type': 'application/json'
					},
				},
			);
		}

		// Handle CORS preflight requests
		if (request.method === "OPTIONS") {
			const origin = request.headers.get('Origin') || '';
			const corsHeaders = corsHeader(env, origin);
			if (!corsHeaders) {
				return new Response('CORS policy violation', { status: 403 });
			}
			return new Response(null, {
				status: 204,
				headers: {
					...corsHeaders,
					"Access-Control-Allow-Credentials": "true",
				},
			});
		}

		try {
			// Route API requests to dedicated handler
			if (pathname.startsWith('/api/v1/')) {
				const apiHandler = new PTTAPIHandler(env.PTT_DB, env.PTT_CACHE, env, env.CORS_ORIGIN);
				return await apiHandler.handleAPIRequest(request, env);
			}

			// Route channel real-time operations to Durable Objects
			if (pathname.startsWith('/channel/')) {
				return await handleChannelDurableObjectRequest(request, env);
			}

			// Route PTT WebSocket connections directly to channel Durable Objects
			if (pathname.startsWith('/ptt/channel/') && request.headers.get('Upgrade') === 'websocket') {
				return await handlePTTWebSocketRequest(request, env);
			}

			// Legacy endpoint for backward compatibility
			if (pathname === "/" && request.headers.has("Authorization")) {
				return await handleLegacyRequest(request, env);
			}

			// Default health check
			if (pathname === "/" || pathname === "/health") {
				const origin = request.headers.get('Origin') || '';
				const corsHeaders = corsHeader(env, origin);
				if (!corsHeaders) {
					return new Response('CORS policy violation', { status: 403 });
				}
				return new Response(
					JSON.stringify({
						service: "ParaWave PTT Backend",
						version: "1.0.0",
						status: "healthy",
						timestamp: new Date().toISOString(),
						endpoints: {
							api: "/api/v1/",
							channels: "/api/v1/channels",
							health: "/api/v1/health",
							websocket: "/channel/{uuid}/websocket"
						}
					}),
					{
						headers: {
							...corsHeaders,
							'Content-Type': 'application/json'
						},
					}
				);
			}

			const origin = request.headers.get('Origin') || '';
			const corsHeaders = corsHeader(env, origin);
			if (!corsHeaders) {
				return new Response('CORS policy violation', { status: 403 });
			}
			return new Response(
				JSON.stringify({
					error: "Endpoint not found",
					code: 'NOT_FOUND'
				}),
				{
					status: 404,
					headers: {
						...corsHeaders,
						'Content-Type': 'application/json'
					},
				}
			);
		} catch (error) {
			console.error('Worker error:', error);
			const origin = request.headers.get('Origin') || '';
			const corsHeaders = corsHeader(env, origin);
			if (!corsHeaders) {
				return new Response('CORS policy violation', { status: 403 });
			}
			return new Response(
				JSON.stringify({
					error: "Internal server error",
					code: 'INTERNAL_ERROR'
				}),
				{
					status: 500,
					headers: {
						...corsHeaders,
						'Content-Type': 'application/json'
					},
				}
			);
		}
	},
} satisfies ExportedHandler<Env>;
