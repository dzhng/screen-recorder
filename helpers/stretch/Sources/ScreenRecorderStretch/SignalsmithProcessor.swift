import CSignalsmith

/// Exact stretch adapters. Selection and publication belong to its caller.
public enum SignalsmithProcessor {
  public enum Failure: Error, Equatable {
    case unsupportedFormat, invalidCount, unsupportedSelection, nonfinite, processingFailed, ioFailed
  }

  /// Preserves the frozen research domain, not a product duration policy.
  /// Cancellation is observed around the synchronous upstream call, never inside it.
  public static func process(
    selected: [Float], outputFrames: Int, sampleRate: Int, channels: Int,
    checkCancellation: () throws -> Void = {}
  ) throws -> [Float] {
    guard sampleRate == 48_000, channels == 1 else { throw Failure.unsupportedFormat }
    guard !selected.isEmpty, selected.count <= 2_880_000,
      outputFrames > 0, outputFrames <= 2_880_000 else { throw Failure.invalidCount }
    try checkCancellation()
    var output = [Float](repeating: 0, count: outputFrames)
    let status = selected.withUnsafeBufferPointer { input in
      output.withUnsafeMutableBufferPointer { result in
        screenrec_stretch_exact(input.baseAddress, Int32(input.count), result.baseAddress, Int32(result.count))
      }
    }
    try requireSuccess(status)
    try checkCancellation()
    return output
  }

  /// Writes to a caller-owned empty, readable/writable regular scratch file.
  /// The caller must discard it on every error and publish only after success.
  /// Samples are interleaved; offsets and counts address frames, not channel samples.
  /// Input must remain immutable throughout the synchronous call. Descriptors stay open.
  public static func processFile(
    inputFD: Int32, firstFrame: Int64, inputFrames: Int, outputFD: Int32,
    outputFrames: Int, sampleRate: Int, channels: Int,
    checkCancellation: () throws -> Void = {}
  ) throws {
    guard sampleRate == 48_000, channels == 1 || channels == 2 else { throw Failure.unsupportedFormat }
    guard inputFrames > 0, inputFrames <= Int(Int32.max),
      outputFrames > 0, outputFrames <= Int(Int32.max) else { throw Failure.invalidCount }
    try withoutActuallyEscaping(checkCancellation) { check in
      let cancellation = CancellationCheck(check)
      let status = screenrec_stretch_exact_file(
        inputFD, firstFrame, Int32(inputFrames), outputFD, Int32(outputFrames), Int32(channels),
        { context in
          let state = Unmanaged<CancellationCheck>.fromOpaque(context!).takeUnretainedValue()
          do { try state.check(); return 0 }
          catch { state.error = error; return 1 }
        }, Unmanaged.passUnretained(cancellation).toOpaque())
      if let error = cancellation.error { throw error }
      try requireSuccess(status)
    }
  }

  private final class CancellationCheck {
    let check: () throws -> Void
    var error: Error?
    init(_ check: @escaping () throws -> Void) { self.check = check }
  }

  private static func requireSuccess(_ status: ScreenrecStretchStatus) throws {
    switch status {
    case SCREENREC_STRETCH_OK: return
    case SCREENREC_STRETCH_INVALID: throw Failure.invalidCount
    case SCREENREC_STRETCH_UNSUPPORTED: throw Failure.unsupportedSelection
    case SCREENREC_STRETCH_NONFINITE: throw Failure.nonfinite
    case SCREENREC_STRETCH_IO: throw Failure.ioFailed
    default: throw Failure.processingFailed
    }
  }

}
