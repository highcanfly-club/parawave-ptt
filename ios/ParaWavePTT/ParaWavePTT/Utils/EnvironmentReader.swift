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

import Foundation

/// Utility class to read environment variables from .env file
/// This class is purely responsible for parsing .env files
class EnvironmentReader {

    private static var envVars: [String: String] = [:]
    private static var isLoaded = false

    /// Load environment variables from .env file at project root
    static func loadEnvironment() {
        guard !isLoaded else { return }
        // 1) Prefer a .env file embedded in the app bundle (copied during the build).
        if let resourceURL = Bundle.main.resourceURL {
            let bundleEnv = resourceURL.appendingPathComponent(".env")
            #if DEBUG
                print("🔍 Checking for .env in app bundle at: \(bundleEnv.path)")
            #endif
            if FileManager.default.fileExists(atPath: bundleEnv.path) {
                do {
                    let content = try String(contentsOf: bundleEnv, encoding: .utf8)
                    parseEnvironmentContent(content)
                    isLoaded = true
                    #if DEBUG
                        print("✅ Environment variables loaded from .env in app bundle")
                        print("   Found \(envVars.count) variables")
                    #endif
                    return
                } catch {
                    #if DEBUG
                        print("❌ Error reading .env from app bundle: \(error)")
                    #endif
                    isLoaded = true
                    return
                }
            }
        }

        // 2) Fallback to development project root (existing behavior)
        let projectRoot = findProjectRoot()
        let envPath = projectRoot.appendingPathComponent(".env")

        #if DEBUG
            print("🔍 Looking for .env file at: \(envPath.path)")
        #endif

        guard FileManager.default.fileExists(atPath: envPath.path) else {
            #if DEBUG
                print("⚠️ .env file not found at project root")
            #endif
            isLoaded = true
            return
        }

        do {
            let content = try String(contentsOf: envPath, encoding: .utf8)
            parseEnvironmentContent(content)
            isLoaded = true

            #if DEBUG
                print("✅ Environment variables loaded from .env file")
                print("   Found \(envVars.count) variables")
            #endif
        } catch {
            #if DEBUG
                print("❌ Error reading .env file: \(error)")
            #endif
            isLoaded = true
        }
    }

    // MARK: - Public Accessors

    /// Get environment variable value
    static func get(_ key: String) -> String? {
        loadEnvironment()
        return envVars[key]
    }

    /// Get environment variable with default value
    static func get(_ key: String, default: String) -> String {
        return get(key) ?? `default`
    }

    /// Get environment variable as Bool
    static func getBool(_ key: String, default: Bool = false) -> Bool {
        guard let value = get(key) else { return `default` }
        return ["true", "yes", "1", "on"].contains(value.lowercased())
    }

    /// Get environment variable as Int
    static func getInt(_ key: String, default: Int = 0) -> Int {
        guard let value = get(key), let intValue = Int(value) else { return `default` }
        return intValue
    }

    /// Get environment variable as Double
    static func getDouble(_ key: String, default: Double = 0.0) -> Double {
        guard let value = get(key), let doubleValue = Double(value) else { return `default` }
        return doubleValue
    }

    // MARK: - Private Implementation

    private static func findProjectRoot() -> URL {
        #if DEBUG
            // En mode DEBUG (développement), essayer de trouver le projet source
            if let projectPath = findDevelopmentProjectRoot() {
                return projectPath
            }
        #endif

        // Fallback pour mode production ou si projet source non trouvé
        return findBundleProjectRoot()
    }

    #if DEBUG
        /// Trouve la racine du projet de développement en remontant depuis le bundle
        private static func findDevelopmentProjectRoot() -> URL? {
            // Commencer par le bundle directory
            var currentURL = Bundle.main.bundleURL

            // Remonter jusqu'à trouver des marqueurs de projet de développement
            while currentURL.path != "/" && currentURL.path != "/Users" {
                // Vérifier si on a trouvé le fichier .env
                let envPath = currentURL.appendingPathComponent(".env")
                if FileManager.default.fileExists(atPath: envPath.path) {
                    print("🎯 Found .env at development path: \(currentURL.path)")
                    return currentURL
                }

                // Vérifier les marqueurs de projet de développement
                let developmentMarkers = [
                    "parawave.code-workspace",  // Votre workspace VS Code
                    "package.json",
                    ".git",
                    "turbo.json",  // Marker de votre monorepo
                    "ios/ParaWavePTT",  // Structure spécifique de votre projet
                ]

                for marker in developmentMarkers {
                    let markerPath = currentURL.appendingPathComponent(marker)
                    if FileManager.default.fileExists(atPath: markerPath.path) {
                        print("🔍 Found development marker '\(marker)' at: \(currentURL.path)")
                        // Vérifier si .env existe à ce niveau
                        let envPath = currentURL.appendingPathComponent(".env")
                        if FileManager.default.fileExists(atPath: envPath.path) {
                            print("✅ Found .env with marker at: \(currentURL.path)")
                            return currentURL
                        }
                    }
                }

                currentURL = currentURL.deletingLastPathComponent()
            }

            // Stratégie alternative : essayer de déduire le chemin depuis SRCROOT si disponible
            if let srcRoot = ProcessInfo.processInfo.environment["SRCROOT"] {
                let srcRootURL = URL(fileURLWithPath: srcRoot)
                let projectRoot = srcRootURL.deletingLastPathComponent()  // Remonter de ios/ vers racine
                let envPath = projectRoot.appendingPathComponent(".env")

                if FileManager.default.fileExists(atPath: envPath.path) {
                    print("✅ Found .env via SRCROOT at: \(projectRoot.path)")
                    return projectRoot
                }
            }

            // Dernière tentative : chemin hardcodé pour développement local
            let hardcodedPath = "/Users/rlemeill/Development/parawave-ptt"
            let hardcodedURL = URL(fileURLWithPath: hardcodedPath)
            let envPath = hardcodedURL.appendingPathComponent(".env")

            if FileManager.default.fileExists(atPath: envPath.path) {
                print("✅ Found .env at hardcoded development path: \(hardcodedPath)")
                return hardcodedURL
            }

            print("⚠️ Could not find development project root")
            return nil
        }
    #endif

    /// Trouve la racine du projet en remontant depuis le bundle (mode production)
    private static func findBundleProjectRoot() -> URL {
        var currentURL = Bundle.main.bundleURL

        // Go up directories until we find .env or reach root
        while currentURL.path != "/" {
            let envPath = currentURL.appendingPathComponent(".env")
            if FileManager.default.fileExists(atPath: envPath.path) {
                return currentURL
            }
            currentURL = currentURL.deletingLastPathComponent()
        }

        // Fallback: try to find project root by looking for specific markers
        currentURL = Bundle.main.bundleURL
        while currentURL.path != "/" {
            let markers = ["parawave.code-workspace", "package.json", ".git"]
            for marker in markers {
                let markerPath = currentURL.appendingPathComponent(marker)
                if FileManager.default.fileExists(atPath: markerPath.path) {
                    return currentURL
                }
            }
            currentURL = currentURL.deletingLastPathComponent()
        }

        // Ultimate fallback: use bundle directory
        return Bundle.main.bundleURL
    }

    private static func parseEnvironmentContent(_ content: String) {
        let lines = content.components(separatedBy: .newlines)

        for line in lines {
            let trimmedLine = line.trimmingCharacters(in: .whitespacesAndNewlines)

            // Skip empty lines and comments
            if trimmedLine.isEmpty || trimmedLine.hasPrefix("#") || trimmedLine.hasPrefix("//") {
                continue
            }

            // Parse KEY=VALUE format
            let components = trimmedLine.components(separatedBy: "=")
            guard components.count >= 2 else { continue }

            let key = components[0].trimmingCharacters(in: .whitespacesAndNewlines)
            let value = components.dropFirst().joined(separator: "=").trimmingCharacters(
                in: .whitespacesAndNewlines)

            // Remove quotes if present
            let cleanValue = removeQuotes(from: value)
            envVars[key] = cleanValue

            #if DEBUG && VERBOSE_ENV_LOADING
                print("   \(key) = \(cleanValue)")
            #endif
        }
    }

    private static func removeQuotes(from string: String) -> String {
        var result = string

        // Remove surrounding double quotes
        if result.hasPrefix("\"") && result.hasSuffix("\"") && result.count > 1 {
            result = String(result.dropFirst().dropLast())
        }

        // Remove surrounding single quotes
        if result.hasPrefix("'") && result.hasSuffix("'") && result.count > 1 {
            result = String(result.dropFirst().dropLast())
        }

        return result
    }

    // MARK: - Debug Helpers

    #if DEBUG
        static func printAllEnvironmentVariables() {
            loadEnvironment()
            print("🔧 All environment variables:")
            for (key, value) in envVars.sorted(by: { $0.key < $1.key }) {
                // Mask sensitive values
                let maskedValue = shouldMaskValue(for: key) ? "***MASKED***" : value
                print("   \(key) = \(maskedValue)")
            }
        }

        private static func shouldMaskValue(for key: String) -> Bool {
            let sensitiveKeys = [
                "AUTH0_CLIENT_SECRET",
                "AUTH0_MANAGEMENT_CLIENT_SECRET",
                "CLOUDFLARE_API_TOKEN",
                "CRYPTOKEN",
                "AUTH0_TOKEN",
            ]
            return sensitiveKeys.contains(key)
        }
    #endif
}
