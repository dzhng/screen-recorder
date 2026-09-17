import Foundation
import ScreenRecorderFrames
import ScreenRecorderMedia

/// The core resolves revisions and allocates derivative paths before calling this worker. Point
/// values inside an overlay are the decoder's to validate against real media.
enum FrameOperation {
    private struct FrameRequestFields: Codable {
        let source: String
        let output: String
        let atSourceUs: Int64
        let kept: TimeSpan
        let crop: FrameCrop?
        let overlay: FrameOverlay?
        let maxLongEdge: Int?
        let maxEncodedBytes: Int?
    }

    private struct VisualSampleFields: Codable {
        let source: String
        let kept: TimeSpan
        let atSourceUs: [Int64]
    }

    static func execute(_ params: [String: Any]) async throws -> DecodedFrame {
        let request = try WireRequest.decode(FrameRequestFields.self, from: params)
        try WireRequest.requireAbsolute(request.source, request.output)
        let source = try await FrameSource(url: URL(fileURLWithPath: request.source))
        return try await source.decodeFrame(
            FrameRequest(
                atSourceUs: request.atSourceUs, kept: request.kept,
                output: URL(fileURLWithPath: request.output), overlay: request.overlay,
                crop: request.crop,
                maxLongEdge: request.maxLongEdge ?? FrameLimits.defaultLongEdge,
                maxEncodedBytes: request.maxEncodedBytes ?? FrameLimits.maximumEncodedBytes))
    }

    static func visualSamples(_ params: [String: Any]) async throws -> VisualSamples {
        let request = try WireRequest.decode(VisualSampleFields.self, from: params)
        try WireRequest.requireAbsolute(request.source)
        let source = try await FrameSource(url: URL(fileURLWithPath: request.source))
        return try await source.visualSamples(atSourceUs: request.atSourceUs, kept: request.kept)
    }
}
