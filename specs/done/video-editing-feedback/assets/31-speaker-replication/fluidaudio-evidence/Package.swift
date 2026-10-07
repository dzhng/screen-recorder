// swift-tools-version: 6.2
import PackageDescription
let package = Package(name:"FluidReference",platforms:[.macOS(.v14)],dependencies:[.package(path:"/Users/server/dev/screen-recorder/helpers/mac/.build/checkouts/FluidAudio",traits:[])],targets:[.executableTarget(name:"Reference",dependencies:[.product(name:"FluidAudio",package:"FluidAudio")])])
