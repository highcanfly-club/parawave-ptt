import Foundation

//
// Copyright © 2025 Ronan Le Meillat
// Licensed under the GNU Affero General Public License v3.0 (AGPL-3.0)
// See: https://www.gnu.org/licenses/agpl-3.0.en.html
//
// Localization manager for ParaWave PTT
struct LocalizableStrings {
    
    // MARK: - Authentication
    static let authLoginButton = NSLocalizedString("auth0.login.button", comment: "Auth0 login button")
    static let authLogoutButton = NSLocalizedString("auth0.logout.button", comment: "Logout button")
    static let authBiometricPrompt = NSLocalizedString("auth0.biometric.prompt", comment: "Auth0 biometric prompt")
    static let authNetworkError = NSLocalizedString("auth0.error.network", comment: "Auth0 network error")
    static let authTokenExpired = NSLocalizedString("auth0.error.token_expired", comment: "Token expired")
    
    // MARK: - Main Interface
    static let mainTalkButton = NSLocalizedString("main.talk.button", comment: "Bouton parler principal")
    static let mainChannelLabel = NSLocalizedString("main.channel.label", comment: "Label canal")
    static let mainJoinChannel = NSLocalizedString("main.join.channel", comment: "Rejoindre le canal")
    static let mainLeaveChannel = NSLocalizedString("main.leave.channel", comment: "Quitter le canal")
    
    // MARK: - Status
    static let statusConnected = NSLocalizedString("status.connected", comment: "Connected status")
    static let statusDisconnected = NSLocalizedString("status.disconnected", comment: "Disconnected status")
    static let statusTransmitting = NSLocalizedString("status.transmitting", comment: "Transmitting")
    static let statusReceiving = NSLocalizedString("status.receiving", comment: "Receiving")
    
    // MARK: - Network Status
    static let networkGPRS = NSLocalizedString("status.network.2g", comment: "GPRS disponible")
    static let network3G = NSLocalizedString("status.network.3g", comment: "3G disponible")
    static let network4G = NSLocalizedString("status.network.4g", comment: "4G disponible")
    static let network5G = NSLocalizedString("status.network.5g", comment: "5G disponible")
    static let networkOffline = NSLocalizedString("status.network.offline", comment: "Hors ligne")
    static let networkPoor = NSLocalizedString("status.network.poor", comment: "Poor connection")
    static let networkGood = NSLocalizedString("status.network.good", comment: "Good connection")
    static let networkExcellent = NSLocalizedString("status.network.excellent", comment: "Excellent connection")
    
    // MARK: - Channels
    static let channelTypeGeneral = NSLocalizedString("channel.type.general", comment: "Canal général")
    static let channelTypeSiteLocal = NSLocalizedString("channel.type.site_local", comment: "Canal site local")
    static let channelTypeEmergency = NSLocalizedString("channel.type.emergency", comment: "Canal d'urgence")
    static let channelTypeCrossCountry = NSLocalizedString("channel.type.cross_country", comment: "Canal cross country")
    static let channelTypeTraining = NSLocalizedString("channel.type.training", comment: "Canal formation")
    static let channelTypeCompetition = NSLocalizedString("channel.type.competition", comment: "Canal compétition")
    
    static let channelSelectTitle = NSLocalizedString("channel.select.title", comment: "Select a channel")
    static let channelNoSelection = NSLocalizedString("channel.no.selection", comment: "No channel selected")
    static let channelParticipants = NSLocalizedString("channel.participants", comment: "participants")
    static let channelJoinSuccess = NSLocalizedString("channel.join.success", comment: "Channel joined successfully")
    static let channelJoinFailed = NSLocalizedString("channel.join.failed", comment: "Failed to join channel")
    static let channelLeaveSuccess = NSLocalizedString("channel.leave.success", comment: "Channel left successfully")
    
    // MARK: - Emergency
    static let emergencyTitle = NSLocalizedString("emergency.title", comment: "Emergency")
    static let emergencyCall112 = NSLocalizedString("emergency.call.112", comment: "Call 112")
    static let emergencyChannelButton = NSLocalizedString("emergency.channel.button", comment: "Emergency channel")
    static let emergencyCancel = NSLocalizedString("emergency.cancel", comment: "Cancel")
    static let emergencyMessage = NSLocalizedString("emergency.message", comment: "Select the type of emergency")
    static let emergencyChannelName = NSLocalizedString("emergency.channel.name", comment: "EMERGENCY")
    static let emergencyNotificationTitle = NSLocalizedString("notification.emergency.title", comment: "Paragliding Emergency Alert")
    
    // MARK: - Audio
    static let audioQualityNoSignal = NSLocalizedString("audio.quality.no_signal", comment: "No signal")
    static let audioQualityPoor = NSLocalizedString("audio.quality.poor", comment: "Poor quality")
    static let audioQualityGood = NSLocalizedString("audio.quality.good", comment: "Good quality")
    static let audioQualityExcellent = NSLocalizedString("audio.quality.excellent", comment: "Excellent quality")
    
    static let audioPermissionTitle = NSLocalizedString("audio.permission.title", comment: "Microphone permission")
    static let audioPermissionMessage = NSLocalizedString("audio.permission.message", comment: "Microphone access is required for PTT transmissions")
    static let audioPermissionSettings = NSLocalizedString("audio.permission.settings", comment: "Settings")
    
    // MARK: - Location
    static let locationPermissionTitle = NSLocalizedString("location.permission.title", comment: "Location permission")
    static let locationPermissionMessage = NSLocalizedString("location.permission.message", comment: "Location allows suggesting channels suitable for your flying site")
    static let locationDisabled = NSLocalizedString("location.disabled", comment: "GPS disabled")
    static let locationSearching = NSLocalizedString("location.searching", comment: "Searching...")
    
    // MARK: - Errors
    static let errorNetworkTitle = NSLocalizedString("error.network.title", comment: "Network Error")
    static let errorAuthenticationTitle = NSLocalizedString("error.authentication.title", comment: "Authentication Error")
    static let errorPermissionTitle = NSLocalizedString("error.permission.title", comment: "Insufficient Permissions")
    static let errorChannelTitle = NSLocalizedString("error.channel.title", comment: "Channel Error")
    static let errorAudioTitle = NSLocalizedString("error.audio.title", comment: "Audio Error")
    
    static let errorGenericMessage = NSLocalizedString("error.generic.message", comment: "An unexpected error occurred")
    static let errorNetworkMessage = NSLocalizedString("error.network.message", comment: "Please check your internet connection")
    static let errorRetryButton = NSLocalizedString("error.retry.button", comment: "Retry")
    static let errorOKButton = NSLocalizedString("error.ok.button", comment: "OK")
    
    // MARK: - Flying Sites
    static let siteAnnecyName = NSLocalizedString("site.annecy.name", comment: "Annecy - Forclaz")
    static let siteChamonixName = NSLocalizedString("site.chamonix.name", comment: "Chamonix - Vallée Blanche")
    static let sitePyreneesName = NSLocalizedString("site.pyrenees.name", comment: "Pyrénées - Saint-Hilaire")
    static let siteAlpsName = NSLocalizedString("site.alps.name", comment: "Alpes du Sud")
    
    // MARK: - VHF Integration
    static let vhfBackupFrequency = NSLocalizedString("vhf.backup.frequency", comment: "VHF backup frequency")
    static let vhfRecommendedTitle = NSLocalizedString("vhf.recommended.title", comment: "VHF recommended")
    static let vhfRecommendedMessage = NSLocalizedString("vhf.recommended.message", comment: "Weak 4G/5G connection detected, consider using VHF")
    
    // MARK: - Settings
    static let settingsTitle = NSLocalizedString("settings.title", comment: "Settings")
    static let settingsAudioTitle = NSLocalizedString("settings.audio.title", comment: "Audio")
    static let settingsNetworkTitle = NSLocalizedString("settings.network.title", comment: "Network")
    static let settingsLocationTitle = NSLocalizedString("settings.location.title", comment: "Location")
    static let settingsAccountTitle = NSLocalizedString("settings.account.title", comment: "Account")
    
    static let settingsWindNoiseReduction = NSLocalizedString("settings.wind.noise.reduction", comment: "Wind noise reduction")
    static let settingsAutoGainControl = NSLocalizedString("settings.auto.gain.control", comment: "Automatic gain control")
    static let settingsVolumeButtonsPTT = NSLocalizedString("settings.volume.buttons.ptt", comment: "Volume buttons for PTT")
    
    // MARK: - Transmission
    static let transmissionStarted = NSLocalizedString("transmission.started", comment: "Transmission started")
    static let transmissionEnded = NSLocalizedString("transmission.ended", comment: "Transmission ended")
    static let transmissionFailed = NSLocalizedString("transmission.failed", comment: "Transmission failed")
    static let transmissionMaxDuration = NSLocalizedString("transmission.max.duration", comment: "Maximum duration reached")
    
    // MARK: - General
    static let appName = NSLocalizedString("app.name", comment: "ParaWave PTT")
    static let appTagline = NSLocalizedString("app.tagline", comment: "PTT communication for paragliders")
    static let cancel = NSLocalizedString("general.cancel", comment: "Cancel")
    static let confirm = NSLocalizedString("general.confirm", comment: "Confirm")
    static let close = NSLocalizedString("general.close", comment: "Close")
    static let retry = NSLocalizedString("general.retry", comment: "Retry")
    static let loading = NSLocalizedString("general.loading", comment: "Loading...")
}

// MARK: - Helper Extensions

extension LocalizableStrings {
    
    /// Format a localized string with parameters
    static func formatted(_ key: String, _ arguments: CVarArg...) -> String {
        let format = NSLocalizedString(key, comment: "")
        return String(format: format, arguments: arguments)
    }
    
    /// Return the appropriate plural form based on the count
    static func plural(key: String, count: Int) -> String {
        let format = NSLocalizedString(key, comment: "")
        return String.localizedStringWithFormat(format, count)
    }
    
    /// Return the localized string for a channel type
    static func channelTypeName(_ type: ChannelType) -> String {
        switch type {
        case .general:
            return channelTypeGeneral
        case .siteLocal:
            return channelTypeSiteLocal
        case .emergency:
            return channelTypeEmergency
        case .crossCountry:
            return channelTypeCrossCountry
        case .training:
            return channelTypeTraining
        case .competition:
            return channelTypeCompetition
        }
    }
    
    /// Return the localized string for a network quality
    static func networkQualityName(_ quality: NetworkQuality) -> String {
        switch quality {
        case .unknown:
            return "Inconnue"
        case .poor:
            return networkPoor
        case .good:
            return networkGood
        case .excellent:
            return networkExcellent
        }
    }
    
    /// Return the localized string for an audio quality
    static func audioQualityName(_ quality: AudioQuality) -> String {
        switch quality {
        case .noSignal:
            return audioQualityNoSignal
        case .poor:
            return audioQualityPoor
        case .good:
            return audioQualityGood
        case .excellent:
            return audioQualityExcellent
        }
    }
}

// MARK: - Date and Time Formatting

extension LocalizableStrings {
    
    /// Localized date formatter
    static var dateFormatter: DateFormatter {
        let formatter = DateFormatter()
        formatter.locale = Locale.current
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter
    }
    
    /// Duration formatter
    static func formatDuration(_ seconds: TimeInterval) -> String {
        let formatter = DateComponentsFormatter()
        formatter.allowedUnits = [.minute, .second]
        formatter.unitsStyle = .abbreviated
        return formatter.string(from: seconds) ?? "0s"
    }
    
    /// Coordinates display format
    static func formatCoordinates(lat: Double, lon: Double) -> String {
        return String(format: "%.6f°, %.6f°", lat, lon)
    }
}

// MARK: - Accessibility

extension LocalizableStrings {
    
    // Accessibility labels
    static let accessibilityPTTButton = NSLocalizedString("accessibility.ptt.button", comment: "Push-to-Talk button")
    static let accessibilityChannelSelector = NSLocalizedString("accessibility.channel.selector", comment: "Channel selector")
    static let accessibilityEmergencyButton = NSLocalizedString("accessibility.emergency.button", comment: "Emergency button")
    static let accessibilityNetworkStatus = NSLocalizedString("accessibility.network.status", comment: "Network status")
    static let accessibilityAudioLevel = NSLocalizedString("accessibility.audio.level", comment: "Audio level")
    
    // Accessibility hints
    static let accessibilityPTTHint = NSLocalizedString("accessibility.ptt.hint", comment: "Press and hold to transmit")
    static let accessibilityChannelHint = NSLocalizedString("accessibility.channel.hint", comment: "Tap to select a channel")
    static let accessibilityEmergencyHint = NSLocalizedString("accessibility.emergency.hint", comment: "Tap to access emergency functions")
}
