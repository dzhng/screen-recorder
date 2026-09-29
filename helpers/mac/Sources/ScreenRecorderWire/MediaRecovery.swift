@preconcurrency import AVFoundation
import Foundation
import ScreenRecorderCapture
import ScreenRecorderMedia

package struct RecoveredTrack: Codable, Sendable {
    package let role: String
    package let file: String
    package let intervals: [TimeSpan]
    /// Legacy decoder buffer count. Canonical verification reports exact native frames separately.
    package let decodedSamples: Int?
    package var representedFrames: JournalInteger? = nil
    package let decodeReachedEnd: Bool
    package let acquisitionVerified: Bool
    package let failure: CaptureFailure?
}

package struct RecoveredCapture: Codable, Sendable {
    package let durationUs: Int64
    package let tracks: [RecoveredTrack]
    package let journal: CaptureJournalSummary?
    package let journalFailure: CaptureFailure?
    package var cleanupFailure: CaptureFailure? = nil
}

/// Bounded control result. Complete support stays in the native model and source-evidence owner.
package struct RecoveryReceipt: Encodable {
    let durationUs: Int64
    let tracks: [Track]
    let journal: Journal?
    let journalFailure: CaptureFailure?
    let cleanupFailure: CaptureFailure?
    package init(_ capture: RecoveredCapture) {
        durationUs = capture.durationUs
        tracks = capture.tracks.map(Track.init)
        journal = capture.journal.map(Journal.init)
        journalFailure = capture.journalFailure
        cleanupFailure = capture.cleanupFailure
    }
    struct Track: Encodable {
        let role: String
        let file: String
        let intervalCount: Int
        let decodedSamples: Int?
        let representedFrames: JournalInteger?
        let decodeReachedEnd: Bool
        let acquisitionVerified: Bool
        let failure: CaptureFailure?
        init(_ track: RecoveredTrack) {
            role = track.role; file = track.file; intervalCount = track.intervals.count
            decodedSamples = track.decodedSamples; representedFrames = track.representedFrames
            decodeReachedEnd = track.decodeReachedEnd; acquisitionVerified = track.acquisitionVerified
            failure = track.failure
        }
    }
    struct Journal: Encodable {
        let file: String
        let header: CaptureJournalHeader?
        let originHostUs: Int64?
        let openPauseHostUs: Int64?
        let lastSequence: Int
        let incompleteTail: Bool
        let invalidAtSequence: Int?
        let finished: Bool
        let completion: JournalCompletion?
        init(_ summary: CaptureJournalSummary) {
            file = summary.file; header = summary.header; originHostUs = summary.originHostUs
            openPauseHostUs = summary.openPauseHostUs; lastSequence = summary.lastSequence
            incompleteTail = summary.incompleteTail; invalidAtSequence = summary.invalidAtSequence
            finished = summary.finished; completion = summary.completion
        }
    }
}

package enum MediaRecovery {
    /// Packed recovery uses the same publication transaction as normal finish, under one lease.
    package static func recover(directory: String) async throws -> RecoveredCapture {
        try Task.checkCancellation()
        let layout: Int?
        do { layout = try CaptureJournal.layout(directory: directory) }
        catch is CancellationError { throw CancellationError() }
        catch let failure as CaptureFailure where ["JOURNAL_MISSING", "INVALID_JOURNAL"].contains(failure.code) {
            layout = nil
        }
        guard layout == 2 else {
            let result = await inspect(directory: directory)
            try Task.checkCancellation()
            if let failure = result.tracks.compactMap(\.failure).first(where: { $0.code == "MEDIA_UNAVAILABLE" }) { throw failure }
            return result
        }
        let lease = try CaptureJournalLease(directory: directory)
        var journal = try CaptureJournal.streamAcceptedPCM(lease: lease) { _ in }
        var tracks: [RecoveredTrack] = []
        var receipts: [CaptureAudioPublication.Receipt] = []
        var retryFailure: (any Error)?
        let root = URL(fileURLWithPath: directory)
        let video = await inspectTrack(role: "video", directory: directory, acquired: nil, requested: true)
        tracks.append(video)
        if let failure = video.failure, failure.code == "MEDIA_UNAVAILABLE" { retryFailure = failure }
        try Task.checkCancellation()
        for role in ["narration", "system"] {
            try Task.checkCancellation()
            let requested = journal.header?.requested(role) == true
            do {
                guard requested else { throw CaptureFailure("NOT_REQUESTED", "This take did not request \(role) audio.") }
                let hasFiles = ["\(role).packed.mov", "\(role).mov", "\(role).publication.json"].contains {
                    FileManager.default.fileExists(atPath: root.appendingPathComponent($0).path)
                }
                guard hasFiles else { throw CaptureFailure("AUDIO_UNAVAILABLE", "Requested \(role) has no retained media.") }
                switch try await CaptureAudioPublication.publish(lease: lease, role: role) {
                case .unavailable:
                    throw CaptureFailure("AUDIO_UNAVAILABLE", "Requested \(role) has no verified playable frames.")
                case .published(let receipt):
                    let verified = try await CaptureAudioPublication.verify(receipt, lease: lease,
                        canonical: root.appendingPathComponent("\(role).mov"))
                    let support = verified.acquiredAudio.map { TimeSpan(startUs: $0.startUs, endUs: $0.endUs) }
                    journal.acquiredAudio[role] = support
                    tracks.append(RecoveredTrack(role: role, file: "\(role).mov", intervals: support,
                        decodedSamples: nil, representedFrames: JournalInteger(wrappedValue: verified.representedFrames),
                        decodeReachedEnd: true, acquisitionVerified: true,
                        failure: receipt.diagnostic.map { CaptureFailure("AUDIO_PUBLICATION_PARTIAL", $0) }))
                    receipts.append(receipt)
                }
            } catch is CancellationError { throw CancellationError() }
            catch {
                if CaptureFinalizationError(error).retryable { retryFailure = retryFailure ?? error }
                tracks.append(RecoveredTrack(role: role, file: "\(role).mov", intervals: [],
                    decodedSamples: nil, decodeReachedEnd: false, acquisitionVerified: false,
                    failure: (error as? CaptureFailure) ?? CaptureFailure("PUBLICATION_FAILED", error.localizedDescription)))
            }
        }
        try Task.checkCancellation()
        var cleanupFailure: CaptureFailure?
        for receipt in receipts {
            do { try await CaptureAudioPublication.cleanup(lease: lease, receipt: receipt) }
            catch { cleanupFailure = cleanupFailure ?? CaptureFailure("CLEANUP_PENDING", error.localizedDescription) }
        }
        try lease.check()
        if let retryFailure { throw retryFailure }
        return RecoveredCapture(durationUs: tracks.first { $0.role == "video" }?.intervals.last?.endUs ?? 0,
            tracks: tracks, journal: journal,
            journalFailure: journal.invalidAtSequence == nil ? nil : CaptureFailure("INVALID_JOURNAL", "Recovery used only the validated journal prefix."),
            cleanupFailure: cleanupFailure)
    }

    package static func inspect(directory: String) async -> RecoveredCapture {
        var journal: CaptureJournalSummary?
        var journalFailure: CaptureFailure?
        do { journal = try CaptureJournal.inspect(directory: directory) } catch {
            journalFailure = CaptureFailure("JOURNAL_UNAVAILABLE", error.localizedDescription)
        }
        var tracks: [RecoveredTrack] = []
        for role in ["video", "narration", "system"] {
            tracks.append(
                await inspectTrack(
                    role: role, directory: directory,
                    acquired: journal?.header == nil
                        ? nil : journal?.acquiredAudio[role, default: []],
                    requested: journal?.header?.requested(role)))
        }
        return RecoveredCapture(
            durationUs: tracks.first { $0.role == "video" }?.intervals.last?.endUs ?? 0,
            tracks: tracks, journal: journal, journalFailure: journalFailure)
    }

    /// `requested` is nil when no journal header says whether this take asked for the role.
    private static func inspectTrack(
        role: String, directory: String, acquired: [TimeSpan]?, requested: Bool?
    ) async -> RecoveredTrack {
        // Video bounds are half-open integer source-clock ticks. Nearest rounding may
        // admit a tick after a fractional container/sample endpoint.
        func endUs(_ time: CMTime) -> Int64 {
            role == "video"
                ? CMTimeConvertScale(
                    time, timescale: 1_000_000, method: .roundTowardNegativeInfinity
                ).value
                : microseconds(time)
        }
        let file = "\(role).mov"
        let url = URL(fileURLWithPath: directory).appendingPathComponent(file)
        var intervals: [TimeSpan] = []
        var samples = 0
        var reachedEnd = false
        var failure: CaptureFailure?
        do {
            guard FileManager.default.fileExists(atPath: url.path) else {
                // A role the header never requested is absent by design. Only an absence the
                // journal cannot explain is a loss.
                throw requested == false
                    ? CaptureFailure(
                        "NOT_REQUESTED", "This take did not request \(role) audio.")
                    : CaptureFailure("MISSING_MEDIA", "No \(role) source file is present.")
            }
            let asset = AVURLAsset(url: url)
            guard
                let track = try await asset.loadTracks(
                    withMediaType: role == "video" ? .video : .audio
                ).first
            else {
                throw CaptureFailure("NO_TRACK", "No \(role) track is present.")
            }
            let reader = try AVAssetReader(asset: asset)
            let output = AVAssetReaderTrackOutput(
                track: track,
                outputSettings: role == "video"
                    ? [
                        kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA
                    ] : [AVFormatIDKey: kAudioFormatLinearPCM])
            output.alwaysCopiesSampleData = false
            guard reader.canAdd(output) else {
                throw CaptureFailure("DECODE_FAILED", "Cannot decode \(role).")
            }
            reader.add(output)
            guard reader.startReading() else {
                throw reader.error ?? CaptureFailure("DECODE_FAILED", "Cannot read \(role).")
            }
            let segments = SourceSegment.occupied(of: try await track.load(.segments))
            var firstVideoTime: CMTime?
            var lastVideoTime: CMTime?
            var unknownTail: CaptureFailure?
            while let interval = autoreleasepool(invoking: { () -> TimeSpan? in
                guard !Task.isCancelled else { reader.cancelReading(); return nil }
                guard let sample = output.copyNextSampleBuffer() else { return nil }
                let start = CMSampleBufferGetPresentationTimeStamp(sample)
                guard sample.isValid, CMSampleBufferDataIsReady(sample), start.isNumeric else {
                    reader.cancelReading()
                    return nil
                }
                var duration = CMSampleBufferGetDuration(sample)
                if role == "video" {
                    guard sample.imageBuffer != nil else {
                        reader.cancelReading()
                        return nil
                    }
                    firstVideoTime = min(firstVideoTime ?? start, start)
                    lastVideoTime = max(lastVideoTime ?? start, start)
                    duration = .zero
                } else if !duration.isNumeric || duration <= .zero {
                    guard let format = sample.formatDescription,
                        let description = CMAudioFormatDescriptionGetStreamBasicDescription(format)?
                            .pointee,
                        description.mSampleRate > 0
                    else {
                        reader.cancelReading()
                        return nil
                    }
                    duration = CMTime(
                        seconds: Double(sample.numSamples) / description.mSampleRate,
                        preferredTimescale: 1_000_000_000)
                }
                return TimeSpan(
                    startUs: microseconds(start), endUs: microseconds(CMTimeAdd(start, duration)))
            }) {
                samples += 1
                if role == "video" { continue }
                if let last = intervals.last, interval.startUs <= last.endUs + 1 {
                    intervals[intervals.count - 1] = TimeSpan(
                        startUs: last.startUs, endUs: max(last.endUs, interval.endUs))
                } else {
                    intervals.append(interval)
                }
            }
            if let first = firstVideoTime, let last = lastVideoTime {
                if let end = assetEnd(ofSamplePresentedAt: last, in: segments, of: track) {
                    intervals = [
                        TimeSpan(startUs: microseconds(first), endUs: endUs(end))
                    ]
                } else {
                    // Decoded samples prove coverage up to the last one's own timestamp and no
                    // further. How long that frame stayed on screen is unknown, and the gap to the
                    // previous sample is not evidence of it, so the shortfall is reported instead
                    // of filled in.
                    intervals = [
                        TimeSpan(startUs: microseconds(first), endUs: endUs(last))
                    ]
                    unknownTail = CaptureFailure(
                        "UNKNOWN_TAIL",
                        "Decoded \(role) through \(microseconds(last))us; no sample cursor states "
                            + "the final frame's duration.")
                }
            }
            // Edit-list ranges can include empty tails; use them only to clip decoded media.
            let range = try await track.load(.timeRange)
            if range.duration.isNumeric, range.duration > .zero {
                let start = max(0, microseconds(range.start))
                let end = endUs(CMTimeRangeGetEnd(range))
                intervals = intervals.compactMap { interval in
                    let clippedStart = max(start, interval.startUs)
                    let clippedEnd = min(end, interval.endUs)
                    return clippedStart < clippedEnd
                        ? TimeSpan(startUs: clippedStart, endUs: clippedEnd) : nil
                }
            }
            // Decoders can synthesize video or silence for empty edits. Neither is acquisition.
            let occupied = segments.map {
                TimeSpan(
                    startUs: microseconds($0.asset.start),
                    endUs: endUs(CMTimeRangeGetEnd($0.asset)))
            }
            intervals = TimeSpan.intersection(intervals, occupied)
            if role != "video", let acquired { intervals = TimeSpan.intersection(intervals, acquired) }
            reachedEnd = reader.status == .completed
            if !reachedEnd {
                failure = reader.error.map(inspectionFailure)
                    ?? CaptureFailure("DECODE_FAILED", "A sample had invalid timing or data.")
            }
            failure = failure ?? unknownTail
        } catch {
            failure = inspectionFailure(error)
        }
        return RecoveredTrack(
            role: role, file: file, intervals: intervals, decodedSamples: samples,
            decodeReachedEnd: reachedEnd, acquisitionVerified: role == "video" || acquired != nil,
            failure: failure)
    }

    private static func inspectionFailure(_ error: any Error) -> CaptureFailure {
        if let failure = error as? CaptureFailure { return failure }
        if CaptureFinalizationError.isOperationalRead(error) {
            return CaptureFailure("MEDIA_UNAVAILABLE", error.localizedDescription)
        }
        return CaptureFailure("DECODE_FAILED", error.localizedDescription)
    }

}
