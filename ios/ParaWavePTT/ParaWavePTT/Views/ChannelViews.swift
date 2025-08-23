import CoreLocation
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

// Channel selection and management views

// MARK: - Channel Selection View

struct ChannelSelectionView: View {
  @ObservedObject var stateManager: ParapenteStateManager
  @ObservedObject var networkService: ParapenteNetworkService
  @ObservedObject var locationManager: LocationManager

  var body: some View {
    VStack {
      Text("Channel Selection")
        .font(.title)

      Text("Select a channel to join")
        .foregroundColor(.secondary)

      Spacer()

      Button("Back") {
        Task {
          await stateManager.goBack()
        }
      }
      .buttonStyle(.borderedProminent)
    }
    .padding()
  }
}

// MARK: - PTT Transmission View

struct PTTTransmissionView: View {
  let channel: PTTChannel
  @ObservedObject var stateManager: ParapenteStateManager
  @ObservedObject var networkService: ParapenteNetworkService

  var body: some View {
    VStack(spacing: 20) {
      Text("Connected to:")
        .font(.headline)

      Text(channel.name)
        .font(.title)
        .fontWeight(.bold)

      // PTT Button
      Button(action: {
        Task {
          await stateManager.startTransmission()
        }
      }) {
        VStack {
          Image(systemName: "mic.fill")
            .font(.system(size: 50))
          Text("Press to Talk")
            .font(.headline)
        }
        .frame(width: 200, height: 200)
        .background(Color.blue)
        .foregroundColor(.white)
        .clipShape(Circle())
      }

      Spacer()

      Button("Leave Channel") {
        Task {
          await stateManager.leaveChannel()
        }
      }
      .buttonStyle(.bordered)
    }
    .padding()
  }
}

// MARK: - Active Transmission View

struct ActiveTransmissionView: View {
  let sessionId: String
  @ObservedObject var stateManager: ParapenteStateManager

  var body: some View {
    VStack(spacing: 20) {
      Text("TRANSMITTING")
        .font(.title)
        .fontWeight(.bold)
        .foregroundColor(.red)

      Image(systemName: "mic.fill")
        .font(.system(size: 80))
        .foregroundColor(.red)

      Text("Session: \(sessionId)")
        .font(.caption)
        .foregroundColor(.secondary)

      Button("Stop Transmission") {
        Task {
          await stateManager.stopTransmission()
        }
      }
      .buttonStyle(.borderedProminent)

      Spacer()
    }
    .padding()
  }
}

// MARK: - Error View

struct ErrorView: View {
  let error: ParapenteError
  @ObservedObject var stateManager: ParapenteStateManager

  var body: some View {
    VStack(spacing: 20) {
      Image(systemName: "exclamationmark.triangle.fill")
        .font(.system(size: 60))
        .foregroundColor(.red)

      Text("Error")
        .font(.title)
        .fontWeight(.bold)

      Text(error.localizedDescription)
        .multilineTextAlignment(.center)
        .padding()

      Button("Retry") {
        Task {
          await stateManager.retry()
        }
      }
      .buttonStyle(.borderedProminent)

      Button("Go Back") {
        Task {
          await stateManager.goBack()
        }
      }
      .buttonStyle(.bordered)
    }
    .padding()
  }
}
