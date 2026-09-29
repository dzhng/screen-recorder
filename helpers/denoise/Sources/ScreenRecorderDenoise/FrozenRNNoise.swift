import CRNNoise

/// Fixed mono recipe over one explicitly selected domain. Caller owns selection and publication.
public enum FrozenRNNoise {
  public enum Failure: Error {
    case unsupportedFormat, invalidCount, invalidRead, nonfinite, unavailable
  }

  /// Reads and writes at most 480 samples at a time; arbitrary input chunk boundaries keep one state.
  public static func process(
    sampleCount: Int64, sampleRate: Int, channels: Int,
    read: (UnsafeMutableBufferPointer<Float>) throws -> Int,
    write: (UnsafeBufferPointer<Float>) throws -> Void,
    checkCancellation: () throws -> Void = {}
  ) throws {
    guard sampleRate == 48_000, channels == 1 else { throw Failure.unsupportedFormat }
    guard sampleCount > 0, sampleCount <= Int64.max - 1_440 else { throw Failure.invalidCount }
    guard rnnoise_get_frame_size() == 480, let state = rnnoise_create(nil) else {
      throw Failure.unavailable
    }
    defer { rnnoise_destroy(state) }
    var input = [Float](repeating: 0, count: 480)
    var output = [Float](repeating: 0, count: 480)
    var remaining = sampleCount
    var rawPosition: Int64 = 0
    var flushFrames = 2
    while remaining > 0 || flushFrames > 0 {
      try checkCancellation()
      input.withUnsafeMutableBufferPointer { $0.initialize(repeating: 0) }
      let count = Int(min(480, remaining))
      if count > 0 {
        var received = 0
        while received < count {
          try checkCancellation()
          let readCount = try input.withUnsafeMutableBufferPointer {
            try read(UnsafeMutableBufferPointer(rebasing: $0[received..<count]))
          }
          guard readCount > 0, readCount <= count - received else { throw Failure.invalidRead }
          received += readCount
        }
        for i in 0..<count {
          input[i] *= 32768
          guard input[i].isFinite else { throw Failure.nonfinite }
        }
        remaining -= Int64(count)
      } else {
        flushFrames -= 1
      }
      _ = input.withUnsafeBufferPointer { x in
        output.withUnsafeMutableBufferPointer { y in
          rnnoise_process_frame(state, y.baseAddress!, x.baseAddress!)
        }
      }
      for i in output.indices {
        output[i] /= 32768
        guard output[i].isFinite else { throw Failure.nonfinite }
      }
      let start = max(rawPosition, 960)
      let end = min(rawPosition + 480, 960 + sampleCount)
      if end > start {
        try output.withUnsafeBufferPointer {
          try write(
            UnsafeBufferPointer(rebasing: $0[Int(start - rawPosition)..<Int(end - rawPosition)]))
        }
      }
      rawPosition += 480
    }
  }
}
