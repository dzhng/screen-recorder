// swift-tools-version: 6.1
import PackageDescription

let package = Package(
  name: "ScreenRecorderStretch",
  platforms: [.macOS("26.0")],
  products: [.library(name: "ScreenRecorderStretch", targets: ["ScreenRecorderStretch"])],
  targets: [
    .target(name: "CSignalsmith", exclude: ["vendor/sources.json", "vendor/LICENSE-stretch.txt", "vendor/LICENSE-linear.txt"],
      publicHeadersPath: "include", cxxSettings: [.unsafeFlags(["-O2"])]),
    .target(name: "ScreenRecorderStretch", dependencies: ["CSignalsmith"]),
    .executableTarget(name: "StretchParity", dependencies: ["ScreenRecorderStretch"], path: "Tests/Parity"),
  ],
  cxxLanguageStandard: .cxx17
)
