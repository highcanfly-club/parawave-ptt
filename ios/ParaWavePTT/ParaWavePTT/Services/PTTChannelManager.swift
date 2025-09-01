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

// MARK: - Audio Quality & Stats Types

/// Audio quality enumeration for PTT transmissions
public enum AudioQuality {
    case unknown
    case noSignal
    case poor
    case good
    case excellent
    case transmitting
    case listening
    
    var displayName: String {
        switch self {
        case .unknown: return "Unknown"
        case .noSignal: return "No Signal"
        case .poor: return "Poor"
        case .good: return "Good"
        case .excellent: return "Excellent"
        case .transmitting: return "Transmitting"
        case .listening: return "Listening"
        }
    }
    
    var color: UIColor {
        switch self {
        case .unknown: return .systemGray
        case .noSignal: return .systemRed
        case .poor: return .systemOrange
        case .good: return .systemYellow
        case .excellent: return .systemGreen
        case .transmitting: return .systemBlue
        case .listening: return .systemTeal
        }
    }
}

// MARK: - Audio Statistics
public struct AudioStats {
    let quality: AudioQuality
    let signalStrength: Float
    let noiseLevel: Float
    let latency: TimeInterval
    
    public init(quality: AudioQuality = .unknown, signalStrength: Float = 0.0, noiseLevel: Float = 0.0, latency: TimeInterval = 0.0) {
        self.quality = quality
        self.signalStrength = signalStrength
        self.noiseLevel = noiseLevel
        self.latency = latency
    }
}

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
    private var pendingPushToken: String? // Token temporaire en attente d'un canal
    private var currentSessionId: String?
    private var transmissionStartTime: Date?

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

        // Enhanced diagnostics before attempting initialization
        print("🔍 PTT Framework Diagnostic Information:")
        let systemVersion = ProcessInfo.processInfo.operatingSystemVersionString
        print("   - iOS Version: \(systemVersion)")
        print("   - App Bundle ID: \(Bundle.main.bundleIdentifier ?? "unknown")")

        // Check entitlements from Info.plist (note: actual entitlements are embedded at build time)
        if let backgroundModes = Bundle.main.object(forInfoDictionaryKey: "UIBackgroundModes")
            as? [String]
        {
            let hasPTTBackgroundMode = backgroundModes.contains("push-to-talk")
            print("   - Background Modes: \(backgroundModes)")
            print("   - Push-to-Talk Background Mode: \(hasPTTBackgroundMode)")

            if !hasPTTBackgroundMode {
                print("   - ⚠️ WARNING: push-to-talk not found in UIBackgroundModes")
            }
        } else {
            print("   - ❌ No UIBackgroundModes found in Info.plist")
        }

        // Check for microphone permission - PTT requires microphone access
        let microphonePermission = AVAudioSession.sharedInstance().recordPermission
        print("   - Microphone Permission: \(microphonePermission)")

        if microphonePermission == .denied {
            print("   - ❌ WARNING: Microphone access denied - this may prevent PTT initialization")
        } else if microphonePermission == .undetermined {
            print("   - ⚠️ WARNING: Microphone permission not yet requested")
        }

        // Check if we have required device capabilities
        if let requiredCapabilities = Bundle.main.object(
            forInfoDictionaryKey: "UIRequiredDeviceCapabilities") as? [String]
        {
            print("   - Required Device Capabilities: \(requiredCapabilities)")
        }

        // Test App Group access (this will help identify entitlements issues)
        let appGroupID = "group.club.highcanfly.parawave-ptt"
        if let containerURL = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: appGroupID)
        {
            print("   - ✅ App Group '\(appGroupID)' accessible at: \(containerURL)")
        } else {
            print(
                "   - ❌ App Group '\(appGroupID)' NOT accessible - this indicates entitlements/provisioning issue"
            )
        }

        // Check push notification registration status
        let pushRegistration = UIApplication.shared.isRegisteredForRemoteNotifications
        print("   - Push Notifications Registration: \(pushRegistration)")

        // Check if we have push capabilities in entitlements
        if let entitlements = Bundle.main.object(forInfoDictionaryKey: "Entitlements")
            as? [String: Any]
        {
            let hasPushToTalk = entitlements["com.apple.developer.push-to-talk"] != nil
            let hasAppGroups = entitlements["com.apple.security.application-groups"] != nil
            print("   - Push-to-Talk Entitlement: \(hasPushToTalk)")
            print("   - App Groups Entitlement: \(hasAppGroups)")
        } else {
            print("   - ⚠️ No entitlements found in bundle (this may be normal)")
        }

        do {
            // Request microphone permission if needed before initializing PTT
            if microphonePermission == .undetermined {
                print("🎤 Requesting microphone permission...")
                let granted = await withCheckedContinuation { continuation in
                    AVAudioSession.sharedInstance().requestRecordPermission { granted in
                        continuation.resume(returning: granted)
                    }
                }
                if granted {
                    print("✅ Microphone permission granted")
                } else {
                    print("❌ Microphone permission denied - PTT may not work properly")
                }
            }

            // Final verification before PTT initialization
            print("🔍 Final checks before PTT initialization:")
            print("   - Bundle ID: \(Bundle.main.bundleIdentifier ?? "unknown")")
            print("   - Expected App Group: group.club.highcanfly.parawave-ptt")
            print("   - Microphone permission: \(AVAudioSession.sharedInstance().recordPermission)")

            print("🔄 Attempting to initialize PTChannelManager...")
            channelManager = try await PTChannelManager.channelManager(
                delegate: self,
                restorationDelegate: self)
            print("✅ PTT Channel Manager initialized successfully")
        } catch {
            print("❌ Failed to initialize PTT Channel Manager: \(error.localizedDescription)")

            // Enhanced error analysis
            if let nsError = error as NSError? {
                print("   - Error Domain: \(nsError.domain)")
                print("   - Error Code: \(nsError.code)")
                print("   - Error UserInfo: \(nsError.userInfo)")

                // Specific error code analysis for PTT
                switch nsError {
                case PTInstantiationError.unknown:
                    print("   - Error PTInstantiationError.unknown: Unknown error occurred")
                case PTInstantiationError.invalidPlatform:
                    print(
                        "   - Error PTInstantiationError.invalidPlatform: Invalid platform (not real iOS)"
                    )
                case PTInstantiationError.missingBackgroundMode:
                    print(
                        "   - Error PTInstantiationError.missingBackgroundMode: Missing 'push-to-talk' in UIBackgroundModes"
                    )
                case PTInstantiationError.missingPushServerEnvironment:
                    print(
                        "   - Error PTInstantiationError.missingPushServerEnvironment: Missing push server environment"
                    )
                case PTInstantiationError.missingEntitlement:
                    print(
                        "   - Error PTInstantiationError.missingEntitlement: Missing Push-to-Talk entitlement"
                    )
                case PTInstantiationError.instantiationAlreadyInProgress:
                    print(
                        "   - Error PTInstantiationError.instantiationAlreadyInProgress: Instantiation already in progress"
                    )
                default:
                    print("   - Unknown error code: \(nsError.code)")
                }
            }

            print("💡 Common causes:")
            print("   - Missing or invalid provisioning profile with Push-to-Talk capability")
            print("   - App not properly signed with Push-to-Talk entitlements")
            print("   - Push-to-Talk capability not enabled in Apple Developer Console")
            print("   - App Group configuration mismatch")
            print("   - Device restrictions or parental controls")
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

        // Join the channel via API first
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

        // Store channel info immediately (before PTT framework call)
        self.currentChannel = channel
        self.currentChannelDescriptor = channelDescriptor

        // Join via the Apple PTT framework (if available)
        if let channelManager = channelManager {
            // Create a UUID for this channel session
            let channelUUID = UUID()
            self.currentChannelUUID = channelUUID
            
            print("🔄 Requesting join to Apple PTT framework...")
            
            // Use the correct Apple API - this triggers didJoinChannel delegate when successful
            try await channelManager.requestJoinChannel(
                channelUUID: channelUUID, 
                descriptor: channelDescriptor
            )
            
            print("✅ Apple PTT join request sent, waiting for delegate callback...")
            // The actual join confirmation will come via didJoinChannel delegate
        } else {
            print("⚠️ PTT Channel Manager not available - continuing with API-only mode")
            print("💡 For full PTT functionality, test on a physical device with iOS 16+")
            self.currentChannelUUID = nil
            // Set joined manually since we won't get the delegate callback
            self.isJoined = true
        }

        // Send pending push token if available
        if let pendingToken = self.pendingPushToken {
            print("📤 Sending pending push token (\(pendingToken.prefix(20))...) now that channel is ready...")
            Task {
                await updateEphemeralPushToken(pendingToken)
                self.pendingPushToken = nil
                print("🧹 Pending token sent and cleared")
            }
        }

        // Load participants
        await loadParticipants()

        print("Channel join process initiated: \(channel.name)")
        if channelManager != nil {
            print("Mode: Full Apple PTT integration - waiting for framework confirmation")
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

        // Leave via the Apple PTT framework first (if available)
        if let channelUUID = currentChannelUUID,
            let channelManager = channelManager
        {
            print("🔄 Requesting leave from Apple PTT framework...")
            try await channelManager.leaveChannel(channelUUID: channelUUID)
            print("✅ Apple PTT leave request sent, waiting for delegate callback...")
            // The actual leave confirmation will come via didLeaveChannel delegate
        } else {
            // Set state manually if no PTT framework
            self.isJoined = false
        }

        // Leave via the API
        do {
            let leaveResponse = try await networkService.leaveChannel(channel.uuid)
            if !leaveResponse.success {
                print("Warning: Failed to leave channel on server")
            } else {
                print("✅ Successfully left channel on server")
            }
        } catch {
            print("Error leaving channel on server: \(error)")
            // Continue with cleanup even if server call fails
        }

        // Reset state (will be confirmed by delegate if using PTT framework)
        self.currentChannel = nil
        self.currentChannelDescriptor = nil
        self.currentChannelUUID = nil
        self.participants = []
        self.activeTransmission = nil
        
        // Reset transmission state
        if isTransmitting {
            self.isTransmitting = false
            self.currentSessionId = nil
            self.transmissionStartTime = nil
        }

        print("Channel leave process completed: \(channel.name)")
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
        print("🔄 Updating ephemeral push token for channel...")
        self.ephemeralPushToken = token

        guard let channel = currentChannel else {
            print("❌ No current channel found, cannot update push token")
            return
        }

        do {
            print("🌐 Sending push token to server...")
            let success = try await networkService.updateEphemeralPushToken(
                channel.uuid, token: token)
            if success {
                print("✅ Ephemeral push token updated successfully")
            } else {
                print("❌ Server returned false for push token update")
            }
        } catch {
            print("❌ Error updating push token: \(error.localizedDescription)")
        }
    }

    // MARK: - Transmission Control (Apple PTT Framework)
    
    /// Request to start transmission via Apple's PTT framework
    /// This will show the Apple PTT interface and begin transmission if successful
    @MainActor
    func requestStartTransmission() async throws {
        guard let channelManager = channelManager else {
            throw ParapenteError.transmissionFailed
        }
        
        guard let channelUUID = currentChannelUUID else {
            throw ParapenteError.channelNotFound
        }
        
        guard !isTransmitting else {
            print("Transmission already in progress")
            return
        }
        
        print("🎙️ Requesting transmission start via Apple's PTT framework...")
        
        do {
            try await channelManager.requestBeginTransmitting(channelUUID: channelUUID)
            print("✅ Apple PTT transmission request sent, waiting for delegate callback...")
            // The actual transmission start will come via didBeginTransmittingFrom delegate
        } catch {
            print("❌ Failed to request transmission start: \(error)")
            throw error
        }
    }
    
    /// Request to stop transmission via Apple's PTT framework
    @MainActor
    func requestStopTransmission() {
        guard let channelManager = channelManager else {
            print("❌ Apple PTT framework not available")
            return
        }
        
        guard let channelUUID = currentChannelUUID else {
            print("❌ No active channel to stop transmission on")
            return
        }
        
        print("🛑 Requesting transmission end via Apple's PTT framework...")
        
        // Apple's stopTransmitting is synchronous
        channelManager.stopTransmitting(channelUUID: channelUUID)
        print("✅ Apple PTT transmission stop request sent")
        // The actual transmission end will come via didEndTransmittingFrom delegate
    }

    // MARK: - Server Communication
    
    /// Handle audio data transmission to server (called by Apple PTT framework internally)
    /// Note: With Apple's PushToTalk framework, audio data is handled automatically
    /// This method is kept for compatibility but may not be needed
    func sendAudioData(_ audioData: Data, sequenceNumber: Int) async throws {
        guard let sessionId = currentSessionId else {
            throw ParapenteError.transmissionFailed
        }
        
        print("📡 Sending audio chunk to server (session: \(sessionId), seq: \(sequenceNumber), size: \(audioData.count) bytes)")

        do {
            let response = try await networkService.sendAudioChunk(
                sessionId: sessionId,
                audioData: audioData,
                sequenceNumber: sequenceNumber
            )

            if !response.success {
                print("❌ Server rejected audio chunk: \(response.error ?? "Unknown error")")
            }
        } catch {
            print("❌ Network error while sending audio: \(error)")
            throw error
        }
    }

    // MARK: - Helper Methods

    /// Check if Apple PTT framework is available and initialized
    var isPTTFrameworkAvailable: Bool {
        return channelManager != nil
    }
    
    /// Get current PTT status for debugging
    func debugPrintPTTStatus() {
        print("=== Apple PushToTalk Status ===")
        print("Framework available: \(isPTTFrameworkAvailable)")
        print("Current channel: \(currentChannel?.name ?? "none")")
        print("Channel UUID: \(currentChannelUUID?.uuidString ?? "none")")
        print("Is joined: \(isJoined)")
        print("Is transmitting: \(isTransmitting)")
        print("Current session ID: \(currentSessionId ?? "none")")
        print("Participants count: \(participants.count)")
        
        if isPTTFrameworkAvailable {
            print("📱 Expected behavior:")
            print("  1. Blue PTT button in iOS status bar when joined")
            print("  2. Tap button or use Apple's interface to transmit")
            print("  3. All audio processing handled by Apple")
            print("  4. Server communication triggered by delegates")
        } else {
            print("⚠️ PTT framework not available - limited functionality")
        }
        print("==============================")
    }

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
    
    // MARK: - Permission Management
    
    /// Request microphone permissions - Static method for compatibility
    public static func requestMicrophonePermission() async -> Bool {
        print("🎤 Requesting microphone permission...")
        
        // With Apple's PTT framework, microphone permissions are handled automatically
        // when the user first attempts to use PTT functionality
        return await withCheckedContinuation { continuation in
            AVAudioSession.sharedInstance().requestRecordPermission { granted in
                print(granted ? "✅ Microphone permission granted" : "❌ Microphone permission denied")
                continuation.resume(returning: granted)
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
        print("✅ Successfully joined Apple PTT channel: \(channelUUID), reason: \(reason)")
        print("📱 Blue PTT button should now appear in iOS status bar")

        Task { @MainActor in
            self.isJoined = true
            
            // Confirm the channel UUID matches what we expect
            if self.currentChannelUUID == channelUUID {
                print("🎯 Channel UUID matches our expectation")
                if let channelName = self.currentChannel?.name {
                    print("🔗 Linked to channel: \(channelName)")
                }
            } else {
                print("⚠️ Channel UUID mismatch - updating to match Apple's framework")
                self.currentChannelUUID = channelUUID
            }
            
            NotificationCenter.default.post(name: .pttChannelJoined, object: channelUUID)
        }
    }

    func channelManager(
        _ channelManager: PTChannelManager, didLeaveChannel channelUUID: UUID,
        reason: PTChannelLeaveReason
    ) {
        print("👋 Left Apple PTT channel: \(channelUUID), reason: \(reason)")
        print("📱 Blue PTT button should now disappear from iOS status bar")

        Task { @MainActor in
            self.isJoined = false
            
            // Stop any ongoing transmission
            if self.isTransmitting {
                self.isTransmitting = false
                
                // Clean up server session if active
                if let sessionId = self.currentSessionId {
                    print("🧹 Cleaning up server transmission session: \(sessionId)")
                    self.currentSessionId = nil
                }
            }
            
            NotificationCenter.default.post(name: .pttChannelLeft, object: channelUUID)
        }
    }

    func channelManager(
        _ channelManager: PTChannelManager, channelUUID: UUID,
        didBeginTransmittingFrom source: PTChannelTransmitRequestSource
    ) {
        print("🎙️ Started transmitting on channel: \(channelUUID), source: \(source)")

        Task { @MainActor in
            // Update local state
            self.isTransmitting = true
            self.transmissionStartTime = Date()
            
            // Start server transmission session
            if let channel = self.currentChannel {
                do {
                    print("📡 Starting server transmission session...")
                    let location = self.locationManager.location
                    let transmissionResponse = try await self.networkService.startTransmission(
                        channelUuid: channel.uuid,
                        expectedDuration: Int(NetworkConfiguration.maxTransmissionDuration),
                        location: location
                    )
                    
                    if transmissionResponse.success, let sessionId = transmissionResponse.sessionId {
                        self.currentSessionId = sessionId
                        print("✅ Server transmission session started: \(sessionId)")
                    } else {
                        print("❌ Failed to start server transmission session")
                    }
                } catch {
                    print("❌ Error starting server transmission: \(error)")
                }
            }
            
            // Notify UI
            NotificationCenter.default.post(name: .pttTransmissionStarted, object: channelUUID)
        }
    }

    func channelManager(
        _ channelManager: PTChannelManager, channelUUID: UUID,
        didEndTransmittingFrom source: PTChannelTransmitRequestSource
    ) {
        print("🛑 Stopped transmitting on channel: \(channelUUID), source: \(source)")

        Task { @MainActor in
            // Update local state
            self.isTransmitting = false
            
            // Calculate transmission duration
            let durationMs: Int
            if let startTime = self.transmissionStartTime {
                let duration = Date().timeIntervalSince(startTime)
                durationMs = Int(duration * 1000) // Convert to milliseconds
                print("📊 Transmission duration: \(duration)s (\(durationMs)ms)")
            } else {
                durationMs = 0
                print("⚠️ No start time recorded, using 0 duration")
            }
            
            // End server transmission session
            if let sessionId = self.currentSessionId {
                do {
                    print("📡 Ending server transmission session: \(sessionId)")
                    let location = self.locationManager.location
                    let coordinates = location.map { loc in
                        Coordinates(lat: loc.coordinate.latitude, lon: loc.coordinate.longitude)
                    }
                    
                    let endResponse = try await self.networkService.endTransmission(
                        sessionId: sessionId, 
                        totalDurationMs: durationMs, 
                        finalLocation: coordinates
                    )
                    
                    if endResponse.success {
                        print("✅ Server transmission ended. Duration: \(endResponse.totalDuration ?? 0)s, Participants: \(endResponse.participantsReached ?? 0)")
                    } else {
                        print("❌ Failed to end server transmission session")
                    }
                } catch {
                    print("❌ Error ending server transmission: \(error)")
                }
                
                self.currentSessionId = nil
            }
            
            // Clear transmission timing
            self.transmissionStartTime = nil
            
            // Reload participants to update state
            await self.loadParticipants()
            
            // Notify UI
            NotificationCenter.default.post(name: .pttTransmissionStopped, object: channelUUID)
        }
    }

    func channelManager(
        _ channelManager: PTChannelManager, receivedEphemeralPushToken pushToken: Data
    ) {
        // Convertir le token binaire en hexadécimal
        let tokenHex = pushToken.map { String(format: "%02x", $0) }.joined()
        print("🔑 Received PTT push token: \(tokenHex.prefix(20))...")

        // Stocker temporairement le token
        self.pendingPushToken = tokenHex
        print("📦 Token stored temporarily, waiting for channel to be ready...")

        // Essayer d'envoyer immédiatement si le canal est déjà défini
        if currentChannel != nil {
            print("� Channel already available, sending token immediately...")
            Task {
                await updateEphemeralPushToken(tokenHex)
            }
        } else {
            print("⏳ Channel not ready yet, token will be sent when channel is joined")
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
        print("🔇 PTT audio session deactivated")

        Task { @MainActor in
            // Clean up transmission state if needed
            // Note: When Apple deactivates the audio session, it usually means
            // the transmission has already ended, so we just clean up our state
            if self.isTransmitting {
                print("⚠️ Audio session deactivated while transmitting - cleaning up state")
                self.isTransmitting = false
                
                // Clean up server session if active
                if let sessionId = self.currentSessionId {
                    print("🧹 Cleaning up server transmission session after audio deactivation: \(sessionId)")
                    
                    // Calculate duration if we have a start time
                    let durationMs: Int
                    if let startTime = self.transmissionStartTime {
                        let duration = Date().timeIntervalSince(startTime)
                        durationMs = Int(duration * 1000)
                        print("📊 Emergency cleanup - transmission duration: \(duration)s")
                    } else {
                        durationMs = 1000 // Default 1 second for emergency cleanup
                        print("⚠️ No start time recorded for emergency cleanup, using 1s")
                    }
                    
                    // Attempt to end the server session
                    Task {
                        do {
                            let location = self.locationManager.location
                            let coordinates = location.map { loc in
                                Coordinates(lat: loc.coordinate.latitude, lon: loc.coordinate.longitude)
                            }
                            
                            let endResponse = try await self.networkService.endTransmission(
                                sessionId: sessionId, 
                                totalDurationMs: durationMs, 
                                finalLocation: coordinates
                            )
                            if endResponse.success {
                                print("✅ Server session cleaned up after audio deactivation")
                            } else {
                                print("⚠️ Server session cleanup warning: \(endResponse.error ?? "unknown error")")
                            }
                        } catch {
                            print("❌ Error cleaning up server session: \(error)")
                        }
                    }
                    
                    self.currentSessionId = nil
                }
                
                // Clear transmission timing
                self.transmissionStartTime = nil
                
                // Reload participants to update state
                await self.loadParticipants()
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
