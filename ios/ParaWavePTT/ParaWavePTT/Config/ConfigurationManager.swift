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
/// Uses EnvironmentReader for .env file parsing and provides app-wide configuration
class ConfigurationManager: ObservableObject {
    
    static let shared = ConfigurationManager()
    
    // MARK: - Fallback Constants
    
    private enum Defaults {
        // Auth0
        static let auth0Domain = "parawave-ptt.eu.auth0.com"
        static let auth0ClientId = "YOUR_AUTH0_CLIENT_ID"
        static let auth0Audience = "https://api.parawave.app"
        
        // API
        static let apiBaseURL = "https://api.parawave.app/v1"
        static let apiTimeout: TimeInterval = 30.0
        static let maxRetryAttempts = 3
        
        // PTT
        static let maxTransmissionDuration: TimeInterval = 60.0
        static let audioSampleRate: Double = 44100.0
        static let audioChannels: UInt32 = 1
        
        // Emergency
        static let emergencyChannelId = "emergency-global"
        static let emergencyPhoneNumber = "112"
        
        // VHF Frequencies
        static let vhfFrequencies = [
            "france_alps": "143.9875 MHz",
            "france_pyrenees": "143.9875 MHz",
            "switzerland": "143.9875 MHz",
            "austria": "143.9500 MHz",
            "italy": "143.9875 MHz"
        ]
    }
    
    // MARK: - User Preferences (Observable)
    
    @Published var windNoiseReductionEnabled: Bool {
        didSet { UserDefaults.standard.set(windNoiseReductionEnabled, forKey: "windNoiseReduction") }
    }
    
    @Published var autoGainControlEnabled: Bool {
        didSet { UserDefaults.standard.set(autoGainControlEnabled, forKey: "autoGainControl") }
    }
    
    @Published var volumeButtonsPTTEnabled: Bool {
        didSet { UserDefaults.standard.set(volumeButtonsPTTEnabled, forKey: "volumeButtonsPTT") }
    }
    
    @Published var biometricAuthEnabled: Bool {
        didSet { UserDefaults.standard.set(biometricAuthEnabled, forKey: "biometricAuth") }
    }
    
    @Published var emergencyNotificationsEnabled: Bool {
        didSet { UserDefaults.standard.set(emergencyNotificationsEnabled, forKey: "emergencyNotifications") }
    }
    
    @Published var selectedRegion: String {
        didSet {
            UserDefaults.standard.set(selectedRegion, forKey: "selectedRegion")
            NotificationCenter.default.post(name: .regionDidChange, object: selectedRegion)
        }
    }
    
    @Published var preferredLanguage: String {
        didSet {
            UserDefaults.standard.set(preferredLanguage, forKey: "preferredLanguage")
            NotificationCenter.default.post(name: .languageDidChange, object: preferredLanguage)
        }
    }
    
    // MARK: - Initialization
    
    private init() {
        // Load preferences from UserDefaults
        self.windNoiseReductionEnabled = UserDefaults.standard.object(forKey: "windNoiseReduction") as? Bool ?? true
        self.autoGainControlEnabled = UserDefaults.standard.object(forKey: "autoGainControl") as? Bool ?? true
        self.volumeButtonsPTTEnabled = UserDefaults.standard.object(forKey: "volumeButtonsPTT") as? Bool ?? true
        self.biometricAuthEnabled = UserDefaults.standard.object(forKey: "biometricAuth") as? Bool ?? true
        self.emergencyNotificationsEnabled = UserDefaults.standard.object(forKey: "emergencyNotifications") as? Bool ?? true
        self.selectedRegion = UserDefaults.standard.object(forKey: "selectedRegion") as? String ?? "france_alps"
        self.preferredLanguage = UserDefaults.standard.object(forKey: "preferredLanguage") as? String ??
                                Locale.current.languageCode ?? "fr"
        
        // Load environment configuration
        EnvironmentReader.loadEnvironment()
        
        #if DEBUG
        logInitialConfiguration()
        #endif
    }
    
    // MARK: - Configuration Properties
    
    /// Auth0 Configuration
    var auth0Domain: String {
        return getConfigValue("AUTH0_DOMAIN", bundleKey: "Auth0Domain", fallback: Defaults.auth0Domain)
    }
    
    var auth0ClientId: String {
        return getConfigValue("AUTH0_CLIENT_ID", bundleKey: "Auth0ClientId", fallback: Defaults.auth0ClientId)
    }
    
    var auth0Audience: String {
        return getConfigValue("AUTH0_AUDIENCE", bundleKey: "Auth0Audience", fallback: Defaults.auth0Audience)
    }
    
    var auth0Scope: String {
        return EnvironmentReader.get("AUTH0_SCOPE",
                                   default: "openid profile email offline_access read:channels write:channels read:transmissions write:transmissions")
    }
    
    /// API Configuration
    var apiBaseURL: String {
        #if DEBUG
        // Pour le développement, priorité aux variables d'environnement
        if let envURL = EnvironmentReader.get("API_BASE_URL") {
            return envURL
        }
        return Bundle.main.object(forInfoDictionaryKey: "ApiBaseURLDev") as? String ?? "http://localhost:8787/api/v1"
        #else
        return getConfigValue("API_BASE_URL", bundleKey: "ApiBaseURL", fallback: Defaults.apiBaseURL)
        #endif
    }
    
    var websocketURL: String {
        let baseURL = apiBaseURL
        if baseURL.hasPrefix("https://") {
            return baseURL.replacingOccurrences(of: "https://", with: "wss://") + "/transmissions/ws"
        } else if baseURL.hasPrefix("http://") {
            return baseURL.replacingOccurrences(of: "http://", with: "ws://") + "/transmissions/ws"
        }
        return "wss://ptt-backend.highcanfly.club/api/v1/transmissions/ws"
    }
    
    var apiTimeout: TimeInterval {
        return EnvironmentReader.getDouble("API_TIMEOUT", default: Defaults.apiTimeout)
    }
    
    var maxRetryAttempts: Int {
        return EnvironmentReader.getInt("MAX_RETRY_ATTEMPTS", default: Defaults.maxRetryAttempts)
    }
    
    /// PTT Configuration
    var maxTransmissionDuration: TimeInterval {
        return EnvironmentReader.getDouble("MAX_TRANSMISSION_DURATION", default: Defaults.maxTransmissionDuration)
    }
    
    var audioSampleRate: Double { Defaults.audioSampleRate }
    var audioChannels: UInt32 { Defaults.audioChannels }
    
    /// Emergency Configuration
    var emergencyChannelId: String {
        return EnvironmentReader.get("EMERGENCY_CHANNEL_ID", default: Defaults.emergencyChannelId)
    }
    
    var emergencyPhoneNumber: String { Defaults.emergencyPhoneNumber }
    
    /// VHF Configuration
    func vhfFrequency(for region: String) -> String? {
        return Defaults.vhfFrequencies[region]
    }
    
    var currentVhfFrequency: String? {
        return vhfFrequency(for: selectedRegion)
    }
    
    /// App Information
    var appVersion: String {
        return Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0.0"
    }
    
    var buildNumber: String {
        return Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "1"
    }
    
    var bundleIdentifier: String {
        return EnvironmentReader.get("APPLE_APP_BUNDLE_ID") ??
               Bundle.main.bundleIdentifier ??
               "club.highcanfly.parawave-ptt"
    }
    
    /// Environment Information
    var environment: String {
        return EnvironmentReader.get("ENVIRONMENT", default: "production")
    }
    
    var isDevelopment: Bool { environment == "development" }
    
    var isDebugEnabled: Bool {
        #if DEBUG
        return true
        #else
        return EnvironmentReader.getBool("DEBUG_ENABLED", default: false)
        #endif
    }
    
    var apiVersion: String {
        return EnvironmentReader.get("API_VERSION", default: "1.0.0")
    }
    
    // MARK: - Private Helpers
    
    /// Get configuration value with priority: Environment > Bundle > Fallback
    private func getConfigValue(_ envKey: String, bundleKey: String, fallback: String) -> String {
        return EnvironmentReader.get(envKey) ??
               Bundle.main.object(forInfoDictionaryKey: bundleKey) as? String ??
               fallback
    }
    
    #if DEBUG
    private func logInitialConfiguration() {
        print("🔧 ConfigurationManager initialized")
        print("   - Environment: \(environment)")
        print("   - Auth0 Domain: \(auth0Domain)")
        print("   - API Base URL: \(apiBaseURL)")
        print("   - Bundle ID: \(bundleIdentifier)")
        print("   - App Version: \(appVersion) (\(buildNumber))")
        print("   - Selected Region: \(selectedRegion)")
        print("   - Preferred Language: \(preferredLanguage)")
        print("   - Wind Noise Reduction: \(windNoiseReductionEnabled)")
        print("   - Volume Buttons PTT: \(volumeButtonsPTTEnabled)")
    }
    #endif
}

// MARK: - Extensions

extension ConfigurationManager {
    /// Audio format configuration
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
