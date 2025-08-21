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
export type DeviceOS = "iOS" | "Android" | "Web" | "Desktop" | "Unknown";

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
