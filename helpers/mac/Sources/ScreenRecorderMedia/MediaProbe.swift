@preconcurrency import AVFoundation
import Foundation
import CryptoKit

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
    public var colorFormats: [ProbedVideoColor]?
    public var codecAtomNames: [[String]]?
    public var compressedVideoInspection: ProbedCompressedVideo?
    public var samples: ProbedSamples?
}

/// Each format declaration remains evidence, including absent values; consumers choose policy.
public struct ProbedVideoColor: Encodable, Sendable {
    public let colorPrimaries: String?
    public let transferFunction: String?
    public let ycbcrMatrix: String?
    public let fullRange: Bool?
    public let bitsPerComponent: Int?
    public let interpretationExtensions: [String]
    public let invalidColorDeclarations: [String]

    public init(_ format: CMFormatDescription) {
        func value(_ key: CFString) -> CFPropertyList? {
            CMFormatDescriptionGetExtension(format, extensionKey: key)
        }
        invalidColorDeclarations = [
            kCMFormatDescriptionExtension_ColorPrimaries,
            kCMFormatDescriptionExtension_TransferFunction,
            kCMFormatDescriptionExtension_YCbCrMatrix,
        ].filter { key in value(key) != nil && !(value(key) is String) }.map { $0 as String }
        colorPrimaries = value(kCMFormatDescriptionExtension_ColorPrimaries) as? String
        transferFunction = value(kCMFormatDescriptionExtension_TransferFunction) as? String
        ycbcrMatrix = value(kCMFormatDescriptionExtension_YCbCrMatrix) as? String
        fullRange = value(kCMFormatDescriptionExtension_FullRangeVideo) as? Bool
        bitsPerComponent = value(kCMFormatDescriptionExtension_BitsPerComponent) as? Int
        interpretationExtensions = [
            kCMFormatDescriptionExtension_ICCProfile,
            kCMFormatDescriptionExtension_GammaLevel,
            kCMFormatDescriptionExtension_AlternativeTransferCharacteristics,
            kCMFormatDescriptionExtension_LogTransferFunction,
            kCMFormatDescriptionExtension_MasteringDisplayColorVolume,
            kCMFormatDescriptionExtension_ContentLightLevelInfo,
        ].filter { value($0) != nil }.map { $0 as String }
    }

    private enum CodingKeys: String, CodingKey {
        case colorPrimaries, transferFunction, ycbcrMatrix, fullRange, bitsPerComponent,
            interpretationExtensions, invalidColorDeclarations
    }
    public func encode(to encoder: Encoder) throws {
        var values = encoder.container(keyedBy: CodingKeys.self)
        try values.encode(colorPrimaries, forKey: .colorPrimaries)
        try values.encode(transferFunction, forKey: .transferFunction)
        try values.encode(ycbcrMatrix, forKey: .ycbcrMatrix)
        try values.encode(fullRange, forKey: .fullRange)
        try values.encode(bitsPerComponent, forKey: .bitsPerComponent)
        try values.encode(interpretationExtensions, forKey: .interpretationExtensions)
        try values.encode(invalidColorDeclarations, forKey: .invalidColorDeclarations)
    }
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
    public let firstTimeUs: ExactTime
    public let lastTimeUs: ExactTime
    public let lastDurationUs: ExactTime
    public let presentedTimingSha256: String
    public let minDurationUs: Int64
    public let maxDurationUs: Int64
}

/// Metadata describes the admitted bytes. It never normalizes or rewrites them.
public enum MediaProbe {
    public static func inspect(url: URL, inspectCompressedVideo: Bool = false) async throws -> ProbedMedia {
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
        do { return try await inspectTimed(input: input, inspectCompressedVideo: inspectCompressedVideo) }
        catch {
            if let failure = input.failure { throw failure }
            throw error
        }
    }

    private static func inspectTimed(input: MediaInput, inspectCompressedVideo: Bool) async throws -> ProbedMedia {
        let tracks = try await input.asset.load(.tracks)
        var trackSegments: [[AVAssetTrackSegment]] = []
        var trackFormats: [[CMFormatDescription]] = []
        for track in tracks {
            trackSegments.append(try await track.load(.segments))
            trackFormats.append(try await track.load(.formatDescriptions))
            try input.requireSelfContainedStorage(of: track)
        }
        if inspectCompressedVideo { try input.beginStreaming() }
        let occupiedRanges = trackSegments.flatMap { SourceSegment.occupied(of: $0).map(\.asset) }
        guard
            let origin = occupiedRanges.filter({ $0.isValid && $0.start.isNumeric }).map(\.start)
                .min()
        else {
            throw NativeFailure("UNSUPPORTED_MEDIA", "No timed media streams.")
        }
        let originUs = try ExactTime(origin)
        var streams: [ProbedStream] = []
        for (index, track) in tracks.enumerated() {
            let segments = trackSegments[index]
            let range = try await track.load(.timeRange)
            try Task.checkCancellation()
            let formats = trackFormats[index]
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
                if inspectCompressedVideo {
                    stream.compressedVideoInspection = try CompressedVideoInspection.inspect(input: input, track: track)
                }
                stream.hasAlpha = try await track.load(.mediaCharacteristics).contains(.containsAlphaChannel)
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
                let colors = formats.map(ProbedVideoColor.init)
                stream.colorFormats = colors
                stream.codecAtomNames = formats.map { description in
                    let atoms = CMFormatDescriptionGetExtension(description,
                        extensionKey: kCMFormatDescriptionExtension_SampleDescriptionExtensionAtoms)
                    guard let atoms else { return [] }
                    guard let dictionary = atoms as? [String: Any] else { return ["<invalid atom dictionary>"] }
                    return dictionary.keys.sorted()
                }
                stream.colorPrimaries = colors[0].colorPrimaries
                stream.transferFunction = colors[0].transferFunction
                stream.ycbcrMatrix = colors[0].ycbcrMatrix
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
        guard let occupiedStart = segments.map({ $0.asset.start }).min() else {
            throw NativeFailure.decodeFailed("No presented video support.")
        }
        let digestOrigin = try ExactTime(occupiedStart)
        var timingHash = SHA256()
        var count: Int64 = 0
        var first = Int64.max
        var last = Int64.min
        var firstTime: CMTime?
        var lastTime: CMTime?
        var lastDuration: CMTime?
        var minimum = Int64.max
        var maximum: Int64 = 0
        try visitPresentedSamples(track: track, segments: segments) { range in
            if firstTime == nil || range.start < firstTime! { firstTime = range.start }
            if lastTime == nil || range.start > lastTime! {
                lastTime = range.start
                lastDuration = CMTimeSubtract(range.end, range.start)
            }
            let start = try ExactTime(range.start).subtract(digestOrigin)
            let duration = try ExactTime(CMTimeSubtract(range.end, range.start))
            timingHash.update(data: Data(
                "\(start.numerator)/\(start.denominator):\(duration.numerator)/\(duration.denominator)\n".utf8))
            let label = try ExactTime(range.start).subtract(originUs).sample(1_000_000, nearest: true)
            first = min(first, label)
            last = max(last, label)
            let length = microseconds(CMTimeSubtract(range.end, range.start))
            minimum = min(minimum, length)
            maximum = max(maximum, length)
            count += 1
        }
        guard count > 0, let firstTime, let lastTime, let lastDuration else {
            throw NativeFailure.decodeFailed("No presented video samples.")
        }
        return ProbedSamples(
            count: count, firstPtsUs: first, lastPtsUs: last,
            firstTimeUs: try ExactTime(firstTime).subtract(originUs),
            lastTimeUs: try ExactTime(lastTime).subtract(originUs),
            lastDurationUs: try ExactTime(lastDuration),
            presentedTimingSha256: timingHash.finalize().map { String(format: "%02x", $0) }.joined(),
            minDurationUs: minimum,
            maxDurationUs: maximum)
    }
}
