# Analyse de faisabilité : Binding Swift pour libwebm (iOS/macOS)

## Résumé exécutif

Ce document analyse la possibilité de créer un package Swift servant de binding pour la librairie libwebm, permettant la création et le parsing de fichiers/streams WebM sur iOS et macOS. L'objectif est d'exposer les fonctionnalités de muxing/demuxing WebM sans gérer directement l'encodage/décodage des codecs audio/vidéo.

## 1. Vue d'ensemble du projet

### Objectifs
- Créer un package Swift compatible iOS et macOS
- Exposer les fonctionnalités de libwebm pour :
  - Parser (demuxer) des fichiers et streams WebM existants
  - Créer (muxer) des fichiers WebM à partir de données encodées
  - Manipuler les métadonnées WebM
- Maintenir une API Swift idiomatique tout en préservant les performances

### Périmètre
- **Dans le périmètre** : Muxing/demuxing WebM, gestion des métadonnées, parsing de structure
- **Hors périmètre** : Encodage/décodage VP8/VP9/AV1, encodage audio Vorbis/Opus

## 2. Architecture technique proposée

### Structure du package

```
LibWebMSwift/
├── Package.swift
├── Sources/
│   ├── libwebm/           # Code C++ original
│   │   ├── mkvparser/
│   │   ├── mkvmuxer/
│   │   └── common/
│   ├── CLibWebM/          # Module C++ avec headers exposés
│   │   ├── include/
│   │   │   └── module.modulemap
│   │   └── WebMBridge.hpp
│   └── LibWebMSwift/      # Wrapper Swift
│       ├── Parser/
│       ├── Muxer/
│       └── Types/
└── Tests/
```

### Approche d'intégration

#### Objective-C++ Bridge
Utiliser Objective-C++ comme couche intermédiaire pour exposer libwebm à Swift.

**Avantages :**
- Support natif dans Xcode
- Gestion simplifiée de la mémoire avec ARC
- Interopérabilité éprouvée

**Inconvénients :**
- Couche supplémentaire d'abstraction
- Maintenance de code Objective-C++

## 3. Implémentation détaillée

### 3.1 Configuration du Package.swift

```swift
// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "LibWebMSwift",
    platforms: [
        .iOS(.v13),
        .macOS(.v10_15)
    ],
    products: [
        .library(
            name: "LibWebMSwift",
            targets: ["LibWebMSwift"]
        )
    ],
    targets: [
        .target(
            name: "CLibWebM",
            dependencies: [],
            path: "Sources/CLibWebM",
            publicHeadersPath: "include",
            cxxSettings: [
                .headerSearchPath("../libwebm"),
                .define("MKVPARSER_HEADER_ONLY", to: "0"),
                .define("MKVMUXER_HEADER_ONLY", to: "0")
            ],
            linkerSettings: [
                .linkedLibrary("c++")
            ]
        ),
        .target(
            name: "LibWebMSwift",
            dependencies: ["CLibWebM"],
            path: "Sources/LibWebMSwift"
        ),
        .testTarget(
            name: "LibWebMSwiftTests",
            dependencies: ["LibWebMSwift"]
        )
    ],
    cxxLanguageStandard: .cxx11
)
```

### 3.2 Module Map pour C++

```modulemap
module CLibWebM {
    header "WebMBridge.hpp"
    requires cplusplus
    export *
}
```

### 3.3 Bridge Header C++ (WebMBridge.hpp)

```cpp
#ifndef WEBM_BRIDGE_HPP
#define WEBM_BRIDGE_HPP

#ifdef __cplusplus
extern "C" {
#endif

// Parser API
typedef void* WebMParserHandle;
typedef void* WebMSegmentHandle;

WebMParserHandle webm_parser_create(const char* filepath);
void webm_parser_destroy(WebMParserHandle parser);
int webm_parser_parse_headers(WebMParserHandle parser);

// Muxer API
typedef void* WebMMuxerHandle;
typedef void* WebMWriterHandle;

WebMMuxerHandle webm_muxer_create(const char* filepath);
void webm_muxer_destroy(WebMMuxerHandle muxer);
int webm_muxer_add_video_track(WebMMuxerHandle muxer, 
                                int width, int height, 
                                const char* codec_id);

// Callback structures for streaming
typedef struct {
    void* context;
    int (*read)(void* context, void* buffer, size_t size);
    int (*seek)(void* context, long long offset, int whence);
    long long (*tell)(void* context);
} WebMReaderCallbacks;

#ifdef __cplusplus
}
#endif

#endif // WEBM_BRIDGE_HPP
```

### 3.4 API Swift de haut niveau

```swift
import Foundation
import CLibWebM

public class WebMParser {
    private let handle: OpaquePointer
    
    public init(url: URL) throws {
        guard let handle = webm_parser_create(url.path) else {
            throw WebMError.failedToCreateParser
        }
        self.handle = handle
    }
    
    deinit {
        webm_parser_destroy(handle)
    }
    
    public func parseHeaders() throws -> WebMInfo {
        let result = webm_parser_parse_headers(handle)
        guard result == 0 else {
            throw WebMError.parsingFailed(code: result)
        }
        // Extract and return WebM information
        return WebMInfo(/* ... */)
    }
}

public class WebMMuxer {
    private let handle: OpaquePointer
    
    public struct VideoTrackConfig {
        public let width: Int
        public let height: Int
        public let codecID: String
        public let frameRate: Double?
    }
    
    public init(outputURL: URL) throws {
        guard let handle = webm_muxer_create(outputURL.path) else {
            throw WebMError.failedToCreateMuxer
        }
        self.handle = handle
    }
    
    public func addVideoTrack(_ config: VideoTrackConfig) throws -> TrackID {
        let trackNum = webm_muxer_add_video_track(
            handle,
            Int32(config.width),
            Int32(config.height),
            config.codecID
        )
        guard trackNum >= 0 else {
            throw WebMError.failedToAddTrack
        }
        return TrackID(trackNum)
    }
}
```

## 4. Défis techniques et solutions

### 4.1 Gestion de la mémoire

**Défi :** Coordonner la gestion mémoire entre C++ et Swift (ARC vs manual).

**Solution :**
- Utiliser RAII côté C++ avec des smart pointers
- Wrapper les objets C++ dans des classes Swift avec deinit appropriés
- Implémenter un système de référence counting pour les objets partagés

### 4.2 Streaming et callbacks

**Défi :** Implémenter des callbacks pour le streaming I/O entre C++ et Swift.

**Solution :**
```swift
public protocol WebMDataSource: AnyObject {
    func read(into buffer: UnsafeMutableRawPointer, maxLength: Int) -> Int
    func seek(to offset: Int64, whence: SeekWhence) -> Bool
    func tell() -> Int64
}

// Bridge vers C++
private func bridgeDataSource(_ source: WebMDataSource) -> WebMReaderCallbacks {
    // Implementation details...
}
```

### 4.3 Thread Safety

**Défi :** libwebm n'est pas thread-safe par défaut.

**Solution :**
- Documenter clairement les limitations de thread-safety
- Utiliser des DispatchQueues pour sérialiser l'accès si nécessaire
- Considérer l'implémentation d'un mode thread-safe optionnel

### 4.4 Gestion des erreurs

**Défi :** Convertir les codes d'erreur C++ en erreurs Swift idiomatiques.

**Solution :**
```swift
public enum WebMError: LocalizedError {
    case fileNotFound
    case invalidFormat
    case unsupportedCodec(String)
    case corruptedData(offset: Int64)
    case ioError(underlying: Error?)
    
    public var errorDescription: String? {
        switch self {
        case .fileNotFound:
            return "WebM file not found"
        case .invalidFormat:
            return "Invalid WebM format"
        // etc...
        }
    }
}
```

## 5. Considérations de performance

### Optimisations recommandées

1. **Zero-copy où possible** : Utiliser UnsafeBufferPointer pour éviter les copies de données
2. **Lazy parsing** : Parser les clusters à la demande plutôt qu'en une fois
3. **Memory mapping** : Utiliser mmap pour les gros fichiers en lecture
4. **Batch operations** : Grouper les écritures pour le muxing

### Benchmarks à implémenter

- Temps de parsing pour différentes tailles de fichiers
- Throughput de muxing/demuxing
- Utilisation mémoire peak
- Comparaison avec les alternatives natives iOS

## 6. Testing et validation

### Tests unitaires
```swift
func testParseValidWebMFile() throws {
    let parser = try WebMParser(url: testFileURL)
    let info = try parser.parseHeaders()
    
    XCTAssertEqual(info.duration, expectedDuration)
    XCTAssertEqual(info.tracks.count, 2)
}

func testMuxVideoTrack() throws {
    let muxer = try WebMMuxer(outputURL: outputURL)
    let trackID = try muxer.addVideoTrack(.init(
        width: 1920,
        height: 1080,
        codecID: "V_VP9"
    ))
    
    // Add frames and finalize
}
```

### Tests d'intégration
- Round-trip testing (mux puis parse)
- Compatibilité avec différentes versions WebM
- Tests de performance avec gros fichiers
- Tests de streaming avec sources réseau

## 7. Distribution et maintenance

### Publication sur Swift Package Manager
```bash
git tag 1.0.0
git push origin 1.0.0
```

### Versioning Strategy
- Suivre Semantic Versioning
- Maintenir la compatibilité avec les dernières versions de libwebm upstream
- Support des 2 dernières versions majeures d'iOS/macOS

### CI/CD avec GitHub Actions
```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v2
      - name: Build
        run: swift build
      - name: Test
        run: swift test
```

## 8. Exemples d'utilisation

### Parsing d'un fichier WebM
```swift
import LibWebMSwift

func parseWebMFile() async throws {
    let parser = try WebMParser(url: fileURL)
    let info = try parser.parseHeaders()
    
    print("Duration: \(info.duration) seconds")
    print("Tracks: \(info.tracks.count)")
    
    for track in info.tracks {
        switch track.type {
        case .video(let videoInfo):
            print("Video: \(videoInfo.width)x\(videoInfo.height)")
        case .audio(let audioInfo):
            print("Audio: \(audioInfo.sampleRate) Hz")
        }
    }
}
```

### Création d'un fichier WebM
```swift
func createWebMFile() async throws {
    let muxer = try WebMMuxer(outputURL: outputURL)
    
    // Add video track
    let videoTrack = try muxer.addVideoTrack(.init(
        width: 1920,
        height: 1080,
        codecID: "V_VP9",
        frameRate: 30.0
    ))
    
    // Add audio track
    let audioTrack = try muxer.addAudioTrack(.init(
        sampleRate: 48000,
        channels: 2,
        codecID: "A_OPUS"
    ))
    
    // Write frames (data must be pre-encoded)
    try muxer.writeFrame(videoTrack, data: encodedVideoFrame, timestamp: 0)
    try muxer.writeFrame(audioTrack, data: encodedAudioFrame, timestamp: 0)
    
    // Finalize file
    try muxer.finalize()
}
```
