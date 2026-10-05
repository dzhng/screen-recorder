// swift-tools-version: 6.0
import PackageDescription
import Foundation

let sparkle = ProcessInfo.processInfo.environment["SCREENREC_SPARKLE_FRAMEWORK"] ?? "../../dist/sparkle/Sparkle.framework"
let sparkleDirectory = URL(fileURLWithPath: sparkle, relativeTo: URL(fileURLWithPath: #filePath).deletingLastPathComponent()).standardizedFileURL.deletingLastPathComponent().path

let package = Package(
    name: "ScreenRecorder",
    platforms: [.macOS("26.0")],
    products: [.executable(name: "ScreenRecorder", targets: ["ScreenRecorder"])],
    dependencies: [.package(path: "../../helpers/mac")],
    targets: [
        .target(name: "ScreenRecorderControls"),
        .executableTarget(
            name: "ScreenRecorder",
            dependencies: [
                "ScreenRecorderControls",
                .product(name: "ScreenRecorderCapture", package: "mac"),
            ],
            swiftSettings: [.unsafeFlags(["-F", sparkleDirectory])],
            linkerSettings: [.unsafeFlags(["-F", sparkleDirectory, "-framework", "Sparkle", "-Xlinker", "-rpath", "-Xlinker", "@executable_path/../Frameworks"])]),
        .executableTarget(
            name: "ScreenRecorderControlsTests", dependencies: ["ScreenRecorderControls"],
            path: "tests/ScreenRecorderControlsTests"),
    ]
)
