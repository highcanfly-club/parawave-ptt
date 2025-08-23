import Foundation
import AVFoundation
import CoreLocation
import PushToTalk
import LocalAuthentication

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

// Centralized permission manager for ParaWave PTT
class PermissionManager: NSObject, ObservableObject {
    
    static let shared = PermissionManager()
    
    @Published var microphonePermission: PermissionStatus = .notDetermined
    @Published var locationPermission: PermissionStatus = .notDetermined
    @Published var pttPermission: PermissionStatus = .notDetermined
    @Published var biometricPermission: PermissionStatus = .notDetermined
    @Published var notificationPermission: PermissionStatus = .notDetermined
    
    private let locationManager = CLLocationManager()
    
    override init() {
        super.init()
        locationManager.delegate = self
        checkAllPermissions()
        
    #if DEBUG
    print("🔐 Permission Manager initialized")
    #endif
    }
    
    // MARK: - Permission Status Check
    
    /// Check all permissions
    func checkAllPermissions() {
        checkMicrophonePermission()
        checkLocationPermission()
        checkPTTPermission()
        checkBiometricPermission()
        checkNotificationPermission()
    }
    
    /// Check microphone permission
    func checkMicrophonePermission() {
        let status = AVAudioSession.sharedInstance().recordPermission
        
        DispatchQueue.main.async {
            switch status {
            case .granted:
                self.microphonePermission = .granted
            case .denied:
                self.microphonePermission = .denied
            case .undetermined:
                self.microphonePermission = .notDetermined
            @unknown default:
                self.microphonePermission = .notDetermined
            }
        }
        
    #if DEBUG
    print("🎤 Microphone permission: \(microphonePermission)")
    #endif
    }
    
    /// Check location permission
    func checkLocationPermission() {
        let status = locationManager.authorizationStatus
        
        DispatchQueue.main.async {
            switch status {
            case .authorizedWhenInUse, .authorizedAlways:
                self.locationPermission = .granted
            case .denied, .restricted:
                self.locationPermission = .denied
            case .notDetermined:
                self.locationPermission = .notDetermined
            @unknown default:
                self.locationPermission = .notDetermined
            }
        }
        
    #if DEBUG
    print("📍 Location permission: \(locationPermission)")
    #endif
    }
    
    /// Check Push-to-Talk permission
    func checkPTTPermission() {
        if #available(iOS 16.0, *) {
            Task {
                do {
                    let channelManager = try PTChannelManager(delegate: nil, restorationDelegate: nil)
                    let channels = try await channelManager.requestJoinChannelToken(
                        descriptor: PTChannelDescriptor(name: "test", image: nil)
                    )
                    
                    DispatchQueue.main.async {
                        self.pttPermission = .granted
                    }
                } catch {
                    DispatchQueue.main.async {
                        self.pttPermission = .denied
                    }
                }
            }
        } else {
            DispatchQueue.main.async {
                self.pttPermission = .denied
            }
        }
        
    #if DEBUG
    print("📻 PTT permission: \(pttPermission)")
    #endif
    }
    
    /// Check biometric availability
    func checkBiometricPermission() {
        let context = LAContext()
        var error: NSError?
        
        DispatchQueue.main.async {
            if context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) {
                self.biometricPermission = .granted
            } else {
                self.biometricPermission = .denied
            }
        }
        
    #if DEBUG
    print("👆 Biometric permission: \(biometricPermission)")
    #endif
    }
    
    /// Check notification permission
    func checkNotificationPermission() {
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            DispatchQueue.main.async {
                switch settings.authorizationStatus {
                case .authorized, .provisional:
                    self.notificationPermission = .granted
                case .denied:
                    self.notificationPermission = .denied
                case .notDetermined:
                    self.notificationPermission = .notDetermined
                case .ephemeral:
                    self.notificationPermission = .granted
                @unknown default:
                    self.notificationPermission = .notDetermined
                }
            }
        }
        
    #if DEBUG
    print("🔔 Notification permission: \(notificationPermission)")
    #endif
    }
    
    // MARK: - Permission Requests
    
    /// Request microphone permission
    func requestMicrophonePermission() async -> Bool {
        let granted = await AVAudioSession.sharedInstance().requestRecordPermission()
        
        DispatchQueue.main.async {
            self.microphonePermission = granted ? .granted : .denied
        }
        
    #if DEBUG
    print("🎤 Microphone permission requested: \(granted)")
    #endif
        
        if !granted {
            ErrorManager.shared.reportError(
                ParaWaveError.microphonePermissionDenied,
                context: "User denied microphone permission"
            )
        }
        
        return granted
    }
    
    /// Request location permission
    func requestLocationPermission() {
        guard locationPermission == .notDetermined else { return }
        
        locationManager.requestWhenInUseAuthorization()
        
    #if DEBUG
    print("📍 Location permission requested")
    #endif
    }
    
    /// Request Push-to-Talk permission
    func requestPTTPermission() async -> Bool {
        guard #available(iOS 16.0, *) else {
            DispatchQueue.main.async {
                self.pttPermission = .denied
            }
            
            ErrorManager.shared.reportError(
                ParaWaveError.pttNotSupported,
                context: "iOS 16+ required for PTT"
            )
            
            return false
        }
        
        // La permission PTT est demandée implicitement lors de la première utilisation
        DispatchQueue.main.async {
            self.pttPermission = .granted
        }
        
    #if DEBUG
    print("📻 PTT permission granted (iOS 16+)")
    #endif
        
        return true
    }
    
    /// Request notification permission
    func requestNotificationPermission() async -> Bool {
        let center = UNUserNotificationCenter.current()
        
        do {
            let granted = try await center.requestAuthorization(
                options: [.alert, .sound, .badge]
            )
            
            DispatchQueue.main.async {
                self.notificationPermission = granted ? .granted : .denied
            }
            
        #if DEBUG
        print("🔔 Notification permission requested: \(granted)")
        #endif
            
            return granted
        } catch {
            DispatchQueue.main.async {
                self.notificationPermission = .denied
            }
            
            ErrorManager.shared.reportError(error, context: "Notification permission request")
            return false
        }
    }
    
    /// Biometric authentication
    func authenticateWithBiometrics() async -> Bool {
        let context = LAContext()
        var error: NSError?
        
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
            #if DEBUG
            print("👆 Biometric authentication not available: \(error?.localizedDescription ?? "Unknown")")
            #endif
            
            ErrorManager.shared.reportError(
                ParaWaveError.biometricAuthFailed,
                context: "Biometric not available"
            )
            
            return false
        }
        
        do {
            let result = try await context.evaluatePolicy(
                .deviceOwnerAuthenticationWithBiometrics,
                localizedReason: LocalizableStrings.authBiometricPrompt
            )
            
            #if DEBUG
            print("👆 Biometric authentication: \(result)")
            #endif
            
            return result
        } catch {
            #if DEBUG
            print("👆 Biometric authentication failed: \(error.localizedDescription)")
            #endif
            
            ErrorManager.shared.reportError(
                ParaWaveError.biometricAuthFailed,
                context: error.localizedDescription
            )
            
            return false
        }
    }
    
    // MARK: - Convenience Methods
    
    /// Check if all critical permissions are granted
    var allCriticalPermissionsGranted: Bool {
        return microphonePermission == .granted &&
               locationPermission == .granted &&
               pttPermission == .granted
    }
    
    /// Check if all permissions are granted
    var allPermissionsGranted: Bool {
        return allCriticalPermissionsGranted &&
               notificationPermission == .granted
    }
    
    /// Request all critical permissions
    func requestAllCriticalPermissions() async -> Bool {
        async let micGranted = requestMicrophonePermission()
        async let notificationGranted = requestNotificationPermission()
        async let pttGranted = requestPTTPermission()
        
    // Location permission is requested synchronously
        requestLocationPermission()
        
        let results = await (micGranted, notificationGranted, pttGranted)
        
        let allGranted = results.0 && results.1 && results.2 && locationPermission == .granted
        
    #if DEBUG
    print("🔐 All critical permissions requested. Granted: \(allGranted)")
    #endif
        
        return allGranted
    }
    
    /// Open the application settings
    func openSettings() {
        guard let settingsUrl = URL(string: UIApplication.openSettingsURLString) else { return }
        
        if UIApplication.shared.canOpenURL(settingsUrl) {
            UIApplication.shared.open(settingsUrl)
            
            #if DEBUG
                print("⚙️ Opening app settings")
                #endif
        }
    }
    
    /// Returns missing permissions
    var missingPermissions: [PermissionType] {
        var missing: [PermissionType] = []
        
        if microphonePermission != .granted {
            missing.append(.microphone)
        }
        if locationPermission != .granted {
            missing.append(.location)
        }
        if pttPermission != .granted {
            missing.append(.ptt)
        }
        if notificationPermission != .granted {
            missing.append(.notifications)
        }
        
        return missing
    }
    
    /// Return a localized description of missing permissions
    func missingPermissionsDescription() -> String {
        let missing = missingPermissions
        guard !missing.isEmpty else { return "" }
        
    let descriptions = missing.map { permission in
            switch permission {
            case .microphone:
        return "Microphone"
            case .location:
        return "Location"
            case .ptt:
        return "Push-to-Talk"
            case .notifications:
        return "Notifications"
            case .biometric:
        return "Biometric"
            }
        }
        
        return descriptions.joined(separator: ", ")
    }
}

// MARK: - CLLocationManagerDelegate

extension PermissionManager: CLLocationManagerDelegate {
    
    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        checkLocationPermission()
    }
}

// MARK: - Supporting Types

enum PermissionStatus: String, CaseIterable {
    case notDetermined
    case denied
    case granted
    
    var isGranted: Bool {
        return self == .granted
    }
    
    var localizedDescription: String {
        switch self {
        case .notDetermined:
            return "Not determined"
        case .denied:
            return "Denied"
        case .granted:
            return "Granted"
        }
    }
}

enum PermissionType: String, CaseIterable {
    case microphone
    case location
    case ptt
    case notifications
    case biometric
    
    var displayName: String {
        switch self {
        case .microphone:
                return "Microphone"
        case .location:
                return "Location"
        case .ptt:
                return "Push-to-Talk"
        case .notifications:
                return "Notifications"
        case .biometric:
                return "Biometric authentication"
        }
    }
    
    var icon: String {
        switch self {
        case .microphone:
            return "mic.fill"
        case .location:
            return "location.fill"
        case .ptt:
            return "radio"
        case .notifications:
            return "bell.fill"
        case .biometric:
            return "touchid"
        }
    }
}
