import Foundation
import ScreenRecorderStretch

// Offline parity seam; file publication occurs only after a complete successful result.
do {
  let args = CommandLine.arguments
  if args.count == 2 && args[1] == "--contracts" {
    func refused(_ expected: FrozenSignalsmith.Failure, _ operation: () throws -> Void) throws {
      do { try operation(); throw ParityFailure.expectedFailure }
      catch let error as FrozenSignalsmith.Failure { guard error == expected else { throw error } }
    }
    try refused(.unsupportedFormat) { _ = try FrozenSignalsmith.process(selected: [0], outputFrames: 1, sampleRate: 48000, channels: 2) }
    try refused(.invalidCount) { _ = try FrozenSignalsmith.process(selected: [], outputFrames: 1, sampleRate: 48000, channels: 1) }
    for canceledAt in [1, 2] {
      var checks = 0
      do {
        _ = try FrozenSignalsmith.process(selected: [0.5], outputFrames: 1, sampleRate: 48000, channels: 1) {
          checks += 1
          if checks == canceledAt { throw CancellationError() }
        }
        throw ParityFailure.expectedFailure
      } catch is CancellationError { precondition(checks == canceledAt) }
    }
    print("PASS format, empty selection and cancellation boundaries")
    exit(0)
  }
  guard args.count == 7, let first = Int(args[3]), let end = Int(args[4]),
    let wanted = Int(args[5]), let rate = Int(args[6]), first >= 0, end > first,
    end <= 2_880_000 else { throw ParityFailure.invalidArguments }
  let output = URL(fileURLWithPath: args[2])
  guard !FileManager.default.fileExists(atPath: output.path) else { throw ParityFailure.outputExists }
  guard let bytes = try? Data(contentsOf: URL(fileURLWithPath: args[1])) else { throw ParityFailure.missingInput }
  guard bytes.count % 4 == 0, end <= bytes.count / 4 else { throw ParityFailure.shortInput }
  let selected = (first..<end).map { i in
    bytes.withUnsafeBytes { Float(bitPattern: UInt32(littleEndian: $0.loadUnaligned(fromByteOffset: i * 4, as: UInt32.self))) }
  }
  let samples = try FrozenSignalsmith.process(selected: selected, outputFrames: wanted, sampleRate: rate, channels: 1)
  let result = samples.withUnsafeBytes { Data($0) }
  try result.write(to: output, options: .withoutOverwriting)
  print("{\"frames\":\(samples.count)}")
} catch {
  FileHandle.standardError.write(Data("\(error)\n".utf8))
  exit(1)
}
enum ParityFailure: Error { case expectedFailure, invalidArguments, outputExists, missingInput, shortInput }
