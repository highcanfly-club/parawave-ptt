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
	PTTChannel,
	CreateChannelRequest,
	UpdateChannelRequest,
	ChannelStats,
	ChannelsListResponse,
	Coordinates,
	ChannelParticipant,
} from "../types/ptt";

/**
 * Channel management service for PTT application
 * Handles CRUD operations for channels with D1 database
 */
export class ChannelService {
	private db: D1Database;
	private kv: KVNamespace;

	constructor(db: D1Database, kv: KVNamespace) {
		this.db = db;
		this.kv = kv;
	}

	/**
	 * Generate a unique UUID for a new channel
	 */
	private generateChannelUUID(): string {
		return crypto.randomUUID();
	}

	/**
	 * Get current timestamp in ISO format
	 */
	private getCurrentTimestamp(): string {
		return new Date().toISOString();
	}

	/**
	 * Cache channel data in KV for performance
	 */
	private async cacheChannel(channel: PTTChannel): Promise<void> {
		const cacheKey = `channel:${channel.uuid}`;

		await this.kv.put(cacheKey, JSON.stringify(channel), {
			expirationTtl: 300, // 5 minutes cache
		});
	}

	/**
	 * Get channel from cache
	 */
	private async getCachedChannel(uuid: string): Promise<PTTChannel | null> {
		const cacheKey = `channel:${uuid}`;
		const cached = await this.kv.get(cacheKey, "json");

		return cached as PTTChannel | null;
	}

	/**
	 * Invalidate channel cache
	 */
	private async invalidateChannelCache(uuid: string): Promise<void> {
		const cacheKey = `channel:${uuid}`;

		await this.kv.delete(cacheKey);
		// Also invalidate channels list cache
		await this.kv.delete("channels:list");
	}

	/**
	 * Create a new PTT channel with a specific UUID
	 * @param request Channel creation data
	 * @param createdBy User ID who is creating the channel
	 * @param specificUuid The specific UUID to use for the channel
	 * @returns Created channel or null if failed
	 */
	async createChannelWithUuid(
		request: CreateChannelRequest,
		createdBy: string,
		specificUuid: string,
	): Promise<PTTChannel | null> {
		try {
			const now = this.getCurrentTimestamp();
			const uuidLower = specificUuid.toLowerCase();

			// Validate UUID format
			const uuidRegex =
				/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

			if (!uuidRegex.test(uuidLower)) {
				throw new Error("Invalid UUID format");
			}

			// Check if UUID already exists
			const existingChannel = await this.db
				.prepare(
					`
				   SELECT uuid FROM channels WHERE uuid = ?
			   `,
				)
				.bind(uuidLower)
				.first();

			if (existingChannel) {
				throw new Error("Channel with this UUID already exists");
			}

			// Validate required fields
			if (!request.name || !request.type) {
				throw new Error("Name and type are required fields");
			}

			// Validate coordinates if provided
			if (request.coordinates) {
				if (
					!this.isValidCoordinates(
						request.coordinates.lat,
						request.coordinates.lon,
					)
				) {
					throw new Error("Invalid coordinates provided");
				}
			}

			// Validate VHF frequency format if provided
			if (
				request.vhf_frequency &&
				!this.isValidVHFFrequency(request.vhf_frequency)
			) {
				throw new Error("Invalid VHF frequency format");
			}

			const channel: PTTChannel = {
				uuid: uuidLower,
				name: request.name,
				type: request.type,
				description: request.description,
				coordinates: request.coordinates,
				radius_km: request.radius_km || 50,
				vhf_frequency: request.vhf_frequency,
				max_participants: request.max_participants || 50,
				difficulty: request.difficulty,
				is_active: true,
				created_at: now,
				created_by: createdBy,
			};

			// Insert into database
			const result = await this.db
				.prepare(
					`
				   INSERT INTO channels (
					   uuid, name, type, description, coordinates_lat, coordinates_lon,
					   radius_km, vhf_frequency, max_participants, difficulty, is_active,
					   created_at, created_by
				   ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			   `,
				)
				.bind(
					channel.uuid,
					channel.name,
					channel.type,
					channel.description || null,
					channel.coordinates?.lat || null,
					channel.coordinates?.lon || null,
					channel.radius_km,
					channel.vhf_frequency || null,
					channel.max_participants,
					channel.difficulty || null,
					channel.is_active ? 1 : 0,
					channel.created_at,
					channel.created_by,
				)
				.run();

			if (!result.success) {
				console.error("Failed to insert channel:", result);

				return null;
			}

			// Cache the channel
			await this.cacheChannel(channel);

			return channel;
		} catch (error) {
			console.error("Error creating channel with specific UUID:", error);

			return null;
		}
	}

	/**
	 * Create a new PTT channel
	 * @param request Channel creation data
	 * @param createdBy User ID who is creating the channel
	 * @returns Created channel or null if failed
	 */
	async createChannel(
		request: CreateChannelRequest,
		createdBy: string,
	): Promise<PTTChannel | null> {
		try {
			const uuid = this.generateChannelUUID();
			const now = this.getCurrentTimestamp();

			// Validate required fields
			if (!request.name || !request.type) {
				throw new Error("Name and type are required fields");
			}

			// Validate coordinates if provided
			if (request.coordinates) {
				if (
					!this.isValidCoordinates(
						request.coordinates.lat,
						request.coordinates.lon,
					)
				) {
					throw new Error("Invalid coordinates provided");
				}
			}

			// Validate VHF frequency format if provided
			if (
				request.vhf_frequency &&
				!this.isValidVHFFrequency(request.vhf_frequency)
			) {
				throw new Error("Invalid VHF frequency format");
			}

			const channel: PTTChannel = {
				uuid,
				name: request.name,
				type: request.type,
				description: request.description,
				coordinates: request.coordinates,
				radius_km: request.radius_km || 50,
				vhf_frequency: request.vhf_frequency,
				max_participants: request.max_participants || 50,
				difficulty: request.difficulty,
				is_active: true,
				created_at: now,
				created_by: createdBy,
			};

			// Insert into database
			const result = await this.db
				.prepare(
					`
				INSERT INTO channels (
					uuid, name, type, description, coordinates_lat, coordinates_lon,
					radius_km, vhf_frequency, max_participants, difficulty, is_active,
					created_at, created_by
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			`,
				)
				.bind(
					channel.uuid,
					channel.name,
					channel.type,
					channel.description || null,
					channel.coordinates?.lat || null,
					channel.coordinates?.lon || null,
					channel.radius_km,
					channel.vhf_frequency || null,
					channel.max_participants,
					channel.difficulty || null,
					channel.is_active,
					channel.created_at,
					channel.created_by,
				)
				.run();

			if (result.success) {
				// Cache the new channel
				await this.cacheChannel(channel);

				// Log creation event
				await this.logChannelEvent(channel.uuid, "channel_created", createdBy, {
					channel_name: channel.name,
					channel_type: channel.type,
				});

				return channel;
			}

			return null;
		} catch (error) {
			console.error("Error creating channel:", error);

			return null;
		}
	}

	/**
	 * Get a channel by UUID
	 * @param uuid Channel UUID
	 * @returns Channel or null if not found
	 */
	async getChannel(uuid: string): Promise<PTTChannel | null> {
		try {
			const uuidLower = uuid.toLowerCase();
			// Try cache first
			const cached = await this.getCachedChannel(uuidLower);

			if (cached) {
				return cached;
			}

			// Query database
			const result = await this.db
				.prepare(
					`
				   SELECT uuid, name, type, description, coordinates_lat, coordinates_lon,
						  radius_km, vhf_frequency, max_participants, difficulty, is_active,
						  created_at, created_by, updated_at, updated_by
				   FROM channels WHERE uuid = ?
			   `,
				)
				.bind(uuidLower)
				.first();

			if (result) {
				const channel = this.mapRowToChannel(result);

				// Cache the result
				await this.cacheChannel(channel);

				return channel;
			}

			return null;
		} catch (error) {
			console.error("Error getting channel:", error);

			return null;
		}
	}

	/**
	 * Get all channels with optional filtering
	 * @param type Filter by channel type
	 * @param activeOnly Filter only active channels
	 * @param location Filter by proximity to location
	 * @param radiusKm Radius for location filtering
	 * @returns List of channels with statistics
	 */
	async getChannels(
		type?: string,
		activeOnly: boolean = true,
		location?: { lat: number; lon: number },
		radiusKm?: number,
	): Promise<ChannelsListResponse> {
		try {
			// Build dynamic query
			let query = `
				SELECT 
					c.uuid, c.name, c.type, c.description, c.coordinates_lat, c.coordinates_lon,
					c.radius_km, c.vhf_frequency, c.max_participants, c.difficulty, c.is_active,
					c.created_at, c.created_by, c.updated_at, c.updated_by,
					COUNT(DISTINCT cp.user_id) as current_participants,
					COUNT(DISTINCT CASE WHEN DATE(cm.timestamp) = DATE('now') THEN cm.user_id END) as total_participants_today,
					COUNT(CASE WHEN cm.message_type = 'audio_start' AND DATE(cm.timestamp) = DATE('now') THEN 1 END) as total_transmissions_today,
					AVG(th.duration_seconds) as avg_transmission_duration,
					MAX(cm.timestamp) as last_activity
				FROM channels c
				LEFT JOIN channel_participants cp ON c.uuid = cp.channel_uuid AND cp.last_seen > datetime('now', '-5 minutes')
				LEFT JOIN channel_messages cm ON c.uuid = cm.channel_uuid
				LEFT JOIN transmission_history th ON c.uuid = th.channel_uuid AND DATE(th.start_time) = DATE('now')
			`;

			const params: any[] = [];
			const conditions: string[] = [];

			if (activeOnly) {
				conditions.push("c.is_active = ?");
				params.push(true);
			}

			if (type) {
				conditions.push("c.type = ?");
				params.push(type);
			}

			// Location-based filtering using Haversine formula approximation
			if (location && radiusKm) {
				conditions.push(`
					(6371 * acos(cos(radians(?)) * cos(radians(c.coordinates_lat)) * 
					cos(radians(c.coordinates_lon) - radians(?)) + sin(radians(?)) * 
					sin(radians(c.coordinates_lat)))) <= ?
				`);
				params.push(location.lat, location.lon, location.lat, radiusKm);
			}

			if (conditions.length > 0) {
				query += " WHERE " + conditions.join(" AND ");
			}

			query += `
				GROUP BY c.uuid, c.name, c.type, c.description, c.coordinates_lat, c.coordinates_lon,
				         c.radius_km, c.vhf_frequency, c.max_participants, c.difficulty, c.is_active,
				         c.created_at, c.created_by, c.updated_at, c.updated_by
				ORDER BY c.type = 'emergency' DESC, c.name ASC
			`;

			const results = await this.db
				.prepare(query)
				.bind(...params)
				.all();

			const channels: (PTTChannel & ChannelStats)[] =
				results.results?.map((row: any) => {
					const channel = this.mapRowToChannel(row);
					const stats: ChannelStats = {
						uuid: channel.uuid,
						current_participants: row.current_participants || 0,
						total_participants_today: row.total_participants_today || 0,
						total_transmissions_today: row.total_transmissions_today || 0,
						avg_transmission_duration: row.avg_transmission_duration || 0,
						last_activity: row.last_activity,
						avg_connection_quality: "good", // TODO: Calculate from actual data
					};

					return { ...channel, ...stats };
				}) || [];

			const activeCount = channels.filter((c) => c.is_active).length;

			return {
				channels,
				total_count: channels.length,
				active_count: activeCount,
			};
		} catch (error) {
			console.error("Error getting channels:", error);

			return {
				channels: [],
				total_count: 0,
				active_count: 0,
			};
		}
	}

	/**
	 * Update an existing channel
	 * @param uuid Channel UUID
	 * @param request Update data
	 * @param updatedBy User ID who is updating
	 * @returns Updated channel or null if failed
	 */
	async updateChannel(
		uuid: string,
		request: UpdateChannelRequest,
		updatedBy: string,
	): Promise<PTTChannel | null> {
		try {
			const uuidLower = uuid.toLowerCase();
			// Get existing channel
			const existingChannel = await this.getChannel(uuidLower);

			if (!existingChannel) {
				return null;
			}

			// Build update query dynamically
			const updateFields: string[] = [];
			const params: any[] = [];

			if (request.name !== undefined) {
				updateFields.push("name = ?");
				params.push(request.name);
			}

			if (request.type !== undefined) {
				updateFields.push("type = ?");
				params.push(request.type);
			}

			if (request.description !== undefined) {
				updateFields.push("description = ?");
				params.push(request.description);
			}

			if (request.coordinates !== undefined) {
				if (
					request.coordinates &&
					this.isValidCoordinates(
						request.coordinates.lat,
						request.coordinates.lon,
					)
				) {
					updateFields.push("coordinates_lat = ?", "coordinates_lon = ?");
					params.push(request.coordinates.lat, request.coordinates.lon);
				} else {
					updateFields.push("coordinates_lat = NULL", "coordinates_lon = NULL");
				}
			}

			if (request.radius_km !== undefined) {
				updateFields.push("radius_km = ?");
				params.push(request.radius_km);
			}

			if (request.vhf_frequency !== undefined) {
				if (
					request.vhf_frequency &&
					!this.isValidVHFFrequency(request.vhf_frequency)
				) {
					throw new Error("Invalid VHF frequency format");
				}
				updateFields.push("vhf_frequency = ?");
				params.push(request.vhf_frequency);
			}

			if (request.max_participants !== undefined) {
				updateFields.push("max_participants = ?");
				params.push(request.max_participants);
			}

			if (request.difficulty !== undefined) {
				updateFields.push("difficulty = ?");
				params.push(request.difficulty);
			}

			if (request.is_active !== undefined) {
				updateFields.push("is_active = ?");
				params.push(request.is_active);
			}

			if (updateFields.length === 0) {
				// No fields to update
				return existingChannel;
			}

			// Add update metadata
			updateFields.push("updated_at = ?", "updated_by = ?");
			params.push(this.getCurrentTimestamp(), updatedBy);

			// Add UUID for WHERE clause
			params.push(uuidLower);

			const query = `UPDATE channels SET ${updateFields.join(", ")} WHERE uuid = ?`;
			const result = await this.db
				.prepare(query)
				.bind(...params)
				.run();

			if (result.success) {
				// Invalidate cache
				await this.invalidateChannelCache(uuidLower);

				// Get updated channel
				const updatedChannel = await this.getChannel(uuidLower);

				if (updatedChannel) {
					// Log update event
					await this.logChannelEvent(uuidLower, "channel_updated", updatedBy, {
						updated_fields: Object.keys(request),
					});
				}

				return updatedChannel;
			}

			return null;
		} catch (error) {
			console.error("Error updating channel:", error);

			return null;
		}
	}

	/**
	 * Delete a channel (soft delete by setting is_active to false)
	 * @param uuid Channel UUID
	 * @param deletedBy User ID who is deleting
	 * @returns Success status
	 */
	async deleteChannel(uuid: string, deletedBy: string): Promise<boolean> {
		try {
			const uuidLower = uuid.toLowerCase();
			// Check if channel exists
			const existingChannel = await this.getChannel(uuidLower);

			if (!existingChannel) {
				return false;
			}

			// Soft delete: set is_active to false
			const result = await this.db
				.prepare(
					`
				   UPDATE channels 
				   SET is_active = ?, updated_at = ?, updated_by = ?
				   WHERE uuid = ?
			   `,
				)
				.bind(false, this.getCurrentTimestamp(), deletedBy, uuidLower)
				.run();

			if (result.success) {
				// Invalidate cache
				await this.invalidateChannelCache(uuidLower);

				// Log deletion event
				await this.logChannelEvent(uuidLower, "channel_deleted", deletedBy, {
					channel_name: existingChannel.name,
				});

				return true;
			}

			return false;
		} catch (error) {
			console.error("Error deleting channel:", error);

			return false;
		}
	}

	/**
	 * Hard delete a channel (admin only - permanently removes from database)
	 * @param uuid Channel UUID
	 * @param deletedBy User ID who is deleting
	 * @returns Success status
	 */
	async hardDeleteChannel(uuid: string, deletedBy: string): Promise<boolean> {
		try {
			const uuidLower = uuid.toLowerCase();
			// Check if channel exists
			const existingChannel = await this.getChannel(uuidLower);

			if (!existingChannel) {
				return false;
			}

			// Hard delete from database (CASCADE will handle related records)
			const result = await this.db
				.prepare("DELETE FROM channels WHERE uuid = ?")
				.bind(uuidLower)
				.run();

			if (result.success) {
				// Invalidate cache
				await this.invalidateChannelCache(uuidLower);

				// Log hard deletion event
				await this.logChannelEvent(
					uuidLower,
					"channel_hard_deleted",
					deletedBy,
					{
						channel_name: existingChannel.name,
					},
				);

				return true;
			}

			return false;
		} catch (error) {
			console.error("Error hard deleting channel:", error);

			return false;
		}
	}

	/**
	 * Get channel statistics for admin dashboard
	 * @param uuid Channel UUID
	 * @returns Channel statistics
	 */
	async getChannelStats(uuid: string): Promise<ChannelStats | null> {
		try {
			const uuidLower = uuid.toLowerCase();
			const result = await this.db
				.prepare(
					`
				   SELECT 
					   c.uuid,
					   COUNT(DISTINCT cp.user_id) as current_participants,
					   COUNT(DISTINCT CASE WHEN DATE(cm.timestamp) = DATE('now') THEN cm.user_id END) as total_participants_today,
					   COUNT(CASE WHEN cm.message_type = 'audio_start' AND DATE(cm.timestamp) = DATE('now') THEN 1 END) as total_transmissions_today,
					   AVG(th.duration_seconds) as avg_transmission_duration,
					   MAX(cm.timestamp) as last_activity,
					   AVG(CASE 
						   WHEN cp.connection_quality = 'excellent' THEN 4
						   WHEN cp.connection_quality = 'good' THEN 3
						   WHEN cp.connection_quality = 'fair' THEN 2
						   WHEN cp.connection_quality = 'poor' THEN 1
						   ELSE 3
					   END) as avg_quality_score
				   FROM channels c
				   LEFT JOIN channel_participants cp ON c.uuid = cp.channel_uuid AND cp.last_seen > datetime('now', '-5 minutes')
				   LEFT JOIN channel_messages cm ON c.uuid = cm.channel_uuid
				   LEFT JOIN transmission_history th ON c.uuid = th.channel_uuid AND DATE(th.start_time) = DATE('now')
				   WHERE c.uuid = ?
				   GROUP BY c.uuid
			   `,
				)
				.bind(uuidLower)
				.first();

			if (result) {
				const qualityMap = ["poor", "poor", "fair", "good", "excellent"];
				const avgQualityScore = Number(result.avg_quality_score) || 3;
				const avgQualityIndex = Math.round(avgQualityScore - 1);

				return {
					uuid: String(result.uuid),
					current_participants: Number(result.current_participants) || 0,
					total_participants_today:
						Number(result.total_participants_today) || 0,
					total_transmissions_today:
						Number(result.total_transmissions_today) || 0,
					avg_transmission_duration:
						Number(result.avg_transmission_duration) || 0,
					last_activity: result.last_activity
						? String(result.last_activity)
						: null,
					avg_connection_quality:
						(qualityMap[avgQualityIndex] as any) || "good",
				};
			}

			return null;
		} catch (error) {
			console.error("Error getting channel stats:", error);

			return null;
		}
	}

	/**
	 * Validate geographic coordinates
	 */
	private isValidCoordinates(lat: number, lon: number): boolean {
		return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
	}

	/**
	 * Validate VHF frequency format (e.g., "144.150", "143.9875")
	 */
	private isValidVHFFrequency(frequency: string): boolean {
		const vhfPattern = /^1[4-7]\d\.\d{3,4}$/;

		return vhfPattern.test(frequency);
	}

	/**
	 * Map database row to PTTChannel object
	 */
	private mapRowToChannel(row: any): PTTChannel {
		return {
			uuid: row.uuid,
			name: row.name,
			type: row.type,
			description: row.description,
			coordinates:
				row.coordinates_lat && row.coordinates_lon
					? {
							lat: row.coordinates_lat,
							lon: row.coordinates_lon,
						}
					: undefined,
			radius_km: row.radius_km,
			vhf_frequency: row.vhf_frequency,
			max_participants: row.max_participants,
			difficulty: row.difficulty,
			is_active: Boolean(row.is_active),
			created_at: row.created_at,
			created_by: row.created_by,
			updated_at: row.updated_at,
			updated_by: row.updated_by,
		};
	}

	/**
	 * Add a user as participant to a channel
	 * @param channelUuid Channel UUID
	 * @param userId User ID joining the channel
	 * @param userLocation Optional user location
	 * @param ephemeralPushToken Optional ephemeral APNs PTT token
	 * @returns Success status and participant info
	 */
	async joinChannel(
		channelUuid: string,
		userId: string,
		userLocation?: Coordinates,
		ephemeralPushToken?: string,
	): Promise<{
		success: boolean;
		participant?: ChannelParticipant;
		error?: string;
	}> {
		try {
			const uuidLower = channelUuid.toLowerCase();

			// Check if channel exists and is active
			const channel = await this.getChannel(uuidLower);

			if (!channel) {
				return { success: false, error: "Channel not found" };
			}

			if (!channel.is_active) {
				return { success: false, error: "Channel is not active" };
			}

			// Check current participant count
			const currentParticipants = await this.db
				.prepare(
					`
				   SELECT COUNT(*) as count 
				   FROM channel_participants 
				   WHERE channel_uuid = ?
			   `,
				)
				.bind(uuidLower)
				.first<{ count: number }>();

			if (
				currentParticipants &&
				currentParticipants.count >= channel.max_participants
			) {
				return { success: false, error: "Channel is full" };
			}

			// Check if user is already a participant
			const existingParticipant = (await this.db
				.prepare(
					`
				   SELECT * FROM channel_participants 
				   WHERE channel_uuid = ? AND user_id = ?
			   `,
				)
				.bind(uuidLower, userId)
				.first()) as any;

			if (existingParticipant) {
				// User is already in the channel, update last seen, location and token
				await this.db
					.prepare(
						`
					UPDATE channel_participants 
					SET last_seen = ?, location_lat = ?, location_lon = ?, ephemeral_push_token = ?
					WHERE channel_uuid = ? AND user_id = ?
				`,
					)
					.bind(
						this.getCurrentTimestamp(),
						userLocation?.lat || null,
						userLocation?.lon || null,
						ephemeralPushToken || null,
						uuidLower,
						userId,
					)
					.run();

				const participant: ChannelParticipant = {
					user_id: userId,
					username: existingParticipant.username || userId,
					join_time: existingParticipant.join_time,
					last_seen: this.getCurrentTimestamp(),
					location: userLocation,
					connection_quality: "good",
					is_transmitting: false,
					ephemeral_push_token: ephemeralPushToken,
				};

				return { success: true, participant };
			}

			// Add user as new participant
			const joinTime = this.getCurrentTimestamp();
			const insertResult = await this.db
				.prepare(
					`
				INSERT INTO channel_participants (
					channel_uuid, user_id, username, join_time, last_seen, 
					location_lat, location_lon, connection_quality, ephemeral_push_token
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			`,
				)
				.bind(
					uuidLower,
					userId,
					userId, // Using userId as username for now
					joinTime,
					joinTime,
					userLocation?.lat || null,
					userLocation?.lon || null,
					"good",
					ephemeralPushToken || null,
				)
				.run(); // Log join event

			await this.logChannelEvent(uuidLower, "user_joined", userId, {
				location: userLocation,
				has_push_token: !!ephemeralPushToken,
			});

			const participant: ChannelParticipant = {
				user_id: userId,
				username: userId,
				join_time: joinTime,
				last_seen: joinTime,
				location: userLocation,
				connection_quality: "good",
				is_transmitting: false,
				ephemeral_push_token: ephemeralPushToken,
			};

			// Invalidate cache
			await this.invalidateChannelCache(uuidLower);

			return { success: true, participant };
		} catch (error) {
			console.error("Error joining channel:", error);

			return { success: false, error: "Failed to join channel" };
		}
	}

	/**
	 * Remove a user from channel participants
	 * @param channelUuid Channel UUID
	 * @param userId User ID leaving the channel
	 * @returns Success status
	 */
	async leaveChannel(
		channelUuid: string,
		userId: string,
	): Promise<{ success: boolean; error?: string }> {
		try {
			const uuidLower = channelUuid.toLowerCase();
			// Check if user is a participant
			const participant = (await this.db
				.prepare(
					`
			   SELECT * FROM channel_participants 
			   WHERE channel_uuid = ? AND user_id = ?
		   `,
				)
				.bind(uuidLower, userId)
				.first()) as any;

			if (!participant) {
				return {
					success: false,
					error: "User is not a participant in this channel",
				};
			}

			// Remove participant from channel
			await this.db
				.prepare(
					`
			   DELETE FROM channel_participants 
			   WHERE channel_uuid = ? AND user_id = ?
		   `,
				)
				.bind(uuidLower, userId)
				.run(); // Log leave event
			await this.logChannelEvent(uuidLower, "user_left", userId);

			// Invalidate cache
			await this.invalidateChannelCache(uuidLower);

			return { success: true };
		} catch (error) {
			console.error("Error leaving channel:", error);

			return { success: false, error: "Failed to leave channel" };
		}
	}

	/**
	 * Get current participants of a channel
	 * @param channelUuid Channel UUID
	 * @returns List of active participants
	 */
	async getChannelParticipants(
		channelUuid: string,
	): Promise<ChannelParticipant[]> {
		try {
			const uuidLower = channelUuid.toLowerCase();
			const results = await this.db
				.prepare(
					`
			   SELECT 
				   user_id, username, join_time, last_seen,
				   location_lat, location_lon, connection_quality, is_transmitting, ephemeral_push_token
			   FROM channel_participants 
			   WHERE channel_uuid = ?
			   ORDER BY join_time ASC
		   `,
				)
				.bind(uuidLower)
				.all();

			return results.results.map((row: any) => ({
				user_id: row.user_id as string,
				username: row.username as string,
				join_time: row.join_time as string,
				last_seen: row.last_seen as string,
				location:
					row.location_lat && row.location_lon
						? {
								lat: row.location_lat as number,
								lon: row.location_lon as number,
							}
						: undefined,
				connection_quality: (row.connection_quality as any) || "good",
				is_transmitting: Boolean(row.is_transmitting),
				ephemeral_push_token: row.ephemeral_push_token as string | undefined,
			}));
		} catch (error) {
			console.error("Error getting channel participants:", error);

			return [];
		}
	}

	/**
	 * Update ephemeral push token for a channel participant
	 * @param channelUuid Channel UUID
	 * @param userId User ID
	 * @param ephemeralPushToken New ephemeral APNs PTT token
	 * @returns Success status
	 */
	async updateParticipantPushToken(
		channelUuid: string,
		userId: string,
		ephemeralPushToken: string,
	): Promise<{ success: boolean; error?: string }> {
		try {
			const uuidLower = channelUuid.toLowerCase();

			// Check if user is a participant
			const participant = (await this.db
				.prepare(
					`
				   SELECT * FROM channel_participants 
				   WHERE channel_uuid = ? AND user_id = ?
			   `,
				)
				.bind(uuidLower, userId)
				.first()) as any;

			if (!participant) {
				return {
					success: false,
					error: "User is not a participant in this channel",
				};
			}

			// Update push token
			await this.db
				.prepare(
					`
				   UPDATE channel_participants 
				   SET ephemeral_push_token = ?, last_seen = ?
				   WHERE channel_uuid = ? AND user_id = ?
			   `,
				)
				.bind(ephemeralPushToken, this.getCurrentTimestamp(), uuidLower, userId)
				.run();

			return { success: true };
		} catch (error) {
			console.error("Error updating participant push token:", error);

			return { success: false, error: "Failed to update push token" };
		}
	}

	/**
	 * Update participant location
	 * @param channelUuid Channel UUID
	 * @param userId User ID
	 * @param location User location coordinates
	 * @returns Success status
	 */
	async updateParticipantLocation(
		channelUuid: string,
		userId: string,
		location: Coordinates,
	): Promise<{ success: boolean; error?: string }> {
		try {
			const uuidLower = channelUuid.toLowerCase();

			// Check if user is a participant
			const participant = (await this.db
				.prepare(
					`
				   SELECT * FROM channel_participants 
				   WHERE channel_uuid = ? AND user_id = ?
			   `,
				)
				.bind(uuidLower, userId)
				.first()) as any;

			if (!participant) {
				return {
					success: false,
					error: "User is not a participant in this channel",
				};
			}

			// Update location and last seen
			await this.db
				.prepare(
					`
				   UPDATE channel_participants 
				   SET location_lat = ?, location_lon = ?, last_seen = ?
				   WHERE channel_uuid = ? AND user_id = ?
			   `,
				)
				.bind(location.lat, location.lon, this.getCurrentTimestamp(), uuidLower, userId)
				.run();

			return { success: true };
		} catch (error) {
			console.error("Error updating participant location:", error);

			return { success: false, error: "Failed to update participant location" };
		}
	}

	/**
	 * Log channel-related events for audit trail
	 * Uses 'text' message type for system events to comply with DB constraints
	 */
	private async logChannelEvent(
		channelUuid: string,
		eventType: string,
		userId: string,
		metadata: any = {},
	): Promise<void> {
		try {
			// Map event types to message types that match the DB constraint
			const eventTypeToMessageType: { [key: string]: string } = {
				user_joined: "join",
				user_left: "leave",
				channel_created: "text",
				channel_updated: "text",
				channel_deleted: "text",
				channel_hard_deleted: "text",
			};

			const messageType = eventTypeToMessageType[eventType] || "text";

			// For hard delete events, skip logging since the channel will be deleted
			if (eventType === "channel_hard_deleted") {
				return;
			}

			await this.db
				.prepare(
					`
				INSERT INTO channel_messages (channel_uuid, user_id, username, message_type, content, metadata)
				VALUES (?, ?, ?, ?, ?, ?)
			`,
				)
				.bind(
					channelUuid,
					userId,
					"system", // System user for channel events
					messageType,
					`Channel event: ${eventType}`, // The actual event type is in the content
					JSON.stringify({
						event_type: eventType, // Store the real event type in metadata
						...metadata,
					}),
				)
				.run();
		} catch (error) {
			console.error("Error logging channel event:", error);
		}
	}
}
