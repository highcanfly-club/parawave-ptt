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

// Audio formats supported by the PTT system
export type AudioFormat = "aac-lc" | "opus" | "pcm";

// Network quality indicators
export type NetworkQuality = "excellent" | "good" | "fair" | "poor";

// Geographic location data
export interface Location {
	lat: number;
	lon: number;
	accuracy?: number;
	altitude?: number;
}

// Audio chunk data structure for real-time transmission
export interface AudioChunk {
	sequence: number;
	data: string; // base64 encoded audio data
	timestamp: number;
	sizeBytes: number;
}

// Active transmission session stored in Durable Object memory
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
	location?: Location;
	isEmergency: boolean;

	// Real-time state
	audioChunks: Map<number, { chunk: AudioChunk; expires: number }>;
	participants: Set<WebSocket>;
	cleanupTimeout?: number;
	expectedSequence: number;
	totalBytes: number;
}

// WebSocket message types for real-time communication
export type PTTWebSocketMessage =
	| PTTTransmissionStartMessage
	| PTTAudioChunkMessage
	| PTTTransmissionEndMessage
	| PTTParticipantJoinMessage
	| PTTParticipantLeaveMessage
	| PTTErrorMessage
	| PTTPongMessage;

export interface PTTTransmissionStartMessage {
	type: "transmission_start";
	sessionId: string;
	userId: string;
	username: string;
	audioFormat: AudioFormat;
	isEmergency: boolean;
	timestamp: number;
}

export interface PTTAudioChunkMessage {
	type: "audio_chunk";
	sessionId: string;
	sequence: number;
	audioData: string;
	timestamp: number;
	sizeBytes: number;
}

export interface PTTTransmissionEndMessage {
	type: "transmission_end";
	sessionId: string;
	userId: string;
	duration: number;
	totalChunks: number;
	totalBytes: number;
	timestamp: number;
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
	error: string;
	code?: string;
	timestamp: number;
}

export interface PTTPongMessage {
	type: "pong";
	timestamp: number;
}

// HTTP API Request/Response types
export interface PTTStartTransmissionRequest {
	channel_uuid: string;
	audio_format: AudioFormat;
	sample_rate: number;
	bitrate: number;
	network_quality: NetworkQuality;
	location?: Location;
	is_emergency?: boolean;
}

export interface PTTStartTransmissionResponse {
	success: boolean;
	session_id?: string;
	max_duration_ms?: number;
	websocket_url?: string;
	error?: string;
}

export interface PTTAudioChunkRequest {
	session_id: string;
	chunk_sequence: number;
	audio_data: string;
	chunk_size_bytes: number;
	timestamp_ms: number;
}

export interface PTTAudioChunkResponse {
	success: boolean;
	chunk_received?: boolean;
	next_expected_sequence?: number;
	error?: string;
}

export interface PTTEndTransmissionRequest {
	session_id: string;
	total_duration_ms: number;
	final_location?: Location;
}

export interface PTTEndTransmissionResponse {
	success: boolean;
	session_summary?: {
		total_duration_ms: number;
		chunks_received: number;
		total_bytes: number;
		participants_notified: number;
	};
	error?: string;
}

// Durable Object state for channel
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

// Transmission metadata for audit logging (minimal)
export interface TransmissionAuditLog {
	sessionId: string;
	channelUuid: string;
	userId: string;
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
	location?: Location;
}
