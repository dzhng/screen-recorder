import Foundation

/// Physical closure facts and retained publication authority; NativeCapture owns this lifetime.
@MainActor
package final class ClosedCameraSource {
    let directory: URL
    let journal: CaptureJournal?
    let observations: URL
    let clock: CaptureClock
    let width: Int
    let height: Int
    let frames: Int
    let dropped: Int
    let omitted: Int
    let sealed: Bool
    let failure: CaptureFailure?
    var rawIdentity: CaptureMediaIdentity?
    var observationIdentity: CaptureMediaIdentity?
    var identityFailure: (any Error)?
    var terminalAppendAttempted = false
    var journalFailure: CaptureFailure?
    var terminalFailure: CaptureFailure?

    init(directory: URL, journal: CaptureJournal?, observations: URL, clock: CaptureClock,
        width: Int, height: Int, frames: Int, dropped: Int, omitted: Int, sealed: Bool,
        failure: CaptureFailure?) {
        self.directory = directory; self.journal = journal; self.observations = observations
        self.clock = clock; self.width = width; self.height = height; self.frames = frames
        self.dropped = dropped; self.omitted = omitted; self.sealed = sealed; self.failure = failure
    }
    package func releaseJournal() { journal?.lease.release() }

    func pinIdentities() throws {
        let raw = try CaptureMediaIdentity.read(directory.appendingPathComponent("camera.raw.mov"))
        guard rawIdentity.map({ $0 == raw }) ?? true else { throw CameraMedia.invalid("Closed camera payload changed.") }
        rawIdentity = raw
        let evidence = try CaptureMediaIdentity.read(observations)
        guard observationIdentity.map({ $0 == evidence }) ?? true else { throw CameraMedia.invalid("Closed camera observations changed.") }
        observationIdentity = evidence
    }
}

extension CameraMedia {
    /// Publication errors retain the snapshot. Terminal missing/conflicting media settles truthfully.
    @MainActor
    package static func publish(_ closed: ClosedCameraSource) async throws -> CapturedCameraSource {
        try Task.checkCancellation()
        var reason = closed.failure ?? closed.terminalFailure ?? closed.journalFailure
        var receipt: Receipt?
        if let journal = closed.journal, closed.frames > 0, closed.terminalFailure == nil {
            do {
                try journal.lease.check()
                let raw = closed.directory.appendingPathComponent("camera.raw.mov")
                if let failure = closed.identityFailure {
                    closed.identityFailure = nil
                    throw failure
                }
                try closed.pinIdentities()
                let marker = closed.directory.appendingPathComponent("camera.closed.json")
                if closed.sealed && !FileManager.default.fileExists(atPath: marker.path) {
                    try recordClosed(raw: raw, marker: marker)
                }
                receipt = try await publish(lease: journal.lease, observationURL: closed.observations)
                if let receipt, !receipt.diagnostics.isEmpty {
                    reason = reason ?? CaptureFailure("PARTIAL_CAMERA", receipt.diagnostics.joined(separator: ", "))
                }
            } catch {
                try Task.checkCancellation()
                let failure = CaptureFinalizationError(error)
                if failure.retryable { throw error }
                let terminal = CaptureFailure(failure.code, failure.message)
                closed.terminalFailure = terminal
                reason = reason ?? terminal
            }
        }
        var result = CaptureResult(state: reason == nil ? "complete" : "interrupted",
            source: CaptureSource(kind: "probe-camera"), width: closed.width, height: closed.height,
            durationUs: receipt?.endUs ?? 0, hostOriginUs: closed.clock.originUs, pauses: closed.clock.pauses,
            tracks: receipt.map { [CapturedTrack(role: "video", file: "video.mov", firstSampleUs: $0.firstUs,
                lastSampleEndUs: $0.endUs, samples: $0.representedFrames, droppedSamples: closed.dropped,
                omittedSamples: closed.omitted, heldTailUs: 0, sampleRate: nil, channelCount: nil)] } ?? [],
            failure: reason, systemAudioScope: "disabled")
        // Persist the result file before the one terminal append. An operational write failure
        // can retry without claiming journal completion or repeating physical closure.
        let resultURL = closed.directory.appendingPathComponent("capture-result.json")
        if !closed.terminalAppendAttempted {
            try JSONEncoder().encode(result).write(to: resultURL, options: .atomic)
            // A journal append may have written bytes before synchronization fails. It is
            // terminal evidence failure, never permission to append another finished row.
            closed.terminalAppendAttempted = true
            do { try closed.journal?.recordFinished(result) }
            catch {
                let bounded = CaptureFinalizationError(error)
                closed.journalFailure = CaptureFailure("JOURNAL_FAILED", bounded.message)
                result = result.withFailure(closed.journalFailure)
            }
        }
        if closed.journalFailure != nil {
            try JSONEncoder().encode(result).write(to: resultURL, options: .atomic)
        }
        return CapturedCameraSource(directory: closed.directory.path, result: result)
    }
}
