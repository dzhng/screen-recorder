@preconcurrency import AVFoundation
import Foundation
import ScreenRecorderMediaTime

public struct MediaInterval: Codable, Sendable, Equatable {
    public let startUs: Int64
    public let endUs: Int64
}

public struct RecoveredTrack: Codable, Sendable {
    public let role: String
    public let file: String
    public let intervals: [MediaInterval]
    public let decodedSamples: Int
    public let decodeReachedEnd: Bool
    public let acquisitionVerified: Bool
    public let failure: CaptureFailure?
}

public struct RecoveredCapture: Codable, Sendable {
    public let durationUs: Int64
    public let tracks: [RecoveredTrack]
    public let journal: CaptureJournalSummary?
    public let journalFailure: CaptureFailure?
}

public enum MediaRecovery {
    public static func inspect(directory: String) async -> RecoveredCapture {
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
        role: String, directory: String, acquired: [MediaInterval]?, requested: Bool?
    ) async -> RecoveredTrack {
        let file = "\(role).mov"
        let url = URL(fileURLWithPath: directory).appendingPathComponent(file)
        var intervals: [MediaInterval] = []
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
            while let interval = autoreleasepool(invoking: { () -> MediaInterval? in
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
                return MediaInterval(
                    startUs: microseconds(start), endUs: microseconds(CMTimeAdd(start, duration)))
            }) {
                samples += 1
                if role == "video" { continue }
                if let last = intervals.last, interval.startUs <= last.endUs + 1 {
                    intervals[intervals.count - 1] = MediaInterval(
                        startUs: last.startUs, endUs: max(last.endUs, interval.endUs))
                } else {
                    intervals.append(interval)
                }
            }
            if let first = firstVideoTime, let last = lastVideoTime {
                if let end = assetEnd(ofSamplePresentedAt: last, in: segments, of: track) {
                    intervals = [
                        MediaInterval(startUs: microseconds(first), endUs: microseconds(end))
                    ]
                } else {
                    // Decoded samples prove coverage up to the last one's own timestamp and no
                    // further. How long that frame stayed on screen is unknown, and the gap to the
                    // previous sample is not evidence of it, so the shortfall is reported instead
                    // of filled in.
                    intervals = [
                        MediaInterval(startUs: microseconds(first), endUs: microseconds(last))
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
                let end = microseconds(CMTimeRangeGetEnd(range))
                intervals = intervals.compactMap { interval in
                    let clippedStart = max(start, interval.startUs)
                    let clippedEnd = min(end, interval.endUs)
                    return clippedStart < clippedEnd
                        ? MediaInterval(startUs: clippedStart, endUs: clippedEnd) : nil
                }
            }
            if role != "video" {
                let occupied = segments.map {
                    MediaInterval(
                        startUs: microseconds($0.asset.start),
                        endUs: microseconds(CMTimeRangeGetEnd($0.asset)))
                }
                intervals = intersect(intervals, occupied)
                if let acquired { intervals = intersect(intervals, acquired) }
            }
            reachedEnd = reader.status == .completed
            if !reachedEnd {
                failure = CaptureFailure(
                    "DECODE_FAILED",
                    reader.error?.localizedDescription ?? "A sample had invalid timing or data.")
            }
            failure = failure ?? unknownTail
        } catch {
            failure =
                (error as? CaptureFailure)
                ?? CaptureFailure("DECODE_FAILED", error.localizedDescription)
        }
        return RecoveredTrack(
            role: role, file: file, intervals: intervals, decodedSamples: samples,
            decodeReachedEnd: reachedEnd, acquisitionVerified: role == "video" || acquired != nil,
            failure: failure)
    }
    private static func intersect(_ samples: [MediaInterval], _ limits: [MediaInterval])
        -> [MediaInterval]
    {
        var result: [MediaInterval] = []
        var index = 0
        for sample in samples {
            while index < limits.count && limits[index].endUs <= sample.startUs { index += 1 }
            var cursor = index
            while cursor < limits.count && limits[cursor].startUs < sample.endUs {
                let start = max(sample.startUs, limits[cursor].startUs)
                let end = min(sample.endUs, limits[cursor].endUs)
                if start < end { result.append(MediaInterval(startUs: start, endUs: end)) }
                cursor += 1
            }
        }
        return result
    }

}
