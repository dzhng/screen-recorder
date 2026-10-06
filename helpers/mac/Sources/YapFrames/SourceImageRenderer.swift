import CoreImage
import Foundation
import YapMedia

/// Raw still delivery has image identity and dimensions, never a fabricated presentation clock.
public enum SourceImageRenderer {
    public struct Request: Codable {
        public struct Asset: Codable {
            let assetId: String
            let streamId: String
            public let path: String
        }
        public let asset: Asset
        public let output: String
        let maxLongEdge: Int?
        let maxEncodedBytes: Int?
        let maxDecodedPixels: Int64?
    }
    public struct Result: Encodable {
        let kind = "image"
        let file: String
        let mediaType = "image/png"
        let assetId: String
        let streamId: String
        let width: Int
        let height: Int
        let sourceWidth: Int
        let sourceHeight: Int
        let orientation: Int
        let hasAlpha: Bool
        let decodedImages = 1
        let readerOpens = 1
        let bytes: Int
    }
    public static func write(_ request: Request) throws -> Result {
        let edge = request.maxLongEdge ?? FrameLimits.defaultLongEdge
        let limit = request.maxEncodedBytes ?? FrameLimits.maximumEncodedBytes
        guard !request.asset.assetId.isEmpty, request.asset.streamId == "image:0",
            edge > 0, edge <= FrameLimits.maximumLongEdge,
            limit > 0, limit <= FrameLimits.maximumEncodedBytes
        else { throw NativeFailure("INVALID_REQUEST", "Invalid selected still-image request.") }
        guard
            let source = try StillImageSource.open(
                URL(fileURLWithPath: request.asset.path),
                maximumPixels: request.maxDecodedPixels ?? StillImageSource.maximumDecodedPixels)
        else {
            throw NativeFailure(
                "UNSUPPORTED_MEDIA", "Raw still pictures require one PNG or JPEG image.")
        }
        let output = try NewFile(at: request.output, assembledAs: "image.png")
        defer { output.discard() }
        let image = FrameImage(oriented: source.oriented, maxLongEdge: edge)
        let bytes = try image.publishPNG(
            to: output,
            context: CIContext(options: [.cacheIntermediates: false]), maxEncodedBytes: limit)
        return Result(
            file: request.output, assetId: request.asset.assetId, streamId: request.asset.streamId,
            width: image.width, height: image.height, sourceWidth: source.orientedWidth,
            sourceHeight: source.orientedHeight, orientation: source.orientation,
            hasAlpha: source.hasAlpha, bytes: bytes)
    }
}
