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
import createLibWebM from "@sctg/libwebm-js";

/**
 * Service for managing PTT audio transmissions via Durable Objects
 * Provides high-level API for real-time audio communication using RPC methods
 *
 * This service uses RPC (Remote Procedure Call) methods on Durable Objects
 * for better performance compared to traditional HTTP requests.
 */
export class PTTAudioService {
	private env: Env;
	private libwebm: any = null;

	constructor(env: Env) {
		this.env = env;
		// Initialize libwebm asynchronously when first needed
		this.initializeLibWebM();
	}

	/**
	 * Initialize LibWebM library for WebM validation
	 */
	private async initializeLibWebM() {
		try {
			if (!this.libwebm) {
				this.libwebm = await createLibWebM();
				console.log('LibWebM initialized successfully');
			}
		} catch (error) {
			console.error('Failed to initialize LibWebM:', error);
		}
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
	 * Validate WebM/Opus audio chunk format using LibWebM-JS
	 * Provides robust validation using the actual libwebm library
	 */
	private async validateWebMOpusChunk(audioData: string): Promise<{ valid: boolean; error?: string }> {
		try {
			// Ensure LibWebM is initialized
			await this.initializeLibWebM();

			if (!this.libwebm) {
				// console.warn('LibWebM not available, skipping validation');
				return { valid: true }; // Skip validation if library not available
			}

			// Decode base64 audio data
			const binaryString = atob(audioData);
			const uint8Array = new Uint8Array(binaryString.length);
			for (let i = 0; i < binaryString.length; i++) {
				uint8Array[i] = binaryString.charCodeAt(i);
			}

			// Basic size check
			if (uint8Array.length < 32) {
				// console.warn('WebM chunk too small:', uint8Array.length);
				return { valid: false, error: 'WebM chunk too small (less than 32 bytes)' };
			}

			try {
				// Parse WebM file using LibWebM-JS
				const webmFile = await this.libwebm.WebMFile.fromBuffer(uint8Array, this.libwebm._module);

				// Validate file structure
				const duration = webmFile.getDuration();
				const trackCount = webmFile.getTrackCount();

				if (trackCount === 0) {
					// console.warn('No tracks found in WebM chunk');
					return { valid: false, error: 'No tracks found in WebM chunk' };
				}

				// Check for audio tracks with Opus codec
				let hasOpusAudio = false;
				let hasValidAudioTrack = false;

				for (let i = 0; i < trackCount; i++) {
					const trackInfo = webmFile.getTrackInfo(i);

					if (trackInfo.trackType === this.libwebm.WebMTrackType.AUDIO) {
						hasValidAudioTrack = true;

						if (trackInfo.codecId === 'A_OPUS') {
							hasOpusAudio = true;

							// Get detailed audio info
							const audioInfo = webmFile.parser.getAudioInfo(trackInfo.trackNumber);

							// Validate audio parameters suitable for PTT
							if (audioInfo.samplingFrequency < 8000 || audioInfo.samplingFrequency > 48000) {
								// console.warn('Invalid sample rate:', audioInfo.samplingFrequency);
								return {
									valid: false,
									error: `Invalid sample rate: ${audioInfo.samplingFrequency}Hz (expected 8-48kHz)`
								};
							}

							if (audioInfo.channels < 1 || audioInfo.channels > 2) {
								// console.warn('Invalid channel count:', audioInfo.channels);
								return {
									valid: false,
									error: `Invalid channel count: ${audioInfo.channels} (expected 1-2 channels)`
								};
							}

							console.log(`WebM validation: Opus audio ${audioInfo.samplingFrequency}Hz, ${audioInfo.channels}ch, duration: ${duration.toFixed(3)}s`);
						}
					} else if (trackInfo.trackType === this.libwebm.WebMTrackType.VIDEO) {
						// PTT chunks shouldn't contain video
						// console.warn('Video track found in WebM chunk');
						return { valid: false, error: 'WebM chunk contains video track (audio-only expected for PTT)' };
					}
				}

				if (!hasValidAudioTrack) {
					// console.warn('No audio tracks found in WebM chunk');
					return { valid: false, error: 'No audio tracks found in WebM chunk' };
				}

				if (!hasOpusAudio) {
					// console.warn('No Opus audio track found in WebM chunk');
					return { valid: false, error: 'No Opus audio codec found (A_OPUS required for PTT)' };
				}

				// Validate duration (PTT chunks should be reasonably short)
				if (duration > 30.0) {
					// console.warn('WebM chunk too long:', duration);
					return {
						valid: false,
						error: `WebM chunk too long: ${duration.toFixed(1)}s (max 30s for PTT)`
					};
				}

				if (duration <= 0) {
					// console.warn('WebM chunk has invalid duration:', duration);
					return { valid: false, error: 'WebM chunk has invalid duration' };
				}

				return { valid: true };

			} catch (parseError) {
				// If libwebm can't parse it, it's not a valid WebM file
				const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown parse error';
				// console.warn('WebM parsing error:', errorMessage);
				return {
					valid: false,
					error: `WebM parsing failed: ${errorMessage}`
				};
			}

		} catch (error) {
			// console.error('WebM validation error:', error);
			return {
				valid: false,
				error: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
			};
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

			// Validate WebM/Opus format using LibWebM-JS if WEBM_DEBUG is enabled
			if (this.env.WEBM_DEBUG && this.env.WEBM_DEBUG === 'true') {
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
