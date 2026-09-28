@preconcurrency import AVFoundation
import CoreImage
import Foundation
import ScreenRecorderMedia

/// A demanded raw source picture uses physical presentation membership, without a project canvas.
public enum SourceFrameRenderer {
    public struct Request: Codable {
        public let asset: CompositionAsset
        let available: [TimeSpan]
        let atUs: Int64
        public let output: String
        let maxLongEdge: Int?
        let maxEncodedBytes: Int?
    }
    public struct Sample: Encodable {
        let value: String
        let timescale: Int32
        let endValue: String
        let endTimescale: Int32
        let originUs: Int64
    }
    public struct Result: Encodable {
        let file: String
        let mediaType = "image/png"
        let assetId: String
        let streamId: String
        let requestedSourceUs: Int64
        let actualSourceUs: Int64
        let sample: Sample
        let width: Int
        let height: Int
        let sourceWidth: Int
        let sourceHeight: Int
        let decodedSamples: Int
        let readerOpens = 1
        let bytes: Int
    }

    public static func write(_ request: Request) async throws -> Result {
        let edge = request.maxLongEdge ?? FrameLimits.defaultLongEdge
        let limit = request.maxEncodedBytes ?? FrameLimits.maximumEncodedBytes
        guard request.atUs >= 0, request.atUs <= TimeSpan.maximumMicroseconds,
            !request.asset.assetId.isEmpty, !request.asset.streamId.isEmpty,
            edge > 0, edge <= FrameLimits.maximumLongEdge,
            limit > 0, limit <= FrameLimits.maximumEncodedBytes,
            TimeSpan.areAvailable(request.available)
        else { throw NativeFailure("INVALID_REQUEST", "Invalid selected source picture request.") }
        guard request.available.contains(where: { $0.startUs <= request.atUs && request.atUs < $0.endUs }) else {
            throw NativeFailure("UNAVAILABLE", "Requested picture is outside selected source support.")
        }
        let (containerUs, overflow) = request.atUs.addingReportingOverflow(request.asset.originUs)
        guard !overflow else { throw NativeFailure("INVALID_REQUEST", "Source picture clock overflow.") }
        let output = try NewFile(at: request.output, assembledAs: "frame.png")
        defer { output.discard() }
        let source = try await PresentationSource(
            source: URL(fileURLWithPath: request.asset.path), streamId: request.asset.streamId,
            startUs: containerUs)
        try await VideoColorPolicy.requireSupportedColor(source.track)
        let selected = try source.selection(at: time(microseconds: containerUs), end: .positiveInfinity)
        guard let buffer = selected.buffer else {
            throw NativeFailure("SOURCE_PICTURE_UNAVAILABLE", "Requested source picture has no physical sample.")
        }
        guard let stamp = selected.sampleTime else {
            throw NativeFailure("INVALID_RESPONSE", "Decoded source picture has no physical clock.")
        }
        let (actualUs, clockOverflow) = microseconds(stamp).subtractingReportingOverflow(request.asset.originUs)
        guard !clockOverflow else { throw NativeFailure("INVALID_REQUEST", "Physical picture clock overflow.") }
        let image = try FrameImage(buffer: buffer, transform: source.transform, overlay: nil,
            agedFromUs: 0, crop: nil, maxLongEdge: edge)
        let bytes = try image.publishPNG(to: output,
            context: CIContext(options: [.cacheIntermediates: false]), maxEncodedBytes: limit)
        return Result(file: request.output, assetId: request.asset.assetId,
            streamId: request.asset.streamId, requestedSourceUs: request.atUs,
            actualSourceUs: actualUs,
            sample: Sample(value: String(stamp.value), timescale: stamp.timescale,
                endValue: String(selected.end.value), endTimescale: selected.end.timescale,
                originUs: request.asset.originUs),
            width: image.width, height: image.height, sourceWidth: source.width,
            sourceHeight: source.height, decodedSamples: source.decodedCount, bytes: bytes)
    }
}
