// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "ScreenRecorderNative",
    platforms: [.macOS("26.0")],
    products: [
        .library(name: "ScreenRecorderWire", targets: ["ScreenRecorderWire"]),
        .executable(name: "screenrec-native", targets: ["ScreenRecorderNative"]),
    ],
    targets: [
        .target(name: "ScreenRecorderWire"),
        .executableTarget(name: "ScreenRecorderNative", dependencies: ["ScreenRecorderWire"]),
    ]
)
