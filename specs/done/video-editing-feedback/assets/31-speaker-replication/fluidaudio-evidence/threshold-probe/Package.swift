// swift-tools-version: 6.2
import PackageDescription
let package = Package(name: "ThresholdProbe", platforms: [.macOS(.v14)], dependencies: [.package(path: "/Users/server/dev/yap-video-editing/helpers/mac/.build/checkouts/FluidAudio")], targets: [.executableTarget(name: "ThresholdProbe", dependencies: [.product(name: "FluidAudio", package: "FluidAudio")])])
