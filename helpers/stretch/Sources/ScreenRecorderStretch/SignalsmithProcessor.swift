import CSignalsmith

/// Bounded mono parity adapter. Selection and publication belong to its caller.
public enum SignalsmithProcessor {
  public enum Failure: Error, Equatable {
    case unsupportedFormat, invalidCount, unsupportedSelection, nonfinite, processingFailed
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
    switch status {
    case SCREENREC_STRETCH_OK: break
    case SCREENREC_STRETCH_INVALID: throw Failure.invalidCount
    case SCREENREC_STRETCH_UNSUPPORTED: throw Failure.unsupportedSelection
    case SCREENREC_STRETCH_NONFINITE: throw Failure.nonfinite
    default: throw Failure.processingFailed
    }
    try checkCancellation()
    return output
  }
}
