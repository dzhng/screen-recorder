@preconcurrency import AVFoundation
import Foundation

public struct ProbedMedia: Encodable, Sendable {
    public let originUs: ExactTime
    public let streams: [ProbedStream]
    public var fontFaces: [ProbedFontFace]?
}

public struct ProbedStream: Encodable, Sendable {
    public let id: String
    public let kind: String
    public let codec: String
    public let decodable: Bool
    public var startUs: ExactTime?
    public var endUs: ExactTime?
    public var segments: [ProbedSegment]?
    public var width: Int?
    public var height: Int?
    public var orientedWidth: Double?
    public var orientedHeight: Double?
    public var orientedPixelBounds: OrientedPixelBounds?
    public var transform: [Double]?
    public var orientation: Int?
    public var hasAlpha: Bool?
    public var sampleRate: Double?
    public var channels: UInt32?
    public var channelLayoutTag: UInt32?
    public var colorPrimaries: String?
    public var transferFunction: String?
    public var ycbcrMatrix: String?
    public var samples: ProbedSamples?
}

public struct ProbedSegment: Encodable, Sendable {
    public let startUs: ExactTime
    public let endUs: ExactTime
    public let empty: Bool
    public let mediaStartUs: ExactTime?
    public let mediaDurationUs: ExactTime?
}

public struct ProbedSamples: Encodable, Sendable {
    public let count: Int64
    public let firstPtsUs: Int64
    public let lastPtsUs: Int64
    public let minDurationUs: Int64
    public let maxDurationUs: Int64
}

/// Metadata describes the admitted bytes. It never normalizes or rewrites them.
public enum MediaProbe {
    public static func inspect(url: URL) async throws -> ProbedMedia {
        if let faces = try FontProbe.inspect(url: url) {
            return ProbedMedia(originUs: ExactTime(0), streams: [], fontFaces: faces)
        }
        if let image = try StillImageSource.open(url) {
            var stream = ProbedStream(
                id: "image:0", kind: "image", codec: image.codec, decodable: true)
            stream.width = image.width
            stream.height = image.height
            stream.orientedWidth = Double(image.orientedWidth)
            stream.orientedHeight = Double(image.orientedHeight)
            stream.orientation = image.orientation
            stream.hasAlpha = image.hasAlpha
            return ProbedMedia(originUs: ExactTime(0), streams: [stream])
        }
        let input = try MediaInput(url: url)
        let tracks = try await input.asset.load(.tracks)
        var trackSegments: [[AVAssetTrackSegment]] = []
        for track in tracks { trackSegments.append(try await track.load(.segments)) }
        let occupiedRanges = trackSegments.flatMap { SourceSegment.occupied(of: $0).map(\.asset) }
        guard
            let origin = occupiedRanges.filter({ $0.isValid && $0.start.isNumeric }).map(\.start)
                .min()
        else {
            throw NativeFailure("UNSUPPORTED_MEDIA", "No timed media streams.")
        }
        let originUs = try ExactTime(origin)
        var streams: [ProbedStream] = []
        for (track, segments) in zip(tracks, trackSegments) {
            let range = try await track.load(.timeRange)
            try Task.checkCancellation()
            let formats = try await track.load(.formatDescriptions)
            guard let format = formats.first, range.isValid, range.duration.isNumeric else {
                throw NativeFailure("UNSUPPORTED_MEDIA", "Stream has no finite format or timing.")
            }
            let kind =
                track.mediaType == .video
                ? "video" : track.mediaType == .audio ? "audio" : "unsupported"
            let subtype = CMFormatDescriptionGetMediaSubType(format)
            let codec =
                String(
                    bytes: [24, 16, 8, 0].map { UInt8((subtype >> $0) & 255) }, encoding: .ascii)
                ?? String(subtype)
            let decodable = try await track.load(.isDecodable)
            var stream = ProbedStream(
                id: "track:\(track.trackID)", kind: kind, codec: codec, decodable: decodable)
            let occupied = SourceSegment.occupied(of: segments)
            stream.startUs = try occupied.map { $0.asset.start }.min().map { try ExactTime($0).subtract(originUs) }
            stream.endUs = try occupied.map { CMTimeRangeGetEnd($0.asset) }.max().map { try ExactTime($0).subtract(originUs) }
            stream.segments = try segments.map {
                ProbedSegment(
                    startUs: try ExactTime($0.timeMapping.target.start).subtract(originUs),
                    endUs: try ExactTime(CMTimeRangeGetEnd($0.timeMapping.target)).subtract(originUs),
                    empty: $0.isEmpty,
                    mediaStartUs: $0.isEmpty ? nil : try ExactTime($0.timeMapping.source.start),
                    mediaDurationUs: $0.isEmpty ? nil : try ExactTime($0.timeMapping.source.duration)
                )
            }
            if kind == "video" {
                let size = CMVideoFormatDescriptionGetDimensions(format)
                let transform = try await track.load(.preferredTransform)
                let geometry = videoDisplayGeometry(
                    size: CGSize(width: Int(size.width), height: Int(size.height)),
                    transform: transform)
                stream.width = Int(size.width)
                stream.height = Int(size.height)
                stream.orientedWidth = geometry.extent.width
                stream.orientedHeight = geometry.extent.height
                stream.orientedPixelBounds = geometry.pixelBounds
                stream.transform = [
                    transform.a, transform.b, transform.c, transform.d, transform.tx, transform.ty,
                ]
                stream.colorPrimaries =
                    CMFormatDescriptionGetExtension(
                        format, extensionKey: kCMFormatDescriptionExtension_ColorPrimaries)
                    as? String
                stream.transferFunction =
                    CMFormatDescriptionGetExtension(
                        format, extensionKey: kCMFormatDescriptionExtension_TransferFunction)
                    as? String
                stream.ycbcrMatrix =
                    CMFormatDescriptionGetExtension(
                        format, extensionKey: kCMFormatDescriptionExtension_YCbCrMatrix) as? String
                stream.samples = try sampleTiming(
                    track: track,
                    segments: SourceSegment.occupied(of: segments), originUs: originUs)
            } else if kind == "audio",
                let audio = CMAudioFormatDescriptionGetStreamBasicDescription(format)
            {
                stream.sampleRate = audio.pointee.mSampleRate
                stream.channels = audio.pointee.mChannelsPerFrame
                if let layout = CMAudioFormatDescriptionGetChannelLayout(format, sizeOut: nil) {
                    stream.channelLayoutTag = layout.pointee.mChannelLayoutTag
                }
            }
            streams.append(stream)
        }
        return ProbedMedia(originUs: originUs, streams: streams)
    }

    /// Cursor timestamps are media time; apply each edit before reporting presentation timing.
    private static func sampleTiming(
        track: AVAssetTrack, segments: [SourceSegment], originUs: ExactTime
    ) throws -> ProbedSamples {
        var count: Int64 = 0
        var first = Int64.max
        var last = Int64.min
        var minimum = Int64.max
        var maximum: Int64 = 0
        for segment in segments {
            guard let cursor = track.makeSampleCursor(presentationTimeStamp: segment.media.start)
            else {
                throw NativeFailure("UNSUPPORTED_MEDIA", "Video timing requires sample cursors.")
            }
            let segmentEnd = CMTimeRangeGetEnd(segment.media)
            while cursor.presentationTimeStamp < segmentEnd {
                try Task.checkCancellation()
                let at = cursor.presentationTimeStamp
                let duration = cursor.currentSampleDuration
                guard at.isNumeric, duration.isNumeric, duration > .zero else {
                    throw NativeFailure("UNSUPPORTED_MEDIA", "Video sample lacks finite timing.")
                }
                let end = CMTimeMinimum(CMTimeAdd(at, duration), segmentEnd)
                if end > segment.media.start {
                    let presented = segment.assetTime(
                        ofMedia: CMTimeMaximum(at, segment.media.start))
                    let presentedEnd = segment.assetTime(ofMedia: end)
                    let label = try ExactTime(presented).subtract(originUs).sample(1_000_000, nearest: true)
                    first = min(first, label)
                    last = max(last, label)
                    let length = microseconds(CMTimeSubtract(presentedEnd, presented))
                    minimum = min(minimum, length)
                    maximum = max(maximum, length)
                    count += 1
                }
                if cursor.stepInPresentationOrder(byCount: 1) != 1 { break }
                guard cursor.presentationTimeStamp > at else {
                    throw NativeFailure("UNSUPPORTED_MEDIA", "Video timing made no progress.")
                }
            }
        }
        guard count > 0 else { throw NativeFailure.decodeFailed("No presented video samples.") }
        return ProbedSamples(
            count: count, firstPtsUs: first, lastPtsUs: last, minDurationUs: minimum,
            maxDurationUs: maximum)
    }
}
