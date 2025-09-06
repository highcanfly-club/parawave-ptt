import CLibWebM

// Re-export C types to Swift with public visibility
public typealias WebMParserHandle = CLibWebM.WebMParserHandle
public typealias WebMMuxerHandle = CLibWebM.WebMMuxerHandle
public typealias WebMTrackID = CLibWebM.WebMTrackID
public typealias WebMErrorCode = CLibWebM.WebMErrorCode

// Re-export C constants using the actual C enum values
public let WEBM_SUCCESS = CLibWebM.WEBM_SUCCESS
public let WEBM_ERROR_INVALID_FILE = CLibWebM.WEBM_ERROR_INVALID_FILE
public let WEBM_ERROR_CORRUPTED_DATA = CLibWebM.WEBM_ERROR_CORRUPTED_DATA
public let WEBM_ERROR_UNSUPPORTED_FORMAT = CLibWebM.WEBM_ERROR_UNSUPPORTED_FORMAT
public let WEBM_ERROR_IO_ERROR = CLibWebM.WEBM_ERROR_IO_ERROR
public let WEBM_ERROR_OUT_OF_MEMORY = CLibWebM.WEBM_ERROR_OUT_OF_MEMORY
public let WEBM_ERROR_INVALID_ARGUMENT = CLibWebM.WEBM_ERROR_INVALID_ARGUMENT
