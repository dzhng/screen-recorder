// swift-tools-version: 6.1
import PackageDescription

let package = Package(
  name: "YapStretch",
  platforms: [.macOS("26.0")],
  products: [.library(name: "YapStretch", targets: ["YapStretch"])],
  targets: [
    .target(name: "CSignalsmith", exclude: ["vendor/sources.json", "vendor/LICENSE-stretch.txt", "vendor/LICENSE-linear.txt"],
      publicHeadersPath: "include", cxxSettings: [.unsafeFlags(["-O2"])]),
    .target(name: "YapStretch", dependencies: ["CSignalsmith"]),
    .executableTarget(name: "StretchFileParity", dependencies: ["YapStretch"], path: "Tests/FileParity"),
    .executableTarget(name: "StretchParity", dependencies: ["YapStretch"], path: "Tests/Parity"),
  ],
  cxxLanguageStandard: .cxx17
)
