import SwiftUI
import Foundation

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

// Placeholder views for missing components (Renamed to avoid conflicts with ChannelViews.swift)

struct PlaceholderChannelSelectionView: View {
    let channels: [PTTChannel]
    let stateManager: ParapenteStateManager
    
    var body: some View {
        VStack {
            Text("Channel Selection")
                .font(.title2)
                .padding()
            
            Text("Available channels will be displayed here")
                .foregroundColor(.gray)
        }
    }
}

struct PlaceholderPTTTransmissionView: View {
    let channel: PTTChannel
    let stateManager: ParapenteStateManager
    
    var body: some View {
        VStack {
            Text("PTT Transmission")
                .font(.title2)
                .padding()
            
            Text("Channel: \(channel.name)")
                .padding()
            
            Button("Transmit") {
                // Placeholder action
            }
            .buttonStyle(.borderedProminent)
        }
    }
}

struct PlaceholderActiveTransmissionView: View {
    let transmission: ActiveTransmission
    let stateManager: ParapenteStateManager
    
    var body: some View {
        VStack {
            Text("Active Transmission")
                .font(.title2)
                .padding()
            
            Text("Transmission in progress...")
                .foregroundColor(.red)
            
            Button("Stop") {
                // Placeholder action
            }
            .buttonStyle(.borderedProminent)
        }
    }
}

struct PlaceholderErrorView: View {
    let error: ParapenteError
    let stateManager: ParapenteStateManager
    
    var body: some View {
        VStack {
            Image(systemName: "exclamationmark.triangle")
                .foregroundColor(.red)
                .font(.largeTitle)
                .padding()
            
            Text("Error")
                .font(.title2)
                .padding()
            
            Text(error.localizedDescription)
                .foregroundColor(.gray)
                .multilineTextAlignment(.center)
                .padding()
            
            Button("Retry") {
                // Placeholder action
            }
            .buttonStyle(.borderedProminent)
        }
    }
}
