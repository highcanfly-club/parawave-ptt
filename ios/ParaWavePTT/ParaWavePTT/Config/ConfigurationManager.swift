/*
 Copyright (C) 2025 Ronan Le Meillat

 This file is part of ParaWave PTT.

 ParaWave PTT is free software: you can redistribute it and/or modify
 it under the terms of the GNU Affero General Public License as
 published by the Free Software Foundation, either version 3 of the
 License, or (at your option) any later version.

 ParaWave PTT is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU Affero General Public License for more details.

 You should have received a copy of the GNU Affero General Public License
 along with ParaWave PTT.  If not, see <https://www.gnu.org/licenses/>.

 SPDX-License-Identifier: AGPL-3.0-or-later
*/

import Foundation

/// Centralized configuration manager for ParaWave PTT
class ConfigurationManager: ObservableObject {
    
    static let shared = ConfigurationManager()
    
    // MARK: - Configuration Keys
    
    private enum Keys {
        // Auth0
        static let auth0Domain = "parawave-ptt.eu.auth0.com"
        static let auth0ClientId = "YOUR_AUTH0_CLIENT_ID"
        static let auth0Audience = "https://api.parawave.app"
        
        // API Configuration
        static let apiBaseURL = "https://api.parawave.app/v1"
        static let apiTimeout: TimeInterval = 30.0
        static let maxRetryAttempts = 3
        
        // PTT Configuration
        static let maxTransmissionDuration: TimeInterval = 60.0
        static let audioSampleRate: Double = 44100.0
        static let audioChannels: UInt32 = 1
        
        // UI Configuration
        static let animationDuration: TimeInterval = 0.3
        static let networkStatusUpdateInterval: TimeInterval = 5.0
        
        // Emergency
        static let emergencyChannelId = "emergency-global"
        static let emergencyPhoneNumber = "112"
        
        // VHF Frequencies by region
        static let vhfFrequencies = [
            "france_alps": "143.9875 MHz",
            "france_pyrenees": "143.9875 MHz",
            "switzerland": "143.9875 MHz",
            "austria": "143.9500 MHz",
            "italy": "143.9875 MHz"
        ]
    }
    
    // MARK: - User Preferences
    
    @Published var windNoiseReductionEnabled: Bool {
        didSet {
            UserDefaults.standard.set(windNoiseReductionEnabled, forKey: "windNoiseReduction")
        }
    }
    
    @Published var autoGainControlEnabled: Bool {
        didSet {
            UserDefaults.standard.set(autoGainControlEnabled, forKey: "autoGainControl")
        }
    }
    
    @Published var volumeButtonsPTTEnabled: Bool {
        didSet {
            UserDefaults.standard.set(volumeButtonsPTTEnabled, forKey: "volumeButtonsPTT")
        }
    }
    
    @Published var biometricAuthEnabled: Bool {
        didSet {
            UserDefaults.standard.set(biometricAuthEnabled, forKey: "biometricAuth")
        }
    }
    
    @Published var emergencyNotificationsEnabled: Bool {
        didSet {
            UserDefaults.standard.set(emergencyNotificationsEnabled, forKey: "emergencyNotifications")
        }
    }
    
    @Published var selectedRegion: String {
        didSet {
            UserDefaults.standard.set(selectedRegion, forKey: "selectedRegion")
        }
    }
    
    @Published var preferredLanguage: String {
        didSet {
            UserDefaults.standard.set(preferredLanguage, forKey: "preferredLanguage")
        }
    }
    
    // MARK: - Initialization
    
    private init() {
        // Charger les préférences utilisateur
        self.windNoiseReductionEnabled = UserDefaults.standard.object(forKey: "windNoiseReduction") as? Bool ?? true
        self.autoGainControlEnabled = UserDefaults.standard.object(forKey: "autoGainControl") as? Bool ?? true
        self.volumeButtonsPTTEnabled = UserDefaults.standard.object(forKey: "volumeButtonsPTT") as? Bool ?? true
        self.biometricAuthEnabled = UserDefaults.standard.object(forKey: "biometricAuth") as? Bool ?? true
        self.emergencyNotificationsEnabled = UserDefaults.standard.object(forKey: "emergencyNotifications") as? Bool ?? true
        self.selectedRegion = UserDefaults.standard.object(forKey: "selectedRegion") as? String ?? "france_alps"
        self.preferredLanguage = UserDefaults.standard.object(forKey: "preferredLanguage") as? String ?? Locale.current.languageCode ?? "fr"
        
        // Configuration initiale pour le développement
        #if DEBUG
        print("🔧 Configuration Manager initialized")
        print("   - Wind noise reduction: \(windNoiseReductionEnabled)")
        print("   - Auto gain control: \(autoGainControlEnabled)")
        print("   - Volume buttons PTT: \(volumeButtonsPTTEnabled)")
        print("   - Biometric auth: \(biometricAuthEnabled)")
        print("   - Selected region: \(selectedRegion)")
        print("   - Preferred language: \(preferredLanguage)")
        #endif
    }
    
    // MARK: - Auth0 Configuration
    
    var auth0Domain: String {
        return Bundle.main.object(forInfoDictionaryKey: "Auth0Domain") as? String ?? Keys.auth0Domain
    }
    
    var auth0ClientId: String {
        return Bundle.main.object(forInfoDictionaryKey: "Auth0ClientId") as? String ?? Keys.auth0ClientId
    }
    
    var auth0Audience: String {
        return Bundle.main.object(forInfoDictionaryKey: "Auth0Audience") as? String ?? Keys.auth0Audience
    }
    
    var auth0Scope: String {
        return "openid profile email offline_access read:channels write:channels read:transmissions write:transmissions"
    }
    
    // MARK: - API Configuration
    
    var apiBaseURL: String {
        #if DEBUG
        return Bundle.main.object(forInfoDictionaryKey: "ApiBaseURLDev") as? String ?? "http://localhost:3000/v1"
        #else
        return Bundle.main.object(forInfoDictionaryKey: "ApiBaseURL") as? String ?? Keys.apiBaseURL
        #endif
    }
    
    var apiTimeout: TimeInterval {
        return Keys.apiTimeout
    }
    
    var maxRetryAttempts: Int {
        return Keys.maxRetryAttempts
    }
    
    // MARK: - PTT Configuration
    
    var maxTransmissionDuration: TimeInterval {
        return Keys.maxTransmissionDuration
    }
    
    var audioSampleRate: Double {
        return Keys.audioSampleRate
    }
    
    var audioChannels: UInt32 {
        return Keys.audioChannels
    }
    
    var audioFormat: AudioFormat {
        return AudioFormat(
            sampleRate: audioSampleRate,
            channels: audioChannels,
            bitDepth: 16,
            codec: .aacLc
        )
    }
    
    // MARK: - Emergency Configuration
    
    var emergencyChannelId: String {
        return Keys.emergencyChannelId
    }
    
    var emergencyPhoneNumber: String {
        return Keys.emergencyPhoneNumber
    }
    
    var vhfFrequencyForRegion: String? {
        return Keys.vhfFrequencies[selectedRegion]
    }
    
    // MARK: - UI Configuration
    
    var animationDuration: TimeInterval {
        return Keys.animationDuration
    }
    
    var networkStatusUpdateInterval: TimeInterval {
        return Keys.networkStatusUpdateInterval
    }
    
    // MARK: - Feature Flags
    
    var isEmergencyFeatureEnabled: Bool {
        #if DEBUG
        return true
        #else
        return Bundle.main.object(forInfoDictionaryKey: "EmergencyFeatureEnabled") as? Bool ?? true
        #endif
    }
    
    var isVHFIntegrationEnabled: Bool {
        #if DEBUG
        return true
        #else
        return Bundle.main.object(forInfoDictionaryKey: "VHFIntegrationEnabled") as? Bool ?? true
        #endif
    }
    
    var isBiometricAuthSupported: Bool {
        return Bundle.main.object(forInfoDictionaryKey: "BiometricAuthSupported") as? Bool ?? true
    }
    
    var isLocationBasedChannelsEnabled: Bool {
        return Bundle.main.object(forInfoDictionaryKey: "LocationBasedChannelsEnabled") as? Bool ?? true
    }
    
    // MARK: - Environment Detection
    
    var isRunningInSimulator: Bool {
        #if targetEnvironment(simulator)
        return true
        #else
        return false
        #endif
    }
    
    var isDebugBuild: Bool {
        #if DEBUG
        return true
        #else
        return false
        #endif
    }
    
    var buildConfiguration: String {
        #if DEBUG
        return "Debug"
        #else
        return "Release"
        #endif
    }
    
    // MARK: - App Information
    
    var appVersion: String {
        return Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0.0"
    }
    
    var buildNumber: String {
        return Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "1"
    }
    
    var appName: String {
        return Bundle.main.object(forInfoDictionaryKey: "CFBundleDisplayName") as? String ?? "ParaWave PTT"
    }
    
    var bundleIdentifier: String {
        return Bundle.main.bundleIdentifier ?? "com.parawave.ptt"
    }
    
    // MARK: - Regional Settings
    
    var availableRegions: [String: String] {
        return [
            "france_alps": "Alpes françaises",
            "france_pyrenees": "Pyrénées françaises",
            "switzerland": "Suisse",
            "austria": "Autriche",
            "italy": "Italie du Nord"
        ]
    }
    
    var availableLanguages: [String: String] {
        return [
            "fr": "Français",
            "en": "English"
        ]
    }
    
    // MARK: - Methods
    
    /// Réinitialise toutes les préférences utilisateur
    func resetUserPreferences() {
        let domain = Bundle.main.bundleIdentifier!
        UserDefaults.standard.removePersistentDomain(forName: domain)
        UserDefaults.standard.synchronize()
        
        // Recharger les valeurs par défaut
        windNoiseReductionEnabled = true
        autoGainControlEnabled = true
        volumeButtonsPTTEnabled = true
        biometricAuthEnabled = true
        emergencyNotificationsEnabled = true
        selectedRegion = "france_alps"
        preferredLanguage = Locale.current.languageCode ?? "fr"
        
        #if DEBUG
        print("🔧 User preferences reset to defaults")
        #endif
    }
    
    /// Valide la configuration actuelle
    func validateConfiguration() -> Bool {
        guard !auth0Domain.isEmpty,
              !auth0ClientId.isEmpty,
              !apiBaseURL.isEmpty else {
            #if DEBUG
            print("❌ Configuration validation failed: Missing required Auth0 or API configuration")
            #endif
            return false
        }
        
        guard maxTransmissionDuration > 0,
              audioSampleRate > 0,
              audioChannels > 0 else {
            #if DEBUG
            print("❌ Configuration validation failed: Invalid audio configuration")
            #endif
            return false
        }
        
        #if DEBUG
        print("✅ Configuration validation successful")
        #endif
        return true
    }
    
    /// Exporte la configuration actuelle (pour le debug)
    func exportConfiguration() -> [String: Any] {
        return [
            "app_version": appVersion,
            "build_number": buildNumber,
            "build_configuration": buildConfiguration,
            "bundle_identifier": bundleIdentifier,
            "api_base_url": apiBaseURL,
            "auth0_domain": auth0Domain,
            "selected_region": selectedRegion,
            "preferred_language": preferredLanguage,
            "wind_noise_reduction": windNoiseReductionEnabled,
            "auto_gain_control": autoGainControlEnabled,
            "volume_buttons_ptt": volumeButtonsPTTEnabled,
            "biometric_auth": biometricAuthEnabled,
            "emergency_notifications": emergencyNotificationsEnabled,
            "max_transmission_duration": maxTransmissionDuration,
            "audio_sample_rate": audioSampleRate,
            "audio_channels": audioChannels,
            "is_simulator": isRunningInSimulator,
            "is_debug": isDebugBuild
        ]
    }
}

// MARK: - Extensions

extension ConfigurationManager {
    
    /// Structure pour la configuration audio
    struct AudioFormat {
        let sampleRate: Double
        let channels: UInt32
        let bitDepth: Int
        let codec: AudioCodec
        
        enum AudioCodec {
            case aacLc
            case opus
            case pcm
        }
    }
}

// MARK: - Notification Names

extension Notification.Name {
    static let configurationDidChange = Notification.Name("ConfigurationDidChange")
    static let regionDidChange = Notification.Name("RegionDidChange")
    static let languageDidChange = Notification.Name("LanguageDidChange")
}
