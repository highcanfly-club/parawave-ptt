import CLibWebM
import Foundation

/// Swift wrapper for WebM parsing functionality
public class WebMParser {
    private var handle: WebMParserHandle?

    /// Initialize parser with a file path
    /// - Parameter filePath: Path to the WebM file to parse
    /// - Throws: WebMError if initialization fails
    public init(filePath: String) throws {
        let handle = webm_parser_create(filePath)
        if handle == nil {
            throw WebMError.invalidFile
        }
        self.handle = handle
    }

    deinit {
        if let handle = handle {
            webm_parser_destroy(handle)
        }
    }

    /// Parse the WebM file headers
    /// - Throws: WebMError if parsing fails
    public func parseHeaders() throws {
        guard let handle = handle else {
            throw WebMError.invalidArgument
        }

        let result = webm_parser_parse_headers(handle)
        try WebMError.check(result)
    }

    /// Get the duration of the WebM file
    /// - Returns: Duration in seconds
    /// - Throws: WebMError if retrieval fails
    public func getDuration() throws -> Double {
        guard let handle = handle else {
            throw WebMError.invalidArgument
        }

        var duration: Double = 0
        let result = webm_parser_get_duration(handle, &duration)
        try WebMError.check(result)
        return duration
    }

    /// Get the number of tracks in the WebM file
    /// - Returns: Number of tracks
    /// - Throws: WebMError if retrieval fails
    public func getTrackCount() throws -> UInt32 {
        guard let handle = handle else {
            throw WebMError.invalidArgument
        }

        var count: UInt32 = 0
        let result = webm_parser_get_track_count(handle, &count)
        try WebMError.check(result)
        return count
    }

    /// Get information about a specific track
    /// - Parameter trackIndex: Index of the track (0-based)
    /// - Returns: Track information
    /// - Throws: WebMError if retrieval fails
    public func getTrackInfo(trackIndex: UInt32) throws -> WebMTrackInfo {
        guard let handle = handle else {
            throw WebMError.invalidArgument
        }

        var info = WebMTrackInfo()
        let result = webm_parser_get_track_info(handle, trackIndex, &info)
        try WebMError.check(result)
        return info
    }

    /// Get video information for a specific track
    /// - Parameter trackNumber: Track number
    /// - Returns: Video information
    /// - Throws: WebMError if retrieval fails or track is not video
    public func getVideoInfo(trackNumber: UInt32) throws -> WebMVideoInfo {
        guard let handle = handle else {
            throw WebMError.invalidArgument
        }

        var info = WebMVideoInfo()
        let result = webm_parser_get_video_info(handle, trackNumber, &info)
        try WebMError.check(result)
        return info
    }

    /// Get audio information for a specific track
    /// - Parameter trackNumber: Track number
    /// - Returns: Audio information
    /// - Throws: WebMError if retrieval fails or track is not audio
    public func getAudioInfo(trackNumber: UInt32) throws -> WebMAudioInfo {
        guard let handle = handle else {
            throw WebMError.invalidArgument
        }

        var info = WebMAudioInfo()
        let result = webm_parser_get_audio_info(handle, trackNumber, &info)
        try WebMError.check(result)
        return info
    }
}

/// Swift wrapper for WebM muxing functionality
public class WebMMuxer {
    private var handle: WebMMuxerHandle?

    /// Initialize muxer with a file path
    /// - Parameter filePath: Path where the WebM file will be created
    /// - Throws: WebMError if initialization fails
    public init(filePath: String) throws {
        let handle = webm_muxer_create(filePath)
        if handle == nil {
            throw WebMError.invalidFile
        }
        self.handle = handle
    }

    deinit {
        if let handle = handle {
            webm_muxer_destroy(handle)
        }
    }

    /// Finalize the WebM file
    /// - Throws: WebMError if finalization fails
    public func finalize() throws {
        guard let handle = handle else {
            throw WebMError.invalidArgument
        }

        let result = webm_muxer_finalize(handle)
        try WebMError.check(result)
    }

    /// Add a video track to the WebM file
    /// - Parameters:
    ///   - width: Video width in pixels
    ///   - height: Video height in pixels
    ///   - codecId: Codec identifier (e.g., "V_VP8", "V_VP9")
    /// - Returns: Track ID for the added track
    /// - Throws: WebMError if track addition fails
    public func addVideoTrack(width: UInt32, height: UInt32, codecId: String) throws -> WebMTrackID
    {
        guard let handle = handle else {
            throw WebMError.invalidArgument
        }

        let trackId = webm_muxer_add_video_track(handle, width, height, codecId)
        if trackId == 0 {
            throw WebMError.unsupportedFormat
        }
        return trackId
    }

    /// Add an audio track to the WebM file
    /// - Parameters:
    ///   - samplingFrequency: Audio sampling frequency in Hz
    ///   - channels: Number of audio channels
    ///   - codecId: Codec identifier (e.g., "A_OPUS", "A_VORBIS")
    /// - Returns: Track ID for the added track
    /// - Throws: WebMError if track addition fails
    public func addAudioTrack(samplingFrequency: Double, channels: UInt32, codecId: String) throws
        -> WebMTrackID
    {
        guard let handle = handle else {
            throw WebMError.invalidArgument
        }

        let trackId = webm_muxer_add_audio_track(handle, samplingFrequency, channels, codecId)
        if trackId == 0 {
            throw WebMError.unsupportedFormat
        }
        return trackId
    }

    /// Write a video frame to the WebM file
    /// - Parameters:
    ///   - trackId: Track ID to write to
    ///   - frameData: Frame data bytes
    ///   - timestampNs: Frame timestamp in nanoseconds
    ///   - isKeyframe: Whether this frame is a keyframe
    /// - Throws: WebMError if writing fails
    public func writeVideoFrame(
        trackId: WebMTrackID, frameData: Data, timestampNs: UInt64, isKeyframe: Bool
    ) throws {
        guard let handle = handle else {
            throw WebMError.invalidArgument
        }

        let result = frameData.withUnsafeBytes { buffer in
            webm_muxer_write_video_frame(
                handle, trackId, buffer.baseAddress?.assumingMemoryBound(to: UInt8.self),
                buffer.count, timestampNs, isKeyframe)
        }
        try WebMError.check(result)
    }

    /// Write an audio frame to the WebM file
    /// - Parameters:
    ///   - trackId: Track ID to write to
    ///   - frameData: Frame data bytes
    ///   - timestampNs: Frame timestamp in nanoseconds
    /// - Throws: WebMError if writing fails
    public func writeAudioFrame(trackId: WebMTrackID, frameData: Data, timestampNs: UInt64) throws {
        guard let handle = handle else {
            throw WebMError.invalidArgument
        }

        let result = frameData.withUnsafeBytes { buffer in
            webm_muxer_write_audio_frame(
                handle, trackId, buffer.baseAddress?.assumingMemoryBound(to: UInt8.self),
                buffer.count, timestampNs)
        }
        try WebMError.check(result)
    }
}
