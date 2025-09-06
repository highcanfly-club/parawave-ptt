# LibWebMSwift

A Swift package providing bindings for libwebm, enabling WebM file parsing and creation on iOS and macOS platforms.

## Features

- **WebM Parsing**: Parse WebM files and extract metadata, track information, and media properties
- **WebM Muxing**: Create new WebM files with video and audio tracks
- **Swift Idiomatic API**: Clean, safe Swift interfaces with proper error handling
- **Memory Safe**: Automatic memory management with ARC
- **Cross-Platform**: Supports both iOS and macOS

## Installation

Add this package to your Swift project using Swift Package Manager:

```swift
dependencies: [
    .package(url: "https://github.com/your-repo/LibWebMSwift.git", from: "1.0.0")
]
```

## Usage

### Parsing WebM Files

```swift
import LibWebMSwift

do {
    let parser = try WebMParser(filePath: "/path/to/file.webm")

    // Parse headers
    try parser.parseHeaders()

    // Get basic information
    let duration = try parser.getDuration()
    let trackCount = try parser.getTrackCount()

    // Get track information
    for i in 0..<trackCount {
        let trackInfo = try parser.getTrackInfo(trackIndex: i)
        print("Track: \(trackInfo.name) (\(trackInfo.codecId))")

        switch trackInfo.trackType {
        case .video:
            let videoInfo = try parser.getVideoInfo(trackNumber: trackInfo.trackNumber)
            print("Video: \(videoInfo.width)x\(videoInfo.height)")
        case .audio:
            let audioInfo = try parser.getAudioInfo(trackNumber: trackInfo.trackNumber)
            print("Audio: \(audioInfo.channels) channels @ \(audioInfo.samplingFrequency)Hz")
        default:
            break
        }
    }
} catch let error as WebMError {
    print("WebM Error: \(error)")
}
```

### Creating WebM Files

```swift
import LibWebMSwift

do {
    let muxer = try WebMMuxer(filePath: "/path/to/output.webm")

    // Add video track
    let videoTrackId = try muxer.addVideoTrack(width: 1920, height: 1080, codecId: "V_VP9")

    // Add audio track
    let audioTrackId = try muxer.addAudioTrack(samplingFrequency: 48000, channels: 2, codecId: "A_OPUS")

    // Write frames
    try muxer.writeVideoFrame(trackId: videoTrackId, frameData: videoFrameData, timestampNs: 0, isKeyframe: true)
    try muxer.writeAudioFrame(trackId: audioTrackId, frameData: audioFrameData, timestampNs: 0)

    // Finalize the file
    try muxer.finalize()
} catch let error as WebMError {
    print("WebM Error: \(error)")
}
```

## Supported Codecs

### Video Codecs
- VP8 (`V_VP8`)
- VP9 (`V_VP9`)

### Audio Codecs
- Opus (`A_OPUS`)
- Vorbis (`A_VORBIS`)

## Error Handling

The package uses Swift's error handling system with the `WebMError` enum:

```swift
enum WebMError: Error {
    case invalidFile
    case corruptedData
    case unsupportedFormat
    case ioError
    case outOfMemory
    case invalidArgument
}
```

## Requirements

- iOS 13.0+ or macOS 10.15+
- Swift 5.9+
- Xcode 15.0+

## Architecture

This package consists of:

1. **CLibWebM**: C++ wrapper around libwebm providing a C API
2. **LibWebMSwift**: Swift classes providing idiomatic Swift interfaces
3. **libwebm**: Google libwebm library (included as git submodule)

## Building

```bash
# Clone with submodules
git clone --recursive https://github.com/your-repo/LibWebMSwift.git
cd LibWebMSwift

# Build
swift build

# Run tests
swift test
```

## License

This project is licensed under the same terms as libwebm. See LICENSE file for details.

## Contributing

Contributions are welcome! Please ensure that:

1. All tests pass
2. Code follows Swift style guidelines
3. New features include appropriate tests
4. Documentation is updated for API changes
