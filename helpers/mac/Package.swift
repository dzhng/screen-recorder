// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "ScreenRecorderNative",
    platforms: [.macOS("26.0")],
    products: [
        .library(name: "ScreenRecorderWire", targets: ["ScreenRecorderWire"]),
        .library(name: "ScreenRecorderCapture", targets: ["ScreenRecorderCapture"]),
        .library(name: "ScreenRecorderFrames", targets: ["ScreenRecorderFrames"]),
        .library(name: "ScreenRecorderAudio", targets: ["ScreenRecorderAudio"]),
        .library(name: "ScreenRecorderMedia", targets: ["ScreenRecorderMedia"]),
        .executable(name: "screenrec-native", targets: ["ScreenRecorderNative"]),
    ],
    targets: [
        .target(
            name: "ScreenRecorderWire",
            dependencies: [
                "ScreenRecorderAudio", "ScreenRecorderCapture", "ScreenRecorderFrames",
                "ScreenRecorderMedia", "CLibArchive",
            ],
            linkerSettings: [.linkedLibrary("archive.2")]),
        .systemLibrary(name: "CLibArchive"),
        .target(name: "ScreenRecorderCapture", dependencies: ["ScreenRecorderMedia"]),
        .target(name: "ScreenRecorderFrames", dependencies: ["ScreenRecorderMedia"]),
        .target(name: "ScreenRecorderAudio", dependencies: ["ScreenRecorderMedia"]),
        .target(name: "ScreenRecorderMedia"),
        .executableTarget(
            name: "ScreenRecorderCaptureTests",
            dependencies: ["ScreenRecorderCapture", "ScreenRecorderMedia"],
            path: "Tests/ScreenRecorderCaptureTests"),
        .executableTarget(
            name: "ScreenRecorderFrameTests", dependencies: ["ScreenRecorderFrames", "ScreenRecorderMedia"],
            path: "Tests/ScreenRecorderFrameTests"),
        .executableTarget(
            name: "ScreenRecorderAudioTests", dependencies: ["ScreenRecorderAudio", "ScreenRecorderMedia"],
            path: "Tests/ScreenRecorderAudioTests"),
        .executableTarget(name: "ScreenRecorderNative", dependencies: ["ScreenRecorderWire"]),
    ]
)
