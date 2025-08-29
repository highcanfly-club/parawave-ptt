import AVFoundation
import CoreLocation
import SwiftUI

//
// Copyright © 2025 Ronan Le Meillat
// Licensed under the GNU Affero General Public License v3.0 (AGPL-3.0)
// See: https://www.gnu.org/licenses/agpl-3.0.en.html
//

// Main application view
struct ContentView: View {
  @StateObject private var appStateManager = ParapenteStateManager()
  @StateObject private var networkService = ParapenteNetworkService()
  @StateObject private var locationManager = LocationManager()

  var body: some View {
    NavigationView {
      ZStack {
        // Gradient background
        LinearGradient(
          colors: [.blue.opacity(0.1), .green.opacity(0.1)],
          startPoint: .topLeading,
          endPoint: .bottomTrailing
        )

        // Main content based on app state
        mainContent
      }
    }
    .onAppear {
      Task {
        await appStateManager.initialize(networkService: networkService)
      }
    }
    .alert(LocalizableStrings.errorGenericTitle, isPresented: $appStateManager.showError) {
      Button(LocalizableStrings.errorOKButton) {
        appStateManager.clearError()
      }
    } message: {
      Text(appStateManager.errorMessage)
    }
  }

  @ViewBuilder
  private var mainContent: some View {
    switch appStateManager.currentState {
    case .launching:
      LaunchView()

    case .authentication:
      AuthenticationView(stateManager: appStateManager)

    case .authenticated(let permissions):
      MainPTTView(
        stateManager: appStateManager,
        networkService: networkService,
        locationManager: locationManager,
        userPermissions: permissions
      )

    case .channelSelection:
      ChannelSelectionView(
        stateManager: appStateManager,
        networkService: networkService,
        locationManager: locationManager
      )

    case .channelJoined(let channel):
      PTTTransmissionView(
        channel: channel,
        stateManager: appStateManager,
        networkService: networkService
      )

    case .activeTransmission(let sessionId):
      ActiveTransmissionView(
        sessionId: sessionId,
        stateManager: appStateManager
      )

    case .error(let error):
      ErrorView(error: error, stateManager: appStateManager)
    }
  }
}

// MARK: - Launch View

struct LaunchView: View {
  var body: some View {
    VStack(spacing: 30) {
      VStack(spacing: 16) {
        Image(systemName: "antenna.radiowaves.left.and.right")
          .font(.system(size: 80))
          .foregroundColor(.blue)

        Text(LocalizableStrings.appName)
          .font(.largeTitle)
          .fontWeight(.bold)

        Text(LocalizableStrings.appTagline)
          .font(.title2)
          .foregroundColor(.secondary)
          .multilineTextAlignment(.center)
      }

      // Loading indicator
      ProgressView()
        .scaleEffect(1.5)
    }
    .padding()
  }
}

// MARK: - Authentication View

struct AuthenticationView: View {
  @ObservedObject var stateManager: ParapenteStateManager

  var body: some View {
    VStack(spacing: 30) {
      VStack(spacing: 16) {
        Image(systemName: "person.badge.key")
          .font(.system(size: 60))
          .foregroundColor(.blue)

        Text(LocalizableStrings.authLoginButton)
          .font(.title)
          .fontWeight(.semibold)

        Text(LocalizableStrings.authBiometricPrompt)
          .font(.body)
          .foregroundColor(.secondary)
          .multilineTextAlignment(.center)
      }

      // Login button
      Button(action: {
        Task {
          await stateManager.authenticateWithAuth0()
        }
      }) {
        HStack {
          Image(systemName: "person.circle.fill")
          Text(LocalizableStrings.authLoginButton)
        }
        .font(.headline)
        .foregroundColor(.white)
        .frame(maxWidth: .infinity)
        .frame(height: 50)
        .background(Color.blue)
        .cornerRadius(25)
      }

      Spacer()
    }
    .padding()
  }
}

// MARK: - Main PTT View

struct MainPTTView: View {
  @ObservedObject var stateManager: ParapenteStateManager
  @ObservedObject var networkService: ParapenteNetworkService
  @ObservedObject var locationManager: LocationManager

  let userPermissions: [String]

  @State private var selectedChannel: PTTChannel?
  @State private var availableChannels: [PTTChannel] = []
  @State private var showChannelSelection = false

  var body: some View {
    VStack(spacing: 20) {
      // Network status bar
      NetworkStatusBar(networkService: networkService, locationManager: locationManager)

      // Channel selector
      ChannelSelector(
        selectedChannel: $selectedChannel,
        availableChannels: availableChannels,
        showChannelSelection: $showChannelSelection
      )

      Spacer()

      // Main PTT button
      MainPTTButton(
        isEnabled: selectedChannel != nil && networkService.isConnected,
        action: {
          if let channel = selectedChannel {
            Task {
              await stateManager.joinChannel(channel)
            }
          }
        }
      )

      Spacer()

      // Secondary action buttons
      HStack(spacing: 20) {
        // Settings button
        Button(action: {
          // Open the settings
        }) {
          Image(systemName: "gearshape")
            .font(.title2)
            .foregroundColor(.blue)
            .frame(width: 50, height: 50)
            .background(Color.blue.opacity(0.1))
            .clipShape(Circle())
        }

        Spacer()

        // Emergency button
        EmergencyButton(stateManager: stateManager)
      }
      .padding(.horizontal)
    }
    .padding()
    .navigationTitle(LocalizableStrings.appName)
    .navigationBarTitleDisplayMode(.inline)
    .task {
      await loadAvailableChannels()
    }
    .sheet(isPresented: $showChannelSelection) {
      ChannelSelectionSheet(
        channels: availableChannels,
        selectedChannel: $selectedChannel,
        userPermissions: userPermissions
      )
    }
  }

  private func loadAvailableChannels() async {
    do {
      let channels = try await networkService.getChannels(
        location: locationManager.currentLocation,
        radius: 50.0
      )

      await MainActor.run {
        self.availableChannels = channels
      }
    } catch {
      print("Error loading channels: \(error)")
    }
  }
}

// MARK: - Network Status Bar

struct NetworkStatusBar: View {
  @ObservedObject var networkService: ParapenteNetworkService
  @ObservedObject var locationManager: LocationManager

  var body: some View {
    HStack {
      // Network status
      HStack(spacing: 8) {
        Circle()
          .fill(networkService.isConnected ? Color.green : Color.red)
          .frame(width: 10, height: 10)

        Text(networkStatusText)
          .font(.caption)
          .foregroundColor(.secondary)
      }

      Spacer()

      // GPS status
      HStack(spacing: 4) {
        Image(systemName: locationManager.isAuthorized ? "location.fill" : "location.slash")
          .font(.caption)
          .foregroundColor(locationManager.isAuthorized ? .blue : .gray)

        Text(locationStatusText)
          .font(.caption)
          .foregroundColor(.secondary)
      }
    }
    .padding(.horizontal)
    .padding(.vertical, 8)
    .background(Color.gray.opacity(0.1))
    .cornerRadius(8)
  }

  private var networkStatusText: String {
    if !networkService.isConnected {
      return LocalizableStrings.networkOffline
    }

    let typeText = networkService.connectionType == .cellular ? "4G/5G" : "WiFi"
    return "\(typeText) - \(networkService.networkQuality.displayName)"
  }

  private var locationStatusText: String {
    if let location = locationManager.currentLocation {
      return String(
        format: "%.3f°, %.3f°", location.coordinate.latitude, location.coordinate.longitude)
    } else {
      return locationManager.isAuthorized
        ? LocalizableStrings.locationSearching : LocalizableStrings.locationDisabled
    }
  }
}

// MARK: - Channel Selector

struct ChannelSelector: View {
  @Binding var selectedChannel: PTTChannel?
  let availableChannels: [PTTChannel]
  @Binding var showChannelSelection: Bool

  var body: some View {
    VStack(spacing: 12) {
      Text(LocalizableStrings.mainChannelLabel)
        .font(.headline)
        .foregroundColor(.primary)

      Button(action: {
        showChannelSelection = true
      }) {
        HStack {
          VStack(alignment: .leading, spacing: 4) {
            Text(selectedChannel?.name ?? LocalizableStrings.channelNoSelection)
              .font(.title2)
              .fontWeight(.semibold)
              .foregroundColor(.primary)

            if let channel = selectedChannel {
              Text(channel.type.displayName)
                .font(.caption)
                .foregroundColor(.secondary)
            }
          }

          Spacer()

          Image(systemName: "chevron.down")
            .foregroundColor(.blue)
        }
        .padding()
        .background(Color.white)
        .overlay(
          RoundedRectangle(cornerRadius: 12)
            .stroke(selectedChannel != nil ? Color.blue : Color.gray, lineWidth: 2)
        )
        .cornerRadius(12)
      }
    }
  }
}

// MARK: - Main PTT Button

struct MainPTTButton: View {
  let isEnabled: Bool
  let action: () -> Void

  @State private var isPressed = false

  var body: some View {
    Button(action: action) {
      VStack(spacing: 8) {
        Image(systemName: "mic.fill")
          .font(.system(size: 40))
          .foregroundColor(.white)

        Text(LocalizableStrings.mainJoinChannel)
          .font(.headline)
          .fontWeight(.bold)
          .foregroundColor(.white)
      }
      .frame(width: 180, height: 180)
      .background(
        Circle()
          .fill(isEnabled ? Color.blue : Color.gray)
          .scaleEffect(isPressed ? 0.95 : 1.0)
      )
      .overlay(
        Circle()
          .stroke(Color.white, lineWidth: 4)
          .scaleEffect(isPressed ? 0.95 : 1.0)
      )
    }
    .disabled(!isEnabled)
    .scaleEffect(isPressed ? 0.95 : 1.0)
    .onTapGesture {
      withAnimation(.easeInOut(duration: 0.1)) {
        isPressed = true
      }

      DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
        withAnimation(.easeInOut(duration: 0.1)) {
          isPressed = false
        }
        action()
      }
    }
  }
}

// MARK: - Emergency Button

struct EmergencyButton: View {
  @ObservedObject var stateManager: ParapenteStateManager
  @State private var showEmergencyAlert = false

  var body: some View {
    Button(action: {
      showEmergencyAlert = true
    }) {
      VStack(spacing: 4) {
        Image(systemName: "exclamationmark.triangle.fill")
          .font(.title2)
          .foregroundColor(.white)

        Text(LocalizableStrings.emergencyChannelButton)
          .font(.caption)
          .fontWeight(.bold)
          .foregroundColor(.white)
      }
      .frame(width: 60, height: 50)
      .background(Color.red)
      .cornerRadius(12)
    }
    .alert("Emergency", isPresented: $showEmergencyAlert) {
      Button("Call 112", role: .destructive) {
        callEmergencyServices()
      }

      Button("Emergency Channel") {
        Task {
          await stateManager.joinEmergencyChannel()
        }
      }

      Button("Cancel", role: .cancel) {}
    } message: {
      Text("Select the type of emergency:")
    }
  }

  private func callEmergencyServices() {
    if let url = URL(string: "tel://112") {
      UIApplication.shared.open(url)
    }
  }
}

// MARK: - Channel Selection Sheet

struct ChannelSelectionSheet: View {
  let channels: [PTTChannel]
  @Binding var selectedChannel: PTTChannel?
  let userPermissions: [String]

  @Environment(\.dismiss) private var dismiss

  var body: some View {
    NavigationView {
      List {
        ForEach(filteredChannels, id: \.uuid) { channel in
          ChannelRow(
            channel: channel,
            isSelected: selectedChannel?.uuid == channel.uuid,
            canAccess: canAccessChannel(channel)
          ) {
            selectedChannel = channel
            dismiss()
          }
        }
      }
      .navigationTitle(LocalizableStrings.channelSelectTitle)
      .navigationBarTitleDisplayMode(.inline)
      .navigationBarBackButtonHidden()
      .toolbar {
        ToolbarItem(placement: .navigationBarTrailing) {
          Button(LocalizableStrings.generalClose) {
            dismiss()
          }
        }
      }
    }
  }

  private var filteredChannels: [PTTChannel] {
    return channels.filter { channel in
      canAccessChannel(channel)
    }
  }

  private func canAccessChannel(_ channel: PTTChannel) -> Bool {
    let accessPermission = "access:\(channel.uuid.lowercased())"
    return userPermissions.contains(accessPermission) || userPermissions.contains("admin:api")
  }
}

// MARK: - Channel Row

struct ChannelRow: View {
  let channel: PTTChannel
  let isSelected: Bool
  let canAccess: Bool
  let action: () -> Void

  var body: some View {
    Button(action: action) {
      HStack {
        VStack(alignment: .leading, spacing: 4) {
          HStack {
            Text(channel.name)
              .font(.headline)
              .foregroundColor(.primary)

            if !canAccess {
              Image(systemName: "lock.fill")
                .font(.caption)
                .foregroundColor(.orange)
            }
          }

          Text(channel.type.displayName)
            .font(.subheadline)
            .foregroundColor(.secondary)

          if let description = channel.description {
            Text(description)
              .font(.caption)
              .foregroundColor(.secondary)
              .lineLimit(2)
          }
        }

        Spacer()

        VStack(alignment: .trailing) {
          if let stats = channel.stats {
            Text("\(stats.activeParticipants) utilisateurs")
              .font(.caption)
              .foregroundColor(.secondary)
          }

          if isSelected {
            Image(systemName: "checkmark.circle.fill")
              .foregroundColor(.blue)
          }
        }
      }
      .padding(.vertical, 4)
    }
    .disabled(!canAccess)
    .opacity(canAccess ? 1.0 : 0.6)
  }
}

// MARK: - Location Manager

class LocationManager: NSObject, ObservableObject, CLLocationManagerDelegate {
  private let locationManager = CLLocationManager()

  @Published var currentLocation: CLLocation?
  @Published var isAuthorized = false

  override init() {
    super.init()
    locationManager.delegate = self
    locationManager.desiredAccuracy = kCLLocationAccuracyBest
    locationManager.requestWhenInUseAuthorization()
  }

  func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
    currentLocation = locations.last
  }

  func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
    switch manager.authorizationStatus {
    case .authorizedWhenInUse, .authorizedAlways:
      isAuthorized = true
      locationManager.startUpdatingLocation()
    case .denied, .restricted:
      isAuthorized = false
    case .notDetermined:
      locationManager.requestWhenInUseAuthorization()
    @unknown default:
      isAuthorized = false
    }
  }
}

// MARK: - Preview

#Preview {
  ContentView()
}
