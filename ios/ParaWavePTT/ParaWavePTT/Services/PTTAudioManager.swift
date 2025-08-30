import Foundation
import UIKit
import AVFoundation
import PushToTalk

/*
 Copyright (C) 2025 Ronan Le Meillat
 SPDX-License-Identifier: AGPL-3.0-or-later

 This file is part of ParaWave PTT.
 ParaWave PTT is free software: you can redistribute it and/or modify
 it under the terms of the GNU Affero General Public License as published by
 t    func channelManager(_ channelManager: PTChannelManager, 
                       didEndTransmitting channelUUID: UUID) {
        print("🛑 Apple PTT: User stopped transmitting via Apple's interface")
        
        Task { @MainActor in
            audioManager?.isTransmitting = false
            audioManager?.isRecording = false
            audioManager?.audioLevel = 0.0
        }
        
        // Notify our external PTT manager that transmission ended
        Task {
            await audioManager?.handleApplePTTTransmissionEnd(channelUUID: channelUUID)
        }
    }
    
    // Alternative delegate methods with source parameter (may be required)
    func channelManager(_ channelManager: PTChannelManager, 
                       channelUUID: UUID, 
                       didBeginTransmittingFrom source: PTChannelTransmitRequestSource) {
        print("🎙️ Apple PTT: Began transmitting from source: \(source)")
        
        Task { @MainActor in
            audioManager?.isTransmitting = true
            audioManager?.isRecording = true
        }
        
        // Notify our external PTT manager that transmission started
        Task {
            await audioManager?.handleApplePTTTransmissionStart(channelUUID: channelUUID)
        }
    }
    
    func channelManager(_ channelManager: PTChannelManager, 
                       channelUUID: UUID, 
                       didEndTransmittingFrom source: PTChannelTransmitRequestSource) {
        print("🛑 Apple PTT: Ended transmitting from source: \(source)")
        
        Task { @MainActor in
            audioManager?.isTransmitting = false
            audioManager?.isRecording = false
            audioManager?.audioLevel = 0.0
        }
        
        // Notify our external PTT manager that transmission ended
        Task {
            await audioManager?.handleApplePTTTransmissionEnd(channelUUID: channelUUID)
        }
    }e Foundation, either version 3 of the License, or
 (at your option) any later version.

 ParaWave PTT is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 GNU Affero General Public License for more details.

 You should have received a copy of the GNU Affero General Public License
 along with this program. If not, see <https://www.gnu.org/licenses/agpl-3.0.en.html>.
*/

// MARK: - Audio Quality & Stats Types (Simplified for Apple's Framework)

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
        case .poor: return .systemRed
        case .good: return .systemOrange
        case .excellent: return .systemGreen
        case .transmitting: return .systemGreen
        case .listening: return .systemBlue
        }
    }
}

/// Audio statistics structure (Simplified for Apple's Framework)
public struct AudioStats {
    let currentLevel: Float
    let quality: AudioQuality
    let isRecording: Bool
    let isPlaying: Bool
    let isTransmitting: Bool
    let format: String
    
    public init(currentLevel: Float, quality: AudioQuality, isRecording: Bool, isPlaying: Bool, isTransmitting: Bool, format: String) {
        self.currentLevel = currentLevel
        self.quality = quality
        self.isRecording = isRecording
        self.isPlaying = isPlaying
        self.isTransmitting = isTransmitting
        self.format = format
    }
}

// MARK: - Error Types

/// PTT audio error enumeration
public enum PTTAudioError: Error, LocalizedError {
    case noActiveChannel
    case pttFrameworkNotInitialized
    
    public var errorDescription: String? {
        switch self {
        case .noActiveChannel:
            return "No active PTT channel"
        case .pttFrameworkNotInitialized:
            return "Apple's PushToTalk framework not initialized"
        }
    }
}

// MARK: - Main PTT Audio Manager

/// Specialized audio manager for PTT transmissions using Apple's PushToTalk framework
/// Following Apple's official documentation: https://developer.apple.com/documentation/pushtotalk/creating-a-push-to-talk-app
/// NOTE: Apple's PushToTalk framework handles ALL audio processing internally.
/// We do NOT use AVAudioEngine - Apple provides the complete audio chain and UI.
public class PTTAudioManager: NSObject, ObservableObject {
    
    // MARK: - Properties
    
    // Apple's PTChannelManager - the core of the PushToTalk framework
    private var channelManager: PTChannelManager?
    fileprivate var activeChannelUUID: UUID?
    private var channelDescriptor: PTChannelDescriptor?
    
    // Published properties for SwiftUI
    @Published public var isRecording = false
    @Published public var audioLevel: Float = 0.0
    @Published public var isPlaying = false
    @Published public var isTransmitting = false
    @Published public var channelJoined = false
    
    // Reference to external PTT manager for server communication
    private weak var pttChannelManager: PTTChannelManager?
    
    // MARK: - Initialization
    
    init(pttChannelManager: PTTChannelManager? = nil) {
        self.pttChannelManager = pttChannelManager
        super.init()
        
        // Initialize Apple's PushToTalk framework asynchronously
        Task {
            await setupPTTFramework()
        }
        
        print("PTTAudioManager initialized - Pure Apple PushToTalk framework integration")
    }
    
    deinit {
        // Apple's framework handles cleanup
        print("PTTAudioManager deinitialized")
    }
    
    // MARK: - Setup Methods
    
    /// Initialize Apple's PushToTalk framework
    private func setupPTTFramework() async {
        do {
            print("🔄 Initializing Apple's PTChannelManager...")
            
            // Create a delegate wrapper to handle Apple's protocols
            let delegateHandler = ApplePTTDelegateHandler(audioManager: self)
            
            // Use Apple's factory method to create the channel manager
            channelManager = try await PTChannelManager.channelManager(
                delegate: delegateHandler,
                restorationDelegate: delegateHandler
            )
            
            print("✅ Apple's PTChannelManager initialized successfully")
            print("📝 Apple's PTT UI will be available in the status bar when channel is joined")
            
            // If we have a pending channel to join, do it now
            if let channelUUID = activeChannelUUID, let descriptor = channelDescriptor {
                print("🔄 Joining pending Apple PTT channel: \(descriptor.name)")
                do {
                    try await channelManager!.requestJoinChannel(
                        channelUUID: channelUUID,
                        descriptor: descriptor
                    )
                    print("✅ Successfully joined pending Apple PTT channel")
                } catch {
                    print("❌ Failed to join pending Apple PTT channel: \(error)")
                }
            }
            
        } catch {
            print("❌ Failed to initialize Apple's PTChannelManager: \(error)")
            // The app can still function with limited capabilities
        }
    }
    
    // MARK: - Public API (Simplified for Apple's Framework)
    
    /// Join a PTT channel using Apple's PushToTalk framework
    public func joinChannel(channelUUID: UUID, name: String) async throws {
        print("🎯 Joining Apple PTT channel: \(name) (\(channelUUID))")
        
        // Store the channel info
        self.activeChannelUUID = channelUUID
        
        // Create channel descriptor for Apple's framework
        let descriptor = PTChannelDescriptor(name: name, image: nil)
        self.channelDescriptor = descriptor
        
        // If Apple's framework is not ready, initialize it first
        if channelManager == nil {
            print("⚠️ Apple's PTChannelManager not initialized yet, initializing...")
            await setupPTTFramework()
        }
        
        guard let manager = channelManager else {
            print("❌ Apple's PTT framework still not available")
            throw PTTAudioError.pttFrameworkNotInitialized
        }
        
        do {
            // Use Apple's requestJoinChannel method
            try await manager.requestJoinChannel(
                channelUUID: channelUUID,
                descriptor: descriptor
            )
            
            print("✅ Successfully joined Apple PTT channel: \(name)")
            print("📱 Blue PTT button should now appear in iOS status bar")
            
            await MainActor.run {
                self.channelJoined = true
            }
            
        } catch {
            print("❌ Failed to join Apple PTT channel: \(error)")
            self.activeChannelUUID = nil
            self.channelDescriptor = nil
            throw error
        }
    }
    
    /// Leave the current PTT channel
    public func leaveChannel() async {
        guard let channelUUID = activeChannelUUID,
              let manager = channelManager else { 
            print("⚠️ No active channel or manager to leave")
            return 
        }
        
        print("🚪 Leaving Apple PTT channel: \(channelUUID)")
        
        do {
            try await manager.leaveChannel(channelUUID: channelUUID)
            
            self.activeChannelUUID = nil
            self.channelDescriptor = nil
            
            await MainActor.run {
                self.channelJoined = false
                self.isTransmitting = false
            }
            
            print("✅ Successfully left Apple PTT channel")
            print("📱 Blue PTT button should disappear from iOS status bar")
            
        } catch {
            print("❌ Error leaving Apple PTT channel: \(error)")
        }
    }
    
    // MARK: - Transmission State (Apple Framework Manages This)
    
    /// Get current transmission state
    /// Note: Actual transmission control is handled by Apple's PTT interface
    public var isCurrentlyTransmitting: Bool {
        return isTransmitting
    }
    
    /// Play audio received from other participants
    /// Note: Apple's framework handles outgoing audio transmission
    public func playAudio(_ data: Data) {
        print("🔊 Playing received audio data (\(data.count) bytes)")
        // TODO: Implement playback for received messages from other participants
        // This is separate from Apple's PTT transmission handling
    }
    
    /// Get current audio quality assessment
    public func assessAudioQuality() -> AudioQuality {
        if isTransmitting {
            return .transmitting
        } else if channelJoined {
            // With Apple's PTT framework, we assume good quality when connected
            return .listening
        } else {
            return .unknown
        }
    }
    
    /// Get current audio statistics (Apple PTT Framework version)
    public func getAudioStats() -> AudioStats {
        return AudioStats(
            currentLevel: audioLevel,
            quality: assessAudioQuality(),
            isRecording: isRecording,
            isPlaying: isPlaying,
            isTransmitting: isTransmitting,
            format: "Apple PTT Framework"
        )
    }
    
    /// Start recording - NOTE: With Apple's PTT framework, recording is triggered by user interaction with the blue button
    /// This method is provided for compatibility but the actual recording start happens when the user interacts with Apple's PTT UI
    @MainActor
    public func startRecording() async throws {
        print("⚠️ startRecording() called - With Apple's PTT framework, recording is controlled by the system")
        print("📱 Users must tap the blue PTT button or use Apple's Speak/Listen interface to start transmission")
        print("🎙️ This method is provided for compatibility but has no effect")
        
        // For compatibility, we could potentially try to programmatically request transmission
        // but Apple's framework is designed to be user-initiated for privacy and security
        if !channelJoined {
            throw PTTAudioError.noActiveChannel
        }
        
        // The actual transmission will be started when the user interacts with Apple's PTT interface
    }
    
    /// Stop recording - NOTE: With Apple's PTT framework, recording is stopped by the system or user interaction
    @MainActor
    public func stopRecording() async {
        print("⚠️ stopRecording() called - With Apple's PTT framework, recording stop is controlled by the system")
        print("📱 Users release the PTT button or the system ends the transmission")
        print("🛑 This method is provided for compatibility but has no effect")
        
        // With Apple's framework, we cannot programmatically stop transmission
        // The user must release the PTT button or the system will end it
    }
    
    /// Check microphone permissions - Static method for compatibility
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
    
    // MARK: - Internal Methods for Apple PTT Integration
    
    /// Handle Apple PTT transmission start event
    /// Called when user starts transmitting via Apple's interface
    fileprivate func handleApplePTTTransmissionStart(channelUUID: UUID) async {
        print("🎙️ Handling Apple PTT transmission start for channel: \(channelUUID)")
        
        // Notify external PTT manager that transmission started
        // Note: This would call methods on your custom PTTChannelManager, not Apple's
        // TODO: Implement the actual server communication here
        print("📡 Would notify server about transmission start")
    }
    
    /// Handle Apple PTT transmission end event  
    /// Called when user stops transmitting via Apple's interface
    fileprivate func handleApplePTTTransmissionEnd(channelUUID: UUID) async {
        print("🛑 Handling Apple PTT transmission end for channel: \(channelUUID)")
        
        // Notify external PTT manager that transmission ended
        // Note: This would call methods on your custom PTTChannelManager, not Apple's
        // TODO: Implement the actual server communication here
        print("📡 Would notify server about transmission end")
    }
    
    /// Send push token to server for PTT notifications
    fileprivate func sendPushTokenToServer(_ token: Data) async {
        print("📤 Sending Apple PTT push token to server: \(token.base64EncodedString())")
        
        // Forward to external PTT manager
        // Note: This would call methods on your custom PTTChannelManager, not Apple's
        // TODO: Implement the actual server communication here
        print("📡 Would send push token to server")
    }
}

// MARK: - Apple PTT Delegate Handler

/// Internal delegate handler for Apple's PushToTalk framework
/// This class responds to events from Apple's built-in PTT interface
private class ApplePTTDelegateHandler: NSObject, PTChannelManagerDelegate, PTChannelRestorationDelegate {
    func channelManager(_ channelManager: PTChannelManager, channelUUID: UUID, didBeginTransmittingFrom source: PTChannelTransmitRequestSource) {
        print("🎙️ Apple PTT: Began transmitting from source: \(source) on channel: \(channelUUID)")
        
        Task { @MainActor in
            audioManager?.isTransmitting = true
            audioManager?.isRecording = true
        }
        
        // Notify our external PTT manager that transmission started
        Task {
            await audioManager?.handleApplePTTTransmissionStart(channelUUID: channelUUID)
        }
    }
    
    func channelManager(_ channelManager: PTChannelManager, channelUUID: UUID, didEndTransmittingFrom source: PTChannelTransmitRequestSource) {
        print("🛑 Apple PTT: Ended transmitting from source: \(source) on channel: \(channelUUID)")
        
        Task { @MainActor in
            audioManager?.isTransmitting = false
            audioManager?.isRecording = false
            audioManager?.audioLevel = 0.0
        }
        
        // Notify our external PTT manager that transmission ended
        Task {
            await audioManager?.handleApplePTTTransmissionEnd(channelUUID: channelUUID)
        }
    }
    
    
    private weak var audioManager: PTTAudioManager?
    
    init(audioManager: PTTAudioManager) {
        self.audioManager = audioManager
        super.init()
    }
    
    // MARK: - PTChannelManagerDelegate
    
    func channelManager(_ channelManager: PTChannelManager, 
                       didJoinChannel channelUUID: UUID, 
                       reason: PTChannelJoinReason) {
        print("🎉 Apple PTT: Successfully joined channel \(channelUUID)")
        print("📱 Blue PTT button is now active in iOS status bar")
        
        Task { @MainActor in
            audioManager?.channelJoined = true
        }
    }
    
    func channelManager(_ channelManager: PTChannelManager, 
                       didLeaveChannel channelUUID: UUID, 
                       reason: PTChannelLeaveReason) {
        print("👋 Apple PTT: Left channel \(channelUUID)")
        print("📱 Blue PTT button is now inactive")
        
        Task { @MainActor in
            audioManager?.channelJoined = false
            audioManager?.isTransmitting = false
        }
    }
    
    func channelManager(_ channelManager: PTChannelManager, 
                       didBeginTransmitting channelUUID: UUID) {
        print("🎙️ Apple PTT: User started transmitting via Apple's interface")
        print("   This means the user pressed the blue button or used Speak/Listen UI")
        
        Task { @MainActor in
            audioManager?.isTransmitting = true
            audioManager?.isRecording = true
        }
        
        // Notify our external PTT manager that transmission started
        Task {
            await audioManager?.handleApplePTTTransmissionStart(channelUUID: channelUUID)
        }
    }
    
    func channelManager(_ channelManager: PTChannelManager, 
                       didEndTransmitting channelUUID: UUID) {
        print("� Apple PTT: User stopped transmitting via Apple's interface")
        
        Task { @MainActor in
            audioManager?.isTransmitting = false
            audioManager?.isRecording = false
            audioManager?.audioLevel = 0.0
        }
        
        // Notify our external PTT manager that transmission ended
        Task {
            await audioManager?.handleApplePTTTransmissionEnd(channelUUID: channelUUID)
        }
    }
    
    func channelManager(_ channelManager: PTChannelManager, 
                       receivedEphemeralPushToken pushToken: Data) {
        print("📱 Apple PTT: Received ephemeral push token")
        
        // Forward push token to server
        Task {
            await audioManager?.sendPushTokenToServer(pushToken)
        }
    }
    
    func channelManager(_ channelManager: PTChannelManager, 
                       channelUUID: UUID, 
                       didActivate audioSession: AVAudioSession) {
        print("🔊 Apple PTT: Audio session activated for channel \(channelUUID)")
        // Apple has activated the audio session - they handle all audio processing
    }
    
    func channelManager(_ channelManager: PTChannelManager, 
                       channelUUID: UUID, 
                       didDeactivate audioSession: AVAudioSession) {
        print("🔇 Apple PTT: Audio session deactivated for channel \(channelUUID)")
        // Apple has deactivated the audio session
    }
    
    func incomingPushResult(channelManager: PTChannelManager, 
                           channelUUID: UUID, 
                           pushPayload: [String: Any]) -> PTPushResult {
        print("📱 Apple PTT: Incoming push for channel: \(channelUUID)")
        // Return appropriate result based on app state
        return .leaveChannel
    }
    
    func channelManager(_ channelManager: PTChannelManager, 
                       serviceStatusDidChange serviceStatus: PTServiceStatus) {
        print("🔄 Apple PTT: Service status changed to: \(serviceStatus)")
        // Handle service status changes if needed
    }
    
    // MARK: - PTChannelRestorationDelegate
    
    func channelDescriptor(restoredChannelUUID channelUUID: UUID) -> PTChannelDescriptor {
        print("🔄 Apple PTT: Restoring channel descriptor for: \(channelUUID)")
        
        // Create a default descriptor for restored channels
        return PTChannelDescriptor(
            name: "Restored ParaWave Channel", 
            image: nil
        )
    }
    
    func channelManager(_ channelManager: PTChannelManager, 
                       didActivate audioSession: AVAudioSession) {
        print("🔊 Apple PTT: Audio session activated during restoration")
    }
    
    func channelManager(_ channelManager: PTChannelManager, 
                       didDeactivate audioSession: AVAudioSession) {
        print("🔇 Apple PTT: Audio session deactivated during restoration")
    }
}

#if DEBUG
// MARK: - Debug Extension
extension PTTAudioManager {
    
    public func debugPrintApplePTTStatus() {
        print("=== Apple PushToTalk Framework Status ===")
        print("Framework initialized: \(channelManager != nil ? "✅ YES" : "❌ NO")")
        print("Active channel UUID: \(activeChannelUUID?.uuidString ?? "none")")
        print("Channel name: \(channelDescriptor?.name ?? "none")")
        print("Channel joined: \(channelJoined)")
        print("Is transmitting: \(isTransmitting)")
        print("Is recording: \(isRecording)")
        print("========================================")
        print("📝 Note: All audio processing is handled by Apple's framework")
        print("📱 Look for the blue PTT button in the iOS status bar")
        print("🎙️ Transmission is controlled by Apple's Speak/Listen interface")
    }
    
    /// Debug method for compatibility with legacy code
    public func debugPrintChannelStatus() {
        print("=== Apple PushToTalk Channel Status ===")
        print("Framework initialized: \(channelManager != nil ? "✅ YES" : "❌ NO")")
        print("Active channel UUID: \(activeChannelUUID?.uuidString ?? "none")")
        print("Channel name: \(channelDescriptor?.name ?? "none")")
        print("Channel joined: \(channelJoined)")
        print("Is transmitting: \(isTransmitting)")
        print("======================================")
    }
    
    /// Test if Apple's PushToTalk framework is working properly
    public func debugTestApplePTTFramework() {
        print("🧪 Testing Apple PushToTalk framework...")
        
        if channelManager == nil {
            print("❌ Apple's PTChannelManager is not initialized")
            print("💡 Try calling setupPTTFramework() or check PushToTalk framework setup")
        } else {
            print("✅ Apple's PTChannelManager is initialized")
        }
        
        if channelJoined {
            print("✅ Channel is joined - blue PTT button should be visible")
        } else {
            print("⚠️ No channel joined - call joinChannel() first")
        }
        
        print("🔍 Expected behavior:")
        print("  1. Blue PTT button appears in iOS status bar when channel is joined")
        print("  2. Tap button or use Apple's Speak/Listen UI to transmit")
        print("  3. didBeginTransmitting/didEndTransmitting delegates are called")
        print("  4. Apple handles ALL audio recording and processing internally")
    }
}
#endif
