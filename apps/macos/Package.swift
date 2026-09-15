// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "ScreenRecorder",
    platforms: [.macOS("26.0")],
    products: [.executable(name: "ScreenRecorder", targets: ["ScreenRecorder"])],
    dependencies: [.package(path: "../../helpers/mac")],
    targets: [
        .executableTarget(
            name: "ScreenRecorder",
            dependencies: [.product(name: "ScreenRecorderCapture", package: "mac")])
    ]
)
