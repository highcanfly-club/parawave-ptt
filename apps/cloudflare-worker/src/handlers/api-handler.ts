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

import { checkPermissions } from "../auth0";
import { ChannelService } from "../services/channel-service";
import { PTTAudioService } from "../services/ptt-audio-service";
import { Auth0ManagementTokenService } from "../services/auth0-management-token-service";
import { Auth0PermissionsService } from "../services/auth0-permissions-service";
import { corsHeader } from "../utils/cors";
import {
	CreateChannelRequest,
	CreateChannelWithUuidRequest,
	UpdateChannelRequest,
	APIResponse,
	ChannelsListResponse,
	JoinChannelRequest,
	JoinChannelResponse,
	LeaveChannelResponse,
	ChannelParticipant,
} from "../types/ptt";
import {
	PTTStartTransmissionRequest,
	PTTAudioChunkRequest,
	PTTEndTransmissionRequest,
} from "../types/ptt";
import { Auth0ManagementTokenData } from "../types/auth0-management";

/**
 * @openapi
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *       description: Auth0 JWT token
 *   schemas:
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         error:
 *           type: string
 *           description: Error message
 *         timestamp:
 *           type: string
 *           format: date-time
 *         version:
 *           type: string
 *           example: "1.0.0"
 *     Channel:
 *       type: object
 *       properties:
 *         uuid:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         type:
 *           type: string
 *           enum: [site_local, emergency, general, cross_country, instructors]
 *         frequency:
 *           type: number
 *         flying_site_id:
 *           type: integer
 *         is_active:
 *           type: boolean
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *         creator_user_id:
 *           type: string
 *         max_participants:
 *           type: integer
 *         difficulty:
 *           type: string
 *           enum: [beginner, intermediate, advanced, expert]
 *         location:
 *           type: object
 *           properties:
 *             lat:
 *               type: number
 *             lon:
 *               type: number
 *     ChannelStats:
 *       type: object
 *       properties:
 *         total_participants:
 *           type: integer
 *         active_participants:
 *           type: integer
 *         total_messages:
 *           type: integer
 *         total_transmissions:
 *           type: integer
 *         last_activity:
 *           type: string
 *           format: date-time
 *     Coordinates:
 *       type: object
 *       properties:
 *         lat:
 *           type: number
 *           minimum: -90
 *           maximum: 90
 *           description: Latitude
 *         lon:
 *           type: number
 *           minimum: -180
 *           maximum: 180
 *           description: Longitude
 *     ChannelParticipant:
 *       type: object
 *       properties:
 *         user_id:
 *           type: string
 *           description: User identifier from Auth0
 *         username:
 *           type: string
 *           description: Display name for the user
 *         join_time:
 *           type: string
 *           format: date-time
 *           description: When the user joined the channel
 *         last_seen:
 *           type: string
 *           format: date-time
 *           description: Last activity timestamp
 *         location:
 *           $ref: '#/components/schemas/Coordinates'
 *         connection_quality:
 *           type: string
 *           enum: [poor, fair, good, excellent]
 *           description: Network connection quality
 *         is_transmitting:
 *           type: boolean
 *           description: Whether the user is currently transmitting
 *         ephemeral_push_token:
 *           type: string
 *           description: Ephemeral APNs PTT token (only visible to admin users)
 *         os_type:
 *           type: string
 *           enum: [iOS, Android, Web, Desktop, Unknown]
 *           description: Operating system type
 *           example: "iOS"
 *         os_version:
 *           type: string
 *           description: Operating system version
 *           example: "17.5.1"
 *         app_version:
 *           type: string
 *           description: Application version
 *           example: "1.2.3"
 *     JoinChannelRequest:
 *       type: object
 *       properties:
 *         location:
 *           $ref: '#/components/schemas/Coordinates'
 *           description: Optional user location when joining
 *         ephemeral_push_token:
 *           type: string
 *           description: Ephemeral APNs PTT token from iOS framework for push notifications
 *         device_info:
 *           type: object
 *           properties:
 *             os:
 *               type: string
 *               description: Operating system
 *               example: "iOS"
 *               enum: [iOS, Android, Web, Desktop, Unknown]
 *             os_version:
 *               type: string
 *               description: Operating system version
 *               example: "17.5.1"
 *             app_version:
 *               type: string
 *               description: Application version
 *               example: "1.2.3"
 *             user_agent:
 *               type: string
 *               description: Full user agent string for debugging
 *               example: "ParaWave/1.2.3 (iPhone; iOS 17.5.1; Scale/3.00)"
 *           description: Optional device and application information
 *     JoinChannelResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         participant:
 *           $ref: '#/components/schemas/ChannelParticipant'
 *         channel_info:
 *           type: object
 *           properties:
 *             name:
 *               type: string
 *               description: Channel name
 *             participants_count:
 *               type: integer
 *               description: Current number of participants
 *             max_participants:
 *               type: integer
 *               description: Maximum allowed participants
 *         error:
 *           type: string
 *           description: Error message if success is false
 *     LeaveChannelResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         error:
 *           type: string
 *           description: Error message if success is false
 *     PTTStartTransmissionRequest:
 *       type: object
 *       required:
 *         - channel_uuid
 *         - audio_format
 *         - sample_rate
 *         - network_quality
 *       properties:
 *         channel_uuid:
 *           type: string
 *           format: uuid
 *           description: UUID of the channel to transmit in
 *         audio_format:
 *           type: string
 *           enum: [aac-lc, opus, pcm]
 *           description: Audio encoding format
 *         sample_rate:
 *           type: integer
 *           minimum: 8000
 *           maximum: 48000
 *           description: Audio sample rate in Hz
 *           example: 44100
 *         network_quality:
 *           type: string
 *           enum: [excellent, good, fair, poor]
 *           description: Network connection quality
 *           example: "good"
 *         device_info:
 *           type: object
 *           properties:
 *             model:
 *               type: string
 *               description: Device model
 *             os_version:
 *               type: string
 *               description: Operating system version
 *           description: Optional device information
 *         expected_duration:
 *           type: number
 *           minimum: 0
 *           maximum: 30
 *           description: Expected transmission duration in seconds (max 30s)
 *         location:
 *           $ref: '#/components/schemas/Coordinates'
 *           description: Optional user location at the time of transmission start
 *     PTTStartTransmissionResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         session_id:
 *           type: string
 *           format: uuid
 *           description: Unique transmission session ID
 *         channel_uuid:
 *           type: string
 *           format: uuid
 *           description: Channel UUID
 *         max_duration:
 *           type: integer
 *           example: 30
 *           description: Maximum transmission duration in seconds
 *         websocket_url:
 *           type: string
 *           description: WebSocket URL for real-time audio streaming
 *         error:
 *           type: string
 *           description: Error message if success is false
 *     PTTAudioChunkRequest:
 *       type: object
 *       required:
 *         - session_id
 *         - audio_data
 *         - chunk_sequence
 *         - chunk_size_bytes
 *         - timestamp_ms
 *       properties:
 *         session_id:
 *           type: string
 *           description: Session ID (must match path parameter)
 *         audio_data:
 *           type: string
 *           format: byte
 *           description: Base64-encoded audio chunk data
 *         chunk_sequence:
 *           type: integer
 *           minimum: 1
 *           description: Sequential chunk number starting from 1
 *         chunk_size_bytes:
 *           type: integer
 *           minimum: 1
 *           description: Size of audio data in bytes
 *         timestamp_ms:
 *           type: integer
 *           minimum: 1
 *           description: Unix timestamp in milliseconds when audio was recorded
 *     PTTAudioChunkResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         sequence_number:
 *           type: integer
 *           description: Acknowledged sequence number
 *         total_chunks:
 *           type: integer
 *           description: Total chunks received so far
 *         duration_so_far:
 *           type: number
 *           description: Total transmission duration so far in seconds
 *         error:
 *           type: string
 *           description: Error message if success is false
 *     PTTEndTransmissionRequest:
 *       type: object
 *       required:
 *         - session_id
 *         - total_duration_ms
 *       properties:
 *         session_id:
 *           type: string
 *           format: uuid
 *           description: The transmission session ID (must match path parameter)
 *         total_duration_ms:
 *           type: integer
 *           minimum: 1
 *           description: Total transmission duration in milliseconds
 *         final_location:
 *           type: object
 *           properties:
 *             lat:
 *               type: number
 *               minimum: -90
 *               maximum: 90
 *               description: Final latitude
 *             lon:
 *               type: number
 *               minimum: -180
 *               maximum: 180
 *               description: Final longitude
 *           description: Optional final location when transmission ended
 *         reason:
 *           type: string
 *           enum: [completed, cancelled, timeout, error]
 *           default: completed
 *           description: Reason for ending the transmission
 *     PTTEndTransmissionResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         session_summary:
 *           type: object
 *           properties:
 *             total_duration_ms:
 *               type: integer
 *               description: Total transmission duration in milliseconds
 *             chunks_received:
 *               type: integer
 *               description: Total number of audio chunks received
 *             total_bytes:
 *               type: integer
 *               description: Total bytes of audio data received
 *             participants_notified:
 *               type: integer
 *               description: Number of participants who were notified of the transmission
 *           description: Transmission session summary (only present on success)
 *         error:
 *           type: string
 *           description: Error message if success is false
 *     PTTActiveTransmissionResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         transmission:
 *           type: object
 *           properties:
 *             session_id:
 *               type: string
 *               format: uuid
 *             user_id:
 *               type: string
 *             username:
 *               type: string
 *             started_at:
 *               type: string
 *               format: date-time
 *             duration:
 *               type: number
 *               description: Current duration in seconds
 *             audio_format:
 *               type: string
 *               enum: [aac-lc, opus, pcm]
 *           description: Active transmission details, null if none active
 *         error:
 *           type: string
 *           description: Error message if success is false
 *     CreateChannelRequest:
 *       type: object
 *       required:
 *         - name
 *         - type
 *       properties:
 *         name:
 *           type: string
 *           minLength: 1
 *           maxLength: 100
 *           description: Channel name
 *           example: "Val d'Isère - Site Local"
 *         description:
 *           type: string
 *           maxLength: 500
 *           description: Channel description
 *           example: "Canal local pour le site de parapente de Val d'Isère"
 *         type:
 *           type: string
 *           enum: [site_local, emergency, general, cross_country, instructors]
 *           description: Channel type
 *           example: "site_local"
 *         frequency:
 *           type: number
 *           minimum: 118.0
 *           maximum: 136.975
 *           description: Radio frequency in MHz
 *           example: 143.9875
 *         flying_site_id:
 *           type: integer
 *           description: Associated flying site ID
 *           example: 1234
 *         max_participants:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *           description: Maximum number of participants
 *           example: 30
 *         difficulty:
 *           type: string
 *           enum: [beginner, intermediate, advanced, expert]
 *           description: Channel difficulty level
 *           example: "intermediate"
 *         location:
 *           $ref: '#/components/schemas/Coordinates'
 *     ChannelResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           $ref: '#/components/schemas/Channel'
 *         timestamp:
 *           type: string
 *           format: date-time
 *         version:
 *           type: string
 *           example: "1.0.0"
 *     CreateChannelWithUuidRequest:
 *       allOf:
 *         - $ref: '#/components/schemas/CreateChannelRequest'
 *         - type: object
 *           required:
 *             - uuid
 *           properties:
 *             uuid:
 *               type: string
 *               format: uuid
 *               description: Specific UUID for the channel
 *     UpdateChannelRequest:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           description: Channel name
 *         description:
 *           type: string
 *           description: Channel description
 *         type:
 *           type: string
 *           enum: [site_local, emergency, general, cross_country, instructors]
 *           description: Channel type
 *         frequency:
 *           type: number
 *           description: Radio frequency in MHz
 *         flying_site_id:
 *           type: integer
 *           description: Associated flying site ID
 *         max_participants:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           description: Maximum number of participants
 *         difficulty:
 *           type: string
 *           enum: [beginner, intermediate, advanced, expert]
 *           description: Channel difficulty level
 *         location:
 *           $ref: '#/components/schemas/Coordinates'
 *     ChannelsListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *           properties:
 *             channels:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Channel'
 *             total:
 *               type: integer
 *               description: Total number of channels
 *             filters_applied:
 *               type: object
 *               description: Applied filter parameters
 *         timestamp:
 *           type: string
 *           format: date-time
 *         version:
 *           type: string
 *           example: "1.0.0"
 *     APIResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         data:
 *           description: Response data
 *         timestamp:
 *           type: string
 *           format: date-time
 *         version:
 *           type: string
 *           example: "1.0.0"
 *         error:
 *           type: string
 *           description: Error message if success is false
 *     Auth0ManagementTokenData:
 *       type: object
 *       properties:
 *         access_token:
 *           type: string
 *           description: Auth0 Management API token
 *         token_type:
 *           type: string
 *           example: "Bearer"
 *         expires_in:
 *           type: integer
 *           description: Token expiration time in seconds
 *         cached:
 *           type: boolean
 *           description: Whether the token was retrieved from cache
 *
 * info:
 *   title: ParaWave PTT API
 *   description: API for managing PTT channels and real-time audio transmissions for paragliding pilots
 *   version: 1.0.0
 *   contact:
 *     name: ParaWave Team
 *     email: support@parawave.com
 *   license:
 *     name: MIT
 *
 * servers:
 *   - url: https://your-worker.your-subdomain.workers.dev
 *     description: Production server
 *   - url: http://localhost:8787
 *     description: Development server
 *
 * tags:
 *   - name: Channels
 *     description: PTT channel management operations
 *   - name: Transmissions
 *     description: Real-time PTT audio transmission operations
 *   - name: System
 *     description: System health and status endpoints
 *   - name: Auth0 Management
 *     description: Auth0 Management API operations
 */

/**
 * PTT API handler for channel management
 * Provides RESTful API endpoints under /api/v1/channels
 */
export class PTTAPIHandler {
	private channelService: ChannelService;
	private audioService: PTTAudioService;
	private managementTokenService: Auth0ManagementTokenService;
	private permissionsService: Auth0PermissionsService;
	private env: Env;
	private origin: string;
	private corsHeaders: Record<string, string> | null;

	constructor(
		db: D1Database,
		kv: KVNamespace,
		env: Env,
		corsOrigin: string,
	) {
		this.channelService = new ChannelService(db, kv);
		this.audioService = new PTTAudioService(env);
		this.managementTokenService = new Auth0ManagementTokenService(kv, env);
		this.permissionsService = new Auth0PermissionsService(this.managementTokenService, env);
		this.env = env;
		this.origin = '';
		this.corsHeaders = null;
	}

	/**
	 * Handle API requests under /api/v1/
	 * @param request HTTP request
	 * @param env Environment variables
	 * @returns HTTP response
	 */
	async handleAPIRequest(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		const pathname = url.pathname;
		const origin = request.headers.get('Origin') || '';
		this.origin = origin;
		this.corsHeaders = corsHeader(this.env, origin);

		// Handle CORS preflight requests
		if (request.method === "OPTIONS") {
			if (!this.corsHeaders) {
				return new Response('CORS policy violation', { status: 403 });
			}
			return new Response(null, {
				status: 204,
				headers: {
					...this.corsHeaders,
					"Access-Control-Allow-Credentials": "true",
				},
			});
		}

		try {
			// Parse API path
			const pathParts = pathname.split("/").filter(Boolean);

			if (
				pathParts.length < 2 ||
				pathParts[0] !== "api" ||
				pathParts[1] !== "v1"
			) {
				return this.errorResponse("Invalid API path", 404);
			}

			const resource = pathParts[2];
			const resourceId = pathParts[3];
			const subResource = pathParts[4];

			// Route to appropriate handler
			switch (resource) {
				case "channels":
					return await this.handleChannelsAPI(
						request,
						env,
						resourceId,
						subResource,
					);
				case "transmissions":
					return await this.handleTransmissionsAPI(
						request,
						env,
						resourceId,
						subResource,
					);
				case "auth0-management":
					return await this.handleAuth0ManagementAPI(
						request,
						env,
						resourceId,
					);
				case "health":
					return await this.handleHealthCheck(request);
				default:
					return this.errorResponse(`Unknown resource: ${resource}`, 404);
			}
		} catch (error) {
			console.error("API error:", error);

			return this.errorResponse("Internal server error", 500);
		}
	}

	/**
	 * Handle channels API endpoints
	 * @param request HTTP request
	 * @param env Environment variables
	 * @param resourceId Channel UUID if specified
	 * @param subResource Sub-resource like 'join', 'leave', 'participants'
	 * @returns HTTP response
	 */
	private async handleChannelsAPI(
		request: Request,
		env: Env,
		resourceId?: string,
		subResource?: string,
	): Promise<Response> {
		const method = request.method;

		// Authentication required for all channel operations
		const authResult = await this.authenticateRequest(request, env);

		if (!authResult.success) {
			return this.errorResponse(
				authResult.error || "Authentication failed",
				401,
			);
		}

		const userId = authResult.userId!;
		const permissions = authResult.permissions!;

		try {
			// Special handling for /channels/with-uuid endpoint
			if (resourceId === "with-uuid" && !subResource) {
				if (method === "POST") {
					return await this.createChannelWithUuid(request, userId, permissions, env);
				}

				return this.errorResponse(
					`Method ${method} not allowed for with-uuid endpoint`,
					405,
				);
			}

			// Handle sub-resources for specific channels
			if (resourceId && subResource) {
				switch (subResource) {
					case "join":
						if (method === "POST") {
							return await this.joinChannel(
								request,
								resourceId,
								userId,
								permissions,
								env,
							);
						}

						return this.errorResponse(
							`Method ${method} not allowed for join operation`,
							405,
						);

					case "leave":
						if (method === "POST" || method === "DELETE") {
							return await this.leaveChannel(
								request,
								resourceId,
								userId,
								permissions,
								env,
							);
						}

						return this.errorResponse(
							`Method ${method} not allowed for leave operation`,
							405,
						);

					case "participants":
						if (method === "GET") {
							return await this.getChannelParticipants(resourceId, permissions, env);
						}

						return this.errorResponse(
							`Method ${method} not allowed for participants operation`,
							405,
						);

					case "update-token":
						if (method === "PUT" || method === "POST") {
							return await this.updateParticipantToken(
								request,
								resourceId,
								userId,
								permissions,
								env,
							);
						}

						return this.errorResponse(
							`Method ${method} not allowed for update-token operation`,
							405,
						);

					default:
						return this.errorResponse(
							`Unknown sub-resource: ${subResource}`,
							404,
						);
				}
			}

			// Handle regular channel CRUD operations
			switch (method) {
				case "GET":
					return resourceId
						? await this.getChannel(resourceId, permissions, env)
						: await this.getChannels(request, permissions, env);

				case "POST":
					return await this.createChannel(request, userId, permissions, env);

				case "PUT":
					if (!resourceId) {
						return this.errorResponse("Channel UUID required for update", 400);
					}

					return await this.updateChannel(
						request,
						resourceId,
						userId,
						permissions,
						env,
					);

				case "DELETE":
					if (!resourceId) {
						return this.errorResponse(
							"Channel UUID required for deletion",
							400,
						);
					}

					return await this.deleteChannel(
						request,
						resourceId,
						userId,
						permissions,
						env,
					);

				default:
					return this.errorResponse(`Method ${method} not allowed`, 405);
			}
		} catch (error) {
			console.error("Channel API error:", error);

			return this.errorResponse("Channel operation failed", 500);
		}
	}

	/**
	 * GET /api/v1/channels - List all channels with optional filtering
	 *
	 * @openapi
	 * /api/v1/channels:
	 *   get:
	 *     summary: List channels
	 *     description: Retrieve a list of channels with optional filtering by type, location, and active status. Requires read permission.
	 *     tags:
	 *       - Channels
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: query
	 *         name: type
	 *         schema:
	 *           type: string
	 *           enum: [site_local, emergency, general, cross_country, instructors]
	 *         description: Filter by channel type
	 *       - in: query
	 *         name: active
	 *         schema:
	 *           type: boolean
	 *           default: true
	 *         description: Filter by active status
	 *       - in: query
	 *         name: lat
	 *         schema:
	 *           type: number
	 *           minimum: -90
	 *           maximum: 90
	 *         description: Latitude for location-based filtering
	 *       - in: query
	 *         name: lon
	 *         schema:
	 *           type: number
	 *           minimum: -180
	 *           maximum: 180
	 *         description: Longitude for location-based filtering
	 *       - in: query
	 *         name: radius
	 *         schema:
	 *           type: number
	 *           minimum: 0
	 *         description: Search radius in kilometers (requires lat/lon)
	 *     responses:
	 *       200:
	 *         description: Channels retrieved successfully
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/ChannelsListResponse'
	 *       401:
	 *         description: Authentication failed
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/ErrorResponse'
	 *       403:
	 *         description: Insufficient permissions
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/ErrorResponse'
	 *       500:
	 *         description: Internal server error
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/ErrorResponse'
	 */
	private async getChannels(
		request: Request,
		permissions: string[],
		env: Env,
	): Promise<Response> {
		// Check read permission
		if (!permissions.includes(env.READ_PERMISSION) && !permissions.includes(env.ADMIN_PERMISSION)) {
			return this.errorResponse("Insufficient permissions", 403);
		}

		const url = new URL(request.url);
		const type = url.searchParams.get("type") || undefined;
		const activeOnly = url.searchParams.get("active") !== "false";
		const lat = url.searchParams.get("lat");
		const lon = url.searchParams.get("lon");
		const radius = url.searchParams.get("radius");

		let location;

		if (lat && lon) {
			location = {
				lat: parseFloat(lat),
				lon: parseFloat(lon),
			};
		}
		// Only admin users can specify a radius greater than 100km
		// others are limited to 100km
		const radiusLimit = permissions.includes(env.ADMIN_PERMISSION) ? Infinity : 100;
		const radiusKm = radius ? Math.min(parseFloat(radius), radiusLimit) : undefined;

		const result = await this.channelService.getChannels(
			type,
			activeOnly,
			location,
			radiusKm,
		);

		return this.successResponse<ChannelsListResponse>(result);
	}

	/**
	 * GET /api/v1/channels/{uuid} - Get specific channel
	 *
	 * @openapi
	 * /api/v1/channels/{uuid}:
	 *   get:
	 *     summary: Get channel details
	 *     description: Retrieve detailed information about a specific channel. Requires read permission. Admin users get additional statistics.
	 *     tags:
	 *       - Channels
	 *     parameters:
	 *       - in: path
	 *         name: uuid
	 *         required: true
	 *         schema:
	 *           type: string
	 *           format: uuid
	 *         description: Channel UUID
	 *     security:
	 *       - bearerAuth: []
	 *     responses:
	 *       200:
	 *         description: Channel details retrieved successfully
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 success:
	 *                   type: boolean
	 *                   example: true
	 *                 data:
	 *                   allOf:
	 *                     - $ref: '#/components/schemas/Channel'
	 *                     - type: object
	 *                       properties:
	 *                         stats:
	 *                           $ref: '#/components/schemas/ChannelStats'
	 *                 timestamp:
	 *                   type: string
	 *                   format: date-time
	 *                 version:
	 *                   type: string
	 *                   example: "1.0.0"
	 *       401:
	 *         description: Authentication failed
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/ErrorResponse'
	 *       403:
	 *         description: Insufficient permissions
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/ErrorResponse'
	 *       404:
	 *         description: Channel not found
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/ErrorResponse'
	 *       500:
	 *         description: Internal server error
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/ErrorResponse'
	 */
	private async getChannel(
		uuid: string,
		permissions: string[],
		env: Env,
	): Promise<Response> {
		// Check read permission
		if (!permissions.includes(env.READ_PERMISSION)) {
			return this.errorResponse("Insufficient permissions", 403);
		}

		const channel = await this.channelService.getChannel(uuid.toLowerCase());

		if (!channel) {
			return this.errorResponse("Channel not found", 404);
		}

		// Get channel statistics if user has admin permissions
		if (permissions.includes(env.ADMIN_PERMISSION)) {
			const stats = await this.channelService.getChannelStats(
				uuid.toLowerCase(),
			);

			if (stats) {
				return this.successResponse({ ...channel, stats });
			}
		}

		return this.successResponse(channel);
	}

	/**
	 * POST /api/v1/channels - Create new channel
	 *
	 * @openapi
	 * /api/v1/channels:
	 *   post:
	 *     summary: Create new channel
	 *     description: Creates a new PTT channel. Requires write permission. Emergency channels require admin permission.
	 *     tags:
	 *       - Channels
	 *     security:
	 *       - bearerAuth: []
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             required:
	 *               - name
	 *               - type
	 *             properties:
	 *               name:
	 *                 type: string
	 *                 minLength: 1
	 *                 maxLength: 100
	 *                 description: Channel name
	 *                 example: "Val d'Isère - Site Local"
	 *               description:
	 *                 type: string
	 *                 maxLength: 500
	 *                 description: Channel description
	 *                 example: "Canal local pour le site de parapente de Val d'Isère"
	 *               type:
	 *                 type: string
	 *                 enum: [site_local, emergency, general, cross_country, instructors]
	 *                 description: Channel type
	 *                 example: "site_local"
	 *               frequency:
	 *                 type: number
	 *                 minimum: 118.0
	 *                 maximum: 136.975
	 *                 description: Radio frequency in MHz
	 *                 example: 143.9875
	 *               flying_site_id:
	 *                 type: integer
	 *                 description: Associated flying site ID
	 *                 example: 1234
	 *               max_participants:
	 *                 type: integer
	 *                 minimum: 1
	 *                 maximum: 100
	 *                 default: 50
	 *                 description: Maximum number of participants
	 *                 example: 30
	 *               difficulty:
	 *                 type: string
	 *                 enum: [beginner, intermediate, advanced, expert]
	 *                 description: Channel difficulty level
	 *                 example: "intermediate"
	 *               location:
	 *                 $ref: '#/components/schemas/Coordinates'
	 *     responses:
	 *       201:
	 *         description: Channel created successfully
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 success:
	 *                   type: boolean
	 *                   example: true
	 *                 data:
	 *                   $ref: '#/components/schemas/Channel'
	 *                 timestamp:
	 *                   type: string
	 *                   format: date-time
	 *                 version:
	 *                   type: string
	 *                   example: "1.0.0"
	 *       400:
	 *         description: Invalid request data
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/ErrorResponse'
	 *       401:
	 *         description: Authentication failed
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/ErrorResponse'
	 *       403:
	 *         description: Insufficient permissions
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/ErrorResponse'
	 *       500:
	 *         description: Failed to create channel
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/ErrorResponse'
	 */
	private async createChannel(
		request: Request,
		userId: string,
		permissions: string[],
		env: Env,
	): Promise<Response> {
		// Check write permission
		if (!permissions.includes(env.WRITE_PERMISSION)) {
			return this.errorResponse("Insufficient permissions", 403);
		}

		let createRequest: CreateChannelRequest;

		try {
			createRequest = await request.json();
		} catch (error) {
			return this.errorResponse("Invalid JSON payload", 400);
		}

		// Validate required fields
		if (!createRequest.name || !createRequest.type) {
			return this.errorResponse("Name and type are required fields", 400);
		}

		// Additional validation for emergency channels (admin only)
		if (
			createRequest.type === "emergency" &&
			!permissions.includes(env.ADMIN_PERMISSION)
		) {
			return this.errorResponse(
				"Admin permission required to create emergency channels",
				403,
			);
		}

		const channel = await this.channelService.createChannel(
			createRequest,
			userId,
		);

		if (!channel) {
			return this.errorResponse("Failed to create channel", 500);
		}

		// Add channel access permission to Auth0
		try {
			await this.permissionsService.addChannelPermission(channel.uuid, channel.name);
		} catch (error) {
			console.error("Failed to add channel permission to Auth0:", error);
			// Don't fail the channel creation if permission addition fails
		}

		return this.successResponse(channel, 201);
	}

	/**
	 * POST /api/v1/channels/with-uuid - Create channel with specific UUID
	 *
	 * @openapi
	 * /api/v1/channels/with-uuid:
	 *   post:
	 *     summary: Create channel with specific UUID
	 *     description: Creates a new channel with a manually specified UUID. UUID must be unique.
	 *     tags:
	 *       - Channels
	 *     security:
	 *       - bearerAuth: []
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             allOf:
	 *               - $ref: '#/components/schemas/CreateChannelRequest'
	 *               - type: object
	 *                 required:
	 *                   - uuid
	 *                 properties:
	 *                   uuid:
	 *                     type: string
	 *                     format: uuid
	 *                     description: Specific UUID for the channel
	 *     responses:
	 *       201:
	 *         description: Channel created successfully
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/ChannelResponse'
	 *       400:
	 *         description: Invalid request or UUID already exists
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/ErrorResponse'
	 *       403:
	 *         description: Insufficient permissions
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/ErrorResponse'
	 *       500:
	 *         description: Failed to create channel
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/ErrorResponse'
	 */
	private async createChannelWithUuid(
		request: Request,
		userId: string,
		permissions: string[],
		env: Env,
	): Promise<Response> {
		// Check write permission
		if (!permissions.includes(env.WRITE_PERMISSION)) {
			return this.errorResponse("Insufficient permissions", 403);
		}

		let createRequest: CreateChannelWithUuidRequest;

		try {
			createRequest = await request.json();
		} catch (error) {
			return this.errorResponse("Invalid JSON payload", 400);
		}

		// Validate required fields
		if (!createRequest.name || !createRequest.type || !createRequest.uuid) {
			return this.errorResponse(
				"Name, type, and uuid are required fields",
				400,
			);
		}

		// Additional validation for emergency channels (admin only)
		if (
			createRequest.type === "emergency" &&
			!permissions.includes(env.ADMIN_PERMISSION)
		) {
			return this.errorResponse(
				"Admin permission required to create emergency channels",
				403,
			);
		}

		const channel = await this.channelService.createChannelWithUuid(
			createRequest,
			userId,
			createRequest.uuid.toLowerCase(),
		);

		if (!channel) {
			return this.errorResponse(
				"Failed to create channel - UUID may already exist",
				400,
			);
		}

		// Add channel access permission to Auth0
		try {
			await this.permissionsService.addChannelPermission(channel.uuid, channel.name);
		} catch (error) {
			console.error("Failed to add channel permission to Auth0:", error);
			// Don't fail the channel creation if permission addition fails
		}

		return this.successResponse(channel, 201);
	}

	/**
	 * PUT /api/v1/channels/{uuid} - Update existing channel
	 *
	 * @openapi
	 * /api/v1/channels/{uuid}:
	 *   put:
	 *     summary: Update channel
	 *     description: Updates an existing channel. Requires write permission.
	 *     tags:
	 *       - Channels
	 *     parameters:
	 *       - in: path
	 *         name: uuid
	 *         required: true
	 *         schema:
	 *           type: string
	 *           format: uuid
	 *         description: Channel UUID
	 *     security:
	 *       - bearerAuth: []
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             properties:
	 *               name:
	 *                 type: string
	 *                 description: Channel name
	 *               description:
	 *                 type: string
	 *                 description: Channel description
	 *               type:
	 *                 type: string
	 *                 enum: [site_local, emergency, general, cross_country, instructors]
	 *                 description: Channel type
	 *               frequency:
	 *                 type: number
	 *                 description: Radio frequency in MHz
	 *               flying_site_id:
	 *                 type: integer
	 *                 description: Associated flying site ID
	 *               max_participants:
	 *                 type: integer
	 *                 minimum: 1
	 *                 maximum: 100
	 *                 description: Maximum number of participants
	 *               difficulty:
	 *                 type: string
	 *                 enum: [beginner, intermediate, advanced, expert]
	 *                 description: Channel difficulty level
	 *               location:
	 *                 type: object
	 *                 properties:
	 *                   lat:
	 *                     type: number
	 *                     minimum: -90
	 *                     maximum: 90
	 *                   lon:
	 *                     type: number
	 *                     minimum: -180
	 *                     maximum: 180
	 *                 description: Channel location coordinates
	 *     responses:
	 *       200:
	 *         description: Channel updated successfully
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/ChannelResponse'
	 *       400:
	 *         description: Invalid JSON payload
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/ErrorResponse'
	 *       401:
	 *         description: Authentication failed
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/ErrorResponse'
	 *       403:
	 *         description: Insufficient permissions
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/ErrorResponse'
	 *       404:
	 *         description: Channel not found
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/ErrorResponse'
	 *       500:
	 *         description: Failed to update channel
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/ErrorResponse'
	 */
	private async updateChannel(
		request: Request,
		uuid: string,
		userId: string,
		permissions: string[],
		env: Env,
	): Promise<Response> {
		// Check write permission
		if (!permissions.includes(env.WRITE_PERMISSION)) {
			return this.errorResponse("Insufficient permissions", 403);
		}

		// Check if channel exists
		const existingChannel = await this.channelService.getChannel(
			uuid.toLowerCase(),
		);

		if (!existingChannel) {
			return this.errorResponse("Channel not found", 404);
		}

		// Emergency channels require admin permission to modify
		if (
			existingChannel.type === "emergency" &&
			!permissions.includes(env.ADMIN_PERMISSION)
		) {
			return this.errorResponse(
				"Admin permission required to modify emergency channels",
				403,
			);
		}

		let updateRequest: UpdateChannelRequest;

		try {
			updateRequest = await request.json();
		} catch (error) {
			return this.errorResponse("Invalid JSON payload", 400);
		}

		// Additional validation for changing to emergency type (admin only)
		if (
			updateRequest.type === "emergency" &&
			!permissions.includes(env.ADMIN_PERMISSION)
		) {
			return this.errorResponse(
				"Admin permission required to change channel to emergency type",
				403,
			);
		}

		const updatedChannel = await this.channelService.updateChannel(
			uuid.toLowerCase(),
			updateRequest,
			userId,
		);

		if (!updatedChannel) {
			return this.errorResponse("Failed to update channel", 500);
		}

		// Check if Auth0 permission exists, create it if it doesn't
		try {
			const hasPermission = await this.permissionsService.hasChannelPermission(updatedChannel.uuid);
			if (!hasPermission) {
				await this.permissionsService.addChannelPermission(updatedChannel.uuid, updatedChannel.name);
			}
		} catch (error) {
			console.error("Failed to verify/create channel permission in Auth0:", error);
			// Don't fail the channel update if permission verification/creation fails
		}

		return this.successResponse(updatedChannel);
	}

	/**
	 * DELETE /api/v1/channels/{uuid} - Delete channel (soft delete)
	 *
	 * @openapi
	 * /api/v1/channels/{uuid}:
	 *   delete:
	 *     summary: Delete channel
	 *     description: Deletes a channel (soft delete by default). Requires admin permission. Use ?hard=true for permanent deletion.
	 *     tags:
	 *       - Channels
	 *     parameters:
	 *       - in: path
	 *         name: uuid
	 *         required: true
	 *         schema:
	 *           type: string
	 *           format: uuid
	 *         description: Channel UUID
	 *       - in: query
	 *         name: hard
	 *         schema:
	 *           type: boolean
	 *           default: false
	 *         description: Perform hard delete (permanent removal)
	 *     security:
	 *       - bearerAuth: []
	 *     responses:
	 *       200:
	 *         description: Channel deleted successfully
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 success:
	 *                   type: boolean
	 *                   example: true
	 *                 data:
	 *                   type: object
	 *                   properties:
	 *                     message:
	 *                       type: string
	 *                       example: "Channel deactivated"
	 *                     uuid:
	 *                       type: string
	 *                       format: uuid
	 *                     hard_delete:
	 *                       type: boolean
	 *                       description: Whether hard delete was performed
	 *                 timestamp:
	 *                   type: string
	 *                   format: date-time
	 *                 version:
	 *                   type: string
	 *                   example: "1.0.0"
	 *       401:
	 *         description: Authentication failed
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/ErrorResponse'
	 *       403:
	 *         description: Admin permission required
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/ErrorResponse'
	 *       404:
	 *         description: Channel not found
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/ErrorResponse'
	 *       500:
	 *         description: Failed to delete channel
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/ErrorResponse'
	 */
	private async deleteChannel(
		request: Request,
		uuid: string,
		userId: string,
		permissions: string[],
		env: Env,
	): Promise<Response> {
		// Check admin permission for deletion
		if (!permissions.includes(env.ADMIN_PERMISSION)) {
			return this.errorResponse(
				"Admin permission required for channel deletion",
				403,
			);
		}

		// Check if channel exists
		const existingChannel = await this.channelService.getChannel(
			uuid.toLowerCase(),
		);

		if (!existingChannel) {
			return this.errorResponse("Channel not found", 404);
		}

		// Check for hard delete parameter
		const url = new URL(request.url);
		const hardDelete = url.searchParams.get("hard") === "true";

		let success;

		if (hardDelete) {
			// Hard delete (permanent) - super admin only
			// TODO: Add super admin permission check
			success = await this.channelService.hardDeleteChannel(
				uuid.toLowerCase(),
				userId,
			);
		} else {
			// Soft delete (deactivate)
			success = await this.channelService.deleteChannel(
				uuid.toLowerCase(),
				userId,
			);
		}

		if (!success) {
			return this.errorResponse("Failed to delete channel", 500);
		}

		// Remove channel access permission from Auth0
		try {
			await this.permissionsService.removeChannelPermission(uuid.toLowerCase());
		} catch (error) {
			console.error("Failed to remove channel permission from Auth0:", error);
			// Don't fail the channel deletion if permission removal fails
		}

		return this.successResponse({
			message: `Channel ${hardDelete ? "permanently deleted" : "deactivated"}`,
			uuid,
			hard_delete: hardDelete,
		});
	}

	/**
	 * Health check endpoint
	 *
	 * @openapi
	 * /api/v1/health:
	 *   get:
	 *     summary: Health check
	 *     description: Returns the health status of the PTT API service and its dependencies.
	 *     tags:
	 *       - System
	 *     responses:
	 *       200:
	 *         description: Service health status
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 success:
	 *                   type: boolean
	 *                   example: true
	 *                 data:
	 *                   type: object
	 *                   properties:
	 *                     status:
	 *                       type: string
	 *                       enum: [healthy, degraded, unhealthy]
	 *                       example: "healthy"
	 *                     timestamp:
	 *                       type: string
	 *                       format: date-time
	 *                     version:
	 *                       type: string
	 *                       example: "1.0.0"
	 *                     api_version:
	 *                       type: string
	 *                       example: "v1"
	 *                     services:
	 *                       type: object
	 *                       properties:
	 *                         database:
	 *                           type: string
	 *                           enum: [operational, degraded, down]
	 *                           example: "operational"
	 *                         cache:
	 *                           type: string
	 *                           enum: [operational, degraded, down]
	 *                           example: "operational"
	 *                         channels:
	 *                           type: string
	 *                           enum: [operational, degraded, down]
	 *                           example: "operational"
	 *                 timestamp:
	 *                   type: string
	 *                   format: date-time
	 *                 version:
	 *                   type: string
	 *                   example: "1.0.0"
	 */
	private async handleHealthCheck(request: Request): Promise<Response> {
		const health = {
			status: "healthy",
			timestamp: new Date().toISOString(),
			version: "1.0.0",
			api_version: "v1",
			services: {
				database: "operational",
				cache: "operational",
				channels: "operational",
			},
		};

		return this.successResponse(health);
	}

	/**
	 * Authenticate request using Auth0 token
	 */
	private async authenticateRequest(
		request: Request,
		env: Env,
	): Promise<{
		success: boolean;
		userId?: string;
		permissions?: string[];
		error?: string;
	}> {
		let authHeader = request.headers.get("Authorization");

		// For WebSocket connections, check for token in query parameters
		if (!authHeader) {
			const url = new URL(request.url);
			const tokenParam = url.searchParams.get("token");
			if (tokenParam) {
				authHeader = `Bearer ${tokenParam}`;
			}
		}

		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			return {
				success: false,
				error: "Missing or invalid Authorization header",
			};
		}

		const token = authHeader.substring(7); // Remove 'Bearer ' prefix

		try {
			// Use the existing checkPermissions function with minimal permissions
			const { access, payload } = await checkPermissions(
				token,
				env.READ_PERMISSION,
				env,
			);

			if (!access) {
				return {
					success: false,
					error: "Invalid token or insufficient permissions",
				};
			}

			const userId = payload.sub as string;
			const rawPermissions = (payload.permissions as string[]) || [];

			// Normalize permissions: convert access:UUID permissions to lowercase
			const permissions = rawPermissions.map((permission) => {
				if (permission.startsWith(env.ACCESS_PERMISSION_PREFIX)) {
					const uuid = permission.substring(env.ACCESS_PERMISSION_PREFIX.length); // Remove access prefix

					return `${env.ACCESS_PERMISSION_PREFIX}${uuid.toLowerCase()}`;
				}

				return permission;
			});

			return {
				success: true,
				userId,
				permissions,
			};
		} catch (error) {
			console.error("Authentication error:", error);

			return { success: false, error: "Token validation failed" };
		}
	}

	/**
	 * Create success response
	 */
	private successResponse<T = any>(data: T, status: number = 200, corsHeaders?: Record<string, string>): Response {
		const response: APIResponse<T> = {
			success: true,
			data,
			timestamp: new Date().toISOString(),
			version: "1.0.0",
		};

		const headers = corsHeaders || this.corsHeaders || {};

		return new Response(JSON.stringify(response), {
			status,
			headers,
		});
	}

	/**
	 * POST /api/v1/channels/{uuid}/join - Join a channel as participant
	 *
	 * @openapi
	 * /api/v1/channels/{uuid}/join:
	 *   post:
	 *     summary: Join a channel
	 *     description: Join a PTT channel as participant. Requires access permission for the specific channel (access:{uuid}) or admin permission (admin:api).
	 *     tags:
	 *       - Channels
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: uuid
	 *         required: true
	 *         schema:
	 *           type: string
	 *           format: uuid
	 *         description: Channel UUID
	 *     requestBody:
	 *       description: Optional location information
	 *       content:
	 *         application/json:
	 *           schema:
	 *             $ref: '#/components/schemas/JoinChannelRequest'
	 *           example:
	 *             location:
	 *               lat: 45.929681
	 *               lon: 6.876345
	 *             ephemeral_push_token: "abcd1234-push-token-from-ios-framework"
	 *     responses:
	 *       200:
	 *         description: Successfully joined channel
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/JoinChannelResponse'
	 *             example:
	 *               success: true
	 *               participant:
	 *                 user_id: "auth0|507f1f77bcf86cd799439011"
	 *                 username: "pilot123"
	 *                 join_time: "2025-08-11T10:30:00.000Z"
	 *                 last_seen: "2025-08-11T10:30:00.000Z"
	 *                 connection_quality: "good"
	 *                 is_transmitting: false
	 *               channel_info:
	 *                 name: "Chamonix - Mont Blanc"
	 *                 participants_count: 3
	 *                 max_participants: 20
	 *       400:
	 *         description: Bad request (channel full, inactive, etc.)
	 *       403:
	 *         description: Access denied - insufficient permissions
	 *       404:
	 *         description: Channel not found
	 */
	private async joinChannel(
		request: Request,
		channelUuid: string,
		userId: string,
		permissions: string[],
		env: Env,
	): Promise<Response> {
		// Check channel-specific access permission
		const requiredPermission = `${env.ACCESS_PERMISSION_PREFIX}${channelUuid.toLowerCase()}`;

		if (
			!permissions.includes(requiredPermission) &&
			!permissions.includes(env.ADMIN_PERMISSION)
		) {
			return this.errorResponse(
				`Access denied - missing permission: ${requiredPermission}`,
				403,
			);
		}

		try {
			// Parse optional location from request body
			let joinRequest: JoinChannelRequest = {};

			try {
				const body = await request.text();

				if (body.trim()) {
					joinRequest = JSON.parse(body);
				}
			} catch {
				// Empty or invalid JSON body is OK for join request
			}

			// Join channel using service
			const result = await this.channelService.joinChannel(
				channelUuid.toLowerCase(),
				userId,
				joinRequest.location,
				joinRequest.ephemeral_push_token,
				joinRequest.device_info,
			);

			if (!result.success) {
				return this.errorResponse(
					result.error || "Failed to join channel",
					400,
				);
			}

			// Get channel info for response
			const channel = await this.channelService.getChannel(
				channelUuid.toLowerCase(),
			);
			const participants = await this.channelService.getChannelParticipants(
				channelUuid.toLowerCase(),
			);

			const response: JoinChannelResponse = {
				success: true,
				participant: result.participant,
				channel_info: channel
					? {
						name: channel.name,
						participants_count: participants.length,
						max_participants: channel.max_participants,
					}
					: undefined,
			};

			return new Response(JSON.stringify(response), {
				status: 200,
				headers: this.corsHeaders || {},
			});
		} catch (error) {
			console.error("Join channel error:", error);

			return this.errorResponse("Internal server error", 500);
		}
	}

	/**
	 * POST /api/v1/channels/{uuid}/leave - Leave a channel
	 * DELETE /api/v1/channels/{uuid}/leave - Leave a channel (alternative method)
	 *
	 * @openapi
	 * /api/v1/channels/{uuid}/leave:
	 *   post:
	 *     summary: Leave a channel
	 *     description: Leave a PTT channel. Requires access permission for the specific channel (access:{uuid}).
	 *     tags:
	 *       - Channels
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: uuid
	 *         required: true
	 *         schema:
	 *           type: string
	 *           format: uuid
	 *         description: Channel UUID
	 *     responses:
	 *       200:
	 *         description: Successfully left channel
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/LeaveChannelResponse'
	 *             example:
	 *               success: true
	 *       400:
	 *         description: Bad request (not a participant, etc.)
	 *       403:
	 *         description: Access denied - insufficient permissions
	 *   delete:
	 *     summary: Leave a channel (alternative method)
	 *     description: Leave a PTT channel using DELETE method. Requires access permission for the specific channel (access:{uuid}).
	 *     tags:
	 *       - Channels
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: uuid
	 *         required: true
	 *         schema:
	 *           type: string
	 *           format: uuid
	 *         description: Channel UUID
	 *     responses:
	 *       200:
	 *         description: Successfully left channel
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/LeaveChannelResponse'
	 *       400:
	 *         description: Bad request (not a participant, etc.)
	 *       403:
	 *         description: Access denied - insufficient permissions
	 */
	private async leaveChannel(
		request: Request,
		channelUuid: string,
		userId: string,
		permissions: string[],
		env: Env,
	): Promise<Response> {
		// Check channel-specific access permission
		const requiredPermission = `${env.ACCESS_PERMISSION_PREFIX}${channelUuid.toLowerCase()}`;

		if (
			!permissions.includes(requiredPermission) &&
			!permissions.includes(env.ADMIN_PERMISSION)
		) {
			return this.errorResponse(
				`Access denied - missing permission: ${requiredPermission}`,
				403,
			);
		}

		try {
			// Leave channel using service
			const result = await this.channelService.leaveChannel(
				channelUuid.toLowerCase(),
				userId,
			);

			if (!result.success) {
				return this.errorResponse(
					result.error || "Failed to leave channel",
					400,
				);
			}

			const response: LeaveChannelResponse = {
				success: true,
			};

			return new Response(JSON.stringify(response), {
				status: 200,
				headers: this.corsHeaders || {},
			});
		} catch (error) {
			console.error("Leave channel error:", error);

			return this.errorResponse("Internal server error", 500);
		}
	}

	/**
	 * GET /api/v1/channels/{uuid}/participants - Get channel participants
	 *
	 * @openapi
	 * /api/v1/channels/{uuid}/participants:
	 *   get:
	 *     summary: Get channel participants
	 *     description: Retrieve list of current participants in a channel. Requires access permission for the specific channel (access:{uuid}).
	 *     tags:
	 *       - Channels
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: uuid
	 *         required: true
	 *         schema:
	 *           type: string
	 *           format: uuid
	 *         description: Channel UUID
	 *     responses:
	 *       200:
	 *         description: Participants retrieved successfully
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 success:
	 *                   type: boolean
	 *                   example: true
	 *                 data:
	 *                   type: array
	 *                   items:
	 *                     $ref: '#/components/schemas/ChannelParticipant'
	 *                 total_count:
	 *                   type: integer
	 *                   description: Total number of participants
	 *                 timestamp:
	 *                   type: string
	 *                   format: date-time
	 *                 version:
	 *                   type: string
	 *             example:
	 *               success: true
	 *               data:
	 *                 - user_id: "auth0|507f1f77bcf86cd799439011"
	 *                   username: "pilot123"
	 *                   join_time: "2025-08-11T10:30:00.000Z"
	 *                   last_seen: "2025-08-11T10:35:00.000Z"
	 *                   connection_quality: "good"
	 *                   is_transmitting: false
	 *               total_count: 1
	 *               timestamp: "2025-08-11T10:35:00.000Z"
	 *               version: "1.0.0"
	 *       403:
	 *         description: Access denied - insufficient permissions
	 *       404:
	 *         description: Channel not found
	 */
	private async getChannelParticipants(
		channelUuid: string,
		permissions: string[],
		env: Env,
	): Promise<Response> {
		// Check channel-specific access permission
		const requiredPermission = `${env.ACCESS_PERMISSION_PREFIX}${channelUuid.toLowerCase()}`;

		if (
			!permissions.includes(requiredPermission) &&
			!permissions.includes(env.ADMIN_PERMISSION)
		) {
			return this.errorResponse(
				`Access denied - missing permission: ${requiredPermission}`,
				403,
			);
		}

		try {
			// Verify channel exists
			const channel = await this.channelService.getChannel(
				channelUuid.toLowerCase(),
			);

			if (!channel) {
				return this.errorResponse("Channel not found", 404);
			}

			// Get participants
			const participants = await this.channelService.getChannelParticipants(
				channelUuid.toLowerCase(),
			);

			const response: APIResponse<ChannelParticipant[]> = {
				success: true,
				data: participants,
				timestamp: new Date().toISOString(),
				version: "1.0.0",
			};

			// Add total count as additional property
			const responseWithCount = {
				...response,
				total_count: participants.length,
			};

			return new Response(JSON.stringify(responseWithCount), {
				status: 200,
				headers: this.corsHeaders || {},
			});
		} catch (error) {
			console.error("Get channel participants error:", error);

			return this.errorResponse("Failed to get channel participants", 500);
		}
	}

	/**
	 * PUT /api/v1/channels/{uuid}/update-token - Update participant ephemeral push token
	 *
	 * @openapi
	 * /api/v1/channels/{uuid}/update-token:
	 *   put:
	 *     summary: Update ephemeral push token
	 *     description: Update the ephemeral APNs PTT push token for a channel participant. This token is provided by the iOS Push-to-Talk framework after joining a channel.
	 *     tags:
	 *       - Channels
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: uuid
	 *         required: true
	 *         schema:
	 *           type: string
	 *           format: uuid
	 *         description: Channel UUID
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             properties:
	 *               ephemeral_push_token:
	 *                 type: string
	 *                 description: Ephemeral APNs PTT token from iOS framework
	 *             required:
	 *               - ephemeral_push_token
	 *           example:
	 *             ephemeral_push_token: "abcd1234-push-token-from-ios-framework"
	 *     responses:
	 *       200:
	 *         description: Token updated successfully
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 success:
	 *                   type: boolean
	 *                   example: true
	 *                 message:
	 *                   type: string
	 *                   example: "Push token updated successfully"
	 *       400:
	 *         description: Bad request (missing token, not a participant, etc.)
	 *       403:
	 *         description: Access denied - insufficient permissions
	 */
	private async updateParticipantToken(
		request: Request,
		channelUuid: string,
		userId: string,
		permissions: string[],
		env: Env,
	): Promise<Response> {
		// Check channel-specific access permission
		const requiredPermission = `${env.ACCESS_PERMISSION_PREFIX}${channelUuid.toLowerCase()}`;

		if (
			!permissions.includes(requiredPermission) &&
			!permissions.includes(env.ADMIN_PERMISSION)
		) {
			return this.errorResponse(
				`Access denied - missing permission: ${requiredPermission}`,
				403,
			);
		}

		try {
			// Parse request body
			const body = (await request.json()) as { ephemeral_push_token?: string };

			if (!body.ephemeral_push_token) {
				return this.errorResponse(
					"Missing ephemeral_push_token in request body",
					400,
				);
			}

			// Update token using service
			const result = await this.channelService.updateParticipantPushToken(
				channelUuid.toLowerCase(),
				userId,
				body.ephemeral_push_token,
			);

			if (!result.success) {
				return this.errorResponse(
					result.error || "Failed to update push token",
					400,
				);
			}

			const response = {
				success: true,
				message: "Push token updated successfully",
				timestamp: new Date().toISOString(),
				version: "1.0.0",
			};

			return new Response(JSON.stringify(response), {
				status: 200,
				headers: this.corsHeaders || {},
			});
		} catch (error) {
			console.error("Update participant token error:", error);

			return this.errorResponse("Invalid request body", 400);
		}
	}

	/**
	 * Handle PTT audio transmissions API endpoints
	 * Supports:
	 * POST /api/v1/transmissions/start - Start PTT transmission
	 * POST /api/v1/transmissions/{session_id}/chunk - Send audio chunk
	 * POST /api/v1/transmissions/{session_id}/end - End transmission
	 * GET /api/v1/transmissions/active/{channel_uuid} - Get active transmission
	 * GET /api/v1/transmissions/ws/{channel_uuid} - WebSocket for real-time
	 */
	private async handleTransmissionsAPI(
		request: Request,
		env: Env,
		resourceId?: string,
		subResource?: string,
	): Promise<Response> {
		const method = request.method;

		// Authentication required for all transmission operations
		const authResult = await this.authenticateRequest(request, env);

		if (!authResult.success || !authResult.userId) {
			return this.errorResponse(
				authResult.error || "Authentication required",
				401,
			);
		}

		const userId = authResult.userId;

		// Extract username from JWT payload
		let username = "Unknown User";

		try {
			const authHeader = request.headers.get("Authorization");

			if (authHeader) {
				const token = authHeader.substring(7);
				const payload = JSON.parse(atob(token.split(".")[1]));

				username =
					payload.name || payload.email || payload.nickname || "Unknown User";
			}
		} catch (error) {
			username = "Unknown User";
		}

		try {
			if (method === "POST") {
				// Handle transmission actions
				if (resourceId === "start") {
					return await this.handleStartTransmission(request, userId, username);
				} else if (resourceId && subResource === "chunk") {
					// Decode the session ID from URL parameter
					const decodedSessionId = decodeURIComponent(resourceId);
					return await this.handleAudioChunk(request, decodedSessionId);
				} else if (resourceId && subResource === "end") {
					// Decode the session ID from URL parameter
					const decodedSessionId = decodeURIComponent(resourceId);
					return await this.handleEndTransmission(request, decodedSessionId);
				} else {
					return this.errorResponse("Invalid transmission endpoint", 400);
				}
			} else if (method === "GET") {
				// Handle transmission queries
				if (resourceId === "active" && subResource) {
					return await this.handleGetActiveTransmission(subResource);
				} else if (resourceId === "ws" && subResource) {
					return await this.handleWebSocketUpgrade(
						request,
						subResource,
						userId,
						username,
					);
				} else {
					return this.errorResponse("Invalid transmission query endpoint", 400);
				}
			} else {
				return this.errorResponse("Method not allowed", 405);
			}
		} catch (error) {
			console.error("Transmission API error:", error);

			return this.errorResponse("Internal server error", 500);
		}
	}

	/**
	 * @openapi
	 * /api/v1/transmissions/start:
	 *   post:
	 *     summary: Start PTT transmission
	 *     description: Initiate a new PTT audio transmission in a channel. Maximum transmission duration is 30 seconds.
	 *     tags:
	 *       - Transmissions
	 *     security:
	 *       - bearerAuth: []
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             $ref: '#/components/schemas/PTTStartTransmissionRequest'
	 *           examples:
	 *             basic:
	 *               summary: Basic transmission request
	 *               value:
	 *                 channel_uuid: "550e8400-e29b-41d4-a716-446655440000"
	 *                 audio_format: "aac-lc"
	 *             with_device_info:
	 *               summary: With device information
	 *               value:
	 *                 channel_uuid: "550e8400-e29b-41d4-a716-446655440000"
	 *                 audio_format: "opus"
	 *                 device_info:
	 *                   model: "iPhone 15 Pro"
	 *                   os_version: "17.2"
	 *                 expected_duration: 15
	 *     responses:
	 *       200:
	 *         description: Transmission started successfully
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/PTTStartTransmissionResponse'
	 *             examples:
	 *               success:
	 *                 value:
	 *                   success: true
	 *                   session_id: "123e4567-e89b-12d3-a456-426614174000"
	 *                   channel_uuid: "550e8400-e29b-41d4-a716-446655440000"
	 *                   max_duration: 30
	 *                   websocket_url: "wss://your-worker.your-subdomain.workers.dev/api/v1/transmissions/ws/550e8400-e29b-41d4-a716-446655440000"
	 *       400:
	 *         description: Invalid request parameters
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/ErrorResponse'
	 *             examples:
	 *               missing_channel:
	 *                 value:
	 *                   success: false
	 *                   error: "channel_uuid is required"
	 *               invalid_format:
	 *                 value:
	 *                   success: false
	 *                   error: "Valid audio_format is required (aac-lc, opus, pcm)"
	 *       401:
	 *         description: Authentication required
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/ErrorResponse'
	 *       403:
	 *         description: Channel access denied or already transmitting
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/ErrorResponse'
	 *             examples:
	 *               access_denied:
	 *                 value:
	 *                   success: false
	 *                   error: "Channel access denied"
	 *               already_transmitting:
	 *                 value:
	 *                   success: false
	 *                   error: "Another transmission is already active"
	 *       500:
	 *         description: Internal server error
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/ErrorResponse'
	 */
	private async handleStartTransmission(
		request: Request,
		userId: string,
		username: string,
	): Promise<Response> {
		try {
			const body = (await request.json()) as PTTStartTransmissionRequest;
			// Validate required fields
			if (!body.channel_uuid) {
				return this.errorResponse("channel_uuid is required", 400);
			}

			if (
				!body.audio_format ||
				!["aac-lc", "opus", "pcm"].includes(body.audio_format)
			) {
				return this.errorResponse(
					"Valid audio_format is required (aac-lc, opus, pcm)",
					400,
				);
			}

			if (!body.sample_rate || body.sample_rate <= 0) {
				return this.errorResponse("Valid sample_rate is required", 400);
			}

			if (
				!body.network_quality ||
				!["excellent", "good", "fair", "poor"].includes(body.network_quality)
			) {
				return this.errorResponse("Valid network_quality is required", 400);
			}

			// Validate channel access
			const accessResult = await this.audioService.validateChannelAccess(
				body.channel_uuid,
				userId,
			);

			if (!accessResult.valid) {
				return this.errorResponse(
					accessResult.error || "Channel access denied",
					403,
				);
			}

			// Start transmission via audio service
			const result = await this.audioService.startTransmission(
				body,
				userId,
				username,
			);

			// Update participant location if provided
			if (result.success && body.location) {
				try {
					await this.channelService.updateParticipantLocation(
						body.channel_uuid,
						userId,
						body.location,
					);
				} catch (locationError) {
					console.warn("Failed to update participant location:", locationError);
					// Continue with transmission start even if location update fails
				}
			}

			if (result.success) {
				return new Response(JSON.stringify(result), {
					status: 200,
					headers: this.corsHeaders || {},
				});
			} else {
				return this.errorResponse(
					result.error || "Failed to start transmission",
					400,
				);
			}
		} catch (error) {
			console.error("Start transmission error:", error);

			return this.errorResponse("Invalid request body", 400);
		}
	}

	/**
	 * @openapi
	 * /api/v1/transmissions/{session_id}/chunk:
	 *   post:
	 *     summary: Send audio chunk
	 *     description: Send a chunk of audio data for an active transmission. Chunks must be sent in sequential order.
	 *     tags:
	 *       - Transmissions
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - name: session_id
	 *         in: path
	 *         required: true
	 *         schema:
	 *           type: string
	 *           format: uuid
	 *         description: The transmission session ID returned from start transmission
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             $ref: '#/components/schemas/PTTAudioChunkRequest'
	 *           examples:
	 *             basic:
	 *               summary: Basic audio chunk
	 *               value:
	 *                 session_id: "ptt_04b242cb-91b5-4e6d-a10a-27099fb6e866_user123_1640995200_abc123"
	 *                 audio_data: "UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA="
	 *                 chunk_sequence: 1
	 *                 chunk_size_bytes: 1024
	 *                 timestamp_ms: 1640995200123
	 *     responses:
	 *       200:
	 *         description: Audio chunk processed successfully
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/PTTAudioChunkResponse'
	 *             examples:
	 *               success:
	 *                 value:
	 *                   success: true
	 *                   chunk_sequence: 1
	 *                   total_chunks: 1
	 *                   duration_so_far: 0.1
	 *       400:
	 *         description: Invalid request parameters
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/ErrorResponse'
	 *             examples:
	 *               missing_data:
	 *                 value:
	 *                   success: false
	 *                   error: "audio_data (base64) is required"
	 *               invalid_sequence:
	 *                 value:
	 *                   success: false
	 *                   error: "Invalid sequence_number"
	 *       401:
	 *         description: Authentication required
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/ErrorResponse'
	 *       404:
	 *         description: Session not found or expired
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/ErrorResponse'
	 *             examples:
	 *               not_found:
	 *                 value:
	 *                   success: false
	 *                   error: "Transmission session not found"
	 *       500:
	 *         description: Internal server error
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/ErrorResponse'
	 */
	private async handleAudioChunk(
		request: Request,
		sessionId: string,
	): Promise<Response> {
		try {
			const body = (await request.json()) as PTTAudioChunkRequest;

			// Validate required fields
			if (!body.session_id || body.session_id !== sessionId) {
				return this.errorResponse("session_id mismatch", 400);
			}

			if (!body.audio_data || typeof body.audio_data !== "string") {
				return this.errorResponse("audio_data (base64) is required", 400);
			}

			if (typeof body.chunk_sequence !== "number" || body.chunk_sequence <= 0) {
				return this.errorResponse("Valid chunk_sequence is required", 400);
			}

			if (
				typeof body.chunk_size_bytes !== "number" ||
				body.chunk_size_bytes <= 0
			) {
				return this.errorResponse("Valid chunk_size_bytes is required", 400);
			}

			if (typeof body.timestamp_ms !== "number" || body.timestamp_ms <= 0) {
				return this.errorResponse("Valid timestamp_ms is required", 400);
			}

			// Validate base64 audio data
			try {
				atob(body.audio_data);
			} catch (error) {
				return this.errorResponse("Invalid base64 audio_data", 400);
			}

			// Process audio chunk via audio service
			const result = await this.audioService.receiveAudioChunk(body);

			if (result.success) {
				return new Response(JSON.stringify(result), {
					status: 200,
					headers: this.corsHeaders || {},
				});
			} else {
				console.error("ERROR processing audio chunk:", result.error);
				return this.errorResponse(
					result.error || "Failed to process audio chunk",
					400,
				);
			}
		} catch (error) {
			console.error("Audio chunk error:", error);

			return this.errorResponse("Invalid request body", 400);
		}
	}

	/**
	 * @openapi
	 * /api/v1/transmissions/{session_id}/end:
	 *   post:
	 *     summary: End PTT transmission
	 *     description: End an active PTT transmission and get transmission statistics.
	 *     tags:
	 *       - Transmissions
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - name: session_id
	 *         in: path
	 *         required: true
	 *         schema:
	 *           type: string
	 *           format: uuid
	 *         description: The transmission session ID
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             required:
	 *               - session_id
	 *               - total_duration_ms
	 *             properties:
	 *               session_id:
	 *                 type: string
	 *                 format: uuid
	 *                 description: The transmission session ID (must match path parameter)
	 *               total_duration_ms:
	 *                 type: integer
	 *                 minimum: 1
	 *                 description: Total transmission duration in milliseconds
	 *               final_location:
	 *                 type: object
	 *                 properties:
	 *                   lat:
	 *                     type: number
	 *                     minimum: -90
	 *                     maximum: 90
	 *                     description: Final latitude
	 *                   lon:
	 *                     type: number
	 *                     minimum: -180
	 *                     maximum: 180
	 *                     description: Final longitude
	 *                 description: Optional final location when transmission ended
	 *               reason:
	 *                 type: string
	 *                 enum: [completed, cancelled, timeout, error]
	 *                 default: completed
	 *                 description: Reason for ending the transmission
	 *           examples:
	 *             completed:
	 *               summary: Normal completion with location
	 *               value:
	 *                 session_id: "ptt_04b242cb-91b5-4e6d-a10a-27099fb6e866_user123_1640995200_abc123"
	 *                 total_duration_ms: 5200
	 *                 final_location:
	 *                   lat: 45.929681
	 *                   lon: 6.876345
	 *                 reason: "completed"
	 *             cancelled:
	 *               summary: User cancelled without location
	 *               value:
	 *                 session_id: "ptt_04b242cb-91b5-4e6d-a10a-27099fb6e866_user456_1640995300_def456"
	 *                 total_duration_ms: 1500
	 *                 reason: "cancelled"
	 *     responses:
	 *       200:
	 *         description: Transmission ended successfully
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/PTTEndTransmissionResponse'
	 *             examples:
	 *               success:
	 *                 value:
	 *                   success: true
	 *                   session_summary:
	 *                     total_duration_ms: 5200
	 *                     chunks_received: 52
	 *                     total_bytes: 524288
	 *                     participants_notified: 3
	 *       400:
	 *         description: Invalid request parameters
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/ErrorResponse'
	 *             examples:
	 *               session_mismatch:
	 *                 value:
	 *                   success: false
	 *                   error: "session_id mismatch"
	 *               invalid_duration:
	 *                 value:
	 *                   success: false
	 *                   error: "Valid total_duration_ms is required"
	 *       401:
	 *         description: Authentication required
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/ErrorResponse'
	 *       404:
	 *         description: Session not found or already ended
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/ErrorResponse'
	 *             examples:
	 *               not_found:
	 *                 value:
	 *                   success: false
	 *                   error: "Transmission session not found"
	 *       500:
	 *         description: Internal server error
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/ErrorResponse' 
	 */
	private async handleEndTransmission(
		request: Request,
		sessionId: string,
	): Promise<Response> {
		try {
			const body = (await request.json()) as PTTEndTransmissionRequest;

			// Validate required fields
			if (!body.session_id || body.session_id !== sessionId) {
				return this.errorResponse(`session_id mismatch. Expected: "${sessionId}", Got: "${body.session_id}"`, 400);
			}

			if (
				typeof body.total_duration_ms !== "number" ||
				body.total_duration_ms <= 0
			) {
				return this.errorResponse("Valid total_duration_ms is required", 400);
			}

			// End transmission via audio service
			const result = await this.audioService.endTransmission(body);

			if (result.success) {
				return new Response(JSON.stringify(result), {
					status: 200,
					headers: this.corsHeaders || {},
				});
			} else {
				return this.errorResponse(
					result.error || "Failed to end transmission",
					400,
				);
			}
		} catch (error) {
			console.error("End transmission error:", error);

			return this.errorResponse("Invalid request body", 400);
		}
	}

	/**
	 * @openapi
	 * /api/v1/transmissions/active/{channel_uuid}:
	 *   get:
	 *     summary: Get active transmission
	 *     description: Get information about the currently active transmission in a channel, if any.
	 *     tags:
	 *       - Transmissions
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - name: channel_uuid
	 *         in: path
	 *         required: true
	 *         schema:
	 *           type: string
	 *           format: uuid
	 *         description: The channel UUID to check for active transmissions
	 *     responses:
	 *       200:
	 *         description: Active transmission information retrieved successfully
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/PTTActiveTransmissionResponse'
	 *             examples:
	 *               with_active:
	 *                 summary: Channel has active transmission
	 *                 value:
	 *                   success: true
	 *                   transmission:
	 *                     session_id: "123e4567-e89b-12d3-a456-426614174000"
	 *                     user_id: "auth0|user123"
	 *                     username: "Pilot Alpha"
	 *                     started_at: "2024-01-15T10:30:00Z"
	 *                     duration: 5.2
	 *                     audio_format: "aac-lc"
	 *               no_active:
	 *                 summary: No active transmission
	 *                 value:
	 *                   success: true
	 *                   transmission: null
	 *       401:
	 *         description: Authentication required
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/ErrorResponse'
	 *       403:
	 *         description: Channel access denied
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/ErrorResponse'
	 *       404:
	 *         description: Channel not found
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/ErrorResponse'
	 *       500:
	 *         description: Internal server error
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/ErrorResponse'
	 */
	private async handleGetActiveTransmission(
		channelUuid: string,
	): Promise<Response> {
		try {
			const activeTransmission =
				await this.audioService.getActiveTransmission(channelUuid);

			return new Response(
				JSON.stringify({
					success: true,
					active_transmission: activeTransmission,
					timestamp: new Date().toISOString(),
					version: "1.0.0",
				}),
				{
					status: 200,
					headers: this.corsHeaders || {},
				},
			);
		} catch (error) {
			console.error("Get active transmission error:", error);

			return this.errorResponse("Failed to get active transmission", 500);
		}
	}

	/**
	 * @openapi
	 * /api/v1/transmissions/ws/{channel_uuid}:
	 *   get:
	 *     summary: WebSocket upgrade for real-time PTT
	 *     description: Upgrade HTTP connection to WebSocket for real-time PTT audio transmission. Used for receiving live audio broadcasts.
	 *     tags:
	 *       - Transmissions
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - name: channel_uuid
	 *         in: path
	 *         required: true
	 *         schema:
	 *           type: string
	 *           format: uuid
	 *         description: The channel UUID for real-time PTT communication
	 *     responses:
	 *       101:
	 *         description: WebSocket connection upgraded successfully
	 *         headers:
	 *           Upgrade:
	 *             schema:
	 *               type: string
	 *               example: websocket
	 *           Connection:
	 *             schema:
	 *               type: string
	 *               example: Upgrade
	 *           Sec-WebSocket-Accept:
	 *             schema:
	 *               type: string
	 *               description: WebSocket handshake response
	 *       400:
	 *         description: Invalid WebSocket request
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/ErrorResponse'
	 *             examples:
	 *               not_websocket:
	 *                 value:
	 *                   success: false
	 *                   error: "WebSocket upgrade required"
	 *       401:
	 *         description: Authentication required
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/ErrorResponse'
	 *       403:
	 *         description: Channel access denied
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/ErrorResponse'
	 *       404:
	 *         description: Channel not found
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/ErrorResponse'
	 *       500:
	 *         description: Internal server error
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/ErrorResponse'
	 */
	private async handleWebSocketUpgrade(
		request: Request,
		channelUuid: string,
		userId: string,
		username: string,
	): Promise<Response> {
		try {
			// Validate channel access
			const accessResult = await this.audioService.validateChannelAccess(
				channelUuid,
				userId,
			);

			if (!accessResult.valid) {
				return this.errorResponse(
					accessResult.error || "Channel access denied",
					403,
				);
			}

			// Get participant's ephemeral_push_token from channel
			const participants = await this.channelService.getChannelParticipants(
				channelUuid.toLowerCase(),
			);

			// Find the participant with matching userId
			const participant = participants.find(p => p.user_id === userId);

			if (!participant?.ephemeral_push_token) {
				return this.errorResponse(
					"Participant not found or missing ephemeral_push_token. Please join the channel first.",
					403,
				);
			}

			// Create new request with user info and ephemeral_push_token in query params for Durable Object
			const url = new URL(request.url);

			url.searchParams.set("userId", userId);
			url.searchParams.set("username", username);
			url.searchParams.set("ephemeralPushToken", participant.ephemeral_push_token);

			const newRequest = new Request(url.toString(), request);

			// Forward WebSocket upgrade to PTT audio service
			return await this.audioService.getChannelWebSocket(
				channelUuid,
				newRequest,
			);
		} catch (error) {
			console.error("WebSocket upgrade error:", error);

			return this.errorResponse(
				"Failed to establish WebSocket connection",
				500,
			);
		}
	}

	/**
	 * Handle Auth0 Management API requests under /api/v1/auth0-management/
	 *
	 * @openapi
	 * /api/v1/auth0-management/token:
	 *   get:
	 *     summary: Get Auth0 Management API token
	 *     description: Returns a valid Auth0 Management API token for users with tenant:admin permission. Tokens are cached to avoid exceeding quotas.
	 *     tags:
	 *       - Auth0 Management
	 *     security:
	 *       - bearerAuth: []
	 *     responses:
	 *       200:
	 *         description: Management API token retrieved successfully
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 success:
	 *                   type: boolean
	 *                   example: true
	 *                 data:
	 *                   type: object
	 *                   properties:
	 *                     access_token:
	 *                       type: string
	 *                       description: Auth0 Management API token
	 *                     token_type:
	 *                       type: string
	 *                       example: "Bearer"
	 *                     expires_in:
	 *                       type: integer
	 *                       description: Token expiration time in seconds
	 *                     cached:
	 *                       type: boolean
	 *                       description: Whether the token was retrieved from cache
	 *                 timestamp:
	 *                   type: string
	 *                   format: date-time
	 *                 version:
	 *                   type: string
	 *                   example: "1.0.0"
	 *       401:
	 *         description: Authentication failed
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/ErrorResponse'
	 *       403:
	 *         description: Insufficient permissions - tenant:admin required
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/ErrorResponse'
	 *       500:
	 *         description: Failed to generate Management API token
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/ErrorResponse'
	 */
	private async handleAuth0ManagementAPI(
		request: Request,
		env: Env,
		action?: string,
	): Promise<Response> {
		try {
			// Only handle GET requests for token endpoint
			if (request.method !== "GET") {
				return this.errorResponse("Method not allowed", 405);
			}

			if (action !== "token") {
				return this.errorResponse(`Unknown action: ${action}`, 404);
			}

			// Authenticate request and check tenant admin permission
			const authResult = await this.authenticateRequest(request, env);

			if (!authResult.success) {
				return this.errorResponse(
					authResult.error || "Authentication failed",
					401,
				);
			}

			// Check if user has tenant admin permission
			if (!authResult.permissions?.includes(env.TENANT_ADMIN_PERMISSION)) {
				return this.errorResponse(
					"Insufficient permissions - tenant:admin required",
					403,
				);
			}

			// Get Management API token (cached if available)
			const managementToken = await this.managementTokenService.getManagementToken();

			if (!managementToken) {
				return this.errorResponse(
					"Failed to generate Management API token",
					500,
				);
			}

			// Get cache info for response metadata
			const cacheInfo = await this.managementTokenService.getCacheInfo();

			const responseData: Auth0ManagementTokenData = {
				access_token: managementToken,
				token_type: "Bearer",
				cached: cacheInfo.cached,
				...(cacheInfo.remaining_time && {
					expires_in: cacheInfo.remaining_time
				})
			};

			return this.successResponse(responseData);

		} catch (error) {
			console.error("Auth0 Management API error:", error);
			return this.errorResponse("Internal server error", 500);
		}
	}

	/**
	 * Create error response
	 */
	private errorResponse(error: string, status: number = 400, corsHeaders?: Record<string, string>): Response {
		const response: APIResponse = {
			success: false,
			error,
			timestamp: new Date().toISOString(),
			version: "1.0.0",
		};

		const headers = corsHeaders || this.corsHeaders || {};

		return new Response(JSON.stringify(response), {
			status,
			headers,
		});
	}
}
