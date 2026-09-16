@preconcurrency import AVFoundation
import CoreImage
import Foundation
import ScreenRecorderMediaTime

/// One owner for sequential movie presentation membership. Unlike still selection,
/// the retained moment belongs to a sample's support, not its nearest timestamp.
final class PresentationSource {
    struct Selection {
        let buffer: CVPixelBuffer?
        let sampleTime: CMTime?
        let end: CMTime
    }
    let width: Int
    let height: Int
    let transform: CGAffineTransform
    private let reader: AVAssetReader
    private let decoded: AVAssetReaderTrackOutput
    private let track: AVAssetTrack
    private let segments: [AVAssetTrackSegment]
    private let occupied: [SourceSegment]
    private var held: CMSampleBuffer?
    private var heldStart = CMTime.invalid
    private var heldEnd = CMTime.invalid
    private var segmentIndex = 0

    static func duration(of plan: [VideoRenderSpan]) throws -> Int64 {
        var through: Int64 = 0
        var sourceEnd: Int64 = 0
        guard !plan.isEmpty, plan.count <= 10_000 else {
            throw FrameFailure("INVALID_REQUEST", "Render plan requires 1...10000 spans.")
        }
        for span in plan {
            guard span.source.startUs >= sourceEnd, span.source.endUs > span.source.startUs,
                span.source.endUs <= FrameLimits.maximumMicroseconds,
                span.playback.startUs == through, span.playback.endUs > through,
                span.playback.endUs <= FrameLimits.maximumMicroseconds,
                span.source.endUs - span.source.startUs == span.playback.endUs - through
            else {
                throw FrameFailure(
                    "INVALID_REQUEST", "Render plan has invalid source or playback ranges.")
            }
            sourceEnd = span.source.endUs
            through = span.playback.endUs
        }
        return through
    }

    init(source: URL, plan: [VideoRenderSpan]) async throws {
        _ = try Self.duration(of: plan)
        let asset = AVURLAsset(
            url: source,
            options: [AVURLAssetPreferPreciseDurationAndTimingKey: true])
        let sourceDuration = try await asset.load(.duration)
        guard let track = try await asset.loadTracks(withMediaType: .video).first,
            try await track.load(.canProvideSampleCursors),
            time(microseconds: plan.last!.source.endUs) <= sourceDuration
        else { throw FrameFailure("UNAVAILABLE", "Render plan exceeds a usable video source.") }
        let segments = try await track.load(.segments)
        let occupied = SourceSegment.occupied(of: segments)
        let transform = try await track.load(.preferredTransform)
        let natural = try await track.load(.naturalSize).applying(transform)
        let width = Int(abs(natural.width).rounded())
        let height = Int(abs(natural.height).rounded())
        guard width > 0, height > 0, width <= 8192, height <= 8192,
            width.isMultiple(of: 2), height.isMultiple(of: 2)
        else {
            throw FrameFailure(
                "UNAVAILABLE", "Video renderer requires even dimensions up to 8192 pixels.")
        }
        let reader = try AVAssetReader(asset: asset)
        let decoded = AVAssetReaderTrackOutput(
            track: track,
            outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA])
        decoded.alwaysCopiesSampleData = false
        reader.add(decoded)
        self.track = track
        self.segments = segments
        self.occupied = occupied
        self.transform = transform
        self.width = width
        self.height = height
        self.reader = reader
        self.decoded = decoded
        guard reader.startReading() else {
            throw FrameFailure("NATIVE_DECODE_FAILED", "Cannot start sequential presentation read.")
        }
    }

    deinit { reader.cancelReading() }

    func selection(at: CMTime, end: CMTime) throws -> Selection {
        try Task.checkCancellation()
        while segmentIndex < segments.count
            && CMTimeRangeGetEnd(segments[segmentIndex].timeMapping.target) <= at
        { segmentIndex += 1 }
        guard segmentIndex < segments.count,
            segments[segmentIndex].timeMapping.target.containsTime(at)
        else {
            throw FrameFailure("UNAVAILABLE", "Retained time has no proven track support.")
        }
        let segment = segments[segmentIndex]
        if segment.isEmpty {
            return Selection(
                buffer: nil, sampleTime: nil,
                end: CMTimeMinimum(end, CMTimeRangeGetEnd(segment.timeMapping.target)))
        }
        while held == nil || heldEnd <= at {
            try Task.checkCancellation()
            held = nil
            guard let sample = autoreleasepool(invoking: { decoded.copyNextSampleBuffer() }) else {
                throw FrameFailure("UNAVAILABLE", "Decoder ended before retained sample support.")
            }
            let pts = CMSampleBufferGetPresentationTimeStamp(sample)
            // Duplicate pictures in empty edits do not prove nonempty support.
            guard let supportEnd = assetEnd(ofSamplePresentedAt: pts, in: occupied, of: track)
            else { continue }
            held = sample
            heldStart = pts
            heldEnd = supportEnd
        }
        guard heldStart <= at, let buffer = CMSampleBufferGetImageBuffer(held!) else {
            throw FrameFailure("UNAVAILABLE", "Retained time has unknown sample support.")
        }
        return Selection(buffer: buffer, sampleTime: heldStart, end: CMTimeMinimum(end, heldEnd))
    }
}
