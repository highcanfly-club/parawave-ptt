import Foundation
import os.log

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

// Centralized log manager for ParaWave PTT
class LogManager {
    
    static let shared = LogManager()
    
    // MARK: - Loggers by category
    
    private let authLogger = Logger(subsystem: "com.parawave.ptt", category: "Authentication")
    private let networkLogger = Logger(subsystem: "com.parawave.ptt", category: "Network")
    private let audioLogger = Logger(subsystem: "com.parawave.ptt", category: "Audio")
    private let pttLogger = Logger(subsystem: "com.parawave.ptt", category: "PTT")
    private let locationLogger = Logger(subsystem: "com.parawave.ptt", category: "Location")
    private let uiLogger = Logger(subsystem: "com.parawave.ptt", category: "UI")
    private let systemLogger = Logger(subsystem: "com.parawave.ptt", category: "System")
    
    // Logging configuration
    private let maxLogEntries = 1000
    private var logEntries: [LogEntry] = []
    private let logQueue = DispatchQueue(label: "com.parawave.ptt.logging", qos: .utility)
    
    private init() {
        #if DEBUG
        print("📝 Log Manager initialized")
        #endif
    }
    
    // MARK: - Public Logging Methods
    
    /// Authentication log
    func auth(_ message: String, level: LogLevel = .info, file: String = #file, function: String = #function, line: Int = #line) {
        log(message: message, level: level, category: .authentication, file: file, function: function, line: line)
        authLogger.log(level: level.osLogType, "\(message)")
    }
    
    /// Network log
    func network(_ message: String, level: LogLevel = .info, file: String = #file, function: String = #function, line: Int = #line) {
        log(message: message, level: level, category: .network, file: file, function: function, line: line)
        networkLogger.log(level: level.osLogType, "\(message)")
    }
    
    /// Audio log
    func audio(_ message: String, level: LogLevel = .info, file: String = #file, function: String = #function, line: Int = #line) {
        log(message: message, level: level, category: .audio, file: file, function: function, line: line)
        audioLogger.log(level: level.osLogType, "\(message)")
    }
    
    /// PTT log
    func ptt(_ message: String, level: LogLevel = .info, file: String = #file, function: String = #function, line: Int = #line) {
        log(message: message, level: level, category: .ptt, file: file, function: function, line: line)
        pttLogger.log(level: level.osLogType, "\(message)")
    }
    
    /// Location log
    func location(_ message: String, level: LogLevel = .info, file: String = #file, function: String = #function, line: Int = #line) {
        log(message: message, level: level, category: .location, file: file, function: function, line: line)
        locationLogger.log(level: level.osLogType, "\(message)")
    }
    
    /// UI log
    func ui(_ message: String, level: LogLevel = .info, file: String = #file, function: String = #function, line: Int = #line) {
        log(message: message, level: level, category: .ui, file: file, function: function, line: line)
        uiLogger.log(level: level.osLogType, "\(message)")
    }
    
    /// System log
    func system(_ message: String, level: LogLevel = .info, file: String = #file, function: String = #function, line: Int = #line) {
        log(message: message, level: level, category: .system, file: file, function: function, line: line)
        systemLogger.log(level: level.osLogType, "\(message)")
    }
    
    // MARK: - Specialized Logging
    
    /// Function entry log
    func enter(_ function: String = #function, file: String = #file, line: Int = #line) {
        #if DEBUG
        let fileName = (file as NSString).lastPathComponent
        system("→ \(function)", level: .debug, file: file, function: function, line: line)
        #endif
    }
    
    /// Function exit log
    func exit(_ function: String = #function, file: String = #file, line: Int = #line) {
        #if DEBUG
        let fileName = (file as NSString).lastPathComponent
        system("← \(function)", level: .debug, file: file, function: function, line: line)
        #endif
    }
    
    /// Error log with context
    func error(_ error: Error, context: String = "", file: String = #file, function: String = #function, line: Int = #line) {
        let message = context.isEmpty ? error.localizedDescription : "\(context): \(error.localizedDescription)"
        log(message: message, level: .error, category: .system, file: file, function: function, line: line)
        systemLogger.error("\(message)")
    }
    
    /// Performance log
    func performance(_ operation: String, duration: TimeInterval, file: String = #file, function: String = #function, line: Int = #line) {
        let message = "⏱️ \(operation) completed in \(String(format: "%.3f", duration))s"
        log(message: message, level: .info, category: .system, file: file, function: function, line: line)
        systemLogger.info("\(message)")
    }
    
    /// Metric log
    func metric(name: String, value: Any, unit: String? = nil, file: String = #file, function: String = #function, line: Int = #line) {
        let unitString = unit.map { " \($0)" } ?? ""
        let message = "📊 \(name): \(value)\(unitString)"
        log(message: message, level: .info, category: .system, file: file, function: function, line: line)
        systemLogger.info("\(message)")
    }
    
    // MARK: - Private Methods
    
    private func log(message: String, level: LogLevel, category: LogCategory, file: String, function: String, line: Int) {
        let entry = LogEntry(
            message: message,
            level: level,
            category: category,
            timestamp: Date(),
            file: (file as NSString).lastPathComponent,
            function: function,
            line: line,
            thread: Thread.current.name ?? "Unknown"
        )
        
        logQueue.async {
            self.addLogEntry(entry)
        }
        
        #if DEBUG
        let emoji = level.emoji
        let categoryName = category.rawValue.uppercased()
        let fileName = (file as NSString).lastPathComponent
        let threadInfo = Thread.isMainThread ? "[MAIN]" : "[BG]"
        
        print("\(emoji) [\(categoryName)] \(threadInfo) \(fileName):\(line) \(function) - \(message)")
        #endif
    }
    
    private func addLogEntry(_ entry: LogEntry) {
        logEntries.append(entry)
        
        // Limiter le nombre d'entrées
        if logEntries.count > maxLogEntries {
            logEntries.removeFirst(logEntries.count - maxLogEntries)
        }
    }
    
    // MARK: - Log Export and Management
    
    /// Return all logs
    func getAllLogs() -> [LogEntry] {
        return logQueue.sync {
            return logEntries
        }
    }
    
    /// Return filtered logs
    func getLogs(category: LogCategory? = nil, level: LogLevel? = nil, since: Date? = nil) -> [LogEntry] {
        return logQueue.sync {
            return logEntries.filter { entry in
                if let category = category, entry.category != category { return false }
                if let level = level, entry.level.rawValue < level.rawValue { return false }
                if let since = since, entry.timestamp < since { return false }
                return true
            }
        }
    }
    
    /// Clear all logs
    func clearLogs() {
        logQueue.async {
            self.logEntries.removeAll()
        }
        
        #if DEBUG
        print("📝 All logs cleared")
        #endif
    }
    
    /// Export logs as text
    func exportLogs(category: LogCategory? = nil, level: LogLevel? = nil) -> String {
        let logs = getLogs(category: category, level: level)
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd HH:mm:ss.SSS"
        
        return logs.map { entry in
            let timestamp = formatter.string(from: entry.timestamp)
            let levelStr = entry.level.rawValue.uppercased()
            let categoryStr = entry.category.rawValue.uppercased()
            return "[\(timestamp)] [\(levelStr)] [\(categoryStr)] \(entry.file):\(entry.line) \(entry.function) - \(entry.message)"
        }.joined(separator: "\n")
    }
    
    /// Save logs to file
    func saveLogs(to url: URL) throws {
        let content = exportLogs()
        try content.write(to: url, atomically: true, encoding: .utf8)
        
        system("Logs saved to \(url.path)")
    }
    
    // MARK: - Debug Utilities
    
    /// Print a summary of logs
    func printLogSummary() {
        #if DEBUG
        let logs = getAllLogs()
        let counts = Dictionary(grouping: logs) { $0.level }.mapValues { $0.count }
        
        print("📝 Log Summary:")
        print("   Total entries: \(logs.count)")
        LogLevel.allCases.forEach { level in
            let count = counts[level] ?? 0
            if count > 0 {
                print("   \(level.emoji) \(level.rawValue.capitalized): \(count)")
            }
        }
        
        if let oldest = logs.first?.timestamp, let newest = logs.last?.timestamp {
            let duration = newest.timeIntervalSince(oldest)
            print("   Time span: \(String(format: "%.1f", duration))s")
        }
        #endif
    }
    
    /// Benchmark an operation
    func benchmark<T>(_ operation: String, file: String = #file, function: String = #function, line: Int = #line, block: () throws -> T) rethrows -> T {
        let startTime = CFAbsoluteTimeGetCurrent()
        let result = try block()
        let duration = CFAbsoluteTimeGetCurrent() - startTime
        
        performance(operation, duration: duration, file: file, function: function, line: line)
        
        return result
    }
    
    /// Benchmark an async operation
    func benchmark<T>(_ operation: String, file: String = #file, function: String = #function, line: Int = #line, block: () async throws -> T) async rethrows -> T {
        let startTime = CFAbsoluteTimeGetCurrent()
        let result = try await block()
        let duration = CFAbsoluteTimeGetCurrent() - startTime
        
        performance(operation, duration: duration, file: file, function: function, line: line)
        
        return result
    }
}

// MARK: - Supporting Types

enum LogLevel: Int, CaseIterable {
    case debug = 0
    case info = 1
    case warning = 2
    case error = 3
    case critical = 4
    
    var emoji: String {
        switch self {
        case .debug: return "🐛"
        case .info: return "ℹ️"
        case .warning: return "⚠️"
        case .error: return "❌"
        case .critical: return "🚨"
        }
    }
    
    var osLogType: OSLogType {
        switch self {
        case .debug: return .debug
        case .info: return .info
        case .warning: return .default
        case .error: return .error
        case .critical: return .fault
        }
    }
}

enum LogCategory: String, CaseIterable {
    case authentication = "auth"
    case network = "network"
    case audio = "audio"
    case ptt = "ptt"
    case location = "location"
    case ui = "ui"
    case system = "system"
}

struct LogEntry: Identifiable {
    let id = UUID()
    let message: String
    let level: LogLevel
    let category: LogCategory
    let timestamp: Date
    let file: String
    let function: String
    let line: Int
    let thread: String
}

// MARK: - Extensions

extension Thread {
    var name: String? {
        if isMainThread {
            return "main"
        } else if let name = self.name, !name.isEmpty {
            return name
        } else {
            return String(format: "%p", self)
        }
    }
}

// MARK: - Global Logging Functions

/// Fonctions globales pour un logging facile
func logAuth(_ message: String, level: LogLevel = .info) {
    LogManager.shared.auth(message, level: level)
}

func logNetwork(_ message: String, level: LogLevel = .info) {
    LogManager.shared.network(message, level: level)
}

func logAudio(_ message: String, level: LogLevel = .info) {
    LogManager.shared.audio(message, level: level)
}

func logPTT(_ message: String, level: LogLevel = .info) {
    LogManager.shared.ptt(message, level: level)
}

func logLocation(_ message: String, level: LogLevel = .info) {
    LogManager.shared.location(message, level: level)
}

func logUI(_ message: String, level: LogLevel = .info) {
    LogManager.shared.ui(message, level: level)
}

func logSystem(_ message: String, level: LogLevel = .info) {
    LogManager.shared.system(message, level: level)
}

func logError(_ error: Error, context: String = "") {
    LogManager.shared.error(error, context: context)
}
