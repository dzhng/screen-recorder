@preconcurrency import AVFoundation
import CoreImage
import Foundation
import ScreenRecorderMedia

/// Delivers one compiled picture, without encoding or decoding an intermediate movie.
public enum CompositionFrameRenderer {
    public struct Request: Codable {
        public let output: String
        public let frame: CompositionPictureExecutor.Frame
        let canvas: CompositionPictureExecutor.Canvas
        let profile: String
        let processing: [CompositionProcessing]
        public let assets: [CompositionAsset]
        let maxLongEdge: Int?
        let maxEncodedBytes: Int?
    }
    public struct Result: Encodable {
        let file: String
        let mediaType = "image/png"
        let profile = "h264-rec709"
        let frame: CompositionPictureExecutor.Frame
        let picture: CompositionPictureExecutor.Picture
        let width: Int
        let height: Int
        let sourceWidth: Int
        let sourceHeight: Int
        let decodedSamples: Int
        let readerOpens: Int
        let bytes: Int
    }

    public static func write(_ request: Request) async throws -> Result {
        guard request.profile == "h264-rec709" else {
            throw NativeFailure("NOT_READY", "Unknown video export profile.")
        }
        let frame = request.frame
        let edge = request.maxLongEdge ?? FrameLimits.defaultLongEdge
        let limit = request.maxEncodedBytes ?? FrameLimits.maximumEncodedBytes
        guard edge > 0, edge <= FrameLimits.maximumLongEdge,
            limit > 0, limit <= FrameLimits.maximumEncodedBytes,
            frame.index >= 0, frame.index <= TimeSpan.maximumMicroseconds,
            frame.sampleAtUs >= 0, frame.sampleAtUs <= frame.visibleRange.startUs,
            frame.visibleRange.endUs > frame.visibleRange.startUs,
            frame.visibleRange.endUs <= TimeSpan.maximumMicroseconds
        else { throw NativeFailure("INVALID_REQUEST", "Invalid compiled picture or image limits.") }
        let pictures = try CompositionPictureExecutor(
            canvas: request.canvas, processing: request.processing, bindings: request.assets)
        let output = try NewFile(at: request.output, assembledAs: "frame.png")
        defer { output.discard() }
        let buffer = try await pictures.render(frame) { _ in
            var buffer: CVPixelBuffer?
            guard
                CVPixelBufferCreate(
                    nil, request.canvas.width, request.canvas.height, kCVPixelFormatType_32BGRA,
                    [kCVPixelBufferIOSurfacePropertiesKey as String: [:]] as CFDictionary,
                    &buffer) == kCVReturnSuccess, let buffer
            else { throw NativeFailure.decodeFailed("Cannot allocate picture buffer.") }
            return buffer
        }
        // Orientation and composition are complete. Only the established delivery bound remains.
        let image = try FrameImage(
            buffer: buffer, transform: .identity, overlay: nil, agedFromUs: 0,
            crop: nil, maxLongEdge: edge)
        let data = try image.png(context: pictures.context)
        guard data.count <= limit else {
            throw NativeFailure("LIMIT_EXCEEDED", "Encoded frame exceeds the requested byte limit.")
        }
        try Task.checkCancellation()
        try output.write(data)
        try Task.checkCancellation()
        let bytes = try output.publish()
        return Result(
            file: request.output, frame: frame, picture: pictures.picture,
            width: image.width, height: image.height,
            sourceWidth: request.canvas.width, sourceHeight: request.canvas.height,
            decodedSamples: pictures.decodedSamples, readerOpens: pictures.opens, bytes: bytes)
    }
}
