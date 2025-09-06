import CLibWebM
import Foundation

/// WebM error types
public enum WebMError: Error {
    case success
    case invalidFile
    case corruptedData
    case unsupportedFormat
    case ioError
    case outOfMemory
    case invalidArgument

    /// Check a WebM error code and throw if it's not success
    static func check(_ code: WebMErrorCode) throws {
        switch code {
        case WEBM_SUCCESS:
            return
        case WEBM_ERROR_INVALID_FILE:
            throw WebMError.invalidFile
        case WEBM_ERROR_CORRUPTED_DATA:
            throw WebMError.corruptedData
        case WEBM_ERROR_UNSUPPORTED_FORMAT:
            throw WebMError.unsupportedFormat
        case WEBM_ERROR_IO_ERROR:
            throw WebMError.ioError
        case WEBM_ERROR_OUT_OF_MEMORY:
            throw WebMError.outOfMemory
        case WEBM_ERROR_INVALID_ARGUMENT:
            throw WebMError.invalidArgument
        default:
            throw WebMError.invalidArgument
        }
    }
}

/// Track type enumeration
public enum WebMTrackType: UInt32 {
    case unknown = 0
    case video = 1
    case audio = 2
    case complex = 3
    case logo = 16
    case subtitle = 17
    case buttons = 18
    case control = 32
}

/// Track information structure - extends the C struct
extension WebMTrackInfo {
    public var trackType: WebMTrackType {
        return WebMTrackType(rawValue: track_type) ?? .unknown
    }

    public var codecIdString: String {
        return withUnsafePointer(to: codec_id) { ptr in
            return String(cString: UnsafeRawPointer(ptr).assumingMemoryBound(to: CChar.self))
        }
    }

    public var nameString: String {
        return withUnsafePointer(to: name) { ptr in
            return String(cString: UnsafeRawPointer(ptr).assumingMemoryBound(to: CChar.self))
        }
    }

    public var languageString: String {
        return withUnsafePointer(to: language) { ptr in
            return String(cString: UnsafeRawPointer(ptr).assumingMemoryBound(to: CChar.self))
        }
    }
}
