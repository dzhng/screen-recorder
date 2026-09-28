@preconcurrency import AVFoundation
import CoreImage
import Foundation
import ScreenRecorderMedia

/// One owner for sequential movie presentation membership. Unlike still selection,
/// the retained moment belongs to a sample's support, not its nearest timestamp.
public final class PresentationSource {
    public struct Selection {
        public let buffer: CVPixelBuffer?
        public let sampleTime: CMTime?
        public let end: CMTime
    }
    struct Media {
        let asset: AVURLAsset
        let duration: CMTime
        let track: AVAssetTrack
        let segments: [AVAssetTrackSegment]
        let occupied: [SourceSegment]
        let transform: CGAffineTransform
        let width: Int
        let height: Int
        let decodedPixels: Int64
    }
    let media: Media
    var width: Int { media.width }
    var height: Int { media.height }
    public var transform: CGAffineTransform { media.transform }
    var track: AVAssetTrack { media.track }
    private var segments: [AVAssetTrackSegment] { media.segments }
    private var occupied: [SourceSegment] { media.occupied }
    private let reader: AVAssetReader
    private let decoded: AVAssetReaderTrackOutput
    public private(set) var decodedCount = 0
    private var held: CMSampleBuffer?
    private var heldStart = CMTime.invalid
    private var heldEnd = CMTime.invalid
    private var segmentIndex = 0

    static func duration(of plan: [VideoRenderSpan]) throws -> Int64 {
        guard !plan.isEmpty, plan.count <= 10_000 else {
            throw NativeFailure("INVALID_REQUEST", "Render plan requires 1...10000 spans.")
        }
        var through: Int64 = 0
        for span in plan {
            guard span.playback.startUs == through,
                span.playback.endUs - span.playback.startUs == span.source.endUs
                    - span.source.startUs
            else {
                throw NativeFailure(
                    "INVALID_REQUEST", "Render plan playback must follow its source spans.")
            }
            through = span.playback.endUs
        }
        guard TimeSpan.areRetained(plan.map(\.source)) else {
            throw NativeFailure("INVALID_REQUEST", "Render plan has invalid source ranges.")
        }
        return through
    }

    convenience init(source: URL, plan: [VideoRenderSpan]) async throws {
        _ = try Self.duration(of: plan)
        try await self.init(
            source: source, streamId: nil, startUs: nil,
            endUs: plan.last!.source.endUs)
    }

    static func prepare(source: URL, streamId: String?) async throws -> Media {
        let asset = AVURLAsset(
            url: source,
            options: [AVURLAssetPreferPreciseDurationAndTimingKey: true])
        let duration = try await asset.load(.duration)
        let tracks = try await asset.loadTracks(withMediaType: .video)
        guard
            let track = streamId.flatMap({ id in tracks.first { "track:\($0.trackID)" == id } })
                ?? (streamId == nil ? tracks.first : nil),
            try await track.load(.canProvideSampleCursors)
        else { throw NativeFailure("UNAVAILABLE", "Render plan exceeds a usable video source.") }
        let segments = try await track.load(.segments)
        let occupied = SourceSegment.occupied(of: segments)
        let transform = try await track.load(.preferredTransform)
        let formats = try await track.load(.formatDescriptions)
        guard let format = formats.first else {
            throw NativeFailure("UNAVAILABLE", "Video source has no decoded pixel format.")
        }
        let dimensions = formats.map(CMVideoFormatDescriptionGetDimensions)
        guard dimensions.allSatisfy({ $0.width > 0 && $0.height > 0 }) else {
            throw NativeFailure(
                "UNAVAILABLE", "Video source has no positive decoded pixel dimensions.")
        }
        let decodedPixels = dimensions.map { Int64($0.width) * Int64($0.height) }.max()!
        let pixels = CMVideoFormatDescriptionGetDimensions(format)
        let natural = videoDisplayGeometry(
            size: CGSize(width: Int(pixels.width), height: Int(pixels.height)), transform: transform
        ).extent
        guard natural.width.isFinite, natural.height.isFinite, natural.width > 0,
            natural.height > 0,
            natural.width <= 8192, natural.height <= 8192
        else {
            throw NativeFailure("UNAVAILABLE", "Video source exceeds oriented raster dimensions.")
        }
        let width = Int(abs(natural.width).rounded())
        let height = Int(abs(natural.height).rounded())
        guard width > 0, height > 0, width <= 8192, height <= 8192
        else {
            throw NativeFailure(
                "UNAVAILABLE",
                "Video source requires positive oriented raster dimensions up to 8192 pixels.")
        }
        return Media(
            asset: asset, duration: duration, track: track, segments: segments,
            occupied: occupied, transform: transform, width: width, height: height,
            decodedPixels: decodedPixels)
    }

    /// Compiled timestamps resolve to one prepared media source; preparation allocates no decoder.
    public convenience init(source: URL, streamId: String?, startUs: Int64?, endUs: Int64? = nil)
        async throws
    {
        let media = try await Self.prepare(source: source, streamId: streamId)
        try self.init(media: media, startUs: startUs, endUs: endUs)
    }

    init(media: Media, startUs: Int64?, endUs: Int64? = nil) throws {
        guard endUs.map({ time(microseconds: $0) <= media.duration }) ?? true else {
            throw NativeFailure("UNAVAILABLE", "Render plan exceeds a usable video source.")
        }
        let asset = media.asset
        let track = media.track
        let occupied = media.occupied
        let reader = try AVAssetReader(asset: asset)
        let decoded = AVAssetReaderTrackOutput(
            track: track,
            outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA])
        decoded.alwaysCopiesSampleData = false
        reader.add(decoded)
        self.media = media
        self.reader = reader
        self.decoded = decoded
        if let startUs {
            let start = time(microseconds: startUs)
            var decodeStart = start
            if let segment = occupied.first(where: { $0.asset.containsTime(start) }),
                let cursor = track.makeSampleCursor(
                    presentationTimeStamp: segment.mediaTime(ofAsset: start))
            {
                decodeStart = segment.assetTime(ofMedia: cursor.presentationTimeStamp)
            }
            reader.timeRange = CMTimeRange(
                start: decodeStart,
                end: endUs.map { time(microseconds: $0) } ?? media.duration)
        }
        guard reader.startReading() else {
            throw NativeFailure.decodeFailed("Cannot start sequential presentation read.")
        }
    }

    /// Metadata-only preflight: container timescales can be much finer than actual
    /// transitions. Including unused ticks can falsely reject an exact audio mux.
    func movieClock(plan: [VideoRenderSpan]) throws -> MovieClock {
        var clock = MovieClock()
        var firstSegment = 0
        for span in plan {
            let start = time(microseconds: span.source.startUs)
            let end = time(microseconds: span.source.endUs)
            while firstSegment < segments.count
                && CMTimeRangeGetEnd(segments[firstSegment].timeMapping.target) <= start
            { firstSegment += 1 }
            for segment in segments[firstSegment...] {
                if segment.timeMapping.target.start >= end { break }
                let range = segment.timeMapping.target
                let begin = CMTimeMaximum(start, range.start)
                let through = CMTimeMinimum(end, CMTimeRangeGetEnd(range))
                guard begin < through else { continue }
                try clock.include(begin)
                try clock.include(through)
                guard !segment.isEmpty else { continue }
                let mapping = SourceSegment(media: segment.timeMapping.source, asset: range)
                guard
                    let cursor = track.makeSampleCursor(
                        presentationTimeStamp: mapping.mediaTime(ofAsset: begin))
                else {
                    throw NativeFailure("UNAVAILABLE", "Cannot inspect movie presentation clock.")
                }
                repeat {
                    let at = mapping.assetTime(ofMedia: cursor.presentationTimeStamp)
                    if at >= through { break }
                    if at >= begin { try clock.include(at) }
                    if let supportEnd = assetEnd(ofSamplePresentedAt: at, in: occupied, of: track),
                        supportEnd > begin
                    {
                        try clock.include(CMTimeMinimum(supportEnd, through))
                    }
                } while cursor.stepInPresentationOrder(byCount: 1) == 1
            }
        }
        return clock
    }

    deinit { reader.cancelReading() }

    public func selection(at: CMTime, end: CMTime, maximumDecodedSamples: Int? = nil) throws
        -> Selection
    {
        while segmentIndex < segments.count
            && CMTimeRangeGetEnd(segments[segmentIndex].timeMapping.target) <= at
        { segmentIndex += 1 }
        guard segmentIndex < segments.count,
            segments[segmentIndex].timeMapping.target.containsTime(at)
        else {
            throw NativeFailure("UNAVAILABLE", "Retained time has no proven track support.")
        }
        let segment = segments[segmentIndex]
        if segment.isEmpty {
            return Selection(
                buffer: nil, sampleTime: nil,
                end: CMTimeMinimum(end, CMTimeRangeGetEnd(segment.timeMapping.target)))
        }
        while held == nil || heldEnd <= at {
            held = nil
            if let maximumDecodedSamples, decodedCount >= maximumDecodedSamples {
                throw NativeFailure(
                    "LIMIT_EXCEEDED", "Presentation decode exceeds its sample budget.")
            }
            guard let sample = autoreleasepool(invoking: { decoded.copyNextSampleBuffer() }) else {
                throw NativeFailure("UNAVAILABLE", "Decoder ended before retained sample support.")
            }
            try Task.checkCancellation()
            decodedCount += 1
            let pts = CMSampleBufferGetPresentationTimeStamp(sample)
            // Duplicate pictures in empty edits do not prove nonempty support.
            guard let supportEnd = assetEnd(ofSamplePresentedAt: pts, in: occupied, of: track)
            else { continue }
            held = sample
            heldStart = pts
            heldEnd = supportEnd
        }
        guard heldStart <= at, let buffer = CMSampleBufferGetImageBuffer(held!) else {
            throw NativeFailure("UNAVAILABLE", "Retained time has unknown sample support.")
        }
        return Selection(buffer: buffer, sampleTime: heldStart, end: CMTimeMinimum(end, heldEnd))
    }
}
