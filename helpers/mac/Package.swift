// swift-tools-version: 6.1
import PackageDescription

let package = Package(
    name: "ScreenRecorderNative",
    platforms: [.macOS("26.0")],
    products: [
        .library(name: "ScreenRecorderCapture", targets: ["ScreenRecorderCapture"]),
        .executable(name: "screenrec-native", targets: ["ScreenRecorderNative"]),
    ],
    dependencies: [
        .package(path: "../denoise"),
        .package(path: "../stretch"),
        // Traits disabled so the NeMo text-normalization binary is never linked. Only the worker's
        // speech target uses it; the app's capture library never reaches it.
        .package(url: "https://github.com/FluidInference/FluidAudio.git", exact: "0.15.7", traits: []),
    ],
    targets: [
        .target(
            name: "ScreenRecorderWire",
            dependencies: [
                "ScreenRecorderAudio", "ScreenRecorderCapture", "ScreenRecorderFrames",
                "ScreenRecorderMedia", "ScreenRecorderSpeech", "CLibArchive",
            ],
            linkerSettings: [.linkedLibrary("archive.2")]),
        .systemLibrary(name: "CLibArchive"),
        .target(name: "ScreenRecorderCapture", dependencies: ["ScreenRecorderMedia"]),
        .target(name: "ScreenRecorderFrames", dependencies: ["ScreenRecorderMedia"]),
        .target(name: "ScreenRecorderAudio", dependencies: ["ScreenRecorderMedia", .product(name: "ScreenRecorderDenoise", package: "denoise"), .product(name: "ScreenRecorderStretch", package: "stretch")]),
        .target(
            name: "ScreenRecorderSpeech",
            dependencies: [
                "ScreenRecorderAudio", "ScreenRecorderMedia",
                .product(name: "FluidAudio", package: "FluidAudio"),
            ]),
        .target(name: "ScreenRecorderMedia"),
        .executableTarget(name: "CameraReproduction", dependencies: ["ScreenRecorderCapture", "ScreenRecorderMedia", "ScreenRecorderWire", "ScreenRecorderAudio"], path: "Tests/CameraReproduction"),
        .executableTarget(
            name: "ScreenRecorderCaptureTests",
            dependencies: ["ScreenRecorderCapture", "ScreenRecorderMedia", "ScreenRecorderWire", "ScreenRecorderAudio"],
            path: "Tests/ScreenRecorderCaptureTests"),
        .executableTarget(
            name: "ScreenRecorderFrameTests", dependencies: ["ScreenRecorderFrames", "ScreenRecorderMedia"],
            path: "Tests/ScreenRecorderFrameTests"),
        .executableTarget(
            name: "ScreenRecorderAudioTests", dependencies: ["ScreenRecorderAudio", "ScreenRecorderMedia"],
            path: "Tests/ScreenRecorderAudioTests"),
        .executableTarget(
            name: "ScreenRecorderSpeechTests",
            dependencies: ["ScreenRecorderSpeech", "ScreenRecorderMedia", .product(name: "FluidAudio", package: "FluidAudio")],
            path: "Tests/ScreenRecorderSpeechTests"),
        .executableTarget(name: "ScreenRecorderSelectedAudioTests", dependencies: ["ScreenRecorderAudio", "ScreenRecorderMedia"], path: "Tests/SelectedAudio"),
        .executableTarget(name: "ScreenRecorderSourceAudioTests", dependencies: ["ScreenRecorderAudio", "ScreenRecorderMedia"], path: "Tests/SourceAudio"),
        .executableTarget(name: "ScreenRecorderCompositionAudioTests", dependencies: ["ScreenRecorderAudio", "ScreenRecorderMedia"], path: "Tests/CompositionAudio"),
        .executableTarget(name: "ScreenRecorderCompositionVideoTests", dependencies: ["ScreenRecorderWire"], path: "Tests/CompositionVideo"),
        .executableTarget(name: "ScreenRecorderScalarTests", dependencies: ["ScreenRecorderMedia"], path: "Tests/ScalarProgram"),
        .executableTarget(name: "ScreenRecorderNative", dependencies: ["ScreenRecorderWire"]),
    ]
)
