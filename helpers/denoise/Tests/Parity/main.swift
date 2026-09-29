import Foundation
import ScreenRecorderDenoise

// Typed native-library entry proof; deliberately absent from the product worker and public schemas.
func main() throws {
  let arguments = CommandLine.arguments
  if arguments.count == 2 && arguments[1] == "--failures" {
    enum Marker: Error { case read, write, cancel }
    func expectFailure(_ expected: String, _ body: () throws -> Void) throws {
      do {
        try body()
        fatalError("Expected \(expected)")
      } catch { guard String(describing: error) == expected else { throw error } }
    }
    for readResult in [0, -1, 481] {
      try expectFailure("invalidRead") {
        try FrozenRNNoise.process(
          sampleCount: 480, sampleRate: 48000, channels: 1,
          read: { _ in readResult }, write: { _ in fatalError("unexpected write") })
      }
    }
    try expectFailure("read") {
      try FrozenRNNoise.process(
        sampleCount: 1, sampleRate: 48000, channels: 1,
        read: { _ in throw Marker.read }, write: { _ in fatalError("unexpected write") })
    }
    try expectFailure("write") {
      try FrozenRNNoise.process(
        sampleCount: 1, sampleRate: 48000, channels: 1,
        read: {
          $0[0] = 0.5
          return 1
        }, write: { _ in throw Marker.write })
    }
    var checks = 0
    try expectFailure("cancel") {
      try FrozenRNNoise.process(
        sampleCount: 960, sampleRate: 48000, channels: 1,
        read: { b in
          for i in b.indices { b[i] = 0 }
          return b.count
        },
        write: { _ in fatalError("unexpected write") },
        checkCancellation: {
          checks += 1
          if checks == 3 { throw Marker.cancel }
        })
    }
    print("read/write/cancellation failures propagated")
    exit(0)
  }
  guard arguments.count == 6 || (arguments.count == 7 && arguments[6] == "--cancel-after-output")
  else {
    throw FrozenRNNoise.Failure.invalidCount
  }
  let input = try FileHandle(forReadingFrom: URL(fileURLWithPath: arguments[1]))
  defer { try? input.close() }
  let bytes = try input.seekToEnd()
  try input.seek(toOffset: 0)
  guard bytes % 4 == 0, bytes / 4 <= UInt64(Int64.max),
    let chunk = Int(arguments[3]), chunk > 0,
    let rate = Int(arguments[4]), let channels = Int(arguments[5])
  else {
    throw FrozenRNNoise.Failure.invalidCount
  }
  let destination = URL(fileURLWithPath: arguments[2])
  let temporary = destination.deletingLastPathComponent().appendingPathComponent(
    ".denoise-\(UUID().uuidString).tmp")
  FileManager.default.createFile(atPath: temporary.path, contents: nil)
  defer { try? FileManager.default.removeItem(at: temporary) }
  let output = try FileHandle(forWritingTo: temporary)
  defer { try? output.close() }
  var frames: Int64 = 0
  try FrozenRNNoise.process(
    sampleCount: Int64(bytes / 4), sampleRate: rate, channels: channels,
    read: { buffer in
      let data = try input.read(upToCount: min(chunk, buffer.count) * 4) ?? Data()
      guard data.count % 4 == 0 else { throw FrozenRNNoise.Failure.invalidRead }
      data.withUnsafeBytes { source in
        for i in 0..<(data.count / 4) {
          buffer[i] = source.loadUnaligned(fromByteOffset: i * 4, as: Float.self)
        }
      }
      return data.count / 4
    },
    write: { buffer in
      try output.write(contentsOf: Data(buffer: buffer))
      frames += Int64(buffer.count)
    },
    checkCancellation: {
      if arguments.count == 7 && frames > 0 { throw CancellationError() }
    })
  try output.synchronize()
  try FileManager.default.moveItem(at: temporary, to: destination)
  print("{\"frames\":\(frames),\"sampleRate\":48000,\"channels\":1}")

}
do { try main() } catch {
  let name = error is CancellationError ? "cancelled" : String(describing: error)
  let message = try! JSONSerialization.data(withJSONObject: ["error": name], options: [.sortedKeys])
  FileHandle.standardError.write(message + Data([10]))
  exit(1)
}
