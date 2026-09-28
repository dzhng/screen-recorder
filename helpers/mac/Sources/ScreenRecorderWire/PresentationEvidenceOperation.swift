import Foundation
import ScreenRecorderFrames
import ScreenRecorderMedia

enum PresentationEvidenceOperation {
    private struct Request: Codable {
        let source: String
        let output: String
        let plan: [VideoRenderSpan]
        let maxBytes: Int
        let streamId: String?
        let clockOffsetUs: Int64?
        let maxRecords: Int?
        let maxDecodedSamples: Int?
    }

    static func execute(_ params: [String: Any]) async throws -> PresentationEvidenceReceipt {
        let request = try WireRequest.decode(Request.self, from: params)
        try WireRequest.requireAbsolute(request.source, request.output)
        return try await PresentationEvidence.write(
            source: URL(fileURLWithPath: request.source), plan: request.plan,
            output: URL(fileURLWithPath: request.output), maxBytes: request.maxBytes,
            streamId: request.streamId, clockOffsetUs: request.clockOffsetUs ?? 0,
            maxRecords: request.maxRecords ?? PresentationEvidence.maximumRecords,
            maxDecodedSamples: request.maxDecodedSamples
                ?? PresentationEvidence.maximumDecodedSamples)
    }
}
