import Foundation
import Security
import CommonCrypto

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

// Secure manager for storing Auth0 tokens in the iOS keychain
class Auth0KeychainManager {
    private let service = "com.highcanfly.parawaveptt.auth0"
    private let accessTokenKey = "auth0_access_token"
    private let refreshTokenKey = "auth0_refresh_token"
    private let expiryDateKey = "auth0_token_expiry"
    private let userIdKey = "auth0_user_id"
    private let permissionsKey = "auth0_permissions"
    
    // MARK: - Token Storage
    
    /// Store Auth0 tokens securely
    /*
     Copyright (C) 2025 Ronan Le Meillat
     SPDX-License-Identifier: AGPL-3.0-or-later
     */
    func storeTokens(accessToken: String, refreshToken: String?, expiresIn: TimeInterval) throws {
        let expiryDate = Date().addingTimeInterval(expiresIn)
        
        try storeInKeychain(key: accessTokenKey, value: accessToken)
        try storeInKeychain(key: expiryDateKey, value: ISO8601DateFormatter().string(from: expiryDate))
        
        if let refreshToken = refreshToken {
            try storeInKeychain(key: refreshTokenKey, value: refreshToken)
        }
    }
    
    /// Store user information and permissions
    func storeUserInfo(userId: String, permissions: [String]) throws {
        try storeInKeychain(key: userIdKey, value: userId)
        
        let permissionsData = try JSONEncoder().encode(permissions)
        if let permissionsString = String(data: permissionsData, encoding: .utf8) {
            try storeInKeychain(key: permissionsKey, value: permissionsString)
        }
    }
    
    // MARK: - Token Retrieval
    
    /// Retrieve a valid access token or nil if expired
    func getValidAccessToken() throws -> String? {
        guard let token = try getFromKeychain(key: accessTokenKey),
            let expiryString = try getFromKeychain(key: expiryDateKey) else { return nil }
        guard let expiryDate = ISO8601DateFormatter().date(from: expiryString) else { return nil }
        
        // Check if the token expires in less than 5 minutes
        if expiryDate.timeIntervalSinceNow <= 300 {
            return nil // Token expired or will expire soon
        }
        
        return token
    }
    
    /// Retrieve the refresh token
    func getRefreshToken() throws -> String? {
        return try getFromKeychain(key: refreshTokenKey)
    }
    
    /// Retrieve the stored user ID
    func getUserId() throws -> String? {
        return try getFromKeychain(key: userIdKey)
    }
    
    /// Retrieve user permissions
    func getUserPermissions() throws -> [String]? {
        guard let permissionsString = try getFromKeychain(key: permissionsKey),
              let permissionsData = permissionsString.data(using: .utf8) else {
            return nil
        }
        
        return try JSONDecoder().decode([String].self, from: permissionsData)
    }
    
    // MARK: - Token Validation
    
    /// Check if the user has a specific permission
    func hasPermission(_ permission: String) -> Bool {
        do {
            let permissions = try getUserPermissions() ?? []
            return permissions.contains(permission) || permissions.contains("admin:api") 
        } catch {
            print("Error while checking permissions: \(error)")
            return false
        }
    }
    
    /// Check if the user can access a specific channel
    func canAccessChannel(_ channelUuid: String) -> Bool {
        let accessPermission = "access:\(channelUuid.lowercased())"
        return hasPermission(accessPermission) || hasPermission("admin:api")
    }
    
    // MARK: - Cleanup
    
    /// Delete all Auth0 tokens
    func deleteAllTokens() throws {
        let keys = [accessTokenKey, refreshTokenKey, expiryDateKey, userIdKey, permissionsKey]
        
        for key in keys {
            let query: [String: Any] = [
                kSecClass as String: kSecClassGenericPassword,
                kSecAttrService as String: service,
                kSecAttrAccount as String: key
            ]
            
            let status = SecItemDelete(query as CFDictionary)
            if status != errSecSuccess && status != errSecItemNotFound {
                throw KeychainError.deletionError(status)
            }
        }
    }
    
    // MARK: - Private Helper Methods
    
    private func storeInKeychain(key: String, value: String) throws {
        guard let data = value.data(using: .utf8) else {
            throw KeychainError.invalidData
        }
        
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        ]
        
    // Try to delete the existing item first
    SecItemDelete(query as CFDictionary)

    // Add the new item
        let status = SecItemAdd(query as CFDictionary, nil)
        
        guard status == errSecSuccess else {
            throw KeychainError.storageError(status)
        }
    }
    
    private func getFromKeychain(key: String) throws -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        
        guard status == errSecSuccess else {
            if status == errSecItemNotFound {
                return nil
            }
            throw KeychainError.retrievalError(status)
        }
        
        guard let data = result as? Data,
              let string = String(data: data, encoding: .utf8) else {
            throw KeychainError.invalidData
        }
        
        return string
    }
}

// MARK: - Keychain Error Types

enum KeychainError: Error, LocalizedError {
    case storageError(OSStatus)
    case retrievalError(OSStatus)
    case deletionError(OSStatus)
    case invalidData
    case tokenRefreshFailed
    
    var errorDescription: String? {
        switch self {
        case .storageError(let status):
            return "Keychain storage error: \(status)"
        case .retrievalError(let status):
            return "Keychain retrieval error: \(status)"
        case .deletionError(let status):
            return "Keychain deletion error: \(status)"
        case .invalidData:
            return "Invalid data for keychain"
        case .tokenRefreshFailed:
            return "Token refresh failed"
        }
    }
}

// MARK: - Auth0 Integration Helper

extension Auth0KeychainManager {
    
    /// Structure for Auth0 token information
    struct Auth0TokenInfo {
        let accessToken: String
        let refreshToken: String?
        let expiresIn: TimeInterval
        let userId: String?
        let permissions: [String]
        
        var isValid: Bool {
            return Date().addingTimeInterval(expiresIn) > Date().addingTimeInterval(300) // At least 5 minutes remaining
        }
    }
    
    /// Met à jour les tokens avec les informations complètes
    func updateTokenInfo(_ tokenInfo: Auth0TokenInfo) throws {
        try storeTokens(
            accessToken: tokenInfo.accessToken,
            refreshToken: tokenInfo.refreshToken,
            expiresIn: tokenInfo.expiresIn
        )
        
        if let userId = tokenInfo.userId {
            try storeUserInfo(userId: userId, permissions: tokenInfo.permissions)
        }
        
    // Schedule an automatic renewal notification
    scheduleTokenRenewalNotification(expiresIn: tokenInfo.expiresIn)
    }
    
    /// Schedule a notification for token renewal
    private func scheduleTokenRenewalNotification(expiresIn: TimeInterval) {
        let renewalTime = max(expiresIn - 600, 60) // 10 minutes avant expiration, minimum 1 minute
        
        DispatchQueue.main.asyncAfter(deadline: .now() + renewalTime) {
            NotificationCenter.default.post(
                name: .auth0TokenWillExpire,
                object: nil
            )
        }
    }
    
    /// Check the full authentication status
    func getAuthenticationStatus() -> AuthenticationStatus {
        do {
            guard let accessToken = try getValidAccessToken(),
                  let userId = try getUserId(),
                  let permissions = try getUserPermissions() else {
                return .unauthenticated
            }
            
            return .authenticated(
                accessToken: accessToken,
                userId: userId,
                permissions: permissions
            )
        } catch {
            return .error(error)
        }
    }
}

// MARK: - Authentication Status

enum AuthenticationStatus {
    case unauthenticated
    case authenticated(accessToken: String, userId: String, permissions: [String])
    case error(Error)
    
    var isAuthenticated: Bool {
        if case .authenticated = self {
            return true
        }
        return false
    }
    
    var accessToken: String? {
        if case .authenticated(let token, _, _) = self {
            return token
        }
        return nil
    }
    
    var permissions: [String] {
        if case .authenticated(_, _, let perms) = self {
            return perms
        }
        return []
    }
}

// MARK: - Notifications

extension Notification.Name {
    static let auth0TokenWillExpire = Notification.Name("auth0TokenWillExpire")
    static let auth0AuthenticationStateChanged = Notification.Name("auth0AuthenticationStateChanged")
}

// MARK: - Security Extensions

extension Auth0KeychainManager {
    
    /// Generate a secure hash for data validation
    func generateSecureHash(for data: String) -> String? {
        guard let data = data.data(using: .utf8) else { return nil }
        
        var hash = [UInt8](repeating: 0, count: Int(CC_SHA256_DIGEST_LENGTH))
        data.withUnsafeBytes {
            _ = CC_SHA256($0.baseAddress, CC_LONG(data.count), &hash)
        }
        
        return hash.compactMap { String(format: "%02x", $0) }.joined()
    }
    
    /// Validate the integrity of stored data
    func validateStoredData() -> Bool {
        do {
            // Verify that tokens exist and are consistent
            let accessToken = try getFromKeychain(key: accessTokenKey)
            let expiryString = try getFromKeychain(key: expiryDateKey)
            
            if accessToken != nil && expiryString != nil {
                // Check the validity of the expiry date
                if let expiryDate = ISO8601DateFormatter().date(from: expiryString!) {
                    return expiryDate > Date()
                }
            }
            
            return false
        } catch {
            return false
        }
    }
}

// MARK: - Debug Helpers

#if DEBUG
extension Auth0KeychainManager {
    
    /// Debug methods for development
    func debugPrintStoredData() {
        print("=== Auth0 Keychain Debug Info ===")
        
        do {
            if let token = try getValidAccessToken() {
                print("Access Token: \(String(token.prefix(20)))...")
            } else {
                print("Access Token: None or expired")
            }
            
            if let userId = try getUserId() {
                print("User ID: \(userId)")
            } else {
                print("User ID: None")
            }
            
            if let permissions = try getUserPermissions() {
                print("Permissions: \(permissions)")
            } else {
                print("Permissions: None")
            }
            
        } catch {
            print("Error reading keychain: \(error)")
        }
        
        print("==================================")
    }
    
    /// Completely clear the keychain for tests
    func debugClearAll() {
        do {
            try deleteAllTokens()
            print("Keychain cleared successfully")
        } catch {
            print("Error clearing keychain: \(error)")
        }
    }
}
#endif
