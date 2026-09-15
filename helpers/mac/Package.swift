// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "ScreenRecorderNative",
    platforms: [.macOS("26.0")],
    products: [
        .library(name: "ScreenRecorderWire", targets: ["ScreenRecorderWire"]),
        .library(name: "ScreenRecorderCapture", targets: ["ScreenRecorderCapture"]),
        .library(name: "ScreenRecorderFrames", targets: ["ScreenRecorderFrames"]),
        .library(name: "ScreenRecorderMediaTime", targets: ["ScreenRecorderMediaTime"]),
        .executable(name: "screenrec-native", targets: ["ScreenRecorderNative"]),
    ],
    targets: [
        .target(name: "ScreenRecorderWire", dependencies: ["ScreenRecorderCapture", "ScreenRecorderFrames"]),
        .target(name: "ScreenRecorderCapture", dependencies: ["ScreenRecorderMediaTime"]),
        .target(name: "ScreenRecorderFrames", dependencies: ["ScreenRecorderMediaTime"]),
        .target(name: "ScreenRecorderMediaTime"),
        .executableTarget(
            name: "ScreenRecorderCaptureTests",
            dependencies: ["ScreenRecorderCapture", "ScreenRecorderMediaTime"],
            path: "Tests/ScreenRecorderCaptureTests"),
        .executableTarget(
            name: "ScreenRecorderFrameTests", dependencies: ["ScreenRecorderFrames"],
            path: "Tests/ScreenRecorderFrameTests"),
        .executableTarget(name: "ScreenRecorderNative", dependencies: ["ScreenRecorderWire"]),
    ]
)
