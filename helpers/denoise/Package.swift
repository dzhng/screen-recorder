// swift-tools-version: 6.1
import PackageDescription

let package = Package(
  name: "YapDenoise",
  platforms: [.macOS("26.0")],
  products: [.library(name: "YapDenoise", targets: ["YapDenoise"])],
  targets: [
    .target(
      name: "CRNNoise", publicHeadersPath: "include",
      cSettings: [
        .headerSearchPath("src"), .define("RNNOISE_BUILD"), .define("DISABLE_DEBUG_FLOAT"),
        .unsafeFlags(["-O2"]),
      ]),
    .target(name: "YapDenoise", dependencies: ["CRNNoise"]),
    .executableTarget(
      name: "DenoiseParity", dependencies: ["YapDenoise"], path: "Tests/Parity"),
  ]
)
