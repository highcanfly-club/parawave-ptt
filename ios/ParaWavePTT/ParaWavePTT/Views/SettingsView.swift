import SwiftUI

//
// Copyright © 2025 Ronan Le Meillat
// Licensed under the GNU Affero General Public License v3.0 (AGPL-3.0)
// See: https://www.gnu.org/licenses/agpl-3.0.en.html
//

// Settings view for configuring app parameters
struct SettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject private var configManager = ConfigurationManager.shared
    
    @State private var tempRadius: Double
    
    init() {
        _tempRadius = State(initialValue: ConfigurationManager.shared.searchRadius)
    }
    
    var body: some View {
        NavigationView {
            Form {
                // General Settings Section
                Section(header: Text("Général")) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Rayon de recherche")
                            .font(.headline)
                        
                        Text("Distance maximale pour rechercher les canaux PTT autour de votre position (en km)")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        
                        HStack {
                            Slider(
                                value: $tempRadius,
                                in: 1...1000,
                                step: 5
                            )
                            .onChange(of: tempRadius) { newValue in
                                configManager.searchRadius = newValue
                            }
                            
                            Text("\(Int(tempRadius)) km")
                                .frame(width: 60, alignment: .trailing)
                                .font(.body.monospacedDigit())
                        }
                    }
                    .padding(.vertical, 8)
                }
                
                // // Audio Settings Section
                // Section(header: Text("Audio")) {
                //     Toggle("Réduction du bruit du vent", isOn: $configManager.windNoiseReductionEnabled)
                    
                //     Toggle("Contrôle automatique du gain", isOn: $configManager.autoGainControlEnabled)
                    
                //     Toggle("Boutons volume pour PTT", isOn: $configManager.volumeButtonsPTTEnabled)
                // }
                
                // // Security Settings Section
                // Section(header: Text("Sécurité")) {
                //     Toggle("Authentification biométrique", isOn: $configManager.biometricAuthEnabled)
                    
                //     Toggle("Notifications d'urgence", isOn: $configManager.emergencyNotificationsEnabled)
                // }
                
                // // Region Settings Section
                // Section(header: Text("Région")) {
                //     Picker("Région préférée", selection: $configManager.selectedRegion) {
                //         Text("Alpes françaises").tag("france_alps")
                //         Text("Pyrénées").tag("france_pyrenees")
                //         Text("Suisse").tag("switzerland")
                //         Text("Autriche").tag("austria")
                //         Text("Italie").tag("italy")
                //     }
                // }
                
                // // Language Settings Section
                // Section(header: Text("Langue")) {
                //     Picker("Langue", selection: $configManager.preferredLanguage) {
                //         Text("Français").tag("fr")
                //         Text("English").tag("en")
                //         Text("Deutsch").tag("de")
                //         Text("Italiano").tag("it")
                //     }
                // }
                
                // About Section
                Section(header: Text("À propos")) {
                    HStack {
                        Text("Version")
                        Spacer()
                        Text("1.0.0")
                            .foregroundColor(.secondary)
                    }
                    
                    HStack {
                        Text("Licence")
                        Spacer()
                        Text("AGPL-3.0")
                            .foregroundColor(.secondary)
                    }
                }
            }
            .navigationTitle("Paramètres")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Fermer") {
                        dismiss()
                    }
                }
            }
        }
    }
}

// MARK: - Preview

#Preview {
    SettingsView()
}
