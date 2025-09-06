import LibWebMSwift

// Example usage of the WebM Swift binding

do {
    // Example 1: Parse an existing WebM file
    print("=== WebM Parser Example ===")
    let parser = try WebMParser(filePath: "/path/to/your/file.webm")

    try parser.parseHeaders()
    print("Headers parsed successfully")

    let duration = try parser.getDuration()
    print("Duration: \(duration) seconds")

    let trackCount = try parser.getTrackCount()
    print("Number of tracks: \(trackCount)")

    for i in 0..<trackCount {
        let trackInfo = try parser.getTrackInfo(trackIndex: i)
        print("Track \(i): \(trackInfo.name) (\(trackInfo.codecId))")

        switch trackInfo.trackType {
        case .video:
            let videoInfo = try parser.getVideoInfo(trackNumber: trackInfo.trackNumber)
            print("  Video: \(videoInfo.width)x\(videoInfo.height) @ \(videoInfo.frameRate) fps")
        case .audio:
            let audioInfo = try parser.getAudioInfo(trackNumber: trackInfo.trackNumber)
            print("  Audio: \(audioInfo.channels) channels @ \(audioInfo.samplingFrequency) Hz")
        default:
            break
        }
    }

} catch let error as WebMError {
    print("WebM Error: \(error)")
} catch {
    print("Unexpected error: \(error)")
}

do {
    // Example 2: Create a new WebM file
    print("\n=== WebM Muxer Example ===")
    let muxer = try WebMMuxer(filePath: "/path/to/output.webm")

    // Add a video track
    let videoTrackId = try muxer.addVideoTrack(width: 1920, height: 1080, codecId: "V_VP9")
    print("Added video track with ID: \(videoTrackId)")

    // Add an audio track
    let audioTrackId = try muxer.addAudioTrack(
        samplingFrequency: 48000, channels: 2, codecId: "A_OPUS")
    print("Added audio track with ID: \(audioTrackId)")

    // Write some sample frames (in a real application, you'd have actual encoded data)
    let sampleVideoData = Data([0x00, 0x01, 0x02])  // Placeholder
    try muxer.writeVideoFrame(
        trackId: videoTrackId, frameData: sampleVideoData, timestampNs: 0, isKeyframe: true)

    let sampleAudioData = Data([0x10, 0x11, 0x12])  // Placeholder
    try muxer.writeAudioFrame(trackId: audioTrackId, frameData: sampleAudioData, timestampNs: 0)

    // Finalize the file
    try muxer.finalize()
    print("WebM file created successfully")

} catch let error as WebMError {
    print("WebM Error: \(error)")
} catch {
    print("Unexpected error: \(error)")
}
