import Foundation
import Darwin
import ScreenRecorderStretch

// Offline caller proof: scratch output is removed on failure, linked only on success.
func run() throws {
  let args = CommandLine.arguments
  if args.count == 2 && args[1] == "--contracts" {
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: false)
    defer { try? FileManager.default.removeItem(at: directory) }
    let source = directory.appendingPathComponent("source")
    let empty = directory.appendingPathComponent("empty")
    let bytes = Data(repeating: 0, count: 12000 * 4)
    try bytes.write(to: source)
    try Data().write(to: empty)
    let input = open(source.path, O_RDONLY)
    let output = open(empty.path, O_RDWR)
    defer { close(input); close(output) }
    func rejected(_ fd: Int32, _ expected: SignalsmithProcessor.Failure) throws {
      do {
        try SignalsmithProcessor.processFile(inputFD: input, firstFrame: 0, inputFrames: 12000,
          outputFD: fd, outputFrames: 14000, sampleRate: 48000, channels: 1)
        throw ProofFailure.acceptedInvalidDescriptor
      } catch let error as SignalsmithProcessor.Failure {
        guard error == expected else { throw error }
      }
    }
    try rejected(input, .invalidCount)
    let alias = directory.appendingPathComponent("alias")
    guard link(source.path, alias.path) == 0 else { throw ProofFailure.output }
    let aliased = open(alias.path, O_RDWR)
    try rejected(aliased, .invalidCount)
    close(aliased)
    try rejected(-1, .ioFailed)
    let readonly = open(empty.path, O_RDONLY)
    try rejected(readonly, .ioFailed)
    close(readonly)
    guard fcntl(output, F_SETFL, O_APPEND) == 0 else { throw ProofFailure.output }
    try rejected(output, .invalidCount)
    guard fcntl(output, F_SETFL, 0) == 0 else { throw ProofFailure.output }
    try Data([1, 2, 3, 4]).write(to: empty)
    try rejected(output, .invalidCount)
    guard try Data(contentsOf: source) == bytes,
      try Data(contentsOf: empty) == Data([1, 2, 3, 4]) else { throw ProofFailure.output }
    guard ftruncate(output, 0) == 0,
      lseek(input, 12, SEEK_SET) == 12, lseek(output, 5, SEEK_SET) == 5 else { throw ProofFailure.output }
    try SignalsmithProcessor.processFile(inputFD: input, firstFrame: 0, inputFrames: 12000,
      outputFD: output, outputFrames: 14000, sampleRate: 48000, channels: 1)
    guard lseek(input, 0, SEEK_CUR) == 12, lseek(output, 0, SEEK_CUR) == 5 else { throw ProofFailure.output }
    print("PASS same-inode aliases, invalid, read-only, append and nonempty descriptors; source bytes and descriptor positions preserved")
    return
  }
  guard args.count == 7 || args.count == 8,
    let first = Int64(args[3]), let count = Int(args[4]), let wanted = Int(args[5]),
    let cancelAfter = Int(args[6]) else { throw ProofFailure.arguments }
  let destination = args[2]
  let temporary = destination + ".partial"
  let input = open(args[1], O_RDONLY)
  guard input >= 0 else { throw ProofFailure.input }
  defer { close(input) }
  var output = open(temporary, O_RDWR | O_CREAT | O_EXCL, 0o600)
  guard output >= 0 else { throw ProofFailure.output }
  defer { if output >= 0 { close(output) }; unlink(temporary) }
  var checks = 0
  try SignalsmithProcessor.processFile(
    inputFD: input, firstFrame: first, inputFrames: count, outputFD: output,
    outputFrames: wanted, sampleRate: 48000, channels: 1
  ) {
    checks += 1
    if cancelAfter > 0 && checks == cancelAfter {
      var prefix = [UInt8](repeating: 0, count: 256)
      let read = pread(output, &prefix, prefix.count, 0)
      print("{\"cancelledAfterOutput\":\(read > 0 && prefix.contains(where: { $0 != 0 }))}")
      throw CancellationError()
    }
    // Inject a real write failure after partial processing, not a mocked status.
    if args.count == 8 && checks == cancelAfter * -1 { close(output); output = -1 }
  }
  guard link(temporary, destination) == 0 else { throw ProofFailure.output }
  print("{\"frames\":\(wanted),\"checks\":\(checks)}")
}

do { try run() } catch {
  FileHandle.standardError.write(Data("\(error)\n".utf8))
  exit(1)
}
enum ProofFailure: Error { case arguments, input, output, acceptedInvalidDescriptor }
