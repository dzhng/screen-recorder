@preconcurrency import AVFoundation
import Foundation

/// Places a healthy take's last delivered video frame across the gap between that sample and
/// the stop boundary, so an unchanged tail ends at the recorded duration without inventing
/// captured content.
///
/// A stop routinely lands while the encoder is still draining. `isReadyForMoreMediaData` goes
/// false whenever an input cannot keep up with appends and returns asynchronously once queued
/// media is written, and appending while it is false raises an AVFoundation exception rather
/// than returning false. So the held frame has to wait for readiness instead of reading
/// ordinary backpressure as a broken take.
public enum HeldTailFrame {
    /// Bounds the readiness wait before preserving only the already accepted prefix.
    static let readinessBudget = DispatchTimeInterval.seconds(2)

    /// Appends `frame` retimed to `timing` as the final sample of `input`, waiting out encoder
    /// backpressure. Call on `queue`; `settle` runs on `queue` with `nil` once the input accepts
    /// the frame, or with the reason the take could not keep its tail.
    public static func place(
        _ frame: CMSampleBuffer, at timing: CMSampleTimingInfo, in input: AVAssetWriterInput,
        of writer: AVAssetWriter, on queue: DispatchQueue,
        then settle: @escaping (CaptureFailure?) -> Void
    ) {
        var timing = timing
        var tail: CMSampleBuffer?
        let status = CMSampleBufferCreateCopyWithNewTiming(
            allocator: kCFAllocatorDefault, sampleBuffer: frame, sampleTimingEntryCount: 1,
            sampleTimingArray: &timing, sampleBufferOut: &tail)
        guard status == noErr, let tail else {
            settle(CaptureFailure("RETIME_FAILED", "Cannot retime the final frame: \(status)."))
            return
        }
        TailAppend(tail, to: input, of: writer, on: queue, then: settle).start()
    }
}

/// One pending held-tail append. Every field is touched only on the writer queue that owns the
/// input, and the pending blocks keep the append alive until it settles exactly once.
private final class TailAppend: @unchecked Sendable {
    private let tail: CMSampleBuffer
    private let input: AVAssetWriterInput
    private let writer: AVAssetWriter
    private let queue: DispatchQueue
    private let settle: (CaptureFailure?) -> Void
    private var observation: NSKeyValueObservation?
    private var settled = false

    init(
        _ tail: CMSampleBuffer, to input: AVAssetWriterInput, of writer: AVAssetWriter,
        on queue: DispatchQueue, then settle: @escaping (CaptureFailure?) -> Void
    ) {
        self.tail = tail
        self.input = input
        self.writer = writer
        self.queue = queue
        self.settle = settle
    }

    func start() {
        // `.initial` delivers the encoder's current state, so an input that is already drained
        // is handled by the same path as one that drains later and no transition can slip
        // between a separate check and this registration. Notifications arrive on whichever
        // thread drained the encoder, so every decision hops back onto the writer queue before
        // it touches the input.
        observation = input.observe(\.isReadyForMoreMediaData, options: [.initial]) { [self] _, _ in
            queue.async { self.drained() }
        }
        queue.asyncAfter(deadline: .now() + HeldTailFrame.readinessBudget) { [self] in
            drained()
            resolve(
                CaptureFailure(
                    "WRITE_FAILED", "The encoder stayed busy and never accepted the final frame."))
        }
    }

    private func drained() {
        guard !settled else { return }
        if let stopped = stoppedWriterFailure() {
            resolve(stopped)
        } else if input.isReadyForMoreMediaData {
            append()
        }
    }

    private func append() {
        resolve(input.append(tail) ? nil : writeFailure("Cannot append the final frame."))
    }

    private func resolve(_ reason: CaptureFailure?) {
        guard !settled else { return }
        settled = true
        observation?.invalidate()
        observation = nil
        settle(reason)
    }

    private func stoppedWriterFailure() -> CaptureFailure? {
        guard writer.status != .writing else { return nil }
        return writeFailure("The writer stopped accepting samples.")
    }

    private func writeFailure(_ fallback: String) -> CaptureFailure {
        CaptureFailure("WRITE_FAILED", writer.error?.localizedDescription ?? fallback)
    }
}
