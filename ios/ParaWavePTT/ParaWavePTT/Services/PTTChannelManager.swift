import AVFoundation
import CoreLocation
import Foundation
import PushToTalk
import UIKit
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
class PTTChannelManager: NSObject, ObservableObject, CLLocationManagerDelegate {

    // MARK: - Properties

    // PTChannelManager instance
    private var channelManager: PTChannelManager?
    private let networkService: ParapenteNetworkService
    private let locationManager = CLLocationManager()
    private let keychainManager = Auth0KeychainManager()

    @Published var currentChannel: PTTChannel?
    @Published var currentChannelDescriptor: PTChannelDescriptor?
    @Published var currentChannelUUID: UUID?
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

        setupLocationManager()
        setupNotifications()

        // Initialize PTT framework asynchronously
        Task { @MainActor in
            await self.setupPTTFramework()
        }
    }

    // MARK: - Setup Methods

    private func setupPTTFramework() async {
        print("setupPTTFramework - Initializing PTT Channel Manager")

        // Check if running on simulator
        #if targetEnvironment(simulator)
            print("⚠️ PushToTalk framework is not available on iOS Simulator")
            print("⚠️ Please test on a physical device with iOS 16+ and proper provisioning")
            channelManager = nil
            return
        #endif

        // Check iOS version
        guard #available(iOS 16.0, *) else {
            print("⚠️ PushToTalk framework requires iOS 16.0 or later")
            channelManager = nil
            return
        }

        do {
            channelManager = try await PTChannelManager.channelManager(
                delegate: self,
                restorationDelegate: self)
            print("✅ PTT Channel Manager initialized successfully")
        } catch {
            print("❌ Failed to initialize PTT Channel Manager: \(error.localizedDescription)")
            print("💡 Common causes:")
            print("   - Running on iOS Simulator (PTT only works on physical device)")
            print("   - Missing provisioning profile with Push-to-Talk capability")
            print("   - iOS version < 16.0")
            print("   - App not properly signed with PTT entitlements")
            channelManager = nil
        }

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
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) {
            granted, error in
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
            try audioSession.setCategory(
                .playAndRecord,
                mode: .voiceChat,
                options: [
                    .allowBluetooth,
                    .defaultToSpeaker,
                    .allowBluetoothA2DP,
                    .allowAirPlay,
                ])

            // Special configuration for noisy environment (wind)
            try audioSession.setActive(true)

            // Optimization for AAC-LC hardware
            if audioSession.preferredIOBufferDuration != 0.02 {
                try audioSession.setPreferredIOBufferDuration(0.02)  // 20ms for low latency
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
            throw ParapenteError.networkError(
                NSError(
                    domain: "JoinFailed", code: 0,
                    userInfo: [
                        NSLocalizedDescriptionKey: joinResponse.error ?? "Failed to join channel"
                    ]))
        }

        // Join via the PTT framework (if available)
        if let channelManager = channelManager {
            // Create a UUID for this channel session
            let channelUUID = UUID()
            channelManager.requestJoinChannel(
                channelUUID: channelUUID, descriptor: channelDescriptor)
            self.currentChannelUUID = channelUUID
            print("✅ PTT Channel Manager join request sent")
        } else {
            print("⚠️ PTT Channel Manager not available - continuing with API-only mode")
            print("💡 For full PTT functionality, test on a physical device with iOS 16+")
            self.currentChannelUUID = nil
        }

        // Update state
        self.currentChannel = channel
        self.currentChannelDescriptor = channelDescriptor
        self.isJoined = true

        // Load participants
        await loadParticipants()

        print("Channel joined successfully: \(channel.name)")
        if channelManager != nil {
            print("Mode: Full PTT integration")
        } else {
            print("Mode: API-only (PTT framework unavailable)")
        }
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
        if let channelUUID = currentChannelUUID,
            let channelManager = channelManager
        {
            channelManager.leaveChannel(channelUUID: channelUUID)
        }

        // Reset state
        self.currentChannel = nil
        self.currentChannelDescriptor = nil
        self.currentChannelUUID = nil
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
            let activeTransmissionResponse = try await networkService.getActiveTransmission(
                channelUuid: channel.uuid)
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
            let success = try await networkService.updateEphemeralPushToken(
                channel.uuid, token: token)
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
        if let channelUUID = currentChannelUUID,
            let channelManager = channelManager
        {
            channelManager.setActiveRemoteParticipant(
                nil, channelUUID: channelUUID,
                completionHandler: { error in
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
                print(
                    "Transmission ended. Duration: \(endResponse.totalDuration ?? 0)s, Participants reached: \(endResponse.participantsReached ?? 0)"
                )
            }
        } catch {
            print("Error stopping transmission: \(error)")
        }

        // Stop transmitting on the PTT framework
        if let channelUUID = currentChannelUUID,
            let channelManager = channelManager
        {
            channelManager.stopTransmitting(channelUUID: channelUUID)
        }

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
                .font: UIFont.boldSystemFont(ofSize: 12),
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
                if (try keychainManager.getRefreshToken()) != nil {
                    // Here you would implement renewal with Auth0
                    print("Token expired, renewal required")
                } else {
                    // Rediriger vers l'authentification
                    await MainActor.run {
                        NotificationCenter.default.post(
                            name: .auth0AuthenticationStateChanged, object: nil)
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

    func channelManager(
        _ channelManager: PTChannelManager, didJoinChannel channelUUID: UUID,
        reason: PTChannelJoinReason
    ) {
        print("Successfully joined PTT channel: \(channelUUID)")

        Task {
            await MainActor.run {
                self.isJoined = true
                NotificationCenter.default.post(name: .pttChannelJoined, object: channelUUID)
            }
        }
    }

    func channelManager(
        _ channelManager: PTChannelManager, didLeaveChannel channelUUID: UUID,
        reason: PTChannelLeaveReason
    ) {
        print("Left PTT channel: \(channelUUID), reason: \(reason)")

        Task {
            await MainActor.run {
                self.isJoined = false
                self.isTransmitting = false
                NotificationCenter.default.post(name: .pttChannelLeft, object: channelUUID)
            }
        }
    }

    func channelManager(
        _ channelManager: PTChannelManager, channelUUID: UUID,
        didBeginTransmittingFrom source: PTChannelTransmitRequestSource
    ) {
        print("Started transmitting on channel: \(channelUUID), source: \(source)")

        Task {
            await MainActor.run {
                self.isTransmitting = true
                NotificationCenter.default.post(name: .pttTransmissionStarted, object: channelUUID)
            }
        }
    }

    func channelManager(
        _ channelManager: PTChannelManager, channelUUID: UUID,
        didEndTransmittingFrom source: PTChannelTransmitRequestSource
    ) {
        print("Stopped transmitting on channel: \(channelUUID), source: \(source)")

        Task {
            await MainActor.run {
                self.isTransmitting = false
                NotificationCenter.default.post(name: .pttTransmissionStopped, object: channelUUID)
            }
        }
    }

    func channelManager(
        _ channelManager: PTChannelManager, receivedEphemeralPushToken pushToken: Data
    ) {
        print(
            "Received PTT push token: \(pushToken.prefix(20).map { String(format: "%02x", $0) }.joined())"
        )

        Task {
            await updateEphemeralPushToken(String(data: pushToken, encoding: .utf8) ?? "")
        }
    }

    func incomingPushResult(
        channelManager: PTChannelManager, channelUUID: UUID, pushPayload: [String: Any]
    ) -> PTPushResult {
        print("Incoming push for channel: \(channelUUID), payload: \(pushPayload)")

        // Handle incoming push notification
        // Return appropriate result based on app state
        return .leaveChannel
    }

    func channelManager(
        _ channelManager: PTChannelManager, didActivate audioSession: AVAudioSession
    ) {
        print("PTT audio session activated")

        // Specialized audio configuration for paragliding
        do {
            try audioSession.setCategory(
                .playAndRecord,
                mode: .voiceChat,
                options: [.allowBluetooth, .defaultToSpeaker])
        } catch {
            print("PTT audio session configuration error: \(error)")
        }
    }

    func channelManager(
        _ channelManager: PTChannelManager, didDeactivate audioSession: AVAudioSession
    ) {
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
}

// MARK: - Notification Names
extension NSNotification.Name {
    static let pttChannelJoined = NSNotification.Name("pttChannelJoined")
    static let pttChannelLeft = NSNotification.Name("pttChannelLeft")
    static let pttTransmissionStarted = NSNotification.Name("pttTransmissionStarted")
    static let pttTransmissionStopped = NSNotification.Name("pttTransmissionStopped")
}

// MARK: - CLLocationManagerDelegate
extension PTTChannelManager {
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        // Handle location updates if needed for geolocation features
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        print("Location manager failed with error: \(error)")
    }
}

// MARK: - PTChannelRestorationDelegate
extension PTTChannelManager: PTChannelRestorationDelegate {

    func channelDescriptor(restoredChannelUUID channelUUID: UUID) -> PTChannelDescriptor {
        print("Restoring channel descriptor for: \(channelUUID)")

        // Create a default descriptor for restored channels
        // In a real app, you'd store and retrieve the actual channel info
        let descriptor = PTChannelDescriptor(
            name: "Restored Channel",
            image: createDefaultChannelImage()
        )

        return descriptor
    }

    private func createDefaultChannelImage() -> UIImage? {
        let size = CGSize(width: 40, height: 40)
        let renderer = UIGraphicsImageRenderer(size: size)

        return renderer.image { context in
            let rect = CGRect(origin: .zero, size: size)

            UIColor.systemBlue.setFill()
            context.fill(rect)

            let attributes: [NSAttributedString.Key: Any] = [
                .foregroundColor: UIColor.white,
                .font: UIFont.boldSystemFont(ofSize: 12),
            ]

            let text = "PT"
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
}
