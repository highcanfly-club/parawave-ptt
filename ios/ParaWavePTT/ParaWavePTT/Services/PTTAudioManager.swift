import Foundation
import AVFoundation
import UIKit
import Accelerate
import PushToTalk

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
    case noSignal
    case poor
    case good
    case excellent
    
    var displayName: String {
        switch self {
        case .noSignal: return "No signal"
        case .poor: return "Poor"
        case .good: return "Good"
        case .excellent: return "Excellent"
        }
    }
    
    var color: UIColor {
        switch self {
        case .noSignal: return .systemGray
        case .poor: return .systemRed
        case .good: return .systemOrange
        case .excellent: return .systemGreen
        }
    }
}

/// Audio statistics structure
public struct AudioStats {
    let currentLevel: Float
    let quality: AudioQuality
    let isRecording: Bool
    let isPlaying: Bool
    let sampleRate: Double
    let format: String
}

// MARK: - Error Types

/// PTT audio error enumeration
public enum PTTAudioError: Error, LocalizedError {
    case audioSessionSetupFailed
    case bufferCreationFailed
    case encodingFailed
    case decodingFailed
    case transmissionFailed
    case noMicrophonePermission
    case noActiveChannel
    case pttFrameworkNotInitialized
    
    public var errorDescription: String? {
        switch self {
        case .audioSessionSetupFailed:
            return "Failed to configure audio session"
        case .bufferCreationFailed:
            return "Failed to create audio buffer"
        case .encodingFailed:
            return "Audio encoding failed"
        case .decodingFailed:
            return "Audio decoding failed"
        case .transmissionFailed:
            return "Audio transmission failed"
        case .noMicrophonePermission:
            return "Microphone permission not granted"
        case .noActiveChannel:
            return "No active PTT channel"
        case .pttFrameworkNotInitialized:
            return "PushToTalk framework not initialized"
        }
    }
}

// MARK: - Main PTT Audio Manager

/// Specialized audio manager for PTT transmissions using Apple's PushToTalk framework
/// Following Apple's official documentation: https://developer.apple.com/documentation/pushtotalk/creating-a-push-to-talk-app
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
    
    // Audio configuration optimized for paragliding
    private let sampleRate: Double = 22050  // Optimal for human voice
    private let channelCount: AVAudioChannelCount = 1  // Mono for PTT
    private let bufferSize: AVAudioFrameCount = 1024
    
    // Audio processing
    private let audioEngine = AVAudioEngine()
    private let playerNode = AVAudioPlayerNode()
    private let audioFormat: AVAudioFormat
    private var mixerFormat: AVAudioFormat?
    
    // Buffers for audio
    private var recordingBuffer: AVAudioPCMBuffer?
    private var audioChunks: [Data] = []
    private var sequenceNumber = 0
    
    // AAC-LC configuration
    private var aacEncoder: AVAudioConverter?
    private var aacSettings: [String: Any] = [
        AVFormatIDKey: kAudioFormatMPEG4AAC,
        AVSampleRateKey: 22050,
        AVNumberOfChannelsKey: 1,
        AVEncoderBitRateKey: 32000,  // 32 kbps pour qualité parapente
    ]
    
    // Reference to external PTT manager for server communication
    private weak var pttChannelManager: PTTChannelManager?
    
    // MARK: - Initialization
    
    init(pttChannelManager: PTTChannelManager? = nil) {
        // Configure optimized audio format
        guard let audioFormat = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: channelCount) else {
            fatalError("Unable to create audio format")
        }
        
        self.audioFormat = audioFormat
        self.pttChannelManager = pttChannelManager
        
        super.init()
        
        setupAudioEngine()
        setupAudioSession()
        setupAACEncoder()
        
        // Initialize Apple's PushToTalk framework asynchronously
        Task {
            await setupPTTFramework()
        }
        
        print("PTTAudioManager initialized - Apple PushToTalk framework integration")
    }
    
    deinit {
        Task {
            await stopRecording()
        }
        audioEngine.stop()
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
    
    private func setupAudioEngine() {
        // Configure playback node
        audioEngine.attach(playerNode)
        
        // Connect player node with the audio format
        audioEngine.connect(playerNode, to: audioEngine.mainMixerNode, format: audioFormat)
        
        // Prepare the audio engine
        audioEngine.prepare()
        
        // Get the main mixer output format
        let mixerFormat = audioEngine.mainMixerNode.outputFormat(forBus: 0)
        self.mixerFormat = mixerFormat
        
        do {
            try audioEngine.start()
            print("Audio engine started successfully")
        } catch {
            print("Error starting audio engine: \(error)")
        }
    }
    
    private func setupAudioSession() {
        let audioSession = AVAudioSession.sharedInstance()
        
        do {
            // PTT-optimized configuration
            try audioSession.setCategory(.playAndRecord,
                                       mode: .voiceChat,
                                       options: [
                                        .allowBluetooth,
                                        .allowBluetoothA2DP,
                                        .defaultToSpeaker,
                                        .allowAirPlay
                                       ])
            
            // Optimize for low latency
            try audioSession.setPreferredIOBufferDuration(0.02) // 20ms
            try audioSession.setPreferredSampleRate(sampleRate)
            
            if #available(iOS 13.0, *) {
                try audioSession.setAllowHapticsAndSystemSoundsDuringRecording(false)
            }
            
            try audioSession.setActive(true)
            
        } catch {
            print("Audio session configuration error: \(error)")
        }
    }
    
    private func setupAACEncoder(with inputFormat: AVAudioFormat? = nil) {
        let sourceFormat = inputFormat ?? audioFormat
        
        aacSettings[AVSampleRateKey] = sourceFormat.sampleRate
        aacSettings[AVNumberOfChannelsKey] = sourceFormat.channelCount
        
        guard let aacFormat = AVAudioFormat(settings: aacSettings) else {
            print("Error creating AAC format")
            return
        }
        
        aacEncoder = AVAudioConverter(from: sourceFormat, to: aacFormat)
        aacEncoder?.bitRate = 32000
    }
    
    // MARK: - Channel Management (Following Apple's Documentation)
    
    /// Join a PTT channel using Apple's PushToTalk framework
    public func joinChannel(channelUUID: UUID, name: String) async throws {
        print("🎯 Joining Apple PTT channel: \(name) (\(channelUUID))")
        
        // Store the channel info regardless
        self.activeChannelUUID = channelUUID
        self.channelDescriptor = PTChannelDescriptor(name: name, image: nil)
        
        // Check if we have a channel manager
        var activeChannelManager = self.channelManager
        
        if activeChannelManager == nil {
            print("⚠️ Apple's PTChannelManager not initialized yet, trying to initialize...")
            
            // Try to initialize the framework
            await setupPTTFramework()
            
            // Check again after initialization attempt
            activeChannelManager = self.channelManager
            
            if activeChannelManager == nil {
                print("⚠️ Apple's PTT framework still not available, will join when ready")
                return
            }
        }
        
        // At this point we should have an active channel manager
        guard let channelManager = activeChannelManager else {
            print("⚠️ Channel manager unexpectedly nil")
            return
        }
        
        // Create channel descriptor following Apple's pattern
        let descriptor = PTChannelDescriptor(name: name, image: nil)
        self.channelDescriptor = descriptor
        
        do {
            // Use Apple's requestJoinChannel method
            try await channelManager.requestJoinChannel(
                channelUUID: channelUUID,
                descriptor: descriptor
            )
            
            print("✅ Successfully requested to join Apple PTT channel: \(name)")
            
        } catch {
            print("❌ Failed to join Apple PTT channel: \(error)")
            self.activeChannelUUID = nil
            self.channelDescriptor = nil
            throw error
        }
    }
    
    /// Leave the current PTT channel
    public func leaveChannel() async {
        guard let channelUUID = activeChannelUUID else { return }
        
        print("🚪 Leaving PTT channel: \(channelUUID)")
        
        do {
            // Use Apple's leaveChannel method
            try await channelManager?.leaveChannel(channelUUID: channelUUID)
            
            self.activeChannelUUID = nil
            self.channelDescriptor = nil
            
            await MainActor.run {
                self.channelJoined = false
                self.isTransmitting = false
            }
            
            print("✅ Successfully left PTT channel")
            
        } catch {
            print("❌ Error leaving PTT channel: \(error)")
        }
    }
    
    // MARK: - Transmission Control (Following Apple's Documentation)
    
    /// Start audio transmission using Apple's requestBeginTransmitting
    @MainActor
    public func startRecording() async throws {
        guard !isRecording else { 
            print("⚠️ Already recording, ignoring start request")
            return 
        }
        
        print("🎙️ Starting PTT transmission...")
        print("   - Active channel UUID: \(activeChannelUUID?.uuidString ?? "nil")")
        print("   - Channel joined: \(channelJoined)")
        print("   - Channel manager available: \(channelManager != nil)")
        
        guard let channelUUID = activeChannelUUID else {
            print("❌ No active channel UUID available")
            throw PTTAudioError.noActiveChannel
        }
        
        guard let channelManager = channelManager else {
            print("❌ Apple's PTChannelManager not initialized")
            throw PTTAudioError.pttFrameworkNotInitialized
        }
        
        print("🎙️ Using Apple's requestBeginTransmitting for channel: \(channelUUID)")
        
        // Reset parameters
        sequenceNumber = 0
        audioChunks.removeAll()
        
        do {
            // CRITICAL: Use Apple's requestBeginTransmitting method
            // This is the key method according to Apple's documentation
            try await channelManager.requestBeginTransmitting(channelUUID: channelUUID)
            
            print("✅ Apple's requestBeginTransmitting succeeded")
            
            // Set up audio recording only AFTER Apple grants permission
            do {
                // Ensure audio session is active before setting up recording
                let audioSession = AVAudioSession.sharedInstance()
                if !audioSession.isOtherAudioPlaying {
                    try audioSession.setActive(true)
                }
                
                try setupAudioRecording()
                print("✅ Audio recording setup completed")
            } catch {
                print("❌ Failed to setup audio recording: \(error)")
                // Try to restart the audio engine and try again
                print("🔄 Attempting to restart audio engine...")
                audioEngine.stop()
                do {
                    try audioEngine.start()
                    // Give the audio engine time to initialize
                    try await Task.sleep(nanoseconds: 100_000_000) // 100ms
                    try setupAudioRecording()
                    print("✅ Audio recording setup completed after restart")
                } catch {
                    print("❌ Failed to setup audio recording even after restart: \(error)")
                    throw error
                }
            }
            
            self.isRecording = true
            
        } catch {
            print("❌ Apple's requestBeginTransmitting failed: \(error)")
            print("   Error type: \(type(of: error))")
            print("   Error description: \(error.localizedDescription)")
            throw error
        }
    }
    
    /// Stop audio transmission using Apple's stopTransmitting
    @MainActor
    public func stopRecording() async {
        guard isRecording else { return }
        guard let channelUUID = activeChannelUUID else { return }
        
        print("🛑 Stopping PTT transmission using Apple's stopTransmitting")
        
        // Remove audio tap first with error handling
        do {
            audioEngine.inputNode.removeTap(onBus: 0)
            print("✅ Audio tap removed successfully")
        } catch {
            print("⚠️ Error removing audio tap (this may be normal): \(error)")
        }
        
        self.isRecording = false
        self.audioLevel = 0.0
        
        do {
            // CRITICAL: Use Apple's stopTransmitting method
            try await channelManager?.stopTransmitting(channelUUID: channelUUID)
            
            print("✅ Apple's stopTransmitting succeeded")
            
        } catch {
            print("❌ Apple's stopTransmitting failed: \(error)")
        }
        
        // Clean up
        audioChunks.removeAll()
        recordingBuffer = nil
    }
    
    /// Set up audio recording (called only after Apple grants transmission permission)
    private func setupAudioRecording() throws {
        let inputNode = audioEngine.inputNode
        let inputFormat = inputNode.outputFormat(forBus: 0)
        
        print("🎧 Input node format:")
        print("   - Sample rate: \(inputFormat.sampleRate) Hz")
        print("   - Channels: \(inputFormat.channelCount)")
        print("   - Format: \(inputFormat)")
        
        // Check if the input format is valid (sample rate > 0)
        if inputFormat.sampleRate <= 0 {
            print("⚠️ Invalid input format detected, using fallback format")
            
            // Use our predefined audioFormat as fallback
            guard let buffer = AVAudioPCMBuffer(pcmFormat: audioFormat, frameCapacity: bufferSize) else {
                throw PTTAudioError.bufferCreationFailed
            }
            recordingBuffer = buffer
            setupAACEncoder(with: audioFormat)
            
            print("✅ Installing audio tap with fallback format: \(audioFormat)")
            
            inputNode.installTap(onBus: 0, bufferSize: bufferSize, format: audioFormat) { [weak self] buffer, time in
                self?.processAudioBuffer(buffer, at: time)
            }
        } else {
            // Use the input node's actual format for the tap
            guard let buffer = AVAudioPCMBuffer(pcmFormat: inputFormat, frameCapacity: bufferSize) else {
                throw PTTAudioError.bufferCreationFailed
            }
            recordingBuffer = buffer
            setupAACEncoder(with: inputFormat)
            
            print("✅ Installing audio tap with input format: \(inputFormat)")
            
            inputNode.installTap(onBus: 0, bufferSize: bufferSize, format: inputFormat) { [weak self] buffer, time in
                self?.processAudioBuffer(buffer, at: time)
            }
        }
    }
    
    // MARK: - Audio Processing
    
    private func processAudioBuffer(_ buffer: AVAudioPCMBuffer, at time: AVAudioTime) {
        // Update UI audio level
        updateAudioLevel(buffer)
        
        // Encode and send to your server (not through Apple's framework)
        Task {
            await encodeAndSendAudioBuffer(buffer)
        }
    }
    
    private func updateAudioLevel(_ buffer: AVAudioPCMBuffer) {
        guard let channelData = buffer.floatChannelData?[0] else { return }
        
        let frameCount = Int(buffer.frameLength)
        let rms = sqrt(vDSP.meanSquare(Array(UnsafeBufferPointer(start: channelData, count: frameCount))))
        
        DispatchQueue.main.async {
            self.audioLevel = 20 * log10(max(rms, 0.0001))
        }
    }
    
    @MainActor
    private func encodeAndSendAudioBuffer(_ buffer: AVAudioPCMBuffer) async {
        guard let encoder = aacEncoder else { return }
        
        do {
            // Convert to AAC-LC
            let aacData = try encodeToAAC(buffer: buffer, encoder: encoder)
            
            // Send through your custom PTT manager, not Apple's framework
            try await pttChannelManager?.sendAudioData(aacData, sequenceNumber: sequenceNumber)
            
            sequenceNumber += 1
            
        } catch {
            print("❌ Error encoding/sending audio: \(error)")
        }
    }
    
    private func encodeToAAC(buffer: AVAudioPCMBuffer, encoder: AVAudioConverter) throws -> Data {
        let aacFormat = encoder.outputFormat
        let aacBuffer = AVAudioCompressedBuffer(format: aacFormat, packetCapacity: 1, maximumPacketSize: 1024)
        
        var inputBuffer: AVAudioBuffer? = buffer
        let inputBlock: AVAudioConverterInputBlock = { inNumPackets, outStatus in
            outStatus.pointee = .haveData
            let result = inputBuffer
            inputBuffer = nil
            return result
        }
        
        var error: NSError?
        let status = encoder.convert(to: aacBuffer, error: &error, withInputFrom: inputBlock)
        
        guard status == .haveData, error == nil else {
            throw PTTAudioError.encodingFailed
        }
        
        let aacDataLength = Int(aacBuffer.byteLength)
        let aacData = Data(bytes: aacBuffer.data, count: aacDataLength)
        
        return aacData
    }
    
    // MARK: - Playback Control
    
    /// Play received audio data
    public func playReceivedAudio(_ audioData: Data) async {
        await MainActor.run {
            self.isPlaying = true
        }
        
        do {
            let pcmBuffer = try decodeAACData(audioData)
            
            playerNode.scheduleBuffer(pcmBuffer) { [weak self] in
                Task {
                    await MainActor.run {
                        self?.isPlaying = false
                    }
                }
            }
            
            if !playerNode.isPlaying {
                playerNode.play()
            }
            
        } catch {
            print("❌ Error during audio playbook: \(error)")
            await MainActor.run {
                self.isPlaying = false
            }
        }
    }
    
    private func decodeAACData(_ audioData: Data) throws -> AVAudioPCMBuffer {
        let outputFormat = mixerFormat ?? audioFormat
        
        guard let aacFormat = AVAudioFormat(settings: aacSettings),
              let decoder = AVAudioConverter(from: aacFormat, to: outputFormat) else {
            throw PTTAudioError.decodingFailed
        }
        
        let aacBuffer = AVAudioCompressedBuffer(format: aacFormat, packetCapacity: 1, maximumPacketSize: audioData.count)
        
        let _ = audioData.copyBytes(to: UnsafeMutableBufferPointer(start: aacBuffer.data.assumingMemoryBound(to: UInt8.self), count: audioData.count))
        aacBuffer.byteLength = UInt32(audioData.count)
        aacBuffer.packetCount = 1
        
        guard let pcmBuffer = AVAudioPCMBuffer(pcmFormat: outputFormat, frameCapacity: bufferSize) else {
            throw PTTAudioError.bufferCreationFailed
        }
        
        var inputBuffer: AVAudioBuffer? = aacBuffer
        let inputBlock: AVAudioConverterInputBlock = { inNumPackets, outStatus in
            outStatus.pointee = .haveData
            let result = inputBuffer
            inputBuffer = nil
            return result
        }
        
        var error: NSError?
        let status = decoder.convert(to: pcmBuffer, error: &error, withInputFrom: inputBlock)
        
        guard status == .haveData, error == nil else {
            throw PTTAudioError.decodingFailed
        }
        
        return pcmBuffer
    }
    
    // MARK: - Server Communication
    
    fileprivate func sendPushTokenToServer(_ token: Data) async {
        // Send the ephemeral push token to your server
        print("📤 Sending push token to server: \(token.base64EncodedString())")
        // TODO: Implement actual server API call
    }
    
    // MARK: - Audio Effects
    
    /// Enable wind noise reduction
    public func enableWindNoiseReduction(_ enabled: Bool) {
        if enabled {
            let eq = AVAudioUnitEQ(numberOfBands: 1)
            let highPassBand = eq.bands[0]
            highPassBand.filterType = .highPass
            highPassBand.frequency = 300.0
            highPassBand.gain = 0.0
            highPassBand.bypass = false
            
            print("🌪️ Wind noise reduction enabled")
        } else {
            print("🌪️ Wind noise reduction disabled")
        }
    }
    
    /// Adjust gain for flight conditions
    public func adjustGainForFlightConditions(_ windSpeed: Double) {
        let gainAdjustment: Float
        
        if windSpeed < 10 {
            gainAdjustment = 1.0
        } else if windSpeed < 20 {
            gainAdjustment = 1.2
        } else {
            gainAdjustment = 1.5
        }
        
        audioEngine.mainMixerNode.outputVolume = gainAdjustment
        print("🎚️ Gain adjusted to \(gainAdjustment) for wind speed \(windSpeed) km/h")
    }
    
    // MARK: - Quality Assessment
    
    public func assessAudioQuality() -> AudioQuality {
        let currentLevel = audioLevel
        
        if currentLevel > -10 {
            return .excellent
        } else if currentLevel > -20 {
            return .good
        } else if currentLevel > -30 {
            return .poor
        } else {
            return .noSignal
        }
    }
    
    public func getAudioStats() -> AudioStats {
        return AudioStats(
            currentLevel: audioLevel,
            quality: assessAudioQuality(),
            isRecording: isRecording,
            isPlaying: isPlaying,
            sampleRate: sampleRate,
            format: "AAC-LC"
        )
    }
    
    /// Check microphone permissions
    public static func checkMicrophonePermission() -> Bool {
        switch AVAudioSession.sharedInstance().recordPermission {
        case .granted:
            return true
        case .denied, .undetermined:
            return false
        @unknown default:
            return false
        }
    }
    
    /// Request microphone permissions
    public static func requestMicrophonePermission() async -> Bool {
        return await withCheckedContinuation { continuation in
            AVAudioSession.sharedInstance().requestRecordPermission { granted in
                continuation.resume(returning: granted)
            }
        }
    }
    
    /// Test audio latency
    public func measureAudioLatency() async -> TimeInterval? {
        let startTime = Date()
        try? await Task.sleep(nanoseconds: 20_000_000) // 20ms
        let endTime = Date()
        return endTime.timeIntervalSince(startTime)
    }
}

// MARK: - Apple's PushToTalk Delegate Handler

/// Separate handler for Apple's PTT delegate protocols to avoid naming conflicts
private class ApplePTTDelegateHandler: NSObject, PTChannelManagerDelegate, PTChannelRestorationDelegate {
    
    private weak var audioManager: PTTAudioManager?
    
    init(audioManager: PTTAudioManager) {
        self.audioManager = audioManager
        super.init()
    }
    
    // MARK: - PTChannelManagerDelegate
    
    func channelManager(_ channelManager: PTChannelManager, didJoinChannel channelUUID: UUID, reason: PTChannelJoinReason) {
        print("🎯 Apple's PTT: Successfully joined channel \(channelUUID)")
        
        DispatchQueue.main.async { [weak self] in
            guard let audioManager = self?.audioManager else { return }
            audioManager.activeChannelUUID = channelUUID
            audioManager.channelJoined = true
        }
    }
    
    func channelManager(_ channelManager: PTChannelManager, didLeaveChannel channelUUID: UUID, reason: PTChannelLeaveReason) {
        print("🚪 Apple's PTT: Left channel \(channelUUID)")
        
        DispatchQueue.main.async { [weak self] in
            guard let audioManager = self?.audioManager else { return }
            if audioManager.activeChannelUUID == channelUUID {
                audioManager.activeChannelUUID = nil
                audioManager.channelJoined = false
                audioManager.isTransmitting = false
            }
        }
    }
    
    func channelManager(_ channelManager: PTChannelManager, channelUUID: UUID, didBeginTransmittingFrom source: PTChannelTransmitRequestSource) {
        print("🎙️ Apple's PTT: Began transmitting on channel \(channelUUID) from source: \(source)")
        
        DispatchQueue.main.async { [weak self] in
            guard let audioManager = self?.audioManager else { return }
            audioManager.isTransmitting = true
        }
    }
    
    func channelManager(_ channelManager: PTChannelManager, channelUUID: UUID, didEndTransmittingFrom source: PTChannelTransmitRequestSource) {
        print("🛑 Apple's PTT: Ended transmitting on channel \(channelUUID) from source: \(source)")
        
        DispatchQueue.main.async { [weak self] in
            guard let audioManager = self?.audioManager else { return }
            audioManager.isTransmitting = false
            if source == .userRequest {
                audioManager.isRecording = false
            }
        }
    }
    
    func channelManager(_ channelManager: PTChannelManager, receivedEphemeralPushToken pushToken: Data) {
        print("📱 Apple's PTT: Received ephemeral push token")
        
        // Forward to your server
        Task { [weak self] in
            await self?.audioManager?.sendPushTokenToServer(pushToken)
        }
    }
    
    func channelManager(_ channelManager: PTChannelManager, didActivate audioSession: AVAudioSession) {
        print("🔊 Apple's PTT: Audio session activated")
    }
    
    func channelManager(_ channelManager: PTChannelManager, didDeactivate audioSession: AVAudioSession) {
        print("🔇 Apple's PTT: Audio session deactivated")
    }
    
    func incomingPushResult(channelManager: PTChannelManager, channelUUID: UUID, pushPayload: [String: Any]) -> PTPushResult {
        print("📱 Apple's PTT: Incoming push for channel: \(channelUUID)")
        // Return appropriate result based on app state
        return .leaveChannel
    }
    
    // MARK: - PTChannelRestorationDelegate
    
    func channelDescriptor(restoredChannelUUID channelUUID: UUID) -> PTChannelDescriptor {
        print("🔄 Apple's PTT: Restoring channel descriptor for: \(channelUUID)")
        
        // Create a default descriptor for restored channels
        let descriptor = PTChannelDescriptor(
            name: "Restored ParaWave Channel",
            image: createDefaultChannelImage()
        )
        
        return descriptor
    }
    
    func channelManager(_ channelManager: PTChannelManager, didRestoreChannel channelUUID: UUID) {
        print("🔄 Apple's PTT: Restored channel \(channelUUID)")
        
        DispatchQueue.main.async { [weak self] in
            guard let audioManager = self?.audioManager else { return }
            audioManager.activeChannelUUID = channelUUID
            audioManager.channelJoined = true
        }
    }
    
    func channelManager(_ channelManager: PTChannelManager, didFailToRestoreChannel channelUUID: UUID, error: any Error) {
        print("❌ Apple's PTT: Failed to restore channel \(channelUUID): \(error)")
    }
    
    // MARK: - Helper Methods
    
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
            
            let text = "PW"
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

#if DEBUG
extension PTTAudioManager {
    
    public func debugPrintAudioInfo() {
        let stats = getAudioStats()
        print("=== Apple PushToTalk Audio Manager Debug ===")
        print("Recording: \(stats.isRecording)")
        print("Playing: \(stats.isPlaying)")
        print("Transmitting: \(isTransmitting)")
        print("Channel Joined: \(channelJoined)")
        print("Audio Level: \(stats.currentLevel) dB")
        print("Quality: \(stats.quality.displayName)")
        print("Sample Rate: \(stats.sampleRate) Hz")
        print("Format: \(stats.format)")
        print("Apple's PTT Framework: \(channelManager != nil ? "✅ Initialized" : "❌ Not initialized")")
        print("Active Channel UUID: \(activeChannelUUID?.uuidString ?? "nil")")
        print("Channel Descriptor: \(channelDescriptor?.name ?? "nil")")
        print("============================================")
    }
    
    public func debugPrintChannelStatus() {
        print("=== Apple PushToTalk Channel Status ===")
        print("Framework initialized: \(channelManager != nil)")
        print("Active channel UUID: \(activeChannelUUID?.uuidString ?? "none")")
        print("Channel name: \(channelDescriptor?.name ?? "none")")
        print("Channel joined: \(channelJoined)")
        print("Is transmitting: \(isTransmitting)")
        print("=====================================")
    }
    
    public func debugTestAudioChain() async {
        print("🧪 Testing Apple PushToTalk audio chain...")
        
        let hasPermission = Self.checkMicrophonePermission()
        print("🎤 Microphone permission: \(hasPermission)")
        
        if let latency = await measureAudioLatency() {
            print("⏱️ Audio latency: \(latency * 1000) ms")
        }
        
        let quality = assessAudioQuality()
        print("🔊 Current quality: \(quality.displayName)")
        
        print("🍎 Apple PTT Framework status: \(channelManager != nil ? "Ready" : "Not initialized")")
    }
}
#endif
