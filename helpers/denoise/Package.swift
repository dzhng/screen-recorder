// swift-tools-version: 6.1
import PackageDescription

let package = Package(
  name: "ScreenRecorderDenoise",
  platforms: [.macOS("26.0")],
  products: [.library(name: "ScreenRecorderDenoise", targets: ["ScreenRecorderDenoise"])],
  targets: [
    .target(
      name: "CRNNoise", publicHeadersPath: "include",
      cSettings: [
        .headerSearchPath("src"), .define("RNNOISE_BUILD"), .define("DISABLE_DEBUG_FLOAT"),
        .unsafeFlags(["-O2"]),
      ]),
    .target(name: "ScreenRecorderDenoise", dependencies: ["CRNNoise"]),
    .executableTarget(
      name: "DenoiseParity", dependencies: ["ScreenRecorderDenoise"], path: "Tests/Parity"),
  ]
)
