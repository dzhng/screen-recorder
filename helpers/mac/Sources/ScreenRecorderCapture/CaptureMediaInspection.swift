@preconcurrency import AVFoundation
import Foundation
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
    package init(role: String, file: String, intervals: [TimeSpan], decodedSamples: Int?,
        representedFrames: JournalInteger? = nil, decodeReachedEnd: Bool, acquisitionVerified: Bool, failure: CaptureFailure?) {
        self.role = role; self.file = file; self.intervals = intervals; self.decodedSamples = decodedSamples
        self.representedFrames = representedFrames; self.decodeReachedEnd = decodeReachedEnd
        self.acquisitionVerified = acquisitionVerified; self.failure = failure
    }
}

/// Existing recovery inspection shared with source-authority verification.
package enum CaptureMediaInspection {
    /// `requested` is nil when no journal header says whether this take asked for the role.
    package static func inspect(
        role: String, url: URL, acquired: [TimeSpan]?, requested: Bool?
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
            // AVFoundation cannot seek inherited /dev/fd URLs directly. Ordinary recovery retains its URL behavior.
            let input = url.path.hasPrefix("/dev/fd/") ? try MediaInput(url: url, purpose: .streaming) : nil
            defer { withExtendedLifetime(input) {} }
            let asset = input?.asset ?? AVURLAsset(url: url)
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
