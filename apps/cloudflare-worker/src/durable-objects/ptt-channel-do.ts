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
} from "../types/ptt-audio";

/**
 * Durable Object for real-time PTT channel management
 * Handles audio transmission with ultra-low latency and ephemeral storage
 */
export class PTTChannelDurableObject {
	private state: DurableObjectState;
	private env: Env;

	// Real-time transmission state (in-memory)
	private activeTransmission: LiveTransmission | null = null;
	private connectedParticipants = new Map<
		string,
		{
			userId: string;
			username: string;
			websocket: WebSocket;
			joinedAt: number;
		}
	>();

	// Configuration constants
	private readonly MAX_TRANSMISSION_DURATION_MS = 30000; // 30 seconds
	private readonly CHUNK_BUFFER_DURATION_MS = 5000; // 5 seconds for late joiners
	private readonly MAX_CHUNK_SIZE_BYTES = 64 * 1024; // 64KB
	private readonly CLEANUP_INTERVAL_MS = 1000; // 1 second

	constructor(state: DurableObjectState, env: Env) {
		this.state = state;
		this.env = env;

		// Start periodic cleanup of expired chunks
		this.startPeriodicCleanup();
	}

	/**
	 * Handle HTTP requests and WebSocket upgrades
	 */
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const pathname = url.pathname;

		// Handle WebSocket upgrade for real-time communication
		if (request.headers.get("Upgrade") === "websocket") {
			return this.handleWebSocketUpgrade(request);
		}

		// Handle HTTP API requests
		if (pathname.startsWith("/ptt/")) {
			return this.handleHTTPRequest(request);
		}

		return new Response("Not found", { status: 404 });
	}

	/**
	 * Handle WebSocket connection for real-time communication
	 */
	private async handleWebSocketUpgrade(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const userId = url.searchParams.get("userId");
		const username = url.searchParams.get("username");
		const token = url.searchParams.get("token");

		if (!userId || !username || !token) {
			return new Response("Missing required parameters", { status: 400 });
		}

		// TODO: Validate JWT token
		// const isValid = await this.validateToken(token);
		// if (!isValid) return new Response('Unauthorized', { status: 401 });

		const webSocketPair = new WebSocketPair();
		const [client, server] = Object.values(webSocketPair);

		// Accept WebSocket connection
		server.accept();

		// Add participant to connected list
		this.connectedParticipants.set(userId, {
			userId,
			username,
			websocket: server,
			joinedAt: Date.now(),
		});

		// Set up WebSocket event handlers
		server.addEventListener("message", (event) => {
			this.handleWebSocketMessage(userId, event.data as string);
		});

		server.addEventListener("close", () => {
			this.connectedParticipants.delete(userId);
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
			this.sendToParticipant(userId, {
				type: "transmission_start",
				sessionId: this.activeTransmission.sessionId,
				userId: this.activeTransmission.userId,
				username: this.activeTransmission.username,
				audioFormat: this.activeTransmission.audioFormat,
				isEmergency: this.activeTransmission.isEmergency,
				timestamp: this.activeTransmission.startTime,
			});

			// Send recent audio chunks for late joiner
			const now = Date.now();

			for (const [sequence, bufferedChunk] of this.activeTransmission
				.audioChunks) {
				if (now < bufferedChunk.expires) {
					this.sendToParticipant(userId, {
						type: "audio_chunk",
						sessionId: this.activeTransmission.sessionId,
						sequence: bufferedChunk.chunk.sequence,
						audioData: bufferedChunk.chunk.data,
						timestamp: bufferedChunk.chunk.timestamp,
						sizeBytes: bufferedChunk.chunk.sizeBytes,
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
	 * Handle WebSocket messages (for future expansion)
	 */
	private async handleWebSocketMessage(userId: string, data: string) {
		try {
			const message = JSON.parse(data);

			// Handle different message types
			switch (message.type) {
				case "ping":
					this.sendToParticipant(userId, {
						type: "pong",
						timestamp: Date.now(),
					});
					break;

				default:
					console.warn("Unknown WebSocket message type:", message.type);
			}
		} catch (error) {
			console.error("Error handling WebSocket message:", error);
			this.sendToParticipant(userId, {
				type: "error",
				error: "Invalid message format",
				timestamp: Date.now(),
			});
		}
	}

	/**
	 * Handle HTTP API requests for transmission control
	 */
	private async handleHTTPRequest(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const pathname = url.pathname;
		const method = request.method;

		try {
			if (method === "POST" && pathname === "/ptt/start") {
				return await this.handleStartTransmission(request);
			}

			if (method === "POST" && pathname === "/ptt/chunk") {
				return await this.handleAudioChunk(request);
			}

			if (method === "POST" && pathname === "/ptt/end") {
				return await this.handleEndTransmission(request);
			}

			if (method === "GET" && pathname === "/ptt/status") {
				return await this.handleGetStatus();
			}

			return new Response("Method not allowed", { status: 405 });
		} catch (error) {
			console.error("Error handling HTTP request:", error);

			return new Response(
				JSON.stringify({
					success: false,
					error: "Internal server error",
				}),
				{
					status: 500,
					headers: { "Content-Type": "application/json" },
				},
			);
		}
	}

	/**
	 * Start a new PTT transmission
	 */
	private async handleStartTransmission(request: Request): Promise<Response> {
		const body = (await request.json()) as PTTStartTransmissionRequest & {
			user_id: string;
			username: string;
		};

		// Validate request
		if (this.activeTransmission) {
			return new Response(
				JSON.stringify({
					success: false,
					error: "Another transmission is already active in this channel",
				}),
				{
					status: 400,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		if (!body.user_id || !body.username) {
			return new Response(
				JSON.stringify({
					success: false,
					error: "User ID and username are required",
				}),
				{
					status: 400,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		// Generate session ID
		const sessionId = this.generateSessionId(body.user_id, body.channel_uuid);

		// Create live transmission
		this.activeTransmission = {
			sessionId,
			channelUuid: body.channel_uuid,
			userId: body.user_id,
			username: body.username,
			startTime: Date.now(),
			audioFormat: body.audio_format,
			sampleRate: body.sample_rate,
			bitrate: body.bitrate,
			networkQuality: body.network_quality,
			location: body.location,
			isEmergency: body.is_emergency || false,
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
			type: "transmission_start",
			sessionId,
			userId: body.user_id,
			username: body.username,
			audioFormat: body.audio_format,
			isEmergency: body.is_emergency || false,
			timestamp: Date.now(),
		});

		return new Response(
			JSON.stringify({
				success: true,
				session_id: sessionId,
				max_duration_ms: this.MAX_TRANSMISSION_DURATION_MS,
				chunk_size_limit_bytes: this.MAX_CHUNK_SIZE_BYTES,
			}),
			{
				status: 200,
				headers: { "Content-Type": "application/json" },
			},
		);
	}

	/**
	 * Receive and broadcast audio chunk in real-time
	 */
	private async handleAudioChunk(request: Request): Promise<Response> {
		const body = (await request.json()) as PTTAudioChunkRequest;

		// Validate active transmission
		if (
			!this.activeTransmission ||
			this.activeTransmission.sessionId !== body.session_id
		) {
			return new Response(
				JSON.stringify({
					success: false,
					chunk_received: false,
					error: "Invalid or expired session",
				}),
				{
					status: 400,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		// Validate chunk sequence
		if (body.chunk_sequence !== this.activeTransmission.expectedSequence) {
			return new Response(
				JSON.stringify({
					success: false,
					chunk_received: false,
					error: `Invalid chunk sequence. Expected ${this.activeTransmission.expectedSequence}, got ${body.chunk_sequence}`,
				}),
				{
					status: 400,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		// Validate chunk size
		if (body.chunk_size_bytes > this.MAX_CHUNK_SIZE_BYTES) {
			return new Response(
				JSON.stringify({
					success: false,
					chunk_received: false,
					error: `Chunk size exceeds limit of ${this.MAX_CHUNK_SIZE_BYTES} bytes`,
				}),
				{
					status: 400,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		const audioChunk: AudioChunk = {
			sequence: body.chunk_sequence,
			data: body.audio_data,
			timestamp: body.timestamp_ms,
			sizeBytes: body.chunk_size_bytes,
		};

		// Store chunk temporarily for late joiners
		const expiresAt = Date.now() + this.CHUNK_BUFFER_DURATION_MS;

		this.activeTransmission.audioChunks.set(body.chunk_sequence, {
			chunk: audioChunk,
			expires: expiresAt,
		});

		// Update transmission stats
		this.activeTransmission.expectedSequence++;
		this.activeTransmission.totalBytes += body.chunk_size_bytes;

		// Broadcast immediately to all connected participants
		this.broadcastToParticipants({
			type: "audio_chunk",
			sessionId: body.session_id,
			sequence: body.chunk_sequence,
			audioData: body.audio_data,
			timestamp: body.timestamp_ms,
			sizeBytes: body.chunk_size_bytes,
		});

		return new Response(
			JSON.stringify({
				success: true,
				chunk_received: true,
				next_expected_sequence: this.activeTransmission.expectedSequence,
			}),
			{
				status: 200,
				headers: { "Content-Type": "application/json" },
			},
		);
	}

	/**
	 * End PTT transmission
	 */
	private async handleEndTransmission(request: Request): Promise<Response> {
		const body = (await request.json()) as PTTEndTransmissionRequest;

		if (
			!this.activeTransmission ||
			this.activeTransmission.sessionId !== body.session_id
		) {
			return new Response(
				JSON.stringify({
					success: false,
					error: "Invalid or expired session",
				}),
				{
					status: 400,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		const transmission = this.activeTransmission;
		const duration = body.total_duration_ms;
		const chunksReceived = transmission.expectedSequence - 1;
		const participantsCount = this.connectedParticipants.size;

		// Clear cleanup timeout
		if (transmission.cleanupTimeout) {
			clearTimeout(transmission.cleanupTimeout);
		}

		// Broadcast end to participants
		this.broadcastToParticipants({
			type: "transmission_end",
			sessionId: transmission.sessionId,
			userId: transmission.userId,
			duration: duration,
			totalChunks: chunksReceived,
			totalBytes: transmission.totalBytes,
			timestamp: Date.now(),
		});

		// Log transmission for audit (minimal metadata only)
		await this.logTransmissionAudit(transmission, duration, participantsCount);

		// Clear transmission state
		this.activeTransmission = null;

		return new Response(
			JSON.stringify({
				success: true,
				session_summary: {
					total_duration_ms: duration,
					chunks_received: chunksReceived,
					total_bytes: transmission.totalBytes,
					participants_notified: participantsCount,
				},
			}),
			{
				status: 200,
				headers: { "Content-Type": "application/json" },
			},
		);
	}

	/**
	 * Get current transmission status
	 */
	private async handleGetStatus(): Promise<Response> {
		return new Response(
			JSON.stringify({
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
			}),
			{
				status: 200,
				headers: { "Content-Type": "application/json" },
			},
		);
	}

	/**
	 * Force end transmission (timeout or error)
	 */
	private forceEndTransmission(reason: string) {
		if (!this.activeTransmission) return;

		const transmission = this.activeTransmission;
		const duration = Date.now() - transmission.startTime;

		// Broadcast forced end
		this.broadcastToParticipants({
			type: "transmission_end",
			sessionId: transmission.sessionId,
			userId: transmission.userId,
			duration: duration,
			totalChunks: transmission.expectedSequence - 1,
			totalBytes: transmission.totalBytes,
			timestamp: Date.now(),
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
	 * Broadcast message to all or specific participants
	 */
	private broadcastToParticipants(
		message: PTTWebSocketMessage,
		excludeUsers: string[] = [],
	) {
		const payload = JSON.stringify(message);
		const excludeSet = new Set(excludeUsers);

		for (const [userId, participant] of this.connectedParticipants) {
			if (excludeSet.has(userId)) continue;

			try {
				participant.websocket.send(payload);
			} catch (error) {
				console.error(
					`Failed to send message to participant ${userId}:`,
					error,
				);
				// Remove broken connection
				this.connectedParticipants.delete(userId);
			}
		}
	}

	/**
	 * Send message to specific participant
	 */
	private sendToParticipant(userId: string, message: PTTWebSocketMessage) {
		const participant = this.connectedParticipants.get(userId);

		if (!participant) return;

		try {
			participant.websocket.send(JSON.stringify(message));
		} catch (error) {
			console.error(`Failed to send message to participant ${userId}:`, error);
			this.connectedParticipants.delete(userId);
		}
	}

	/**
	 * Start periodic cleanup of expired chunks
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
	 * Log transmission metadata for audit (no audio data)
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
	 * Generate unique session ID
	 */
	private generateSessionId(userId: string, channelUuid: string): string {
		const timestamp = Date.now();
		const random = Math.random().toString(36).substring(2);

		return `ptt_${channelUuid}_${userId}_${timestamp}_${random}`;
	}
}
