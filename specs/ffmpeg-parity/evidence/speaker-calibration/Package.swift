// swift-tools-version: 6.2
import PackageDescription
let package = Package(name: "SpeechCalibration", platforms: [.macOS(.v15)], dependencies: [.package(path: "/tmp/screenrec-speech-research-native/FluidAudio", traits: [])], targets: [.executableTarget(name: "CalibrationRunner", dependencies: [.product(name: "FluidAudio", package: "FluidAudio")])])
