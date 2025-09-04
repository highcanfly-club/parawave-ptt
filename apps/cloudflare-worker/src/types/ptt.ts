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
 * Channel types for PTT application
 */
export type ChannelType =
	| "site_local"
	| "emergency"
	| "general"
	| "cross_country"
	| "instructors";

/**
 * Channel difficulty levels for paragliding sites
 */
export type ChannelDifficulty =
	| "beginner"
	| "intermediate"
	| "advanced"
	| "expert";

/**
 * Network quality levels
 */
export type NetworkQuality = "poor" | "fair" | "good" | "excellent";

/**
 * Device operating system types
 */
export type DeviceOS = "iOS" | "Android" | "Web" | "WebClient" | "Desktop" | "Unknown";

/**
 * Device information
 */
export interface DeviceInfo {
	os?: DeviceOS;
	os_version?: string;
	app_version?: string;
	user_agent?: string;
}

/**
 * Geographic coordinates
 */
export interface Coordinates {
	lat: number;
	lon: number;
}

/**
 * PTT Channel definition
 */
export interface PTTChannel {
	uuid: string;
	name: string;
	type: ChannelType;
	description?: string;
	coordinates?: Coordinates;
	radius_km?: number;
	vhf_frequency?: string;
	max_participants: number;
	difficulty?: ChannelDifficulty;
	is_active: boolean;
	created_at: string;
	created_by: string;
	updated_at?: string;
	updated_by?: string;
}

/**
 * Request payload for creating a new channel
 */
export interface CreateChannelRequest {
	name: string;
	type: ChannelType;
	description?: string;
	coordinates?: Coordinates;
	radius_km?: number;
	vhf_frequency?: string;
	max_participants?: number;
	difficulty?: ChannelDifficulty;
}

/**
 * Request payload for creating a new channel with specific UUID
 */
export interface CreateChannelWithUuidRequest extends CreateChannelRequest {
	uuid: string;
}

/**
 * Request payload for updating an existing channel
 */
export interface UpdateChannelRequest {
	name?: string;
	type?: ChannelType;
	description?: string;
	coordinates?: Coordinates;
	radius_km?: number;
	vhf_frequency?: string;
	max_participants?: number;
	difficulty?: ChannelDifficulty;
	is_active?: boolean;
}

/**
 * Channel participant information
 */
export interface ChannelParticipant {
	user_id: string;
	username: string;
	join_time: string;
	last_seen: string;
	location?: Coordinates;
	connection_quality: NetworkQuality;
	is_transmitting: boolean;
	ephemeral_push_token?: string; // Token éphémère APNs PTT pour notifications
	os_type?: DeviceOS;
	os_version?: string;
	app_version?: string;
}

/**
 * Channel statistics for admin interface
 */
export interface ChannelStats {
	uuid: string;
	current_participants: number;
	total_participants_today: number;
	total_transmissions_today: number;
	avg_transmission_duration: number;
	last_activity: string | null;
	avg_connection_quality: NetworkQuality;
}

/**
 * API Response wrapper
 */
export interface APIResponse<T = any> {
	success: boolean;
	data?: T;
	error?: string;
	timestamp: string;
	version: string;
}

/**
 * Paginated API Response
 */
export interface PaginatedResponse<T = any> extends APIResponse<T[]> {
	pagination: {
		page: number;
		limit: number;
		total: number;
		total_pages: number;
	};
}

/**
 * Channel list response with statistics
 */
export interface ChannelsListResponse {
	channels: (PTTChannel & ChannelStats)[];
	total_count: number;
	active_count: number;
}

/**
 * Channel participants list response
 */
export interface ChannelParticipantsResponse {
	participants: ChannelParticipant[];
	total_count: number;
}

/**
 * Flying site information (complementary to channels)
 */
export interface FlyingSite {
	id: string;
	name: string;
	coordinates: Coordinates;
	elevation: number;
	difficulty: ChannelDifficulty;
	vhf_frequency?: string;
	radius_km: number;
	weather_station_id?: string;
	associated_channels: string[]; // Channel UUIDs
}

/**
 * Request payload for joining a channel
 */
export interface JoinChannelRequest {
	location?: Coordinates;
	ephemeral_push_token?: string; // Token éphémère APNs PTT depuis iOS framework
	device_info?: DeviceInfo;
}

/**
 * Response payload for joining a channel
 */
export interface JoinChannelResponse {
	success: boolean;
	participant?: ChannelParticipant;
	channel_info?: {
		name: string;
		participants_count: number;
		max_participants: number;
	};
	error?: string;
}

/**
 * Response payload for leaving a channel
 */
export interface LeaveChannelResponse {
	success: boolean;
	error?: string;
}

/**
 * Audio format types supported by the PTT system
 */
export type AudioFormat = "aac-lc" | "opus" | "pcm";

/**
 * Request payload for starting a PTT transmission
 */
export interface PTTStartTransmissionRequest {
	channel_uuid: string;
	audio_format: AudioFormat;
	sample_rate: number;
	bitrate: number;
	network_quality: NetworkQuality;
	device_info?: DeviceInfo;
	expected_duration?: number; // in seconds, max 30
	location?: Coordinates;
	is_emergency?: boolean;
}

/**
 * Response payload for starting a PTT transmission
 */
export interface PTTStartTransmissionResponse {
	success: boolean;
	session_id?: string;
	max_duration_ms?: number;
	websocket_url?: string;
	error?: string;
}

/**
 * Request payload for sending an audio chunk
 */
export interface PTTAudioChunkRequest {
	session_id: string;
	audio_data: string;
	chunk_sequence: number;
	chunk_size_bytes: number;
	timestamp_ms: number;
}

/**
 * Response payload for sending an audio chunk
 */
export interface PTTAudioChunkResponse {
	success: boolean;
	chunk_received?: boolean;
	next_expected_sequence?: number;
	error?: string;
}

/**
 * Request payload for ending a PTT transmission
 */
export interface PTTEndTransmissionRequest {
	session_id: string;
	total_duration_ms: number;
	total_chunks: number;
	actual_sample_rate?: number;
}

/**
 * Response payload for ending a PTT transmission
 */
export interface PTTEndTransmissionResponse {
	success: boolean;
	session_summary?: {
		total_duration_ms: number;
		chunks_received: number;
		total_bytes: number;
		participants_notified: number;
		missing_chunks?: number;
		packet_loss_rate?: number;
	};
	error?: string;
}

/**
 * Audio chunk data structure for real-time transmission
 */
export interface AudioChunk {
	sequence: number;
	data: string; // base64 encoded audio data
	timestamp: number;
	sizeBytes: number;
}

/**
 * Active transmission session stored in Durable Object memory
 */
export interface LiveTransmission {
	sessionId: string;
	channelUuid: string;
	userId: string;
	username: string;
	startTime: number;
	audioFormat: AudioFormat;
	sampleRate: number;
	bitrate: number;
	networkQuality: NetworkQuality;
	location?: Coordinates;
	isEmergency: boolean;

	// Real-time state
	audioChunks: Map<number, { chunk: AudioChunk; expires: number }>;
	participants: Set<WebSocket>;
	cleanupTimeout?: number;
	expectedSequence: number;
	totalBytes: number;
}

/**
 * Detailed WebSocket message types for real-time communication
 */
export type PTTWebSocketMessage =
	| PTTTransmissionStartedMessage
	| PTTAudioChunkMessage
	| PTTTransmissionEndedMessage
	| PTTParticipantJoinMessage
	| PTTParticipantLeaveMessage
	| PTTErrorMessage
	| PTTPongMessage;

export interface PTTTransmissionStartedMessage {
	type: "transmission_started";
	session_id: string;
	channel_uuid: string;
	timestamp_ms: number;
	data: {
		user_id: string;
		username: string;
		audio_format: AudioFormat;
		is_emergency: boolean;
	};
}

export interface PTTAudioChunkMessage {
	type: "audio_chunk";
	session_id: string;
	channel_uuid: string;
	timestamp_ms: number;
	data: {
		sequence: number;
		audio_data: string;
		size_bytes: number;
	};
}

export interface PTTTransmissionEndedMessage {
	type: "transmission_ended";
	session_id: string;
	channel_uuid: string;
	timestamp_ms: number;
	data: {
		user_id: string;
		duration_ms: number;
		total_chunks: number;
		total_bytes: number;
		missing_chunks?: number;
		packet_loss_rate?: number;
		reason?: string;
	};
}

export interface PTTParticipantJoinMessage {
	type: "participant_join";
	userId: string;
	username: string;
	timestamp: number;
}

export interface PTTParticipantLeaveMessage {
	type: "participant_leave";
	userId: string;
	timestamp: number;
}

export interface PTTErrorMessage {
	type: "error";
	session_id: string;
	channel_uuid: string;
	timestamp_ms: number;
	data: {
		message: string;
		code?: string;
	};
}

export interface PTTPongMessage {
	type: "pong";
	session_id: string;
	channel_uuid: string;
	timestamp_ms: number;
	data: {};
}

/**
 * Durable Object state for channel
 */
export interface PTTChannelState {
	channelUuid: string;
	activeTransmission: LiveTransmission | null;
	connectedParticipants: Map<
		string,
		{
			userId: string;
			username: string;
			websocket: WebSocket;
			joinedAt: number;
		}
	>;
	lastActivity: number;
}

/**
 * Transmission metadata for audit logging (minimal)
 */
export interface TransmissionAuditLog {
	sessionId: string;
	channelUuid: string;
	userId: string;
	clientId: string;
	username: string;
	startTime: string;
	endTime?: string;
	duration?: number;
	audioFormat: AudioFormat;
	chunksCount: number;
	totalBytes: number;
	participantCount: number;
	isEmergency: boolean;
	networkQuality: NetworkQuality;
	location?: Coordinates;
}

/**
 * Client identification for device-specific operations
 */
export interface ClientInfo {
	clientId: string;
	userId: string;
	userAgent?: string;
	platform: "ios" | "android" | "web" | "desktop" | "unknown";
	deviceModel?: string;
	osVersion?: string;
	appVersion?: string;
}

/**
 * Participant information with client identification
 */
export interface PTTChannelParticipant {
	userId: string;
	clientId: string;
	username: string;
	joinedAt: number;
	lastActivity: number;
	clientInfo?: ClientInfo;
}

/**
 * Utility functions for client identification
 */
export class ClientIdUtils {
	/**
	 * Generate a unique ephemeral token for client identification
	 * This token is used to uniquely identify a client device/app instance
	 *
	 * @param prefix - Optional prefix for the token (e.g., "web", "ios")
	 * @returns Unique ephemeral token string
	 */
	static generateEphemeralToken(prefix: string = "client"): string {
		const timestamp = Date.now().toString(36);
		const random = Math.random().toString(36).substring(2, 15);
		const random2 = Math.random().toString(36).substring(2, 8);

		return `${prefix}_${timestamp}_${random}_${random2}`;
	}

	/**
	 * Validate that a token has the correct format
	 *
	 * @param token - The token to validate
	 * @returns True if the token format is valid
	 */
	static isValidEphemeralToken(token: string): boolean {
		// Format: prefix_timestamp_random1_random2
		const parts = token.split('_');
		return parts.length === 4 && parts[0].length > 0 && parts[1].length > 0 && parts[2].length > 0 && parts[3].length > 0;
	}
}
