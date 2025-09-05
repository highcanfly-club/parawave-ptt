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

import {
	LiveTransmission,
	AudioChunk,
	PTTWebSocketMessage,
	PTTStartTransmissionRequest,
	PTTAudioChunkRequest,
	PTTEndTransmissionRequest,
	TransmissionAuditLog,
} from "../types/ptt";
import { DurableObject } from "cloudflare:workers";

/**
 * Durable Object for real-time PTT (Push-To-Talk) channel management.
 *
 * This Durable Object handles audio transmission with ultra-low latency and ephemeral storage,
 * supporting both HTTP API endpoints and high-performance RPC methods for real-time communication.
 *
 * Key Features:
 * - Real-time audio chunk broadcasting via WebSocket
 * - Ephemeral audio storage for late-joining participants
 * - Automatic transmission cleanup and timeout handling
 * - Comprehensive audit logging for compliance
 * - Support for emergency transmissions
 * - DRY (Don't Repeat Yourself) architecture with shared business logic
 *
 * @example
 * ```typescript
 * // Get Durable Object instance
 * const durableObjectId = env.CHANNEL_OBJECTS.idFromName(channelUuid);
 * const channelDO = env.CHANNEL_OBJECTS.get(durableObjectId);
 *
 * // Start transmission via RPC
 * const result = await channelDO.pttStart({
 *   channel_uuid: "channel-123",
 *   user_id: "user-456",
 *   username: "John Doe",
 *   audio_format: "opus",
 *   sample_rate: 48000
 * });
 * ```
 */
export class PTTChannelDurableObject extends DurableObject {
	/** Durable Object state for persistence and alarms */
	private state: DurableObjectState;

	/** Environment bindings (KV, D1, etc.) */
	public env: Env;

	/** Current active transmission state, null if no transmission in progress */
	private activeTransmission: LiveTransmission | null = null;

	/** Map of connected participants with their WebSocket connections */
	private connectedParticipants = new Map<
		string,
		{
			userId: string;
			username: string;
			websocket: WebSocket;
			joinedAt: number;
		}
	>();

	/** Maximum duration allowed for a single transmission (30 seconds) */
	private readonly MAX_TRANSMISSION_DURATION_MS = 30000;

	/** Duration to buffer audio chunks for late-joining participants (5 seconds) */
	private readonly CHUNK_BUFFER_DURATION_MS = 5000;

	/** Maximum size allowed for audio chunks (64KB) */
	private readonly MAX_CHUNK_SIZE_BYTES = 64 * 1024;

	/** Interval for periodic cleanup of expired audio chunks (30 seconds) */
	private readonly CLEANUP_INTERVAL_MS = 30000;

	/**
	 * Creates a new PTTChannelDurableObject instance.
	 *
	 * Initializes the Durable Object with the provided state and environment,
	 * and starts the periodic cleanup process for expired audio chunks.
	 *
	 * @param state - The Durable Object state for persistence and storage
	 * @param env - Environment bindings including KV, D1 database, and other resources
	 */
	constructor(state: DurableObjectState, env: Env) {
		super(state, env);
		this.state = state;
		this.env = env;

		// Start periodic cleanup of expired chunks
		this.startPeriodicCleanup();
	}

	/**
	 * Handles WebSocket connection upgrade for real-time communication.
	 *
	 * Establishes a WebSocket connection for a participant, validates parameters,
	 * sets up event handlers, and synchronizes the participant with any ongoing transmission.
	 *
	 * Process:
	 * 1. Validates required parameters (userId, username, token)
	 * 2. Creates WebSocket pair and accepts server connection
	 * 3. Registers participant in connected participants map
	 * 4. Sets up message and close event handlers
	 * 5. Notifies other participants of new join
	 * 6. Synchronizes with any active transmission (sends recent chunks)
	 *
	 * @param request - The WebSocket upgrade request
	 * @returns Promise resolving to WebSocket upgrade response
	 *
	 * @throws Will return 400 response if required parameters are missing
	 *
	 * @example
	 * ```typescript
	 * // WebSocket URL format
	 * const wsUrl = `wss://worker.example.com/ptt/channel/${channelUuid}/ws?userId=user123&username=John&token=jwt-token`;
	 * const ws = new WebSocket(wsUrl);
	 * ```
	 */
	private async handleWebSocketUpgrade(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const userId = url.searchParams.get("userId");
		const username = url.searchParams.get("username");
		const ephemeralPushToken = url.searchParams.get("ephemeralPushToken");
		const token = url.searchParams.get("token");

		if (!userId || !username || !ephemeralPushToken || !token) {
			return new Response("Missing required parameters: userId, username, ephemeralPushToken, token", { status: 400 });
		}

		// TODO: Validate JWT token
		// const isValid = await this.validateToken(token);
		// if (!isValid) return new Response('Unauthorized', { status: 401 });

		const webSocketPair = new WebSocketPair();
		const [client, server] = Object.values(webSocketPair);

		// Accept WebSocket connection
		server.accept();

		// Add participant to connected list using ephemeralPushToken as unique identifier
		this.connectedParticipants.set(ephemeralPushToken, {
			userId,
			username,
			websocket: server,
			joinedAt: Date.now(),
		});

		// Set up WebSocket event handlers
		server.addEventListener("message", (event) => {
			this.handleWebSocketMessage(ephemeralPushToken, event.data as string);
		});

		server.addEventListener("close", () => {
			this.connectedParticipants.delete(ephemeralPushToken);
			this.broadcastToParticipants({
				type: "participant_leave",
				userId,
				timestamp: Date.now(),
			});
		});

		// Notify other participants of new join
		this.broadcastToParticipants(
			{
				type: "participant_join",
				userId,
				username,
				timestamp: Date.now(),
			},
			[userId],
		); // Exclude the joining user

		// Send current transmission state to new participant
		if (this.activeTransmission) {
			this.sendToParticipant(ephemeralPushToken, {
				type: "transmission_started",
				session_id: this.activeTransmission.sessionId,
				channel_uuid: this.activeTransmission.channelUuid,
				timestamp_ms: this.activeTransmission.startTime,
				data: {
					user_id: this.activeTransmission.userId,
					username: this.activeTransmission.username,
					audio_format: this.activeTransmission.audioFormat,
					is_emergency: this.activeTransmission.isEmergency,
				},
			});

			// Send recent audio chunks for late joiner
			const now = Date.now();

			for (const [sequence, bufferedChunk] of this.activeTransmission
				.audioChunks) {
				if (now < bufferedChunk.expires) {
					this.sendToParticipant(ephemeralPushToken, {
						type: "audio_chunk",
						session_id: this.activeTransmission.sessionId,
						channel_uuid: this.activeTransmission.channelUuid,
						timestamp_ms: bufferedChunk.chunk.timestamp,
						data: {
							sequence: bufferedChunk.chunk.sequence,
							audio_data: bufferedChunk.chunk.data,
							size_bytes: bufferedChunk.chunk.sizeBytes,
						},
					});
				}
			}
		}

		return new Response(null, {
			status: 101,
			webSocket: client,
		});
	}

	/**
	 * Handles incoming WebSocket messages from participants.
	 *
	 * Currently supports basic ping/pong for connection health monitoring.
	 * Designed to be extensible for future features like participant controls,
	 * transmission management, or custom commands.
	 *
	 * @param ephemeralPushToken - The ephemeral push token of the client who sent the message
	 * @param data - The raw message data (expected to be JSON string)
	 *
	 * @example
	 * ```typescript
	 * // Ping message from client
	 * ws.send(JSON.stringify({ type: "ping", timestamp: Date.now() }));
	 *
	 * // Future: Custom commands
	 * ws.send(JSON.stringify({ type: "mute", targetUserId: "user123" }));
	 * ```
	 */
	private async handleWebSocketMessage(ephemeralPushToken: string, data: string) {
		try {
			const message = JSON.parse(data);

			// Handle different message types
			switch (message.type) {
				case "ping":
					this.sendToParticipant(ephemeralPushToken, {
						type: "pong",
						session_id: "",
						channel_uuid: this.activeTransmission?.channelUuid || "",
						timestamp_ms: Date.now(),
						data: {},
					});
					break;

				default:
					console.warn("Unknown WebSocket message type:", message.type);
			}
		} catch (error) {
			console.error("Error handling WebSocket message:", error);
			this.sendToParticipant(ephemeralPushToken, {
				type: "error",
				session_id: "",
				channel_uuid: this.activeTransmission?.channelUuid || "",
				timestamp_ms: Date.now(),
				data: {
					message: "Invalid message format",
				},
			});
		}
	}

	/**
	 * Common business logic for starting a PTT transmission (DRY principle).
	 *
	 * This method contains the core logic for initiating a new PTT transmission,
	 * shared between HTTP handlers and RPC methods to ensure consistent behavior.
	 *
	 * Process:
	 * 1. Validates that no transmission is currently active
	 * 2. Validates required user information
	 * 3. Generates unique session ID
	 * 4. Creates and initializes transmission state
	 * 5. Sets up automatic cleanup timeout
	 * 6. Broadcasts transmission start to all participants
	 *
	 * @param request - Transmission start request with user and audio parameters
	 * @param request.user_id - Unique identifier of the transmitting user
	 * @param request.username - Display name of the transmitting user
	 * @param request.channel_uuid - Target channel identifier
	 * @param request.audio_format - Audio encoding format (e.g., "opus", "aac")
	 * @param request.sample_rate - Audio sample rate in Hz
	 * @param request.bitrate - Audio bitrate in bps
	 * @param request.network_quality - Network quality indicator
	 * @param request.location - Optional geographic location
	 * @param request.is_emergency - Whether this is an emergency transmission
	 *
	 * @returns Promise resolving to transmission start result
	 *
	 * @throws Will return error if transmission already active or validation fails
	 *
	 * @example
	 * ```typescript
	 * const result = await this.startPTTTransmissionLogic({
	 *   channel_uuid: "channel-123",
	 *   user_id: "user-456",
	 *   username: "John Doe",
	 *   audio_format: "opus",
	 *   sample_rate: 48000,
	 *   is_emergency: false
	 * });
	 * ```
	 */
	private async startPTTTransmissionLogic(request: PTTStartTransmissionRequest & {
		user_id: string;
		username: string;
	}): Promise<{
		success: boolean;
		error?: string;
		session_id?: string;
		max_duration_ms?: number;
		chunk_size_limit_bytes?: number;
	}> {
		try {
			// Validate request
			if (this.activeTransmission) {
				return {
					success: false,
					error: "Another transmission is already active in this channel",
				};
			}

			if (!request.user_id || !request.username) {
				return {
					success: false,
					error: "User ID and username are required",
				};
			}

			// Generate session ID
			const sessionId = this.generateSessionId(request.user_id, request.channel_uuid);

			// Create live transmission
			this.activeTransmission = {
				sessionId,
				channelUuid: request.channel_uuid,
				userId: request.user_id,
				username: request.username,
				startTime: Date.now(),
				audioFormat: request.audio_format,
				sampleRate: request.sample_rate,
				bitrate: request.bitrate,
				networkQuality: request.network_quality,
				location: request.location,
				isEmergency: request.is_emergency || false,
				audioChunks: new Map(),
				participants: new Set(),
				expectedSequence: 1,
				totalBytes: 0,
			};

			// Set auto-cleanup after max duration
			this.activeTransmission.cleanupTimeout = setTimeout(() => {
				this.forceEndTransmission("Maximum duration exceeded");
			}, this.MAX_TRANSMISSION_DURATION_MS) as any;

			// Broadcast start to all connected participants
			this.broadcastToParticipants({
				type: "transmission_started",
				session_id: sessionId,
				channel_uuid: request.channel_uuid,
				timestamp_ms: Date.now(),
				data: {
					user_id: request.user_id,
					username: request.username,
					audio_format: request.audio_format,
					is_emergency: request.is_emergency || false,
				},
			});

			return {
				success: true,
				session_id: sessionId,
				max_duration_ms: this.MAX_TRANSMISSION_DURATION_MS,
				chunk_size_limit_bytes: this.MAX_CHUNK_SIZE_BYTES,
			};
		} catch (error) {
			console.error("Start PTT transmission logic error:", error);
			return {
				success: false,
				error: "Failed to start transmission",
			};
		}
	}

	/**
	 * Common business logic for processing audio chunks (DRY principle).
	 *
	 * This method handles the real-time processing and broadcasting of audio chunks,
	 * shared between HTTP handlers and RPC methods to ensure consistent behavior.
	 *
	 * Process:
	 * 1. Validates active transmission and session ID
	 * 2. Accepts chunks with tolerance to packet loss and out-of-order delivery
	 * 3. Validates chunk size against limits
	 * 4. Stores chunk temporarily for late-joining participants
	 * 5. Updates transmission statistics and expected sequence
	 * 6. Broadcasts chunk immediately to all connected participants
	 *
	 * Packet Loss Tolerance:
	 * - Accepts out-of-order chunks within reasonable bounds
	 * - Handles duplicate chunks gracefully
	 * - Updates expected sequence based on highest received chunk
	 * - Logs missing chunks for debugging and monitoring
	 *
	 * @param request - Audio chunk request data
	 * @param request.session_id - Transmission session identifier
	 * @param request.chunk_sequence - Sequential chunk number (can be out-of-order)
	 * @param request.audio_data - Base64-encoded audio data
	 * @param request.timestamp_ms - Client timestamp of audio chunk
	 * @param request.chunk_size_bytes - Size of audio data in bytes
	 *
	 * @returns Promise resolving to chunk processing result
	 *
	 * @throws Will return error for invalid session, severely out-of-order chunks, or size violations
	 *
	 * @example
	 * ```typescript
	 * const result = await this.handleAudioChunkLogic({
	 *   session_id: "ptt_channel123_user456_1234567890_abc123",
	 *   chunk_sequence: 1,
	 *   audio_data: "base64-encoded-audio-data",
	 *   timestamp_ms: Date.now(),
	 *   chunk_size_bytes: 4096
	 * });
	 * ```
	 */
	private async handleAudioChunkLogic(request: PTTAudioChunkRequest): Promise<{
		success: boolean;
		error?: string;
		chunk_received?: boolean;
		next_expected_sequence?: number;
	}> {
		try {
			// Validate active transmission
			if (
				!this.activeTransmission ||
				this.activeTransmission.sessionId !== request.session_id
			) {
				return {
					success: false,
					chunk_received: false,
					error: "Invalid or expired session",
				};
			}

			// Validate chunk sequence - be tolerant to packet loss
			const isExpectedSequence = request.chunk_sequence === this.activeTransmission.expectedSequence;
			const isDuplicate = this.activeTransmission.audioChunks.has(request.chunk_sequence);
			const isFutureSequence = request.chunk_sequence > this.activeTransmission.expectedSequence;

			// Accept chunks that are:
			// 1. The expected sequence (normal case)
			// 2. Future sequences (packet arrived out of order)
			// 3. Duplicate chunks (retransmission)
			if (!isExpectedSequence && !isFutureSequence && !isDuplicate) {
				// Only reject chunks that are clearly too old (more than 10 chunks behind)
				const maxAcceptableLag = 10;
				if (request.chunk_sequence < this.activeTransmission.expectedSequence - maxAcceptableLag) {
					return {
						success: false,
						chunk_received: false,
						error: `Chunk too old. Expected >= ${this.activeTransmission.expectedSequence - maxAcceptableLag}, got ${request.chunk_sequence}`,
					};
				}
			}

			// Handle duplicate chunks
			if (isDuplicate) {
				console.warn(`Received duplicate chunk ${request.chunk_sequence}, ignoring`);
				return {
					success: true,
					chunk_received: true,
					next_expected_sequence: this.activeTransmission.expectedSequence,
				};
			}

			// Validate chunk size
			if (request.chunk_size_bytes > this.MAX_CHUNK_SIZE_BYTES) {
				return {
					success: false,
					chunk_received: false,
					error: "Chunk size exceeds 64KB limit",
				};
			}

			const audioChunk: AudioChunk = {
				sequence: request.chunk_sequence,
				data: request.audio_data,
				timestamp: request.timestamp_ms,
				sizeBytes: request.chunk_size_bytes,
			};

			// Store chunk temporarily for late joiners
			const expiresAt = Date.now() + this.CHUNK_BUFFER_DURATION_MS;

			this.activeTransmission.audioChunks.set(request.chunk_sequence, {
				chunk: audioChunk,
				expires: expiresAt,
			});

			// Log sequence information for debugging
			if (!isExpectedSequence && isFutureSequence) {
				console.warn(`Received out-of-order chunk: expected ${this.activeTransmission.expectedSequence}, got ${request.chunk_sequence}`);
			}

			// Update transmission stats
			this.activeTransmission.totalBytes += request.chunk_size_bytes;

			// Update expected sequence - be more tolerant to packet loss
			// If this chunk is the expected one or higher, update expected sequence
			if (request.chunk_sequence >= this.activeTransmission.expectedSequence) {
				// Look for the next missing sequence
				let nextExpected = request.chunk_sequence + 1;
				const maxLookAhead = 50; // Don't look too far ahead to avoid performance issues

				for (let i = 0; i < maxLookAhead; i++) {
					if (!this.activeTransmission.audioChunks.has(nextExpected)) {
						break; // Found a gap
					}
					nextExpected++;
				}

				// Count missing chunks between old expected and new expected
				const missingChunks = nextExpected - this.activeTransmission.expectedSequence - 1;
				if (missingChunks > 0) {
					console.warn(`Detected ${missingChunks} missing chunk(s) between ${this.activeTransmission.expectedSequence} and ${request.chunk_sequence}`);
				}

				this.activeTransmission.expectedSequence = nextExpected;
			}

			// Broadcast immediately to all connected participants
			const message: PTTWebSocketMessage = {
				type: "audio_chunk",
				session_id: request.session_id,
				channel_uuid: this.activeTransmission.channelUuid,
				timestamp_ms: request.timestamp_ms,
				data: {
					sequence: request.chunk_sequence,
					audio_data: request.audio_data,
					size_bytes: request.chunk_size_bytes,
				},
			};
			this.broadcastToParticipants(message);

			return {
				success: true,
				chunk_received: true,
				next_expected_sequence: this.activeTransmission.expectedSequence,
			};
		} catch (error) {
			console.error("Handle audio chunk logic error:", error);
			return {
				success: false,
				chunk_received: false,
				error: "Failed to process audio chunk",
			};
		}
	}

	/**
	 * Common business logic for ending a PTT transmission.
	 *
	 * This method contains the core logic for terminating an active PTT transmission,
	 * shared between HTTP handlers and RPC methods to ensure consistent behavior.
	 *
	 * Process:
	 * 1. Validates active transmission and session ID
	 * 2. Clears automatic cleanup timeout
	 * 3. Broadcasts transmission end to all participants
	 * 4. Logs transmission audit data to database
	 * 5. Cleans up transmission state
	 *
	 * @param request - Transmission end request
	 * @param request.session_id - Transmission session identifier to end
	 * @param request.total_duration_ms - Total duration of the transmission
	 *
	 * @returns Promise resolving to transmission end result with summary
	 *
	 * @throws Will return error for invalid session or inactive transmission
	 *
	 * @example
	 * ```typescript
	 * const result = await this.endPTTTransmissionLogic({
	 *   session_id: "ptt_channel123_user456_1234567890_abc123",
	 *   total_duration_ms: 5000
	 * });
	 *
	 * console.log("Transmission ended:", result.session_summary);
	 * ```
	 */
	private async endPTTTransmissionLogic(request: PTTEndTransmissionRequest): Promise<{
		success: boolean;
		error?: string;
		session_summary?: {
			total_duration_ms: number;
			chunks_received: number;
			total_bytes: number;
			participants_notified: number;
			missing_chunks: number;
			packet_loss_rate: number;
		};
	}> {
		try {
			if (
				!this.activeTransmission ||
				this.activeTransmission.sessionId !== request.session_id
			) {
				return {
					success: false,
					error: "Invalid or expired session",
				};
			}

			const transmission = this.activeTransmission;
			const duration = request.total_duration_ms;
			const chunksReceived = transmission.expectedSequence - 1;
			const participantsCount = this.connectedParticipants.size;

			// Calculate packet loss statistics
			let missingChunks = 0;
			const receivedSequences = Array.from(transmission.audioChunks.keys()).sort((a, b) => a - b);

			if (receivedSequences.length > 0) {
				const minSequence = Math.min(...receivedSequences);
				const maxSequence = Math.max(...receivedSequences);

				// Count gaps in sequence
				for (let seq = minSequence; seq <= maxSequence; seq++) {
					if (!transmission.audioChunks.has(seq)) {
						missingChunks++;
					}
				}
			}

			const packetLossRate = chunksReceived > 0 ? (missingChunks / (chunksReceived + missingChunks)) * 100 : 0;

			// Clear cleanup timeout
			if (transmission.cleanupTimeout) {
				clearTimeout(transmission.cleanupTimeout);
			}

			// Broadcast end to participants
			this.broadcastToParticipants({
				type: "transmission_ended",
				session_id: transmission.sessionId,
				channel_uuid: transmission.channelUuid,
				timestamp_ms: Date.now(),
				data: {
					user_id: transmission.userId,
					duration_ms: duration,
					total_chunks: chunksReceived,
					total_bytes: transmission.totalBytes,
					missing_chunks: missingChunks,
					packet_loss_rate: packetLossRate,
				},
			});

			// Log transmission for audit (minimal metadata only)
			await this.logTransmissionAudit(transmission, duration, participantsCount);

			// Clear transmission state
			this.activeTransmission = null;

			console.log(`Transmission ended: ${chunksReceived} chunks received, ${missingChunks} missing (${packetLossRate.toFixed(1)}% loss)`);

			return {
				success: true,
				session_summary: {
					total_duration_ms: duration,
					chunks_received: chunksReceived,
					total_bytes: transmission.totalBytes,
					participants_notified: participantsCount,
					missing_chunks: missingChunks,
					packet_loss_rate: packetLossRate,
				},
			};
		} catch (error) {
			console.error("End PTT transmission logic error:", error);
			return {
				success: false,
				error: "Failed to end transmission",
			};
		}
	}

	/**
	 * Get current PTT channel status information.
	 *
	 * Retrieves comprehensive status data about the PTT channel including any active
	 * transmission details and participant connection count. Used by both HTTP and RPC endpoints.
	 *
	 * This method provides real-time visibility into channel state for monitoring,
	 * client synchronization, and administrative purposes.
	 *
	 * @returns Status object containing active transmission details and participant count
	 *
	 * @private
	 */
	private getPTTStatusLogic(): {
		success: boolean;
		active_transmission?: {
			session_id: string;
			channel_uuid: string;
			user_id: string;
			username: string;
			start_time: number;
			audio_format: string;
			is_emergency: boolean;
			chunks_count: number;
			total_bytes: number;
		} | null;
		connected_participants: number;
		timestamp: number;
	} {
		return {
			success: true,
			active_transmission: this.activeTransmission
				? {
					session_id: this.activeTransmission.sessionId,
					channel_uuid: this.activeTransmission.channelUuid,
					user_id: this.activeTransmission.userId,
					username: this.activeTransmission.username,
					start_time: this.activeTransmission.startTime,
					audio_format: this.activeTransmission.audioFormat,
					is_emergency: this.activeTransmission.isEmergency,
					chunks_count: this.activeTransmission.expectedSequence - 1,
					total_bytes: this.activeTransmission.totalBytes,
				}
				: null,
			connected_participants: this.connectedParticipants.size,
			timestamp: Date.now(),
		};
	}

	/**
	 * Handle start transmission HTTP request.
	 *
	 * Processes HTTP POST /ptt/start requests to initiate a new PTT transmission.
	 * Validates request data, delegates to business logic, and returns appropriate HTTP response.
	 *
	 * This method serves as the HTTP endpoint wrapper around the startPTTTransmissionLogic method,
	 * handling JSON parsing, error formatting, and HTTP response construction.
	 *
	 * @param request - HTTP request containing PTT start transmission data
	 * @returns Promise resolving to HTTP response with transmission session details or error
	 *
	 * @private
	 */
	private async handleStartTransmission(request: Request): Promise<Response> {
		const body = (await request.json()) as PTTStartTransmissionRequest & {
			user_id: string;
			username: string;
		};

		const result = await this.startPTTTransmissionLogic(body);

		if (!result.success) {
			return new Response(
				JSON.stringify({
					success: false,
					error: result.error,
				}),
				{
					status: 400,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		return new Response(
			JSON.stringify({
				success: true,
				session_id: result.session_id,
				max_duration_ms: result.max_duration_ms,
				chunk_size_limit_bytes: result.chunk_size_limit_bytes,
			}),
			{
				status: 200,
				headers: { "Content-Type": "application/json" },
			},
		);
	}

	/**
	 * Handle audio chunk HTTP request.
	 *
	 * Processes HTTP POST /ptt/chunk requests to receive and broadcast audio chunks.
	 * Validates chunk data, delegates to business logic, and returns processing confirmation.
	 *
	 * This method serves as the HTTP endpoint wrapper around the handleAudioChunkLogic method,
	 * handling JSON parsing, sequence validation, and HTTP response construction for real-time audio streaming.
	 * It is tolerant to packet loss and can handle out-of-order chunk delivery.
	 *
	 * @param request - HTTP request containing audio chunk data
	 * @returns Promise resolving to HTTP response with chunk processing status
	 *
	 * @private
	 */
	private async handleAudioChunk(request: Request): Promise<Response> {
		const body = (await request.json()) as PTTAudioChunkRequest;

		const result = await this.handleAudioChunkLogic(body);

		if (!result.success) {
			return new Response(
				JSON.stringify({
					success: false,
					chunk_received: false,
					error: result.error,
				}),
				{
					status: 400,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		return new Response(
			JSON.stringify({
				success: true,
				chunk_received: result.chunk_received,
				next_expected_sequence: result.next_expected_sequence,
			}),
			{
				status: 200,
				headers: { "Content-Type": "application/json" },
			},
		);
	}

	/**
	 * Handle end transmission HTTP request.
	 *
	 * Processes HTTP POST /ptt/end requests to terminate active PTT transmissions.
	 * Validates termination request, delegates to business logic, and returns session summary.
	 *
	 * This method serves as the HTTP endpoint wrapper around the endPTTTransmissionLogic method,
	 * handling JSON parsing, cleanup coordination, and HTTP response construction with transmission metrics.
	 *
	 * @param request - HTTP request containing transmission end data
	 * @returns Promise resolving to HTTP response with transmission summary or error
	 *
	 * @private
	 */
	private async handleEndTransmission(request: Request): Promise<Response> {
		const body = (await request.json()) as PTTEndTransmissionRequest;

		const result = await this.endPTTTransmissionLogic(body);

		if (!result.success) {
			return new Response(
				JSON.stringify({
					success: false,
					error: result.error,
				}),
				{
					status: 400,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		return new Response(
			JSON.stringify({
				success: true,
				session_summary: result.session_summary,
			}),
			{
				status: 200,
				headers: { "Content-Type": "application/json" },
			},
		);
	}

	/**
	 * Handle get status HTTP request.
	 *
	 * Processes HTTP GET /ptt/status requests to retrieve current PTT channel status.
	 * Returns information about active transmissions and connected participants.
	 *
	 * This method serves as the HTTP endpoint wrapper around the getPTTStatusLogic method,
	 * providing real-time visibility into channel state for monitoring and client synchronization.
	 *
	 * @returns Promise resolving to HTTP response with current channel status
	 *
	 * @private
	 */
	private async handleGetStatus(): Promise<Response> {
		const result = this.getPTTStatusLogic();

		return new Response(
			JSON.stringify(result),
			{
				status: 200,
				headers: { "Content-Type": "application/json" },
			},
		);
	}

	/**
	 * Force termination of active PTT transmission.
	 *
	 * Immediately ends any ongoing transmission due to timeout, error conditions,
	 * or system requirements. Broadcasts termination notification to all participants
	 * and performs cleanup operations.
	 *
	 * This method is used for system-initiated transmission termination when normal
	 * end procedures cannot be followed, ensuring clean state management and audit logging.
	 *
	 * @param reason - Description of why the transmission is being force-ended
	 *
	 * @private
	 */
	private forceEndTransmission(reason: string) {
		if (!this.activeTransmission) return;

		const transmission = this.activeTransmission;
		const duration = Date.now() - transmission.startTime;

		// Broadcast forced end
		this.broadcastToParticipants({
			type: "transmission_ended",
			session_id: transmission.sessionId,
			channel_uuid: transmission.channelUuid,
			timestamp_ms: Date.now(),
			data: {
				user_id: transmission.userId,
				duration_ms: duration,
				total_chunks: transmission.expectedSequence - 1,
				total_bytes: transmission.totalBytes,
				reason: reason,
			},
		});

		// Log forced end
		this.logTransmissionAudit(
			transmission,
			duration,
			this.connectedParticipants.size,
		);

		// Clear state
		this.activeTransmission = null;

		console.log(`PTT transmission force ended: ${reason}`);
	}

	/**
	 * Broadcast WebSocket message to all connected participants.
	 *
	 * Sends a message to all participants in the channel, with optional exclusion
	 * of specific users. Handles connection errors gracefully by removing broken connections.
	 *
	 * This method is used for real-time communication during PTT transmissions,
	 * ensuring all participants receive updates about transmission state changes.
	 *
	 * @param message - WebSocket message to broadcast
	 * @param excludeUsers - Array of user IDs to exclude from broadcast
	 *
	 * @private
	 */
	private broadcastToParticipants(
		message: PTTWebSocketMessage,
		excludeUsers: string[] = [],
	) {
		const payload = JSON.stringify(message);
		const excludeSet = new Set(excludeUsers);

		for (const [ephemeralPushToken, participant] of this.connectedParticipants) {
			if (excludeSet.has(participant.userId)) continue;

			try {
				participant.websocket.send(payload);
			} catch (error) {
				console.error(
					`Failed to send message to participant ${participant.userId}:`,
					error,
				);
				// Remove broken connection
				this.connectedParticipants.delete(ephemeralPushToken);
			}
		}
	}

	/**
	 * Send WebSocket message to a specific participant.
	 *
	 * Delivers a message to a single participant identified by ephemeral push token.
	 * Handles connection errors by removing broken connections from the participant map.
	 *
	 * This method is used for targeted communication with individual participants,
	 * such as private notifications or user-specific updates.
	 *
	 * @param ephemeralPushToken - Ephemeral push token of the target participant
	 * @param message - WebSocket message to send
	 *
	 * @private
	 */
	private sendToParticipant(ephemeralPushToken: string, message: PTTWebSocketMessage) {
		const participant = this.connectedParticipants.get(ephemeralPushToken);

		if (!participant) return;

		try {
			participant.websocket.send(JSON.stringify(message));
		} catch (error) {
			console.error(`Failed to send message to participant ${ephemeralPushToken}:`, error);
			this.connectedParticipants.delete(ephemeralPushToken);
		}
	}

	/**
	 * Start periodic cleanup of expired audio chunks.
	 *
	 * Initiates a background timer that periodically removes expired audio chunks
	 * from the transmission buffer to prevent memory leaks and maintain performance.
	 *
	 * This method ensures that audio chunks that have exceeded their buffer duration
	 * are automatically cleaned up, maintaining efficient memory usage during long transmissions.
	 *
	 * @private
	 */
	private startPeriodicCleanup() {
		setInterval(() => {
			if (!this.activeTransmission) return;

			const now = Date.now();
			const expiredSequences: number[] = [];

			// Find expired chunks
			for (const [sequence, bufferedChunk] of this.activeTransmission
				.audioChunks) {
				if (now >= bufferedChunk.expires) {
					expiredSequences.push(sequence);
				}
			}

			// Remove expired chunks
			expiredSequences.forEach((sequence) => {
				this.activeTransmission?.audioChunks.delete(sequence);
			});

			if (expiredSequences.length > 0) {
				console.log(
					`Cleaned up ${expiredSequences.length} expired audio chunks`,
				);
			}
		}, this.CLEANUP_INTERVAL_MS);
	}

	/**
	 * Log transmission metadata for audit purposes.
	 *
	 * Records comprehensive transmission statistics to D1 database for compliance,
	 * analytics, and troubleshooting. Stores metadata only (no audio content).
	 *
	 * This method captures key transmission metrics including duration, participant count,
	 * audio format details, and network quality for post-transmission analysis and auditing.
	 *
	 * @param transmission - Completed transmission object with all metadata
	 * @param duration - Total transmission duration in milliseconds
	 * @param participantCount - Number of participants who received the transmission
	 *
	 * @private
	 */
	private async logTransmissionAudit(
		transmission: LiveTransmission,
		duration: number,
		participantCount: number,
	) {
		try {
			const auditLog: TransmissionAuditLog = {
				sessionId: transmission.sessionId,
				channelUuid: transmission.channelUuid,
				userId: transmission.userId,
				clientId: "TODO",
				username: transmission.username,
				startTime: new Date(transmission.startTime).toISOString(),
				endTime: new Date().toISOString(),
				duration: Math.floor(duration / 1000), // seconds
				audioFormat: transmission.audioFormat,
				chunksCount: transmission.expectedSequence - 1,
				totalBytes: transmission.totalBytes,
				participantCount: participantCount,
				isEmergency: transmission.isEmergency,
				networkQuality: transmission.networkQuality,
				location: transmission.location,
			};

			// Store minimal audit log in D1 database
			await this.env.PTT_DB.prepare(
				`
        INSERT INTO transmission_history (
          session_id, channel_uuid, user_id, username, start_time, end_time,
          duration_seconds, audio_format, chunks_count, total_bytes, 
          participant_count, is_emergency, network_quality,
          location_lat, location_lon
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
			)
				.bind(
					auditLog.sessionId,
					auditLog.channelUuid,
					auditLog.userId,
					auditLog.username,
					auditLog.startTime,
					auditLog.endTime,
					auditLog.duration,
					auditLog.audioFormat,
					auditLog.chunksCount,
					auditLog.totalBytes,
					auditLog.participantCount,
					auditLog.isEmergency ? 1 : 0,
					auditLog.networkQuality,
					auditLog.location?.lat || null,
					auditLog.location?.lon || null,
				)
				.run();
		} catch (error) {
			console.error("Failed to log transmission audit:", error);
		}
	}

	/**
	 * Generate unique session identifier for PTT transmission.
	 *
	 * Creates a collision-resistant session ID using channel UUID, user ID, timestamp,
	 * and random component to ensure uniqueness across the system.
	 *
	 * Session ID format: ptt_{channelUuid}_{userId}_{timestamp}_{random}
	 *
	 * @param userId - ID of the user initiating the transmission
	 * @param channelUuid - UUID of the PTT channel
	 * @returns Unique session identifier string
	 *
	 * @private
	 */
	private generateSessionId(userId: string, channelUuid: string): string {
		const timestamp = Date.now();
		const random = Math.random().toString(36).substring(2);

		return `ptt_${channelUuid}_${userId}_${timestamp}_${random}`;
	}

	// ===== RPC METHODS =====

	/**
	 * RPC method to start PTT transmission.
	 *
	 * High-performance remote procedure call equivalent to HTTP POST /ptt/start.
	 * Initiates a new PTT transmission session with the specified parameters.
	 *
	 * This method provides better performance than HTTP requests by eliminating
	 * JSON serialization/deserialization and HTTP overhead.
	 *
	 * @param request - Transmission start request parameters
	 * @param request.channel_uuid - Target channel identifier
	 * @param request.user_id - Unique identifier of the transmitting user
	 * @param request.username - Display name of the transmitting user
	 * @param request.audio_format - Audio encoding format (e.g., "opus", "aac")
	 * @param request.sample_rate - Audio sample rate in Hz
	 * @param request.bitrate - Audio bitrate in bps
	 * @param request.network_quality - Network quality indicator
	 * @param request.location - Optional geographic location
	 * @param request.is_emergency - Whether this is an emergency transmission
	 *
	 * @returns Promise resolving to transmission start result
	 *
	 * @throws Will return error if transmission already active or validation fails
	 *
	 * @example
	 * ```typescript
	 * const result = await durableObject.pttStart({
	 *   channel_uuid: "channel-123",
	 *   user_id: "user-456",
	 *   username: "John Doe",
	 *   audio_format: "opus",
	 *   sample_rate: 48000,
	 *   is_emergency: false
	 * });
	 *
	 * if (result.success) {
	 *   console.log("Transmission started:", result.session_id);
	 * }
	 * ```
	 */
	async pttStart(request: PTTStartTransmissionRequest & {
		user_id: string;
		username: string;
	}): Promise<{
		success: boolean;
		error?: string;
		session_id?: string;
		max_duration_ms?: number;
		chunk_size_limit_bytes?: number;
	}> {
		return this.startPTTTransmissionLogic(request);
	}

	/**
	 * RPC method to handle audio chunk.
	 *
	 * High-performance remote procedure call equivalent to HTTP POST /ptt/chunk.
	 * Processes and broadcasts audio chunks in real-time during an active transmission.
	 *
	 * This method ensures low-latency audio streaming by immediately broadcasting
	 * received chunks to all connected participants while maintaining sequence integrity.
	 * It is tolerant to packet loss and can handle out-of-order chunk delivery.
	 *
	 * @param request - Audio chunk data
	 * @param request.session_id - Transmission session identifier
	 * @param request.chunk_sequence - Sequential chunk number (can be out-of-order due to packet loss)
	 * @param request.audio_data - Base64-encoded audio data
	 * @param request.timestamp_ms - Client timestamp of audio chunk
	 * @param request.chunk_size_bytes - Size of audio data in bytes
	 *
	 * @returns Promise resolving to chunk processing result
	 *
	 * @throws Will return error for invalid session, severely out-of-order chunks, or size violations
	 *
	 * @example
	 * ```typescript
	 * const result = await durableObject.pttChunk({
	 *   session_id: "ptt_channel123_user456_1234567890_abc123",
	 *   chunk_sequence: 1,
	 *   audio_data: "UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmQcBzeN1/LNeSsFJHLG8N6QQAoUXrTp66hVFApGn+DyvmQcBzeN1/LNeSsF",
	 *   timestamp_ms: Date.now(),
	 *   chunk_size_bytes: 4096
	 * });
	 *
	 * if (result.chunk_received) {
	 *   console.log("Next expected sequence:", result.next_expected_sequence);
	 * }
	 * ```
	 */
	async pttChunk(request: PTTAudioChunkRequest): Promise<{
		success: boolean;
		error?: string;
		chunk_received?: boolean;
		next_expected_sequence?: number;
	}> {
		return this.handleAudioChunkLogic(request);
	}

	/**
	 * RPC method to end PTT transmission.
	 *
	 * High-performance remote procedure call equivalent to HTTP POST /ptt/end.
	 * Terminates an active PTT transmission, broadcasts end notification to all participants,
	 * and provides comprehensive session statistics.
	 *
	 * This method ensures clean transmission termination by:
	 * - Validating the transmission session exists and is active
	 * - Calculating final transmission metrics
	 * - Broadcasting end notification to all connected participants
	 * - Cleaning up transmission state
	 * - Providing detailed session summary for audit purposes
	 *
	 * @param request - Transmission end request data
	 * @param request.session_id - Transmission session identifier to end
	 * @param request.end_reason - Reason for ending transmission (optional, defaults to "normal")
	 * @param request.final_timestamp_ms - Client timestamp when transmission ended
	 *
	 * @returns Promise resolving to transmission end result with session summary
	 *
	 * @throws Will return error for invalid session, inactive transmission, or cleanup failures
	 *
	 * @example
	 * ```typescript
	 * const result = await durableObject.pttEnd({
	 *   session_id: "ptt_channel123_user456_1234567890_abc123",
	 *   end_reason: "normal",
	 *   final_timestamp_ms: Date.now()
	 * });
	 *
	 * if (result.success && result.session_summary) {
	 *   console.log("Transmission ended successfully");
	 *   console.log("Duration:", result.session_summary.total_duration_ms, "ms");
	 *   console.log("Chunks received:", result.session_summary.chunks_received);
	 *   console.log("Total bytes:", result.session_summary.total_bytes);
	 *   console.log("Participants notified:", result.session_summary.participants_notified);
	 *   console.log("Missing chunks:", result.session_summary.missing_chunks);
	 *   console.log("Packet loss rate:", result.session_summary.packet_loss_rate.toFixed(1), "%");
	 * }
	 * ```
	 */
	async pttEnd(request: PTTEndTransmissionRequest): Promise<{
		success: boolean;
		error?: string;
		session_summary?: {
			total_duration_ms: number;
			chunks_received: number;
			total_bytes: number;
			participants_notified: number;
			missing_chunks: number;
			packet_loss_rate: number;
		};
	}> {
		return this.endPTTTransmissionLogic(request);
	}

	/**
	 * RPC method to get PTT status.
	 *
	 * High-performance remote procedure call equivalent to HTTP GET /ptt/status.
	 * Retrieves current PTT channel status including active transmission details
	 * and participant connection information.
	 *
	 * This method provides real-time visibility into channel state by:
	 * - Checking for any active PTT transmission in progress
	 * - Returning detailed information about the current transmission if active
	 * - Providing participant count and connection status
	 * - Including timestamp for status freshness validation
	 *
	 * @returns Promise resolving to current PTT channel status
	 *
	 * @example
	 * ```typescript
	 * const status = await durableObject.pttStatus();
	 *
	 * if (status.success) {
	 *   console.log("Connected participants:", status.connected_participants);
	 *   console.log("Status timestamp:", new Date(status.timestamp));
	 *
	 *   if (status.active_transmission) {
	 *     console.log("Active transmission by:", status.active_transmission.username);
	 *     console.log("Session ID:", status.active_transmission.session_id);
	 *     console.log("Audio format:", status.active_transmission.audio_format);
	 *     console.log("Emergency:", status.active_transmission.is_emergency);
	 *     console.log("Chunks received:", status.active_transmission.chunks_count);
	 *     console.log("Total bytes:", status.active_transmission.total_bytes);
	 *     console.log("Started at:", new Date(status.active_transmission.start_time));
	 *   } else {
	 *     console.log("No active transmission");
	 *   }
	 * }
	 * ```
	 */
	async pttStatus(): Promise<{
		success: boolean;
		active_transmission?: {
			session_id: string;
			channel_uuid: string;
			user_id: string;
			username: string;
			start_time: number;
			audio_format: string;
			is_emergency: boolean;
			chunks_count: number;
			total_bytes: number;
		} | null;
		connected_participants: number;
		timestamp: number;
	}> {
		return this.getPTTStatusLogic();
	}

	/**
	 * Handle incoming requests to the Durable Object
	 * This is the main entry point for all requests to this Durable Object
	 * Only handles WebSocket upgrades since other operations use RPC calls
	 */
	async fetch(request: Request): Promise<Response> {
		// Handle WebSocket upgrade requests only
		if (request.headers.get("Upgrade") === "websocket") {
			return this.handleWebSocketUpgrade(request);
		}

		// All other operations should use RPC methods (pttStart, pttChunk, pttEnd, pttStatus)
		return new Response("Use RPC methods for PTT operations", { status: 405 });
	}
}
