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
                .define("MKVMUXER_HEADER_ONLY", to: "0"),
                .define("_LIBCPP_DISABLE_AVAILABILITY", to: "1")
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
            dependencies: ["LibWebMSwift"],
            resources: [
                .copy("sample.webm")
            ]
        )
    ],
    cxxLanguageStandard: .cxx11
)