import CoreLocation
import Foundation
import UIKit

/*
 Copyright (C) 2025 Ronan Le Meillat
 SPDX-License-Identifier: AGPL-3.0-or-later

 This file is part of ParaWave PTT.
 ParaWave PTT is free software: you can redistribute it and/or modify
 it under the terms of the GNU Affero General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.

 ParaWave PTT is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 GNU Affero General Public License for more details.

 You should have received a copy of the GNU Affero General Public License
 along with this program. If not, see <https://www.gnu.org/licenses/agpl-3.0.en.html>.
*/

// API and domain models for ParaWave PTT

// MARK: - API Response Models

struct APIResponse<T: Codable>: Codable {
    let success: Bool
    let data: T?
    let error: String?
    let timestamp: Date?
    let version: String?
}

struct ErrorResponse: Codable {
    let success: Bool
    let error: String
    let timestamp: Date?
    let version: String?
}

struct ChannelsData: Codable {
    let channels: [PTTChannel]
    let totalCount: Int
    let activeCount: Int

    enum CodingKeys: String, CodingKey {
        case channels
        case totalCount = "total_count"
        case activeCount = "active_count"
    }
}

// MARK: - Channel Models

struct PTTChannel: Codable, Identifiable, Equatable {
    let uuid: String
    let name: String
    let description: String?
    let type: ChannelType
    let coordinates: Coordinates?
    let radiusKm: Double?
    let vhfFrequency: String?
    let isActive: Bool
    let createdAt: Date
    let updatedAt: Date?
    let createdBy: String?
    let updatedBy: String?
    let maxParticipants: Int
    let difficulty: ChannelDifficulty?
    let currentParticipants: Int?
    let totalParticipantsToday: Int?
    let totalTransmissionsToday: Int?
    let avgTransmissionDuration: Double?
    let lastActivity: Date?
    let avgConnectionQuality: String?

    var id: String { uuid }

    // For backward compatibility
    var location: Coordinates? { coordinates }
    var flyingSiteId: Int? { nil }
    var frequency: Double? {
        // Try to parse vhfFrequency as Double if it exists
        if let vhfFrequency = vhfFrequency {
            return Double(vhfFrequency)
        }
        return nil
    }
    var creatorUserId: String { createdBy ?? "unknown" }
    var stats: ChannelStats? {
        guard let currentParticipants = currentParticipants,
            let totalParticipantsToday = totalParticipantsToday,
            let totalTransmissionsToday = totalTransmissionsToday
        else {
            return nil
        }

        return ChannelStats(
            totalParticipants: totalParticipantsToday,
            activeParticipants: currentParticipants,
            totalMessages: 0,  // Not provided in API
            totalTransmissions: totalTransmissionsToday,
            lastActivity: lastActivity
        )
    }

    enum CodingKeys: String, CodingKey {
        case uuid, name, description, type
        case coordinates
        case radiusKm = "radius_km"
        case vhfFrequency = "vhf_frequency"
        case isActive = "is_active"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case createdBy = "created_by"
        case updatedBy = "updated_by"
        case maxParticipants = "max_participants"
        case difficulty
        case currentParticipants = "current_participants"
        case totalParticipantsToday = "total_participants_today"
        case totalTransmissionsToday = "total_transmissions_today"
        case avgTransmissionDuration = "avg_transmission_duration"
        case lastActivity = "last_activity"
        case avgConnectionQuality = "avg_connection_quality"
    }

    static func == (lhs: PTTChannel, rhs: PTTChannel) -> Bool {
        return lhs.uuid == rhs.uuid
    }
}

enum ChannelType: String, Codable, CaseIterable {
    case general = "general"
    case siteLocal = "site_local"
    case emergency = "emergency"
    case crossCountry = "cross_country"
    case training = "training"
    case competition = "competition"
    case instructors = "instructors"

    var displayName: String {
        switch self {
        case .general: return "General"
        case .siteLocal: return "Local Site"
        case .emergency: return "Emergency"
        case .crossCountry: return "Cross Country"
        case .training: return "Training"
        case .competition: return "Competition"
        case .instructors: return "Instructors"
        }
    }
}

enum ChannelDifficulty: String, Codable, CaseIterable {
    case beginner = "beginner"
    case intermediate = "intermediate"
    case advanced = "advanced"
    case expert = "expert"

    var displayName: String {
        switch self {
        case .beginner: return "Beginner"
        case .intermediate: return "Intermediate"
        case .advanced: return "Advanced"
        case .expert: return "Expert"
        }
    }
}

struct ChannelStats: Codable {
    let totalParticipants: Int
    let activeParticipants: Int
    let totalMessages: Int
    let totalTransmissions: Int
    let lastActivity: Date?

    enum CodingKeys: String, CodingKey {
        case totalParticipants = "total_participants"
        case activeParticipants = "active_participants"
        case totalMessages = "total_messages"
        case totalTransmissions = "total_transmissions"
        case lastActivity = "last_activity"
    }
}

struct Coordinates: Codable {
    let lat: Double
    let lon: Double

    var clLocation: CLLocation {
        return CLLocation(latitude: lat, longitude: lon)
    }
}

// MARK: - Channel Operations

struct CreateChannelRequest: Codable {
    let name: String
    let description: String?
    let type: ChannelType
    let frequency: Double?
    let flyingSiteId: Int?
    let maxParticipants: Int?
    let difficulty: ChannelDifficulty?
    let location: Coordinates?

    enum CodingKeys: String, CodingKey {
        case name, description, type, frequency
        case flyingSiteId = "flying_site_id"
        case maxParticipants = "max_participants"
        case difficulty, location
    }
}

struct UpdateChannelRequest: Codable {
    let name: String?
    let description: String?
    let type: ChannelType?
    let frequency: Double?
    let flyingSiteId: Int?
    let maxParticipants: Int?
    let difficulty: ChannelDifficulty?
    let location: Coordinates?
    let isActive: Bool?

    enum CodingKeys: String, CodingKey {
        case name, description, type, frequency
        case flyingSiteId = "flying_site_id"
        case maxParticipants = "max_participants"
        case difficulty, location
        case isActive = "is_active"
    }
}

// MARK: - Participant Models

struct ChannelParticipant: Codable, Identifiable {
    let userId: String
    let username: String
    let joinTime: Date
    let lastSeen: Date
    let location: Coordinates?
    let connectionQuality: String
    let isTransmitting: Bool
    let ephemeralPushToken: String?
    let osType: String?
    let osVersion: String?
    let appVersion: String?

    var id: String { userId }

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case username
        case joinTime = "join_time"
        case lastSeen = "last_seen"
        case location
        case connectionQuality = "connection_quality"
        case isTransmitting = "is_transmitting"
        case ephemeralPushToken = "ephemeral_push_token"
        case osType = "os_type"
        case osVersion = "os_version"
        case appVersion = "app_version"
    }
}

struct JoinChannelRequest: Codable {
    let location: Coordinates?
    let ephemeralPushToken: String?
    let deviceInfo: DeviceInfo?

    enum CodingKeys: String, CodingKey {
        case location
        case ephemeralPushToken = "ephemeral_push_token"
        case deviceInfo = "device_info"
    }
}

struct JoinChannelResponse: Codable {
    let success: Bool
    let participant: ChannelParticipant?
    let channelInfo: PTTChannel?
    let error: String?

    enum CodingKeys: String, CodingKey {
        case success, participant, error
        case channelInfo = "channel_info"
    }
}

struct LeaveChannelResponse: Codable {
    let success: Bool
    let error: String?
}

// MARK: - PTT Audio Models

struct PTTStartTransmissionRequest: Codable {
    let channelUuid: String
    let audioFormat: AudioFormat
    let deviceInfo: DeviceInfo?
    let expectedDuration: Int?
    let location: Coordinates?

    enum CodingKeys: String, CodingKey {
        case channelUuid = "channel_uuid"
        case audioFormat = "audio_format"
        case deviceInfo = "device_info"
        case expectedDuration = "expected_duration"
        case location
    }
}

struct PTTStartTransmissionResponse: Codable {
    let success: Bool
    let sessionId: String?
    let channelUuid: String?
    let maxDuration: Int?
    let websocketUrl: String?
    let error: String?

    enum CodingKeys: String, CodingKey {
        case success
        case sessionId = "session_id"
        case channelUuid = "channel_uuid"
        case maxDuration = "max_duration"
        case websocketUrl = "websocket_url"
        case error
    }
}

struct PTTAudioChunkRequest: Codable {
    let audioData: String
    let sequenceNumber: Int
    let timestamp: Int?
    let durationMs: Int?

    enum CodingKeys: String, CodingKey {
        case audioData = "audio_data"
        case sequenceNumber = "sequence_number"
        case timestamp
        case durationMs = "duration_ms"
    }
}

struct PTTAudioChunkResponse: Codable {
    let success: Bool
    let sequenceNumber: Int?
    let totalChunks: Int?
    let durationSoFar: Double?
    let error: String?

    enum CodingKeys: String, CodingKey {
        case success
        case sequenceNumber = "sequence_number"
        case totalChunks = "total_chunks"
        case durationSoFar = "duration_so_far"
        case error
    }
}

struct PTTEndTransmissionRequest: Codable {
    let reason: String?
}

struct PTTEndTransmissionResponse: Codable {
    let success: Bool
    let totalDuration: Double?
    let totalChunks: Int?
    let participantsReached: Int?
    let error: String?

    enum CodingKeys: String, CodingKey {
        case success
        case totalDuration = "total_duration"
        case totalChunks = "total_chunks"
        case participantsReached = "participants_reached"
        case error
    }
}

struct PTTActiveTransmissionResponse: Codable {
    let success: Bool
    let transmission: ActiveTransmission?
    let error: String?
}

struct ActiveTransmission: Codable {
    let sessionId: String
    let userId: String
    let username: String
    let startTime: Date
    let currentDuration: Double
    let location: Coordinates?

    enum CodingKeys: String, CodingKey {
        case sessionId = "session_id"
        case userId = "user_id"
        case username
        case startTime = "start_time"
        case currentDuration = "current_duration"
        case location
    }
}

// MARK: - Audio Format

enum AudioFormat: String, Codable, CaseIterable {
    case aacLc = "aac-lc"
    case opus = "opus"
    case pcm = "pcm"

    var displayName: String {
        switch self {
        case .aacLc: return "AAC-LC"
        case .opus: return "Opus"
        case .pcm: return "PCM"
        }
    }
}

// MARK: - Device Info

struct DeviceInfo: Codable {
    let os: String?
    let osVersion: String?
    let appVersion: String?
    let deviceModel: String?
    let userAgent: String?

    enum CodingKeys: String, CodingKey {
        case os
        case osVersion = "os_version"
        case appVersion = "app_version"
        case deviceModel = "device_model"
        case userAgent = "user_agent"
    }

    static var current: DeviceInfo {
        return DeviceInfo(
            os: "iOS",
            osVersion: UIDevice.current.systemVersion,
            appVersion: Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString")
                as? String ?? "1.0",
            deviceModel: UIDevice.current.model,
            userAgent:
                "ParaWave PTT iOS/\(Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0")"
        )
    }
}

// MARK: - WebSocket Messages

struct PTTWebSocketMessage: Codable {
    let type: String
    let sessionId: String?
    let userId: String?
    let username: String?
    let timestamp: Date
    let audioData: String?
    let sequenceNumber: Int?
    let totalDuration: Double?
    let reason: String?

    enum CodingKeys: String, CodingKey {
        case type
        case sessionId = "session_id"
        case userId = "user_id"
        case username
        case timestamp
        case audioData = "audio_data"
        case sequenceNumber = "sequence_number"
        case totalDuration = "total_duration"
        case reason
    }
}

// MARK: - Health Check

struct HealthResponse: Codable {
    let success: Bool
    let status: String
    let timestamp: Date
    let version: String
    let database: String?
    let auth0: String?
    let uptime: Int?
}

// MARK: - Auth0 Models

struct Auth0ValidationResponse: Codable {
    let valid: Bool
    let permissions: [String]
    let userId: String?
    let error: String?

    enum CodingKeys: String, CodingKey {
        case valid, permissions, error
        case userId = "user_id"
    }
}

struct Auth0ManagementTokenResponse: Codable {
    let accessToken: String
    let tokenType: String
    let expiresIn: Int

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case tokenType = "token_type"
        case expiresIn = "expires_in"
    }
}

// MARK: - Application State

enum ParapenteAppState: Equatable {
    // Application states with English names for better code consistency
    case launching
    case authentication
    case authenticated(permissions: [String])
    case channelSelection
    case channelJoined(channel: PTTChannel)
    case activeTransmission(sessionId: String)
    case error(ParapenteError)

    static func == (lhs: ParapenteAppState, rhs: ParapenteAppState) -> Bool {
        switch (lhs, rhs) {
        case (.launching, .launching),
            (.authentication, .authentication),
            (.channelSelection, .channelSelection):
            return true
        case (.authenticated(let lhsPermissions), .authenticated(let rhsPermissions)):
            return lhsPermissions == rhsPermissions
        case (.channelJoined(let lhsChannel), .channelJoined(let rhsChannel)):
            return lhsChannel == rhsChannel
        case (.activeTransmission(let lhsSessionId), .activeTransmission(let rhsSessionId)):
            return lhsSessionId == rhsSessionId
        case (.error, .error):
            return true  // Simplified comparison for errors
        default:
            return false
        }
    }
}

// MARK: - Network Configuration

struct NetworkConfiguration {
    private static let config = ConfigurationManager.shared

    static var baseURL: String {
        return config.apiBaseURL
    }

    static var websocketURL: String {
        return config.websocketURL
    }

    static var auth0Domain: String {
        return config.auth0Domain
    }

    static var auth0ClientId: String {
        return config.auth0ClientId
    }

    static var auth0Audience: String {
        return config.auth0Audience
    }

    static var auth0Scope: String {
        return config.auth0Scope
    }

    static var timeout: TimeInterval {
        return config.apiTimeout
    }

    static var maxTransmissionDuration: TimeInterval {
        return config.maxTransmissionDuration
    }

    static let audioChunkSize = 1024

    static var maxRetries: Int {
        return config.maxRetryAttempts
    }

    // MARK: - Environment-aware configuration

    static var isDevelopment: Bool {
        return config.isDevelopment
    }

    static var isDebugEnabled: Bool {
        return config.isDebugEnabled
    }

    static var apiVersion: String {
        return config.apiVersion
    }

    static var bundleIdentifier: String {
        return config.bundleIdentifier
    }
}

// MARK: - Error Types

enum ParapenteError: Error, Equatable, LocalizedError {
    case networkError(Error)
    case authenticationFailed(Error)
    case channelNotFound
    case insufficientPermissions
    case tokenExpired
    case audioError(String)
    case locationError(String)
    case transmissionFailed
    case unknown(String)

    static func == (lhs: ParapenteError, rhs: ParapenteError) -> Bool {
        switch (lhs, rhs) {
        case (.channelNotFound, .channelNotFound),
            (.insufficientPermissions, .insufficientPermissions),
            (.tokenExpired, .tokenExpired),
            (.transmissionFailed, .transmissionFailed):
            return true
        case (.networkError(let lhsError), .networkError(let rhsError)):
            return lhsError.localizedDescription == rhsError.localizedDescription
        case (.authenticationFailed(let lhsError), .authenticationFailed(let rhsError)):
            return lhsError.localizedDescription == rhsError.localizedDescription
        case (.audioError(let lhsStr), .audioError(let rhsStr)),
            (.locationError(let lhsStr), .locationError(let rhsStr)),
            (.unknown(let lhsStr), .unknown(let rhsStr)):
            return lhsStr == rhsStr
        default:
            return false
        }
    }

    var errorDescription: String? {
        switch self {
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .authenticationFailed(let error):
            return "Authentication failed: \(error.localizedDescription)"
        case .channelNotFound:
            return "Channel not found"
        case .insufficientPermissions:
            return "Insufficient permissions"
        case .tokenExpired:
            return "Authentication token expired"
        case .audioError(let message):
            return "Audio error: \(message)"
        case .locationError(let message):
            return "Location error: \(message)"
        case .transmissionFailed:
            return "Transmission failed"
        case .unknown(let message):
            return "Unknown error: \(message)"
        }
    }
}

// MARK: - Extensions

extension Date {
    static let iso8601Formatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    static let sqlDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd HH:mm:ss"
        formatter.timeZone = TimeZone.current
        return formatter
    }()

    static let sqlDateTimeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd HH:mm:ss"
        formatter.timeZone = TimeZone.current
        return formatter
    }()
}

extension JSONDecoder {
    static let parawaveDecoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()

            // Check if the value is null
            if container.decodeNil() {
                throw DecodingError.valueNotFound(
                    Date.self,
                    DecodingError.Context(
                        codingPath: decoder.codingPath,
                        debugDescription: "Expected Date but found null"))
            }

            let string = try container.decode(String.self)

            // Try ISO8601 format first (with T and Z)
            if let date = Date.iso8601Formatter.date(from: string) {
                return date
            }

            // Try SQL datetime format (YYYY-MM-DD HH:mm:ss)
            if let date = Date.sqlDateFormatter.date(from: string) {
                return date
            }

            throw DecodingError.dataCorruptedError(
                in: container, debugDescription: "Invalid date format: \(string)")
        }
        return decoder
    }()
}

extension JSONEncoder {
    static let parawaveEncoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .custom { date, encoder in
            var container = encoder.singleValueContainer()
            let string = Date.iso8601Formatter.string(from: date)
            try container.encode(string)
        }
        return encoder
    }()
}
