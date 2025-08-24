import CoreLocation
import Foundation
import Network
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

// Main network service for communications with the ParaWave PTT API
class ParapenteNetworkService: NSObject, ObservableObject {

    // MARK: - Properties

    private let baseURL: String
    private let session: URLSession
    private let keychainManager: Auth0KeychainManager
    private let networkMonitor: NWPathMonitor
    private let monitorQueue = DispatchQueue(label: "NetworkMonitor")

    @Published var isConnected = false
    @Published var connectionType: NWInterface.InterfaceType = .other
    @Published var networkQuality: NetworkQuality = .unknown

    // MARK: - Initialization

    init(baseURL: String = NetworkConfiguration.baseURL) {
        self.baseURL = baseURL
        self.keychainManager = Auth0KeychainManager()

        // URLSession configuration
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = NetworkConfiguration.timeout
        config.timeoutIntervalForResource = NetworkConfiguration.timeout * 2
        config.waitsForConnectivity = true

        self.session = URLSession(configuration: config)
        self.networkMonitor = NWPathMonitor()

        super.init()

        setupNetworkMonitoring()
    }

    deinit {
        networkMonitor.cancel()
    }

    // MARK: - Network Monitoring

    private func setupNetworkMonitoring() {
        networkMonitor.pathUpdateHandler = { [weak self] path in
            DispatchQueue.main.async {
                self?.isConnected = path.status == .satisfied

                if path.usesInterfaceType(.cellular) {
                    self?.connectionType = .cellular
                } else if path.usesInterfaceType(.wifi) {
                    self?.connectionType = .wifi
                } else {
                    self?.connectionType = .other
                }

                self?.networkQuality = self?.evaluateNetworkQuality(path: path) ?? .unknown
            }
        }

        networkMonitor.start(queue: monitorQueue)
    }

    private func evaluateNetworkQuality(path: NWPath) -> NetworkQuality {
        if path.isExpensive {
            return .poor
        } else if path.usesInterfaceType(.wifi) {
            return .excellent
        } else if path.usesInterfaceType(.cellular) {
            return .good
        } else {
            return .unknown
        }
    }

    // MARK: - Authentication

    /// Validate an Auth0 token with the backend
    func validateAuth0Token(_ token: String) async throws -> Auth0ValidationResponse {
        let endpoint = "/v1/auth0-management/validate"
        let request = try createAuthenticatedRequest(endpoint: endpoint, method: "POST")

        let response: Auth0ValidationResponse = try await performRequest(request)
        return response
    }

    // MARK: - Health Check

    /// Check service health
    func checkHealth() async throws -> HealthResponse {
        let endpoint = "/v1/health"
        let request = try createRequest(endpoint: endpoint, method: "GET")

        let response: HealthResponse = try await performRequest(request)
        return response
    }

    // MARK: - Channel Operations

    /// Retrieve the list of channels
    func getChannels(
        type: ChannelType? = nil,
        active: Bool = true,
        location: CLLocation? = nil,
        radius: Double = 50.0
    ) async throws -> [PTTChannel] {

        var endpoint = "/v1/channels?active=\(active)"

        if let type = type {
            endpoint += "&type=\(type.rawValue)"
        }

        if let location = location {
            endpoint +=
                "&lat=\(location.coordinate.latitude)&lon=\(location.coordinate.longitude)&radius=\(radius)"
        }

        let request = try createAuthenticatedRequest(endpoint: endpoint, method: "GET")

        let response: APIResponse<[PTTChannel]> = try await performRequest(request)

        guard let channels = response.data else {
            throw ParapenteError.networkError(NSError(domain: "NoData", code: 0, userInfo: nil))
        }

        return channels
    }

    /// Retrieve channel details
    func getChannelDetails(_ uuid: String) async throws -> PTTChannel {
        let endpoint = "/v1/channels/\(uuid.lowercased())"
        let request = try createAuthenticatedRequest(endpoint: endpoint, method: "GET")

        let response: APIResponse<PTTChannel> = try await performRequest(request)

        guard let channel = response.data else {
            throw ParapenteError.channelNotFound
        }

        return channel
    }

    /// Create a new channel
    func createChannel(_ channelRequest: CreateChannelRequest) async throws -> PTTChannel {
        let endpoint = "/v1/channels"

        var request = try createAuthenticatedRequest(endpoint: endpoint, method: "POST")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder.parawaveEncoder.encode(channelRequest)

        let response: APIResponse<PTTChannel> = try await performRequest(request)

        guard let channel = response.data else {
            throw ParapenteError.networkError(
                NSError(domain: "CreateChannelFailed", code: 0, userInfo: nil))
        }

        return channel
    }

    /// Update an existing channel
    func updateChannel(_ uuid: String, request: UpdateChannelRequest) async throws -> PTTChannel {
        let endpoint = "/v1/channels/\(uuid.lowercased())"

        var urlRequest = try createAuthenticatedRequest(endpoint: endpoint, method: "PUT")
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        urlRequest.httpBody = try JSONEncoder.parawaveEncoder.encode(request)

        let response: APIResponse<PTTChannel> = try await performRequest(urlRequest)

        guard let channel = response.data else {
            throw ParapenteError.networkError(
                NSError(domain: "UpdateChannelFailed", code: 0, userInfo: nil))
        }

        return channel
    }

    /// Delete a channel
    func deleteChannel(_ uuid: String, hard: Bool = false) async throws -> Bool {
        let endpoint = "/v1/channels/\(uuid.lowercased())?hard=\(hard)"
        let request = try createAuthenticatedRequest(endpoint: endpoint, method: "DELETE")

        let response: APIResponse<Bool> = try await performRequest(request)
        return response.success
    }

    // MARK: - Channel Participation

    /// Join a channel
    func joinChannel(
        _ uuid: String,
        location: CLLocation? = nil,
        ephemeralPushToken: String? = nil
    ) async throws -> JoinChannelResponse {

        let endpoint = "/v1/channels/\(uuid.lowercased())/join"

        let joinRequest = JoinChannelRequest(
            location: location?.coordinate.toCoordinates(),
            ephemeralPushToken: ephemeralPushToken,
            deviceInfo: DeviceInfo.current
        )

        var request = try createAuthenticatedRequest(endpoint: endpoint, method: "POST")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder.parawaveEncoder.encode(joinRequest)

        let response: JoinChannelResponse = try await performRequest(request)
        return response
    }

    /// Leave a channel
    func leaveChannel(_ uuid: String) async throws -> LeaveChannelResponse {
        let endpoint = "/v1/channels/\(uuid.lowercased())/leave"
        let request = try createAuthenticatedRequest(endpoint: endpoint, method: "POST")

        let response: LeaveChannelResponse = try await performRequest(request)
        return response
    }

    /// Retrieve participants of a channel
    func getChannelParticipants(_ uuid: String) async throws -> [ChannelParticipant] {
        let endpoint = "/v1/channels/\(uuid.lowercased())/participants"
        let request = try createAuthenticatedRequest(endpoint: endpoint, method: "GET")

        let response: APIResponse<[ChannelParticipant]> = try await performRequest(request)

        guard let participants = response.data else {
            throw ParapenteError.networkError(
                NSError(domain: "NoParticipants", code: 0, userInfo: nil))
        }

        return participants
    }

    /// Update ephemeral push token
    func updateEphemeralPushToken(_ uuid: String, token: String) async throws -> Bool {
        let endpoint = "/v1/channels/\(uuid.lowercased())/update-token"

        let updateRequest = ["ephemeral_push_token": token]

        var request = try createAuthenticatedRequest(endpoint: endpoint, method: "PUT")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: updateRequest)

        let response: APIResponse<Bool> = try await performRequest(request)
        return response.success
    }

    // MARK: - PTT Transmissions

    /// Start a PTT transmission
    func startTransmission(
        channelUuid: String,
        expectedDuration: Int? = nil,
        location: CLLocation? = nil
    ) async throws -> PTTStartTransmissionResponse {

        let endpoint = "/v1/transmissions/start"

        let transmissionRequest = PTTStartTransmissionRequest(
            channelUuid: channelUuid.lowercased(),
            audioFormat: .aacLc,
            deviceInfo: DeviceInfo.current,
            expectedDuration: expectedDuration,
            location: location?.coordinate.toCoordinates()
        )

        var request = try createAuthenticatedRequest(endpoint: endpoint, method: "POST")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder.parawaveEncoder.encode(transmissionRequest)

        let response: PTTStartTransmissionResponse = try await performRequest(request)
        return response
    }

    /// Send an audio chunk
    func sendAudioChunk(
        sessionId: String,
        audioData: Data,
        sequenceNumber: Int
    ) async throws -> PTTAudioChunkResponse {

        let endpoint = "/v1/transmissions/\(sessionId)/chunk"

        let chunkRequest = PTTAudioChunkRequest(
            audioData: audioData.base64EncodedString(),
            sequenceNumber: sequenceNumber,
            timestamp: Int(Date().timeIntervalSince1970 * 1000),
            durationMs: nil
        )

        var request = try createAuthenticatedRequest(endpoint: endpoint, method: "POST")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder.parawaveEncoder.encode(chunkRequest)

        let response: PTTAudioChunkResponse = try await performRequest(request)
        return response
    }

    /// End a PTT transmission
    func endTransmission(sessionId: String, reason: String = "completed") async throws
        -> PTTEndTransmissionResponse
    {
        let endpoint = "/v1/transmissions/\(sessionId)/end"

        let endRequest = PTTEndTransmissionRequest(reason: reason)

        var request = try createAuthenticatedRequest(endpoint: endpoint, method: "POST")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder.parawaveEncoder.encode(endRequest)

        let response: PTTEndTransmissionResponse = try await performRequest(request)
        return response
    }

    /// Retrieve active transmission for a channel
    func getActiveTransmission(channelUuid: String) async throws -> PTTActiveTransmissionResponse {
        let endpoint = "/v1/transmissions/active/\(channelUuid.lowercased())"
        let request = try createAuthenticatedRequest(endpoint: endpoint, method: "GET")

        let response: PTTActiveTransmissionResponse = try await performRequest(request)
        return response
    }

    // MARK: - Helper Methods

    private func createRequest(endpoint: String, method: String) throws -> URLRequest {
        guard let url = URL(string: baseURL + endpoint) else {
            throw ParapenteError.networkError(NSError(domain: "InvalidURL", code: 0, userInfo: nil))
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("ParaWave PTT iOS/1.0", forHTTPHeaderField: "User-Agent")

        return request
    }

    private func createAuthenticatedRequest(endpoint: String, method: String) throws -> URLRequest {
        var request = try createRequest(endpoint: endpoint, method: method)

        // Retrieve the authentication token
        guard let token = try keychainManager.getValidAccessToken() else {
            // No valid token - clear any expired tokens from keychain
            try? keychainManager.clearExpiredTokens()
            throw ParapenteError.tokenExpired
        }

        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        return request
    }

    private func performRequest<T: Codable>(_ request: URLRequest) async throws -> T {
        do {
            let (data, response) = try await session.data(for: request)

            guard let httpResponse = response as? HTTPURLResponse else {
                throw ParapenteError.networkError(
                    NSError(domain: "InvalidResponse", code: 0, userInfo: nil))
            }

            // Check HTTP status code
            switch httpResponse.statusCode {
            case 200...299:
                // Success
                break
            case 401:
                // Token expired or invalid - clear it from keychain
                try? keychainManager.clearExpiredTokens()
                throw ParapenteError.tokenExpired
            case 403:
                throw ParapenteError.insufficientPermissions
            case 404:
                throw ParapenteError.channelNotFound
            default:
                // Try to decode an API error response
                if let errorResponse = try? JSONDecoder.parawaveDecoder.decode(
                    ErrorResponse.self, from: data)
                {
                    throw ParapenteError.networkError(
                        NSError(
                            domain: "APIError", code: httpResponse.statusCode,
                            userInfo: [NSLocalizedDescriptionKey: errorResponse.error]))
                } else {
                    throw ParapenteError.networkError(
                        NSError(domain: "HTTPError", code: httpResponse.statusCode, userInfo: nil))
                }
            }

            // Decode the response
            let decodedResponse = try JSONDecoder.parawaveDecoder.decode(T.self, from: data)
            return decodedResponse

        } catch let error as ParapenteError {
            throw error
        } catch {
            throw ParapenteError.networkError(error)
        }
    }
}

// MARK: - Network Quality

enum NetworkQuality {
    case unknown
    case poor
    case good
    case excellent

    var displayName: String {
        switch self {
        case .unknown: return "Unknown"
        case .poor: return "Poor"
        case .good: return "Good"
        case .excellent: return "Excellent"
        }
    }

    var color: UIColor {
        switch self {
        case .unknown: return .systemGray
        case .poor: return .systemRed
        case .good: return .systemOrange
        case .excellent: return .systemGreen
        }
    }
}

// MARK: - Extensions

extension CLLocationCoordinate2D {
    func toCoordinates() -> Coordinates {
        return Coordinates(lat: latitude, lon: longitude)
    }
}

extension ParapenteNetworkService {

    /// Measure network latency
    func measureNetworkLatency() async -> TimeInterval? {
        let startTime = Date()

        do {
            _ = try await checkHealth()
            let endTime = Date()
            return endTime.timeIntervalSince(startTime)
        } catch {
            return nil
        }
    }

    /// Retrieve full network information
    func getNetworkInfo() -> NetworkInfo {
        return NetworkInfo(
            isConnected: isConnected,
            connectionType: connectionType,
            quality: networkQuality
        )
    }
}

// MARK: - Network Info Model

struct NetworkInfo {
    let isConnected: Bool
    let connectionType: NWInterface.InterfaceType
    let quality: NetworkQuality

    var displayString: String {
        if !isConnected {
            return "Hors ligne"
        }

        let typeString =
            connectionType == .cellular ? "Cellulaire" : connectionType == .wifi ? "WiFi" : "Autre"
        return "\(typeString) - \(quality.displayName)"
    }

    var canTransmitAudio: Bool {
        return isConnected && quality != .poor
    }
}

// MARK: - Retry Logic Extension

extension ParapenteNetworkService {

    /// Exécute une requête avec logique de retry
    func performRequestWithRetry<T: Codable>(
        request: URLRequest,
        retries: Int = NetworkConfiguration.maxRetries
    ) async throws -> T {

        var lastError: Error?

        for attempt in 0..<retries {
            do {
                return try await performRequest(request)
            } catch let error as ParapenteError {
                lastError = error

                // Ne pas retry certaines erreurs
                switch error {
                case .tokenExpired, .insufficientPermissions, .channelNotFound:
                    throw error
                default:
                    break
                }

                // Attendre avant le prochain essai
                if attempt < retries - 1 {
                    try await Task.sleep(
                        nanoseconds: UInt64(pow(2.0, Double(attempt))) * 1_000_000_000)
                }
            } catch {
                lastError = error

                if attempt < retries - 1 {
                    try await Task.sleep(
                        nanoseconds: UInt64(pow(2.0, Double(attempt))) * 1_000_000_000)
                }
            }
        }

        throw lastError ?? ParapenteError.unknown("Retry failed")
    }
}

#if DEBUG
    extension ParapenteNetworkService {

        /// Méthodes de debug pour le développement
        func debugNetworkState() {
            print("=== Network Debug Info ===")
            print("Connected: \(isConnected)")
            print("Connection Type: \(connectionType)")
            print("Quality: \(networkQuality.displayName)")
            print("=========================")
        }
    }
#endif
