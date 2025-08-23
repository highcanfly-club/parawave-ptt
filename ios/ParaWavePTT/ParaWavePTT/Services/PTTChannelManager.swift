import Foundation
import PushToTalk
import AVFoundation
import CoreLocation
import UserNotifications

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

// Main manager for Push-to-Talk operations
class PTTChannelManager: NSObject, ObservableObject {
    
    // MARK: - Properties
    
    private let channelManager = PTChannelManager.shared
    private let networkService: ParapenteNetworkService
    private let locationManager = CLLocationManager()
    private let keychainManager = Auth0KeychainManager()
    
    @Published var currentChannel: PTTChannel?
    @Published var currentChannelDescriptor: PTChannelDescriptor?
    @Published var isJoined = false
    @Published var isTransmitting = false
    @Published var participants: [ChannelParticipant] = []
    @Published var activeTransmission: ActiveTransmission?
    
    // Configuration PTT
    private var ephemeralPushToken: String?
    private var currentSessionId: String?
    
    // MARK: - Initialization
    
    init(networkService: ParapenteNetworkService) {
        self.networkService = networkService
        super.init()
        
        setupPTTFramework()
        setupLocationManager()
        setupNotifications()
    }
    
    // MARK: - Setup Methods
    
    private func setupPTTFramework() {
        channelManager.delegate = self
        
        // Audio configuration specialized for flight
        configureAudioSessionForFlight()
    }
    
    private func setupLocationManager() {
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
        locationManager.requestWhenInUseAuthorization()
    }
    
    private func setupNotifications() {
    // Observer for token renewal
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleTokenExpiration),
            name: .auth0TokenWillExpire,
            object: nil
        )
        
    // Configure push notifications
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
            if granted {
                DispatchQueue.main.async {
                    UIApplication.shared.registerForRemoteNotifications()
                }
            }
        }
    }
    
    private func configureAudioSessionForFlight() {
        let audioSession = AVAudioSession.sharedInstance()
        
        do {
            try audioSession.setCategory(.playAndRecord,
                                       mode: .voiceChat,
                                       options: [.allowBluetooth,
                                                .defaultToSpeaker,
                                                .allowBluetoothA2DP,
                                                .allowAirPlay])
            
            // Special configuration for noisy environment (wind)
            try audioSession.setActive(true)
            
            // Optimization for AAC-LC hardware
            if audioSession.preferredIOBufferDuration != 0.02 {
                try audioSession.setPreferredIOBufferDuration(0.02) // 20ms for low latency
            }
            
        } catch {
            print("Audio configuration error: \(error)")
        }
    }
    
    // MARK: - Channel Operations
    
    /// Join a PTT channel
    @MainActor
    func joinChannel(_ channel: PTTChannel) async throws {
        print("Attempting to join channel: \(channel.name)")
        
    // Check permissions
        guard keychainManager.canAccessChannel(channel.uuid) else {
            throw ParapenteError.insufficientPermissions
        }
        
    // Create the channel descriptor for the PTT framework
        let channelDescriptor = PTChannelDescriptor(
            name: channel.name,
            image: createChannelImage(for: channel)
        )
        
    // Join the channel via API
        let location = locationManager.location
        let joinResponse = try await networkService.joinChannel(
            channel.uuid,
            location: location,
            ephemeralPushToken: ephemeralPushToken
        )
        
        guard joinResponse.success else {
            throw ParapenteError.networkError(NSError(domain: "JoinFailed", code: 0, userInfo: [NSLocalizedDescriptionKey: joinResponse.error ?? "Failed to join channel"]))
        }
        
    // Join via the PTT framework
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            channelManager.requestJoinChannel(channelDescriptor) { error in
                if let error = error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume()
                }
            }
        }
        
    // Update state
        self.currentChannel = channel
        self.currentChannelDescriptor = channelDescriptor
        self.isJoined = true
        
    // Load participants
    await loadParticipants()
        
    print("Channel joined successfully: \(channel.name)")
    }
    
    /// Quitte le canal actuel
    @MainActor
    func leaveCurrentChannel() async throws {
        guard let channel = currentChannel else {
            return
        }
        
    print("Leaving channel: \(channel.name)")
        
        // Quitter via l'API
        let leaveResponse = try await networkService.leaveChannel(channel.uuid)
        
        if !leaveResponse.success {
            print("Warning: Failed to leave channel on server")
        }
        
    // Leave via the PTT framework
        if let channelDescriptor = currentChannelDescriptor {
            try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
                channelManager.leaveChannel(channelDescriptor) { error in
                    if let error = error {
                        continuation.resume(throwing: error)
                    } else {
                        continuation.resume()
                    }
                }
            }
        }
        
    // Reset state
        self.currentChannel = nil
        self.currentChannelDescriptor = nil
        self.isJoined = false
        self.participants = []
        self.activeTransmission = nil
        
    print("Channel left successfully")
    }
    
    // MARK: - Participants Management
    
    @MainActor
    private func loadParticipants() async {
        guard let channel = currentChannel else { return }
        
        do {
            let participants = try await networkService.getChannelParticipants(channel.uuid)
            self.participants = participants
            
            // Vérifier s'il y a une transmission active
            let activeTransmissionResponse = try await networkService.getActiveTransmission(channelUuid: channel.uuid)
            self.activeTransmission = activeTransmissionResponse.transmission
            
        } catch {
            print("Error loading participants: \(error)")
        }
    }
    
    /// Met à jour le token push éphémère
    func updateEphemeralPushToken(_ token: String) async {
        self.ephemeralPushToken = token
        
        guard let channel = currentChannel else { return }
        
        do {
            let success = try await networkService.updateEphemeralPushToken(channel.uuid, token: token)
            if success {
                print("Ephemeral push token updated successfully")
            }
        } catch {
            print("Error updating push token: \(error)")
        }
    }
    
    // MARK: - Transmission Control
    
    /// Start an audio transmission
    @MainActor
    func startTransmission() async throws {
        guard let channel = currentChannel else {
            throw ParapenteError.channelNotFound
        }
        
        guard !isTransmitting else {
            print("Transmission already in progress")
            return
        }
        
    print("Starting transmission on channel: \(channel.name)")
        
    // Start the transmission via the API
        let location = locationManager.location
        let transmissionResponse = try await networkService.startTransmission(
            channelUuid: channel.uuid,
            expectedDuration: Int(NetworkConfiguration.maxTransmissionDuration),
            location: location
        )
        
        guard transmissionResponse.success, let sessionId = transmissionResponse.sessionId else {
            throw ParapenteError.transmissionFailed
        }
        
        self.currentSessionId = sessionId
        self.isTransmitting = true
        
    // Notify participants of the new transmission via the PTT framework
        if let channelDescriptor = currentChannelDescriptor {
            channelManager.setActiveRemoteParticipant(channelDescriptor, completionHandler: { error in
                if let error = error {
                    print("Error notifying PTT: \(error)")
                }
            })
        }
        
        print("Transmission started successfully. Session ID: \(sessionId)")
    }
    
    /// Arrête la transmission actuelle
    @MainActor
    func stopTransmission() async {
        guard isTransmitting, let sessionId = currentSessionId else {
            return
        }
        
    print("Stopping transmission. Session ID: \(sessionId)")
        
        do {
            let endResponse = try await networkService.endTransmission(sessionId: sessionId)
            
            if endResponse.success {
                print("Transmission ended. Duration: \(endResponse.totalDuration ?? 0)s, Participants reached: \(endResponse.participantsReached ?? 0)")
            }
        } catch {
            print("Error stopping transmission: \(error)")
        }
        
    // Stop transmitting on the PTT framework
    channelManager.stopTransmitting()
        
    // Reset state
        self.isTransmitting = false
        self.currentSessionId = nil
        
    // Reload participants to update state
        await loadParticipants()
    }
    
    // MARK: - Audio Data Transmission
    
    /// Send audio data (called by the audio manager)
    func sendAudioData(_ audioData: Data, sequenceNumber: Int) async throws {
        guard let sessionId = currentSessionId else {
            throw ParapenteError.transmissionFailed
        }
        
        do {
            let response = try await networkService.sendAudioChunk(
                sessionId: sessionId,
                audioData: audioData,
                sequenceNumber: sequenceNumber
            )
            
            if !response.success {
                print("Error sending audio chunk: \(response.error ?? "Unknown error")")
            }
        } catch {
            print("Network error while sending audio: \(error)")
            throw error
        }
    }
    
    // MARK: - Helper Methods
    
    private func createChannelImage(for channel: PTTChannel) -> UIImage? {
    // Create an image for the channel based on its type
        let size = CGSize(width: 40, height: 40)
        let renderer = UIGraphicsImageRenderer(size: size)
        
        return renderer.image { context in
            let rect = CGRect(origin: .zero, size: size)
            
            // Background color based on the channel type
            let backgroundColor: UIColor
            switch channel.type {
            case .emergency:
                backgroundColor = .systemRed
            case .siteLocal:
                backgroundColor = .systemBlue
            case .crossCountry:
                backgroundColor = .systemGreen
            case .training:
                backgroundColor = .systemOrange
            case .competition:
                backgroundColor = .systemPurple
            default:
                backgroundColor = .systemGray
            }
            
            backgroundColor.setFill()
            context.fill(rect)
            
            // Add an icon or text
            let attributes: [NSAttributedString.Key: Any] = [
                .foregroundColor: UIColor.white,
                .font: UIFont.boldSystemFont(ofSize: 12)
            ]
            
            let text = String(channel.name.prefix(2).uppercased())
            let textSize = text.size(withAttributes: attributes)
            let textRect = CGRect(
                x: (size.width - textSize.width) / 2,
                y: (size.height - textSize.height) / 2,
                width: textSize.width,
                height: textSize.height
            )
            
            text.draw(in: textRect, withAttributes: attributes)
        }
    }
    
    @objc private func handleTokenExpiration() {
        Task {
            do {
                // Attempt to renew the token
                if let refreshToken = try keychainManager.getRefreshToken() {
                    // Here you would implement renewal with Auth0
                    print("Token expired, renewal required")
                } else {
                    // Rediriger vers l'authentification
                    await MainActor.run {
                        NotificationCenter.default.post(name: .auth0AuthenticationStateChanged, object: nil)
                    }
                }
            } catch {
                print("Error during token renewal: \(error)")
            }
        }
    }
}

// MARK: - PTChannelManagerDelegate

extension PTTChannelManager: PTChannelManagerDelegate {
    
    func channelManager(_ channelManager: PTChannelManager, received pushToken: String, for channelDescriptor: PTChannelDescriptor) {
        print("Received PTT push token: \(String(pushToken.prefix(20)))...")
        
        Task {
            await updateEphemeralPushToken(pushToken)
        }
    }
    
    func channelManager(_ channelManager: PTChannelManager, didJoin channelDescriptor: PTChannelDescriptor) {
        print("Successfully joined PTT channel: \(channelDescriptor.name)")
        
        Task {
            await MainActor.run {
                    // Update state if needed
                    self.isJoined = true
            }
        }
    }
    
    func channelManager(_ channelManager: PTChannelManager, didLeave channelDescriptor: PTChannelDescriptor) {
        print("Left PTT channel: \(channelDescriptor.name)")
        
        Task {
            await MainActor.run {
                self.isJoined = false
                self.currentChannel = nil
                self.currentChannelDescriptor = nil
            }
        }
    }
    
    func channelManager(_ channelManager: PTChannelManager, didActivate audioSession: AVAudioSession) {
        print("PTT audio session activated")
        
        // Specialized audio configuration for paragliding
        do {
            try audioSession.setCategory(.playAndRecord,
                                       mode: .voiceChat,
                                       options: [.allowBluetooth, .defaultToSpeaker])
        } catch {
            print("PTT audio session configuration error: \(error)")
        }
    }
    
    func channelManager(_ channelManager: PTChannelManager, didDeactivate audioSession: AVAudioSession) {
        print("PTT audio session deactivated")
        
        Task {
            await MainActor.run {
                if self.isTransmitting {
                    Task {
                        await self.stopTransmission()
                    }
                }
            }
        }
    }
    
    func channelManager(_ channelManager: PTChannelManager, failedToJoin channelDescriptor: PTChannelDescriptor, error: Error) {
        print("Failed to join PTT channel: \(channelDescriptor.name), error: \(error)")
        
        Task {
            await MainActor.run {
                self.isJoined = false
                self.currentChannel = nil
                self.currentChannelDescriptor = nil
            }
        }
    }
    
    func channelManager(_ channelManager: PTChannelManager, failedToLeave channelDescriptor: PTChannelDescriptor, error: Error) {
        print("Failed to leave PTT channel: \(channelDescriptor.name), error: \(error)")
    }
    
    func incomingPushResult(_ channelManager: PTChannelManager, channelDescriptor: PTChannelDescriptor, pushPayload: [String : Any]) {
        print("Incoming PTT push for channel: \(channelDescriptor.name)")
        
    // Handle incoming push notification for a PTT transmission
        Task {
            await MainActor.run {
                    // Update the UI to indicate an incoming transmission
                Task {
                    await loadParticipants()
                }
            }
        }
    }
}

// MARK: - CLLocationManagerDelegate

extension PTTChannelManager: CLLocationManagerDelegate {
    
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        // Process location updates if needed
        // for geo-localized channels
    }
    
    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        print("Location error: \(error)")
    }
    
    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        switch manager.authorizationStatus {
        case .authorizedWhenInUse, .authorizedAlways:
            manager.startUpdatingLocation()
        case .denied, .restricted:
            print("Location authorization denied")
        case .notDetermined:
            manager.requestWhenInUseAuthorization()
        @unknown default:
            break
        }
    }
}

// MARK: - Public Interface Extensions

extension PTTChannelManager {
    
    /// Récupère l'état actuel du gestionnaire PTT
    func getCurrentState() -> PTTState {
        if isTransmitting {
            return .transmitting(sessionId: currentSessionId)
        } else if isJoined, let channel = currentChannel {
            return .joined(channel: channel, participants: participants)
        } else {
            return .idle
        }
    }
    
    /// Vérifie si une transmission est possible
    func canStartTransmission() -> Bool {
        return isJoined && 
               !isTransmitting && 
               networkService.getNetworkInfo().canTransmitAudio &&
               keychainManager.getAuthenticationStatus().isAuthenticated
    }
    
    /// Récupère les statistiques du canal actuel
    func getCurrentChannelStats() -> ChannelStats? {
        return currentChannel?.stats
    }
}

// MARK: - PTT State

enum PTTState: Equatable {
    case idle
    case joined(channel: PTTChannel, participants: [ChannelParticipant])
    case transmitting(sessionId: String?)
    
    static func == (lhs: PTTState, rhs: PTTState) -> Bool {
        switch (lhs, rhs) {
        case (.idle, .idle):
            return true
        case (.joined(let lhsChannel, let lhsParticipants), .joined(let rhsChannel, let rhsParticipants)):
            return lhsChannel.uuid == rhsChannel.uuid && lhsParticipants.count == rhsParticipants.count
        case (.transmitting(let lhsSessionId), .transmitting(let rhsSessionId)):
            return lhsSessionId == rhsSessionId
        default:
            return false
        }
    }
}

#if DEBUG
extension PTTChannelManager {
    
    /// Debug methods for development
    func debugPrintState() {
        print("=== PTT Manager Debug State ===")
        print("Current Channel: \(currentChannel?.name ?? "None")")
        print("Is Joined: \(isJoined)")
        print("Is Transmitting: \(isTransmitting)")
        print("Participants: \(participants.count)")
        print("Session ID: \(currentSessionId ?? "None")")
        print("==============================")
    }
}
#endif
