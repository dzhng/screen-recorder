@preconcurrency import AVFoundation
import Foundation

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
                        ? nil : journal?.acquiredAudio[role, default: []]))
        }
        return RecoveredCapture(
            durationUs: tracks[0].intervals.last?.endUs ?? 0, tracks: tracks, journal: journal,
            journalFailure: journalFailure)
    }

    private static func inspectTrack(role: String, directory: String, acquired: [MediaInterval]?)
        async -> RecoveredTrack
    {
        let file = "\(role).mov"
        let url = URL(fileURLWithPath: directory).appendingPathComponent(file)
        var intervals: [MediaInterval] = []
        var samples = 0
        var reachedEnd = false
        var failure: CaptureFailure?
        do {
            guard FileManager.default.fileExists(atPath: url.path) else {
                throw CaptureFailure("MISSING_MEDIA", "No \(role) source file is present.")
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
            var firstVideoTime: CMTime?
            var lastVideoTime: CMTime?
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
                    startUs: CMTimeConvertScale(
                        start, timescale: 1_000_000, method: .roundHalfAwayFromZero
                    ).value,
                    endUs: CMTimeConvertScale(
                        CMTimeAdd(start, duration), timescale: 1_000_000,
                        method: .roundHalfAwayFromZero
                    ).value
                )
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
            if let first = firstVideoTime, let last = lastVideoTime,
                let cursor = track.makeSampleCursor(presentationTimeStamp: last),
                cursor.currentSampleDuration.isNumeric, cursor.currentSampleDuration > .zero
            {
                intervals = [
                    MediaInterval(
                        startUs: CMTimeConvertScale(
                            first, timescale: 1_000_000, method: .roundHalfAwayFromZero
                        ).value,
                        endUs: CMTimeConvertScale(
                            CMTimeAdd(last, cursor.currentSampleDuration), timescale: 1_000_000,
                            method: .roundHalfAwayFromZero
                        ).value
                    )
                ]
            }
            // Edit-list ranges can include empty tails; use them only to clip decoded media.
            let range = try await track.load(.timeRange)
            if range.duration.isNumeric, range.duration > .zero {
                let start = max(
                    0,
                    CMTimeConvertScale(
                        range.start, timescale: 1_000_000, method: .roundHalfAwayFromZero
                    ).value)
                let end = CMTimeConvertScale(
                    CMTimeRangeGetEnd(range), timescale: 1_000_000, method: .roundHalfAwayFromZero
                ).value
                intervals = intervals.compactMap { interval in
                    let clippedStart = max(start, interval.startUs)
                    let clippedEnd = min(end, interval.endUs)
                    return clippedStart < clippedEnd
                        ? MediaInterval(startUs: clippedStart, endUs: clippedEnd) : nil
                }
            }
            if role != "video" {
                let segments = try await track.load(.segments)
                let occupied = segments.filter { !$0.isEmpty }.map { segment in
                    let range = segment.timeMapping.target
                    return MediaInterval(
                        startUs: CMTimeConvertScale(
                            range.start, timescale: 1_000_000, method: .roundHalfAwayFromZero
                        ).value,
                        endUs: CMTimeConvertScale(
                            CMTimeRangeGetEnd(range), timescale: 1_000_000,
                            method: .roundHalfAwayFromZero
                        ).value
                    )
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
