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

import { ChannelParticipant, NetworkQuality, Coordinates } from '../types/ptt';

/**
 * Channel state for real-time PTT operations
 */
interface ChannelState {
	uuid: string;
	name: string;
	participants: Map<string, ChannelParticipant>;
	currentTransmitter: string | null;
	transmissionStartTime: number | null;
	maxParticipants: number;
	isActive: boolean;
	createdAt: number;
}

/**
 * WebSocket message types for real-time communication
 */
interface WebSocketMessage {
	type: 'join' | 'leave' | 'ptt_start' | 'ptt_end' | 'heartbeat' | 'location_update' | 'emergency';
	userId: string;
	data?: any;
}

/**
 * Durable Object for managing real-time PTT channel operations
 * Each channel gets its own instance with persistent state
 */
export class ChannelDurableObject implements DurableObject {
	private state: DurableObjectState;
	private env: Env;
	private channelState: ChannelState;
	private websocketConnections: Map<string, WebSocket>;
	private heartbeatInterval: number | null = null;

	constructor(state: DurableObjectState, env: Env) {
		this.state = state;
		this.env = env;
		this.websocketConnections = new Map();
		this.channelState = {
			uuid: '',
			name: '',
			participants: new Map(),
			currentTransmitter: null,
			transmissionStartTime: null,
			maxParticipants: 50,
			isActive: true,
			createdAt: Date.now()
		};

		// Initialize channel state from storage
		this.initializeFromStorage();

		// Set up periodic cleanup of inactive participants
		this.heartbeatInterval = setInterval(() => {
			this.cleanupInactiveParticipants();
		}, 30000); // Check every 30 seconds
	}

	/**
	 * Handle HTTP requests to the Durable Object
	 */
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;
		const method = request.method;

		try {
			// Handle WebSocket upgrade requests
			if (path === '/websocket' && request.headers.get('Upgrade') === 'websocket') {
				return this.handleWebSocketUpgrade(request);
			}

			// Handle REST API endpoints
			switch (path) {
				case '/join':
					return method === 'POST' ? this.handleJoinChannel(request) : this.methodNotAllowed();
				case '/leave':
					return method === 'POST' ? this.handleLeaveChannel(request) : this.methodNotAllowed();
				case '/ptt/start':
					return method === 'POST' ? this.handleStartTransmission(request) : this.methodNotAllowed();
				case '/ptt/end':
					return method === 'POST' ? this.handleEndTransmission(request) : this.methodNotAllowed();
				case '/participants':
					return method === 'GET' ? this.handleGetParticipants() : this.methodNotAllowed();
				case '/status':
					return method === 'GET' ? this.handleGetStatus() : this.methodNotAllowed();
				case '/initialize':
					return method === 'POST' ? this.handleInitializeChannel(request) : this.methodNotAllowed();
				default:
					return new Response('Not Found', { status: 404 });
			}
		} catch (error) {
			console.error('ChannelDurableObject error:', error);
			return new Response('Internal Server Error', { status: 500 });
		}
	}

	/**
	 * Initialize or update channel configuration
	 */
	private async handleInitializeChannel(request: Request): Promise<Response> {
		try {
			const requestData = await request.json() as any;
			const { uuid, name, maxParticipants } = requestData;
			
			this.channelState.uuid = uuid;
			this.channelState.name = name;
			this.channelState.maxParticipants = maxParticipants || 50;
			
			await this.persistState();

			return new Response(JSON.stringify({
				success: true,
				channelId: uuid,
				name: name,
				maxParticipants: this.channelState.maxParticipants
			}), {
				headers: { 'Content-Type': 'application/json' }
			});
		} catch (error) {
			return new Response(JSON.stringify({ error: 'Invalid request data' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}
	}

	/**
	 * Handle user joining channel
	 */
	private async handleJoinChannel(request: Request): Promise<Response> {
		try {
			const requestData = await request.json() as any;
			const { userId, username, location } = requestData;

			// Check channel capacity
			if (this.channelState.participants.size >= this.channelState.maxParticipants) {
				return new Response(JSON.stringify({
					error: 'Channel full',
					maxParticipants: this.channelState.maxParticipants,
					currentParticipants: this.channelState.participants.size
				}), {
					status: 409,
					headers: { 'Content-Type': 'application/json' }
				});
			}

			// Add or update participant
			const participant: ChannelParticipant = {
				user_id: userId,
				username: username,
				join_time: new Date().toISOString(),
				last_seen: new Date().toISOString(),
				location: location,
				connection_quality: 'good',
				is_transmitting: false
			};

			this.channelState.participants.set(userId, participant);
			await this.persistState();

			// Notify other participants
			this.broadcastToParticipants({
				type: 'participant_joined',
				participant: participant,
				totalParticipants: this.channelState.participants.size
			}, userId); // Exclude the joining user

			// Log join event to D1 database
			await this.logChannelEvent(userId, username, 'join', { location });

			return new Response(JSON.stringify({
				success: true,
				channelId: this.channelState.uuid,
				participantCount: this.channelState.participants.size,
				currentTransmitter: this.channelState.currentTransmitter
			}), {
				headers: { 'Content-Type': 'application/json' }
			});
		} catch (error) {
			console.error('Join channel error:', error);
			return new Response(JSON.stringify({ error: 'Failed to join channel' }), {
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			});
		}
	}

	/**
	 * Handle user leaving channel
	 */
	private async handleLeaveChannel(request: Request): Promise<Response> {
		try {
			const requestData = await request.json() as any;
			const { userId } = requestData;

			const participant = this.channelState.participants.get(userId);
			if (!participant) {
				return new Response(JSON.stringify({ error: 'User not in channel' }), {
					status: 404,
					headers: { 'Content-Type': 'application/json' }
				});
			}

			// If user was transmitting, end transmission
			if (this.channelState.currentTransmitter === userId) {
				await this.endTransmission(userId);
			}

			// Remove participant
			this.channelState.participants.delete(userId);
			this.websocketConnections.delete(userId);
			await this.persistState();

			// Notify other participants
			this.broadcastToParticipants({
				type: 'participant_left',
				userId: userId,
				username: participant.username,
				totalParticipants: this.channelState.participants.size
			});

			// Log leave event
			await this.logChannelEvent(userId, participant.username, 'leave');

			return new Response(JSON.stringify({
				success: true,
				participantCount: this.channelState.participants.size
			}), {
				headers: { 'Content-Type': 'application/json' }
			});
		} catch (error) {
			console.error('Leave channel error:', error);
			return new Response(JSON.stringify({ error: 'Failed to leave channel' }), {
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			});
		}
	}

	/**
	 * Handle start PTT transmission
	 */
	private async handleStartTransmission(request: Request): Promise<Response> {
		try {
			const requestData = await request.json() as any;
			const { userId, location, quality } = requestData;

			const participant = this.channelState.participants.get(userId);
			if (!participant) {
				return new Response(JSON.stringify({ error: 'User not in channel' }), {
					status: 404,
					headers: { 'Content-Type': 'application/json' }
				});
			}

			// Check if channel is busy
			if (this.channelState.currentTransmitter && this.channelState.currentTransmitter !== userId) {
				const currentTransmitter = this.channelState.participants.get(this.channelState.currentTransmitter);
				return new Response(JSON.stringify({
					error: 'Channel busy',
					currentTransmitter: currentTransmitter?.username || 'Unknown'
				}), {
					status: 409,
					headers: { 'Content-Type': 'application/json' }
				});
			}

			// Start transmission
			this.channelState.currentTransmitter = userId;
			this.channelState.transmissionStartTime = Date.now();
			participant.is_transmitting = true;
			participant.last_seen = new Date().toISOString();
			if (location) participant.location = location;

			await this.persistState();

			// Notify all participants
			this.broadcastToParticipants({
				type: 'transmission_started',
				transmitter: {
					userId: userId,
					username: participant.username,
					location: participant.location
				}
			});

			// Log transmission start
			await this.logChannelEvent(userId, participant.username, 'audio_start', {
				location: location,
				quality: quality
			});

			return new Response(JSON.stringify({
				success: true,
				transmissionId: `${userId}_${this.channelState.transmissionStartTime}`
			}), {
				headers: { 'Content-Type': 'application/json' }
			});
		} catch (error) {
			console.error('Start transmission error:', error);
			return new Response(JSON.stringify({ error: 'Failed to start transmission' }), {
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			});
		}
	}

	/**
	 * Handle end PTT transmission
	 */
	private async handleEndTransmission(request: Request): Promise<Response> {
		try {
			const requestData = await request.json() as any;
			const { userId, quality } = requestData;

			if (this.channelState.currentTransmitter !== userId) {
				return new Response(JSON.stringify({ error: 'Not currently transmitting' }), {
					status: 400,
					headers: { 'Content-Type': 'application/json' }
				});
			}

			const duration = await this.endTransmission(userId, quality);

			return new Response(JSON.stringify({
				success: true,
				duration: duration
			}), {
				headers: { 'Content-Type': 'application/json' }
			});
		} catch (error) {
			console.error('End transmission error:', error);
			return new Response(JSON.stringify({ error: 'Failed to end transmission' }), {
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			});
		}
	}

	/**
	 * Get current channel participants
	 */
	private async handleGetParticipants(): Promise<Response> {
		const participants = Array.from(this.channelState.participants.values());
		
		return new Response(JSON.stringify({
			success: true,
			participants: participants,
			count: participants.length,
			maxParticipants: this.channelState.maxParticipants,
			currentTransmitter: this.channelState.currentTransmitter
		}), {
			headers: { 'Content-Type': 'application/json' }
		});
	}

	/**
	 * Get channel status
	 */
	private async handleGetStatus(): Promise<Response> {
		return new Response(JSON.stringify({
			success: true,
			channel: {
				uuid: this.channelState.uuid,
				name: this.channelState.name,
				isActive: this.channelState.isActive,
				participantCount: this.channelState.participants.size,
				maxParticipants: this.channelState.maxParticipants,
				currentTransmitter: this.channelState.currentTransmitter,
				createdAt: this.channelState.createdAt
			}
		}), {
			headers: { 'Content-Type': 'application/json' }
		});
	}

	/**
	 * Handle WebSocket upgrade for real-time communication
	 */
	private async handleWebSocketUpgrade(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const userId = url.searchParams.get('userId');

		if (!userId || !this.channelState.participants.has(userId)) {
			return new Response('Unauthorized', { status: 401 });
		}

		// Create WebSocket pair
		const webSocketPair = new WebSocketPair();
		const [client, server] = Object.values(webSocketPair);

		// Accept WebSocket connection
		server.accept();
		this.websocketConnections.set(userId, server);

		// Handle WebSocket messages
		server.addEventListener('message', (event) => {
			this.handleWebSocketMessage(userId, event.data);
		});

		// Clean up on connection close
		server.addEventListener('close', () => {
			this.websocketConnections.delete(userId);
		});

		// Send initial channel state
		server.send(JSON.stringify({
			type: 'channel_state',
			participants: Array.from(this.channelState.participants.values()),
			currentTransmitter: this.channelState.currentTransmitter
		}));

		return new Response(null, {
			status: 101,
			webSocket: client
		});
	}

	/**
	 * Handle WebSocket messages from clients
	 */
	private handleWebSocketMessage(userId: string, message: any): void {
		try {
			const data: WebSocketMessage = JSON.parse(message);

			switch (data.type) {
				case 'heartbeat':
					this.handleHeartbeat(userId);
					break;
				case 'location_update':
					this.handleLocationUpdate(userId, data.data.location);
					break;
				case 'emergency':
					this.handleEmergency(userId, data.data);
					break;
			}
		} catch (error) {
			console.error('WebSocket message error:', error);
		}
	}

	/**
	 * Handle heartbeat to keep participant alive
	 */
	private async handleHeartbeat(userId: string): Promise<void> {
		const participant = this.channelState.participants.get(userId);
		if (participant) {
			participant.last_seen = new Date().toISOString();
			await this.persistState();
		}
	}

	/**
	 * Handle location update
	 */
	private async handleLocationUpdate(userId: string, location: Coordinates): Promise<void> {
		const participant = this.channelState.participants.get(userId);
		if (participant) {
			participant.location = location;
			participant.last_seen = new Date().toISOString();
			await this.persistState();

			// Broadcast location update to other participants
			this.broadcastToParticipants({
				type: 'location_update',
				userId: userId,
				location: location
			}, userId);
		}
	}

	/**
	 * Handle emergency alert
	 */
	private async handleEmergency(userId: string, emergencyData: any): Promise<void> {
		const participant = this.channelState.participants.get(userId);
		if (!participant) return;

		// Log emergency event
		await this.logChannelEvent(userId, participant.username, 'emergency', emergencyData);

		// Broadcast emergency alert to all participants
		this.broadcastToParticipants({
			type: 'emergency_alert',
			reporter: participant.username,
			location: emergencyData.location,
			message: emergencyData.message,
			timestamp: Date.now()
		});

		// TODO: Trigger external emergency services if configured
	}

	/**
	 * End current transmission
	 */
	private async endTransmission(userId: string, quality?: number): Promise<number> {
		const participant = this.channelState.participants.get(userId);
		if (!participant) return 0;

		const duration = this.channelState.transmissionStartTime ? 
			Math.round((Date.now() - this.channelState.transmissionStartTime) / 1000) : 0;

		// Reset transmission state
		this.channelState.currentTransmitter = null;
		this.channelState.transmissionStartTime = null;
		participant.is_transmitting = false;
		participant.last_seen = new Date().toISOString();

		await this.persistState();

		// Notify all participants
		this.broadcastToParticipants({
			type: 'transmission_ended',
			transmitter: {
				userId: userId,
				username: participant.username
			},
			duration: duration
		});

		// Log transmission end
		await this.logChannelEvent(userId, participant.username, 'audio_end', {
			duration: duration,
			quality: quality
		});

		return duration;
	}

	/**
	 * Broadcast message to all connected participants via WebSocket
	 */
	private broadcastToParticipants(message: any, excludeUserId?: string): void {
		const messageStr = JSON.stringify(message);

		for (const [userId, ws] of this.websocketConnections) {
			if (excludeUserId && userId === excludeUserId) continue;

			try {
				if (ws.readyState === WebSocket.READY_STATE_OPEN) {
					ws.send(messageStr);
				}
			} catch (error) {
				console.error(`Failed to send message to ${userId}:`, error);
				this.websocketConnections.delete(userId);
			}
		}
	}

	/**
	 * Clean up inactive participants
	 */
	private async cleanupInactiveParticipants(): Promise<void> {
		const now = Date.now();
		const timeoutMs = 5 * 60 * 1000; // 5 minutes
		let hasChanges = false;

		for (const [userId, participant] of this.channelState.participants) {
			const lastSeen = new Date(participant.last_seen).getTime();
			if (now - lastSeen > timeoutMs) {
				// Remove inactive participant
				this.channelState.participants.delete(userId);
				this.websocketConnections.delete(userId);
				hasChanges = true;

				// If they were transmitting, end transmission
				if (this.channelState.currentTransmitter === userId) {
					await this.endTransmission(userId);
				}

				// Notify other participants
				this.broadcastToParticipants({
					type: 'participant_left',
					userId: userId,
					username: participant.username,
					reason: 'timeout',
					totalParticipants: this.channelState.participants.size
				});

				// Log timeout event
				await this.logChannelEvent(userId, participant.username, 'leave', {
					reason: 'timeout'
				});
			}
		}

		if (hasChanges) {
			await this.persistState();
		}
	}

	/**
	 * Initialize channel state from Durable Object storage
	 */
	private async initializeFromStorage(): Promise<void> {
		const stored = await this.state.storage.get<ChannelState>('channelState');
		if (stored) {
			this.channelState = {
				...stored,
				participants: new Map(stored.participants || [])
			};
		}
	}

	/**
	 * Persist channel state to Durable Object storage
	 */
	private async persistState(): Promise<void> {
		const stateToStore = {
			...this.channelState,
			participants: Array.from(this.channelState.participants.entries())
		};
		await this.state.storage.put('channelState', stateToStore);
	}

	/**
	 * Log channel events to D1 database
	 */
	private async logChannelEvent(userId: string, username: string, eventType: string, metadata: any = {}): Promise<void> {
		try {
			// This would typically use the env.PTT_DB binding
			// For now, we'll just log to console
			console.log('Channel event:', {
				channelUuid: this.channelState.uuid,
				userId,
				username,
				eventType,
				metadata,
				timestamp: new Date().toISOString()
			});
		} catch (error) {
			console.error('Error logging channel event:', error);
		}
	}

	/**
	 * Return method not allowed response
	 */
	private methodNotAllowed(): Response {
		return new Response('Method Not Allowed', { status: 405 });
	}
}
