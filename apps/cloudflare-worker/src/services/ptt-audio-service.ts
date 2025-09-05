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
	PTTStartTransmissionRequest,
	PTTStartTransmissionResponse,
	PTTAudioChunkRequest,
	PTTAudioChunkResponse,
	PTTEndTransmissionRequest,
	PTTEndTransmissionResponse,
} from "../types/ptt";

/**
 * Service for managing PTT audio transmissions via Durable Objects
 * Provides high-level API for real-time audio communication using RPC methods
 *
 * This service uses RPC (Remote Procedure Call) methods on Durable Objects
 * for better performance compared to traditional HTTP requests.
 */
export class PTTAudioService {
	private env: Env;

	constructor(env: Env) {
		this.env = env;
	}

	/**
	 * Start a new PTT transmission session
	 * Routes to the appropriate channel Durable Object using RPC
	 */
	async startTransmission(
		request: PTTStartTransmissionRequest,
		userId: string,
		username: string,
	): Promise<PTTStartTransmissionResponse> {
		try {
			const channelUuid = request.channel_uuid.toLowerCase();

			// Get the Durable Object for this channel
			const durableObject = this.env.CHANNEL_OBJECTS.getByName(channelUuid);

			// Use RPC method
			const result = await durableObject.pttStart({
				...request,
				user_id: userId,
				username: username,
			}) as PTTStartTransmissionResponse;

			// Add WebSocket URL for real-time communication
			if (result.success && result.session_id) {
				result.websocket_url = this.generateWebSocketURL(
					channelUuid,
					userId,
					username,
				);
			}

			return result;
		} catch (error) {
			console.error("Error starting PTT transmission:", error);

			return {
				success: false,
				error: "Failed to start transmission",
			};
		}
	}

	/**
	 * Validate WebM/Opus audio chunk format
	 * Only called when WEBM_DEBUG environment variable is set
	 */
	private async validateWebMOpusChunk(audioData: string): Promise<{ valid: boolean; error?: string }> {
		try {
			// Decode base64 audio data
			const binaryString = atob(audioData);
			const uint8Array = new Uint8Array(binaryString.length);
			for (let i = 0; i < binaryString.length; i++) {
				uint8Array[i] = binaryString.charCodeAt(i);
			}

			// For Cloudflare Workers, we'll do basic WebM validation without EBML parser
			// Check for WebM header
			if (uint8Array.length < 4) {
				return { valid: false, error: 'Data too short for WebM format' };
			}

			// WebM files start with EBML header
			// Check for EBML ID (0x1A 0x45 0xDF 0xA3)
			if (uint8Array[0] !== 0x1A || uint8Array[1] !== 0x45 ||
				uint8Array[2] !== 0xDF || uint8Array[3] !== 0xA3) {
				return { valid: false, error: 'Invalid EBML header - not a WebM file' };
			}

			// Look for DocType "webm"
			let foundWebM = false;
			let foundOpus = false;
			let i = 4;

			while (i < uint8Array.length - 10) {
				// Look for DocType element (0x42 0x82)
				if (uint8Array[i] === 0x42 && uint8Array[i + 1] === 0x82) {
					// Skip element ID and size, look for "webm" string
					const docTypeStart = i + 4;
					if (docTypeStart + 4 <= uint8Array.length) {
						const docType = String.fromCharCode(
							uint8Array[docTypeStart],
							uint8Array[docTypeStart + 1],
							uint8Array[docTypeStart + 2],
							uint8Array[docTypeStart + 3]
						);
						if (docType === 'webm') {
							foundWebM = true;
						}
					}
					break;
				}
				i++;
			}

			// Look for A_OPUS codec
			i = 4;
			while (i < uint8Array.length - 10) {
				// Look for CodecID element (0x86)
				if (uint8Array[i] === 0x86) {
					const codecStart = i + 2;
					if (codecStart + 5 <= uint8Array.length) {
						const codec = String.fromCharCode(
							uint8Array[codecStart],
							uint8Array[codecStart + 1],
							uint8Array[codecStart + 2],
							uint8Array[codecStart + 3],
							uint8Array[codecStart + 4]
						);
						if (codec === 'A_OPUS') {
							foundOpus = true;
						}
					}
					break;
				}
				i++;
			}

			if (!foundWebM) {
				return { valid: false, error: 'Not a WebM file (DocType not found)' };
			}

			if (!foundOpus) {
				return { valid: false, error: 'No Opus codec found in WebM file' };
			}

			return { valid: true };

		} catch (error) {
			console.error('WebM validation error:', error);
			return { valid: false, error: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}` };
		}
	}

	/**
	 * Send audio chunk to active transmission using RPC
	 */
	async receiveAudioChunk(
		request: PTTAudioChunkRequest,
	): Promise<PTTAudioChunkResponse> {
		try {
			// Extract channel UUID from session ID
			const channelUuid = this.extractChannelFromSessionId(request.session_id);

			if (!channelUuid) {
				return {
					success: false,
					chunk_received: false,
					error: "Invalid session ID format",
				};
			}

			// Validate WebM/Opus format if WEBM_DEBUG is enabled
			if (this.env.WEBM_DEBUG && this.env.WEBM_DEBUG === 'true') {
				// const validation = { valid: true, error: '' };
				const validation = await this.validateWebMOpusChunk(request.audio_data);
				if (!validation.valid) {
					console.error(`WebM validation failed: ${validation.error}`);
					return {
						success: false,
						chunk_received: false,
						error: `WebM validation failed: ${validation.error}`,
					};
				}
				console.log('WebM/Opus chunk validation passed');
			}

			// Get the Durable Object for this channel
			const durableObject = this.env.CHANNEL_OBJECTS.getByName(channelUuid);

			// Use RPC method
			const result = await durableObject.pttChunk(request);

			return result;
		} catch (error) {
			console.error("Error receiving audio chunk:", error);

			return {
				success: false,
				chunk_received: false,
				error: "Failed to process audio chunk",
			};
		}
	}

	/**
	 * End PTT transmission session using RPC
	 */
	async endTransmission(
		request: PTTEndTransmissionRequest,
	): Promise<PTTEndTransmissionResponse> {
		try {
			// Extract channel UUID from session ID
			const channelUuid = this.extractChannelFromSessionId(request.session_id);

			if (!channelUuid) {
				return {
					success: false,
					error: "Invalid session ID format",
				};
			}

			// Get the Durable Object for this channel
			const durableObjectId = this.env.CHANNEL_OBJECTS.idFromName(channelUuid);
			const durableObject = this.env.CHANNEL_OBJECTS.get(durableObjectId);

			// Use RPC method
			const result = await durableObject.pttEnd(request);

			return result;
		} catch (error) {
			console.error("Error ending PTT transmission:", error);

			return {
				success: false,
				error: "Failed to end transmission",
			};
		}
	}

	/**
	 * Get active transmission for a channel using RPC
	 */
	async getActiveTransmission(channelUuid: string): Promise<any> {
		try {
			const normalizedChannelUuid = channelUuid.toLowerCase();

			// Get the Durable Object for this channel
			const durableObjectId = this.env.CHANNEL_OBJECTS.idFromName(
				normalizedChannelUuid,
			);
			const durableObject = this.env.CHANNEL_OBJECTS.get(durableObjectId);

			// Use RPC method
			const result = await durableObject.pttStatus();

			return result.success ? result.active_transmission : null;
		} catch (error) {
			console.error("Error getting active transmission:", error);

			return null;
		}
	}

	/**
	 * Generate WebSocket URL for real-time communication
	 */
	private generateWebSocketURL(
		channelUuid: string,
		userId: string,
		username: string,
	): string {
		// In production, this would be the actual worker URL
		const baseUrl =
			this.env.API_BASE_URL?.replace("https://", "wss://") ||
			"wss://your-worker.workers.dev";
		const params = new URLSearchParams({
			userId,
			username,
			token: "temp-token", // TODO: Generate proper token
		});

		return `${baseUrl}/ptt/channel/${channelUuid}/ws?${params.toString()}`;
	}

	/**
	 * Extract channel UUID from session ID
	 * Session ID format: ptt_{channelUuid}_{userId}_{timestamp}_{random}
	 */
	private extractChannelFromSessionId(sessionId: string): string | null {
		try {
			const parts = sessionId.split("_");

			if (parts.length >= 5 && parts[0] === "ptt") {
				return parts[1]; // Channel UUID is the second part
			}

			return null;
		} catch (error) {
			return null;
		}
	}

	/**
	 * Get WebSocket connection for a channel (used by the main handler)
	 */
	async getChannelWebSocket(
		channelUuid: string,
		request: Request,
	): Promise<Response> {
		try {
			const normalizedChannelUuid = channelUuid.toLowerCase();

			// Get the Durable Object for this channel
			const durableObjectId = this.env.CHANNEL_OBJECTS.idFromName(
				normalizedChannelUuid,
			);
			const durableObject = this.env.CHANNEL_OBJECTS.get(durableObjectId);

			// Forward WebSocket upgrade to Durable Object
			return await durableObject.fetch(request.url, request);
		} catch (error) {
			console.error("Error getting channel WebSocket:", error);

			return new Response("Failed to establish WebSocket connection", {
				status: 500,
			});
		}
	}

	/**
	 * Validate that user has access to channel
	 */
	async validateChannelAccess(
		channelUuid: string,
		userId: string,
	): Promise<{ valid: boolean; error?: string }> {
		try {
			// Check if channel exists and is active
			const channel = (await this.env.PTT_DB.prepare(
				`
        SELECT uuid, is_active FROM channels WHERE uuid = ?
      `,
			)
				.bind(channelUuid.toLowerCase())
				.first()) as any;

			if (!channel) {
				return { valid: false, error: "Channel not found" };
			}

			if (!channel.is_active) {
				return { valid: false, error: "Channel is not active" };
			}

			// Check if user is a participant in the channel
			const participant = (await this.env.PTT_DB.prepare(
				`
        SELECT user_id FROM channel_participants 
        WHERE channel_uuid = ? AND user_id = ?
      `,
			)
				.bind(channelUuid.toLowerCase(), userId)
				.first()) as any;

			if (!participant) {
				return {
					valid: false,
					error: "User is not a participant in this channel",
				};
			}

			return { valid: true };
		} catch (error) {
			console.error("Error validating channel access:", error);

			return { valid: false, error: "Failed to validate channel access" };
		}
	}
}
