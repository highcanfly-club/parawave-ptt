import Foundation
import XCTest

@testable import LibWebMSwift

final class LibWebMSwiftTests: XCTestCase {

    // Helper to get the path to the sample WebM file
    private var sampleWebMPath: String {
        let testBundle = Bundle(for: type(of: self))
        guard let path = testBundle.path(forResource: "sample", ofType: "webm") else {
            // Fallback to relative path if bundle resource not found
            let currentFile = URL(fileURLWithPath: #file)
            let testDir = currentFile.deletingLastPathComponent()
            return testDir.appendingPathComponent("sample.webm").path
        }
        return path
    }

    func testWebMParserInitialization() {
        // Test that parser can be initialized (will fail with invalid file, but that's expected)
        XCTAssertThrowsError(try WebMParser(filePath: "/nonexistent/file.webm")) { error in
            XCTAssertEqual(error as? WebMError, .invalidFile)
        }
    }

    func testWebMMuxerInitialization() {
        // Test that muxer can be initialized
        XCTAssertThrowsError(try WebMMuxer(filePath: "/invalid/path/file.webm")) { error in
            XCTAssertEqual(error as? WebMError, .invalidFile)
        }
    }

    func testWebMErrorHandling() {
        // Test error code conversion
        XCTAssertNoThrow(try WebMError.check(WEBM_SUCCESS))
        XCTAssertThrowsError(try WebMError.check(WEBM_ERROR_INVALID_FILE))
        XCTAssertThrowsError(try WebMError.check(WEBM_ERROR_INVALID_ARGUMENT))
    }

    func testTrackTypeEnum() {
        // Test that track type enum values match C constants
        XCTAssertEqual(WebMTrackType.video.rawValue, 1)
        XCTAssertEqual(WebMTrackType.audio.rawValue, 2)
        XCTAssertEqual(WebMTrackType.unknown.rawValue, 0)
    }

    // MARK: - Sample WebM File Tests

    func testSampleWebMFileExists() {
        // Verify the sample file exists before running other tests
        let fileManager = FileManager.default
        XCTAssertTrue(
            fileManager.fileExists(atPath: sampleWebMPath),
            "Sample WebM file should exist at: \(sampleWebMPath)")
    }

    func testParseValidWebMFile() throws {
        // Test parsing a valid WebM file
        let parser = try WebMParser(filePath: sampleWebMPath)

        // Should be able to parse headers without throwing
        XCTAssertNoThrow(try parser.parseHeaders())

        // Parse headers for subsequent tests
        try parser.parseHeaders()
    }

    func testGetWebMDuration() throws {
        let parser = try WebMParser(filePath: sampleWebMPath)
        try parser.parseHeaders()

        let duration = try parser.getDuration()

        // Duration should be positive and reasonable (less than 1 hour)
        XCTAssertGreaterThan(duration, 0.0, "Duration should be positive")
        XCTAssertLessThan(duration, 3600.0, "Duration should be reasonable (< 1 hour)")

        print("WebM file duration: \(duration) seconds")
    }

    func testGetWebMTrackCount() throws {
        let parser = try WebMParser(filePath: sampleWebMPath)
        try parser.parseHeaders()

        let trackCount = try parser.getTrackCount()

        // Should have at least one track
        XCTAssertGreaterThan(trackCount, 0, "Should have at least one track")
        XCTAssertLessThan(trackCount, 10, "Track count should be reasonable (< 10)")

        print("WebM file track count: \(trackCount)")
    }

    func testGetWebMTrackInfo() throws {
        let parser = try WebMParser(filePath: sampleWebMPath)
        try parser.parseHeaders()

        let trackCount = try parser.getTrackCount()

        // Test each track
        for i in 0..<trackCount {
            let trackInfo = try parser.getTrackInfo(trackIndex: i)

            // Track number should be valid
            XCTAssertGreaterThan(trackInfo.track_number, 0, "Track number should be positive")

            // Track type should be known
            let trackType = WebMTrackType(rawValue: trackInfo.track_type) ?? .unknown
            XCTAssertNotEqual(trackType, .unknown, "Track type should be known")

            // Codec ID should not be empty
            let codecId = trackInfo.codecIdString
            XCTAssertFalse(codecId.isEmpty, "Codec ID should not be empty")

            print(
                "Track \(i): Number=\(trackInfo.track_number), Type=\(trackType), Codec=\(codecId)")

            // Test video-specific info if it's a video track
            if trackType == .video {
                XCTAssertNoThrow(try parser.getVideoInfo(trackNumber: trackInfo.track_number))

                let videoInfo = try parser.getVideoInfo(trackNumber: trackInfo.track_number)
                XCTAssertGreaterThan(videoInfo.width, 0, "Video width should be positive")
                XCTAssertGreaterThan(videoInfo.height, 0, "Video height should be positive")

                print(
                    "  Video: \(videoInfo.width)x\(videoInfo.height), Frame rate: \(videoInfo.frame_rate)"
                )
            }

            // Test audio-specific info if it's an audio track
            if trackType == .audio {
                XCTAssertNoThrow(try parser.getAudioInfo(trackNumber: trackInfo.track_number))

                let audioInfo = try parser.getAudioInfo(trackNumber: trackInfo.track_number)
                XCTAssertGreaterThan(
                    audioInfo.sampling_frequency, 0, "Audio sampling frequency should be positive")
                XCTAssertGreaterThan(audioInfo.channels, 0, "Audio channels should be positive")

                print(
                    "  Audio: \(audioInfo.channels) channels @ \(audioInfo.sampling_frequency) Hz, Bit depth: \(audioInfo.bit_depth)"
                )
            }
        }
    }

    func testWebMFileStructureValidation() throws {
        let parser = try WebMParser(filePath: sampleWebMPath)
        try parser.parseHeaders()

        let trackCount = try parser.getTrackCount()
        let duration = try parser.getDuration()

        // Validate overall file structure
        XCTAssertGreaterThan(trackCount, 0, "Valid WebM should have tracks")
        XCTAssertGreaterThan(duration, 0, "Valid WebM should have positive duration")

        // Check if we have expected track types
        var hasVideo = false
        var hasAudio = false

        for i in 0..<trackCount {
            let trackInfo = try parser.getTrackInfo(trackIndex: i)
            let trackType = WebMTrackType(rawValue: trackInfo.track_type) ?? .unknown

            switch trackType {
            case .video:
                hasVideo = true
            case .audio:
                hasAudio = true
            default:
                break
            }
        }

        // Most WebM files should have at least video or audio
        XCTAssertTrue(hasVideo || hasAudio, "WebM file should have video or audio tracks")

        print(
            "File summary: \(trackCount) tracks, \(duration)s duration, Video: \(hasVideo), Audio: \(hasAudio)"
        )
    }

    func testWebMCodecValidation() throws {
        let parser = try WebMParser(filePath: sampleWebMPath)
        try parser.parseHeaders()

        let trackCount = try parser.getTrackCount()

        for i in 0..<trackCount {
            let trackInfo = try parser.getTrackInfo(trackIndex: i)
            let codecId = trackInfo.codecIdString
            let trackType = WebMTrackType(rawValue: trackInfo.track_type) ?? .unknown

            // Validate codec IDs match track types
            switch trackType {
            case .video:
                // Common video codecs in WebM
                let validVideoCodecs = ["V_VP8", "V_VP9", "V_AV1"]
                let isValidVideoCodec = validVideoCodecs.contains { codecId.hasPrefix($0) }
                XCTAssertTrue(
                    isValidVideoCodec,
                    "Video track should have valid codec (got: \(codecId))")

            case .audio:
                // Common audio codecs in WebM
                let validAudioCodecs = ["A_VORBIS", "A_OPUS"]
                let isValidAudioCodec = validAudioCodecs.contains { codecId.hasPrefix($0) }
                XCTAssertTrue(
                    isValidAudioCodec,
                    "Audio track should have valid codec (got: \(codecId))")

            default:
                break
            }
        }
    }

    // MARK: - Muxer Tests

    func testWebMMuxerCreation() throws {
        let tempDir = NSTemporaryDirectory()
        let tempFile = URL(fileURLWithPath: tempDir).appendingPathComponent("test_output.webm")

        // Clean up any existing file
        try? FileManager.default.removeItem(at: tempFile)

        do {
            let muxer = try WebMMuxer(filePath: tempFile.path)

            // Add a video track
            let videoTrackId = try muxer.addVideoTrack(width: 640, height: 480, codecId: "V_VP9")
            XCTAssertGreaterThan(videoTrackId, 0, "Video track ID should be positive")

            // Add an audio track
            let audioTrackId = try muxer.addAudioTrack(
                samplingFrequency: 48000, channels: 2, codecId: "A_OPUS")
            XCTAssertGreaterThan(audioTrackId, 0, "Audio track ID should be positive")

            // Note: In a real test, we would write actual encoded frames here
            // For now, we just test the track creation and finalization

            try muxer.finalize()

            // Verify the file was created
            XCTAssertTrue(
                FileManager.default.fileExists(atPath: tempFile.path),
                "Output WebM file should be created")

        } catch {
            XCTFail("Muxer test failed with error: \(error)")
        }

        // Clean up
        try? FileManager.default.removeItem(at: tempFile)
    }

    func testWebMRoundTrip() throws {
        // This test would create a WebM file and then parse it back
        // to verify round-trip functionality
        let tempDir = NSTemporaryDirectory()
        let tempFile = URL(fileURLWithPath: tempDir).appendingPathComponent("roundtrip_test.webm")

        // Clean up any existing file
        try? FileManager.default.removeItem(at: tempFile)

        do {
            // Create a simple WebM file
            let muxer = try WebMMuxer(filePath: tempFile.path)
            _ = try muxer.addVideoTrack(width: 320, height: 240, codecId: "V_VP9")

            // TODO: Add actual frame data when the implementation supports it
            // For now, just finalize the empty file
            try muxer.finalize()

            // Now try to parse the created file
            let parser = try WebMParser(filePath: tempFile.path)
            try parser.parseHeaders()

            let trackCount = try parser.getTrackCount()
            XCTAssertGreaterThan(trackCount, 0, "Created file should have tracks")

            // Verify we can get track info
            for i in 0..<trackCount {
                let trackInfo = try parser.getTrackInfo(trackIndex: i)
                XCTAssertGreaterThan(trackInfo.track_number, 0, "Track should have valid number")
            }

        } catch {
            XCTFail("Round-trip test failed with error: \(error)")
        }

        // Clean up
        try? FileManager.default.removeItem(at: tempFile)
    }

    // MARK: - Performance Tests

    func testWebMParsingPerformance() throws {
        // Measure performance of parsing the sample WebM file
        measure {
            do {
                let parser = try WebMParser(filePath: sampleWebMPath)
                try parser.parseHeaders()
                _ = try parser.getDuration()
                _ = try parser.getTrackCount()
            } catch {
                XCTFail("Performance test failed with error: \(error)")
            }
        }
    }

    func testWebMTrackInfoPerformance() throws {
        let parser = try WebMParser(filePath: sampleWebMPath)
        try parser.parseHeaders()
        let trackCount = try parser.getTrackCount()

        // Measure performance of getting track info for all tracks
        measure {
            do {
                for i in 0..<trackCount {
                    _ = try parser.getTrackInfo(trackIndex: i)
                }
            } catch {
                XCTFail("Track info performance test failed with error: \(error)")
            }
        }
    }
}
