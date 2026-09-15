// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "ScreenRecorder",
    platforms: [.macOS("26.0")],
    products: [.executable(name: "ScreenRecorder", targets: ["ScreenRecorder"])],
    targets: [.executableTarget(name: "ScreenRecorder")]
)
