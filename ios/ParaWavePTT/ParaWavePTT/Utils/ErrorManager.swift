import Foundation
import SwiftUI

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

// Centralized error manager for ParaWave PTT
class ErrorManager: ObservableObject {
    
    static let shared = ErrorManager()
    
    @Published var currentError: ParaWaveError?
    @Published var showErrorAlert = false
    @Published var errorHistory: [ErrorEntry] = []
    
    private let maxHistoryCount = 50
    
    private init() {
        #if DEBUG
        print("🚨 Error Manager initialized")
        #endif
    }
    
    // MARK: - Error Reporting
    
    /// Report an error with automatic UI presentation handling
    func reportError(_ error: Error, context: String = "") {
        let paraWaveError = ParaWaveError.from(error, context: context)
        
        DispatchQueue.main.async {
            self.addToHistory(paraWaveError, context: context)
            
                // Show the error if it is critical
                if paraWaveError.severity == .critical {
                    self.showError(paraWaveError)
                }
        }
        
        #if DEBUG
        print("🚨 Error reported: \(paraWaveError.localizedDescription)")
        if !context.isEmpty {
            print("   Context: \(context)")
        }
        #endif
        
    // Log for analytics (to implement)
    logErrorForAnalytics(paraWaveError, context: context)
    }
    
    /// Present an error to the user
    func showError(_ error: ParaWaveError) {
        DispatchQueue.main.async {
            self.currentError = error
            self.showErrorAlert = true
        }
    }
    
    /// Clear the current error
    func clearCurrentError() {
        DispatchQueue.main.async {
            self.currentError = nil
            self.showErrorAlert = false
        }
    }
    
    /// Clear the error history
    func clearHistory() {
        DispatchQueue.main.async {
            self.errorHistory.removeAll()
        }
    }
    
    // MARK: - Private Methods
    
    private func addToHistory(_ error: ParaWaveError, context: String) {
        let entry = ErrorEntry(
            error: error,
            context: context,
            timestamp: Date(),
            deviceInfo: DeviceInfo.current()
        )
        
        errorHistory.insert(entry, at: 0)
        
        // Limiter la taille de l'historique
        if errorHistory.count > maxHistoryCount {
            errorHistory.removeLast()
        }
    }
    
    private func logErrorForAnalytics(_ error: ParaWaveError, context: String) {
        // TODO: Implémenter l'envoi vers un service d'analytics
        // Par exemple: Crashlytics, Sentry, etc.
        
        let logData: [String: Any] = [
            "error_code": error.code,
            "error_type": error.type.rawValue,
            "severity": error.severity.rawValue,
            "context": context,
            "timestamp": Date().timeIntervalSince1970,
            "app_version": ConfigurationManager.shared.appVersion,
            "device_model": DeviceInfo.current().model,
            "ios_version": DeviceInfo.current().osVersion
        ]
        
        #if DEBUG
        print("📊 Error logged for analytics: \(logData)")
        #endif
    }
}

// MARK: - ParaWaveError

enum ParaWaveError: LocalizedError, Equatable {
    // Authentication
    case authenticationFailed(String)
    case tokenExpired
    case biometricAuthFailed
    case permissionDenied(String)
    
    // Network
    case networkUnavailable
    case apiError(Int, String)
    case requestTimeout
    case invalidResponse
    
    // Audio
    case microphonePermissionDenied
    case audioSessionFailed
    case audioEncodingFailed
    case audioDecodingFailed
    
    // PTT
    case pttChannelJoinFailed(String)
    case pttTransmissionFailed(String)
    case pttNotSupported
    case pttPermissionDenied
    
    // Location
    case locationPermissionDenied
    case locationUnavailable
    case locationAccuracyInsufficient
    
    // Channel
    case channelNotFound(String)
    case channelFull(String)
    case channelPermissionDenied(String)
    case channelConnectionLost
    
    // General
    case configurationError(String)
    case unexpectedError(String)
    
    // MARK: - Properties
    
    var errorDescription: String? {
        switch self {
        case .authenticationFailed(let reason):
            return "Authentication failed: \(reason)"
        case .tokenExpired:
            return LocalizableStrings.authTokenExpired
        case .biometricAuthFailed:
            return "Biometric authentication failed"
        case .permissionDenied(let permission):
            return "Permission denied: \(permission)"
            
        case .networkUnavailable:
            return LocalizableStrings.errorNetworkMessage
        case .apiError(let code, let message):
            return "API Error \(code): \(message)"
        case .requestTimeout:
            return "Request timeout"
        case .invalidResponse:
            return "Invalid server response"
            
        case .microphonePermissionDenied:
            return LocalizableStrings.audioPermissionMessage
        case .audioSessionFailed:
            return "Failed to configure audio session"
        case .audioEncodingFailed:
            return "Audio encoding failed"
        case .audioDecodingFailed:
            return "Audio decoding failed"
            
        case .pttChannelJoinFailed(let channel):
            return "Failed to join PTT channel: \(channel)"
        case .pttTransmissionFailed(let reason):
            return "PTT transmission failed: \(reason)"
        case .pttNotSupported:
            return "Push-to-Talk not supported on this device"
        case .pttPermissionDenied:
            return "Push-to-Talk permission denied"
            
        case .locationPermissionDenied:
            return LocalizableStrings.locationPermissionMessage
        case .locationUnavailable:
            return "Location service unavailable"
        case .locationAccuracyInsufficient:
            return "Location accuracy insufficient"
            
        case .channelNotFound(let name):
            return "Channel not found: \(name)"
        case .channelFull(let name):
            return "Channel is full: \(name)"
        case .channelPermissionDenied(let name):
            return "Permission denied for channel: \(name)"
        case .channelConnectionLost:
            return "Channel connection lost"
            
        case .configurationError(let details):
            return "Configuration error: \(details)"
        case .unexpectedError(let details):
            return "Unexpected error: \(details)"
        }
    }
    
    var code: String {
        switch self {
        case .authenticationFailed: return "AUTH_FAILED"
        case .tokenExpired: return "TOKEN_EXPIRED"
        case .biometricAuthFailed: return "BIOMETRIC_FAILED"
        case .permissionDenied: return "PERMISSION_DENIED"
            
        case .networkUnavailable: return "NETWORK_UNAVAILABLE"
        case .apiError(let code, _): return "API_ERROR_\(code)"
        case .requestTimeout: return "REQUEST_TIMEOUT"
        case .invalidResponse: return "INVALID_RESPONSE"
            
        case .microphonePermissionDenied: return "MIC_PERMISSION_DENIED"
        case .audioSessionFailed: return "AUDIO_SESSION_FAILED"
        case .audioEncodingFailed: return "AUDIO_ENCODING_FAILED"
        case .audioDecodingFailed: return "AUDIO_DECODING_FAILED"
            
        case .pttChannelJoinFailed: return "PTT_JOIN_FAILED"
        case .pttTransmissionFailed: return "PTT_TRANSMISSION_FAILED"
        case .pttNotSupported: return "PTT_NOT_SUPPORTED"
        case .pttPermissionDenied: return "PTT_PERMISSION_DENIED"
            
        case .locationPermissionDenied: return "LOCATION_PERMISSION_DENIED"
        case .locationUnavailable: return "LOCATION_UNAVAILABLE"
        case .locationAccuracyInsufficient: return "LOCATION_ACCURACY_INSUFFICIENT"
            
        case .channelNotFound: return "CHANNEL_NOT_FOUND"
        case .channelFull: return "CHANNEL_FULL"
        case .channelPermissionDenied: return "CHANNEL_PERMISSION_DENIED"
        case .channelConnectionLost: return "CHANNEL_CONNECTION_LOST"
            
        case .configurationError: return "CONFIGURATION_ERROR"
        case .unexpectedError: return "UNEXPECTED_ERROR"
        }
    }
    
    var type: ErrorType {
        switch self {
        case .authenticationFailed, .tokenExpired, .biometricAuthFailed, .permissionDenied:
            return .authentication
        case .networkUnavailable, .apiError, .requestTimeout, .invalidResponse:
            return .network
        case .microphonePermissionDenied, .audioSessionFailed, .audioEncodingFailed, .audioDecodingFailed:
            return .audio
        case .pttChannelJoinFailed, .pttTransmissionFailed, .pttNotSupported, .pttPermissionDenied:
            return .ptt
        case .locationPermissionDenied, .locationUnavailable, .locationAccuracyInsufficient:
            return .location
        case .channelNotFound, .channelFull, .channelPermissionDenied, .channelConnectionLost:
            return .channel
        case .configurationError, .unexpectedError:
            return .system
        }
    }
    
    var severity: ErrorSeverity {
        switch self {
        case .tokenExpired, .networkUnavailable, .channelConnectionLost:
            return .critical
        case .authenticationFailed, .apiError, .pttTransmissionFailed:
            return .high
        case .permissionDenied, .audioSessionFailed, .channelFull:
            return .medium
        default:
            return .low
        }
    }
    
    var recoverySuggestions: [String] {
        switch self {
        case .authenticationFailed, .tokenExpired:
            return [LocalizableStrings.authLoginButton]
        case .networkUnavailable:
            return ["Check your internet connection", "Try again later"]
        case .microphonePermissionDenied:
            return [LocalizableStrings.audioPermissionSettings]
        case .locationPermissionDenied:
            return ["Enable location in Settings"]
        case .pttNotSupported:
            return ["Use a supported device", "Contact support"]
        case .channelFull:
            return ["Try another channel", "Wait and try again"]
        default:
            return [LocalizableStrings.errorRetryButton]
        }
    }
    
    // MARK: - Factory Method
    
    static func from(_ error: Error, context: String = "") -> ParaWaveError {
        if let paraWaveError = error as? ParaWaveError {
            return paraWaveError
        }
        
        // Conversion d'erreurs système courantes
        if let urlError = error as? URLError {
            switch urlError.code {
            case .notConnectedToInternet, .networkConnectionLost:
                return .networkUnavailable
            case .timedOut:
                return .requestTimeout
            default:
                return .networkUnavailable
            }
        }
        
        // Autres types d'erreurs
        return .unexpectedError(error.localizedDescription)
    }
}

// MARK: - Supporting Types

enum ErrorType: String, CaseIterable {
    case authentication
    case network
    case audio
    case ptt
    case location
    case channel
    case system
}

enum ErrorSeverity: String, CaseIterable {
    case low
    case medium
    case high
    case critical
}

struct ErrorEntry: Identifiable {
    let id = UUID()
    let error: ParaWaveError
    let context: String
    let timestamp: Date
    let deviceInfo: DeviceInfo
}

struct DeviceInfo {
    let model: String
    let osVersion: String
    let appVersion: String
    let buildNumber: String
    
    static func current() -> DeviceInfo {
        return DeviceInfo(
            model: UIDevice.current.model,
            osVersion: UIDevice.current.systemVersion,
            appVersion: ConfigurationManager.shared.appVersion,
            buildNumber: ConfigurationManager.shared.buildNumber
        )
    }
}

// MARK: - SwiftUI Integration

struct ErrorAlert: ViewModifier {
    @ObservedObject private var errorManager = ErrorManager.shared
    
    func body(content: Content) -> some View {
        content
            .alert(
                errorManager.currentError?.type.rawValue.capitalized ?? LocalizableStrings.errorGenericMessage,
                isPresented: $errorManager.showErrorAlert,
                presenting: errorManager.currentError
            ) { error in
                VStack {
                    ForEach(error.recoverySuggestions, id: \.self) { suggestion in
                        Button(suggestion) {
                            // Actions de récupération
                            handleRecoveryAction(suggestion, for: error)
                        }
                    }
                    
                    Button(LocalizableStrings.errorOKButton, role: .cancel) {
                        errorManager.clearCurrentError()
                    }
                }
            } message: { error in
                Text(error.localizedDescription ?? LocalizableStrings.errorGenericMessage)
            }
    }
    
    private func handleRecoveryAction(_ action: String, for error: ParaWaveError) {
        switch action {
        case LocalizableStrings.authLoginButton:
            // Déclencher la reconnexion Auth0
            Task {
                await ParapenteStateManager.shared.signIn()
            }
        case LocalizableStrings.audioPermissionSettings, "Enable location in Settings":
            // Ouvrir les paramètres
            if let settingsUrl = URL(string: UIApplication.openSettingsURLString) {
                UIApplication.shared.open(settingsUrl)
            }
        case LocalizableStrings.errorRetryButton:
            // Action générique de retry
            break
        default:
            break
        }
        
        errorManager.clearCurrentError()
    }
}

extension View {
    func withErrorHandling() -> some View {
        modifier(ErrorAlert())
    }
}
