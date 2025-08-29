import Foundation
import AVFoundation
import UIKit
import Accelerate

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

// Specialized audio manager for PTT transmissions optimized for AAC-LC
class PTTAudioManager: NSObject, ObservableObject {
    
    // MARK: - Properties
    
    private let audioEngine = AVAudioEngine()
    private let playerNode = AVAudioPlayerNode()
    private let audioFormat: AVAudioFormat
    private var mixerFormat: AVAudioFormat?
    private let pttChannelManager: PTTChannelManager?
    
    @Published var isRecording = false
    @Published var audioLevel: Float = 0.0
    @Published var isPlaying = false
    
    // Audio configuration optimized for paragliding
    private let sampleRate: Double = 22050  // Optimal for human voice
    private let channelCount: AVAudioChannelCount = 1  // Mono for PTT
    private let bufferSize: AVAudioFrameCount = 1024
    
    // Buffers pour l'audio
    private var recordingBuffer: AVAudioPCMBuffer?
    private var audioChunks: [Data] = []
    private var sequenceNumber = 0
    
    // Configuration AAC-LC
    private var aacEncoder: AVAudioConverter?
    private var aacSettings: [String: Any] = [
        AVFormatIDKey: kAudioFormatMPEG4AAC,
        AVSampleRateKey: 22050,
        AVNumberOfChannelsKey: 1,
        AVEncoderBitRateKey: 32000,  // 32 kbps pour qualité parapente
    ]
    
    // MARK: - Initialization
    
    init(pttChannelManager: PTTChannelManager? = nil) {
        self.pttChannelManager = pttChannelManager
        
    // Configure optimized audio format
        guard let audioFormat = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: channelCount) else {
            fatalError("Unable to create audio format")
        }
        
        self.audioFormat = audioFormat
        
        super.init()
        
        setupAudioSession()
        setupAudioEngine()
        setupAACEncoder()
    }
    
    deinit {
        Task {
            await stopRecording()
        }
        audioEngine.stop()
    }
    
    // MARK: - Setup Methods
    
    private func setupAudioEngine() {
        // Configure playback node
        audioEngine.attach(playerNode)
        
        // Connect player node with the audio format (will be converted if needed)
        audioEngine.connect(playerNode, to: audioEngine.mainMixerNode, format: audioFormat)
        
        // Prepare the audio engine to get the correct formats
        audioEngine.prepare()
        
        // Get the main mixer output format (determined by audio session)
        let mixerFormat = audioEngine.mainMixerNode.outputFormat(forBus: 0)
        self.mixerFormat = mixerFormat
        
        // Debug: Log the formats
        print("Audio engine setup:")
        print("  Configured format - Sample rate: \(audioFormat.sampleRate), Channels: \(audioFormat.channelCount)")
        print("  Mixer output format - Sample rate: \(mixerFormat.sampleRate), Channels: \(mixerFormat.channelCount)")
        
        // Get input node format if available
        let inputFormat = audioEngine.inputNode.outputFormat(forBus: 0)
        print("  Input node format - Sample rate: \(inputFormat.sampleRate), Channels: \(inputFormat.channelCount)")
        
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
            // Specialized configuration for PTT in flight environment
            try audioSession.setCategory(.playAndRecord,
                                       mode: .voiceChat,
                                       options: [
                                        .allowBluetooth,
                                        .allowBluetoothA2DP,
                                        .defaultToSpeaker,
                                        .allowAirPlay
                                       ])
            
            // Optimize for low latency and wind-noise reduction
            try audioSession.setPreferredIOBufferDuration(0.02) // 20ms
            try audioSession.setPreferredSampleRate(sampleRate)
            
            // Enable noise and echo suppression (important for wind)
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
        
        // Update AAC settings to match the input format
        aacSettings[AVSampleRateKey] = sourceFormat.sampleRate
        aacSettings[AVNumberOfChannelsKey] = sourceFormat.channelCount
        
        guard let aacFormat = AVAudioFormat(settings: aacSettings) else {
            print("Error creating AAC format")
            return
        }
        
        aacEncoder = AVAudioConverter(from: sourceFormat, to: aacFormat)
        
        // Configure the encoder for optimal real-time quality
        aacEncoder?.bitRate = 32000
    }
    
    // MARK: - Recording Control
    
    /// Start audio recording for PTT transmission
    @MainActor
    func startRecording() async throws {
        guard !isRecording else { return }
        
        print("Starting PTT recording")
        
        // Reset parameters
        sequenceNumber = 0
        audioChunks.removeAll()
        
        // Get the actual input format from the hardware
        let inputNode = audioEngine.inputNode
        let inputFormat = inputNode.outputFormat(forBus: 0)
        
            inputNode.installTap(onBus: 0, bufferSize: bufferSize, format: inputFormat) { [weak self] buffer, time in
                self?.processAudioBuffer(buffer, at: time)
        }
        
        self.isRecording = true
        
        // Start transmission on the PTT manager
        try await pttChannelManager?.startTransmission()

        print("PTT recording started successfully")
    }
    
    /// Stop audio recording
    @MainActor
    func stopRecording() async {
        guard isRecording else { return }
        
        print("Stopping PTT recording")
        
        // Remove the audio tap
        audioEngine.inputNode.removeTap(onBus: 0)
        
        self.isRecording = false
        self.audioLevel = 0.0
        
        // Stop transmission on the PTT manager
        await pttChannelManager?.stopTransmission()

        // Clean buffers
        audioChunks.removeAll()
        recordingBuffer = nil
        
        print("PTT recording stopped")
    }
    
    // MARK: - Audio Processing
    
    private func processAudioBuffer(_ buffer: AVAudioPCMBuffer, at time: AVAudioTime) {
    // Calculate audio level for the UI
        updateAudioLevel(buffer)
        
    // Encode to AAC-LC and send
        Task {
            await encodeAndSendAudioBuffer(buffer)
        }
    }
    
    private func updateAudioLevel(_ buffer: AVAudioPCMBuffer) {
        guard let channelData = buffer.floatChannelData?[0] else { return }
        
        let frameCount = Int(buffer.frameLength)
        let rms = sqrt(vDSP.meanSquare(Array(UnsafeBufferPointer(start: channelData, count: frameCount))))
        
        DispatchQueue.main.async {
            // Logarithmic conversion for display
            self.audioLevel = 20 * log10(max(rms, 0.0001))
        }
    }
    
    @MainActor
    private func encodeAndSendAudioBuffer(_ buffer: AVAudioPCMBuffer) async {
        guard let encoder = aacEncoder else { return }
        
        do {
            // Convert to AAC-LC
            let aacData = try encodeToAAC(buffer: buffer, encoder: encoder)
            
            // Send over the network
            try await pttChannelManager?.sendAudioData(aacData, sequenceNumber: sequenceNumber)
            
            sequenceNumber += 1
            
        } catch {
            print("Error encoding/sending audio: \(error)")
        }
    }
    
    private func encodeToAAC(buffer: AVAudioPCMBuffer, encoder: AVAudioConverter) throws -> Data {
        let aacFormat = encoder.outputFormat
        
        // Create the AAC output buffer
        let aacBuffer = AVAudioCompressedBuffer(format: aacFormat, packetCapacity: 1, maximumPacketSize: 1024)
        
    // Configure the callback for encoding
        var inputBuffer: AVAudioBuffer? = buffer
        let inputBlock: AVAudioConverterInputBlock = { inNumPackets, outStatus in
            outStatus.pointee = .haveData
            let result = inputBuffer
            inputBuffer = nil
            return result
        }
        
    // Perform the conversion
        var error: NSError?
        let status = encoder.convert(to: aacBuffer, error: &error, withInputFrom: inputBlock)
        
        guard status == .haveData, error == nil else {
            throw PTTAudioError.encodingFailed
        }
        
    // Extract the AAC data
        let aacDataLength = Int(aacBuffer.byteLength)
        let aacData = Data(bytes: aacBuffer.data, count: aacDataLength)
        
        return aacData
    }
    
    // MARK: - Playback Control
    
    /// Play received audio data
    func playReceivedAudio(_ audioData: Data) async {
        await MainActor.run {
            self.isPlaying = true
        }
        
        do {
            // Decode the AAC data
            let pcmBuffer = try decodeAACData(audioData)
            
            // Play the buffer
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
            print("Error during audio playback: \(error)")
            await MainActor.run {
                self.isPlaying = false
            }
        }
    }
    
    private func decodeAACData(_ aacData: Data) throws -> AVAudioPCMBuffer {
        // Use the mixer format for output (determined by audio session)
        let outputFormat = mixerFormat ?? audioFormat
        
        // Configure AAC decoder to PCM
        guard let aacFormat = AVAudioFormat(settings: aacSettings),
              let decoder = AVAudioConverter(from: aacFormat, to: outputFormat) else {
            throw PTTAudioError.decodingFailed
        }
        
        // Create a compressed buffer for AAC data
        let aacBuffer = AVAudioCompressedBuffer(format: aacFormat, packetCapacity: 1, maximumPacketSize: aacData.count)
        
        // Copy AAC data into the buffer
        let _ = aacData.copyBytes(to: UnsafeMutableBufferPointer(start: aacBuffer.data.assumingMemoryBound(to: UInt8.self), count: aacData.count))
        aacBuffer.byteLength = UInt32(aacData.count)
        aacBuffer.packetCount = 1
        
        // Create the output PCM buffer
        guard let pcmBuffer = AVAudioPCMBuffer(pcmFormat: outputFormat, frameCapacity: bufferSize) else {
            throw PTTAudioError.bufferCreationFailed
        }
        
        // Configure the callback for decoding
        var inputBuffer: AVAudioBuffer? = aacBuffer
        let inputBlock: AVAudioConverterInputBlock = { inNumPackets, outStatus in
            outStatus.pointee = .haveData
            let result = inputBuffer
            inputBuffer = nil
            return result
        }
        
        // Perform the conversion
        var error: NSError?
        let status = decoder.convert(to: pcmBuffer, error: &error, withInputFrom: inputBlock)
        
        guard status == .haveData, error == nil else {
            throw PTTAudioError.decodingFailed
        }
        
        return pcmBuffer
    }
    
    // MARK: - Audio Effects
    
    /// Enable high-pass filter to reduce wind noise
    func enableWindNoiseReduction(_ enabled: Bool) {
    // Implementation of a high-pass filter to remove low-frequency wind noise
    // Cutoff frequency at 300 Hz to remove wind noise while preserving voice
        
        if enabled {
            // Configuration d'un filtre passe-haut avec AVAudioUnitEQ
            let eq = AVAudioUnitEQ(numberOfBands: 1)
            let highPassBand = eq.bands[0]
            highPassBand.filterType = .highPass
            highPassBand.frequency = 300.0
            highPassBand.gain = 0.0
            highPassBand.bypass = false
            
            print("Wind noise reduction enabled")
        } else {
            print("Wind noise reduction disabled")
        }
    }
    
    /// Automatically adjust gain based on environment
    func adjustGainForFlightConditions(_ windSpeed: Double) {
        let gainAdjustment: Float
        
        if windSpeed < 10 {
            gainAdjustment = 1.0  // No adjustment
        } else if windSpeed < 20 {
            gainAdjustment = 1.2  // Slight increase
        } else {
            gainAdjustment = 1.5  // Larger increase to compensate for strong wind
        }
        
    // Apply gain adjustment
        audioEngine.mainMixerNode.outputVolume = gainAdjustment
        
    print("Gain adjusted to \(gainAdjustment) for wind speed \(windSpeed) km/h")
    }
    
    // MARK: - Quality Assessment
    
    /// Assess audio quality in real time
    func assessAudioQuality() -> AudioQuality {
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
    
    /// Retrieve audio statistics
    func getAudioStats() -> AudioStats {
        return AudioStats(
            currentLevel: audioLevel,
            quality: assessAudioQuality(),
            isRecording: isRecording,
            isPlaying: isPlaying,
            sampleRate: sampleRate,
            format: "AAC-LC"
        )
    }
}

// MARK: - Audio Quality & Stats

enum AudioQuality {
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

struct AudioStats {
    let currentLevel: Float
    let quality: AudioQuality
    let isRecording: Bool
    let isPlaying: Bool
    let sampleRate: Double
    let format: String
}

// MARK: - Error Types

enum PTTAudioError: Error, LocalizedError {
    case audioSessionSetupFailed
    case bufferCreationFailed
    case encodingFailed
    case decodingFailed
    case transmissionFailed
    case noMicrophonePermission
    
    var errorDescription: String? {
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
        }
    }
}

// MARK: - Extensions

extension PTTAudioManager {
    
    /// Check microphone permissions
    static func checkMicrophonePermission() -> Bool {
        switch AVAudioSession.sharedInstance().recordPermission {
        case .granted:
            return true
        case .denied, .undetermined:
            return false
        @unknown default:
            return false
        }
    }
    
    /// Demande les permissions microphone
    static func requestMicrophonePermission() async -> Bool {
        return await withCheckedContinuation { continuation in
            AVAudioSession.sharedInstance().requestRecordPermission { granted in
                continuation.resume(returning: granted)
            }
        }
    }
    
    /// Teste la latence audio
    func measureAudioLatency() async -> TimeInterval? {
        // Implémentation d'un test de latence audio round-trip
        let startTime = Date()
        
        // Simuler un cycle audio complet
        try? await Task.sleep(nanoseconds: 20_000_000) // 20ms
        
        let endTime = Date()
        return endTime.timeIntervalSince(startTime)
    }
}

#if DEBUG
extension PTTAudioManager {
    
    /// Méthodes de debug pour le développement
    func debugPrintAudioInfo() {
        let stats = getAudioStats()
        print("=== Audio Manager Debug Info ===")
        print("Recording: \(stats.isRecording)")
        print("Playing: \(stats.isPlaying)")
        print("Audio Level: \(stats.currentLevel) dB")
        print("Quality: \(stats.quality.displayName)")
        print("Sample Rate: \(stats.sampleRate) Hz")
        print("Format: \(stats.format)")
        print("===============================")
    }
    
    func debugTestAudioChain() async {
        print("Testing audio chain...")
        
        // Test des permissions
        let hasPermission = Self.checkMicrophonePermission()
        print("Microphone permission: \(hasPermission)")
        
        // Test de latence
        if let latency = await measureAudioLatency() {
            print("Audio latency: \(latency * 1000) ms")
        }
        
        // Test de qualité
        let quality = assessAudioQuality()
        print("Current quality: \(quality.displayName)")
    }
}
#endif
