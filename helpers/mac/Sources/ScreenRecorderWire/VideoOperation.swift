import Foundation
import ScreenRecorderFrames

enum VideoOperation {
    private struct Parameters: Decodable {
        let source: String
        let output: String
        let plan: [VideoRenderSpan]
        let maxBytes: Int?
    }
    private static func parameters(_ params: [String: Any], evidence: Bool) throws -> Parameters {
        guard
            Set(params.keys)
                == (evidence
                    ? ["source", "output", "plan", "maxBytes"] : ["source", "output", "plan"]),
            let plan = params["plan"] as? [[String: Any]],
            plan.allSatisfy({ span in
                Set(span.keys) == ["source", "playback"]
                    && ["source", "playback"].allSatisfy {
                        (span[$0] as? [String: Any]).map { Set($0.keys) == ["startUs", "endUs"] }
                            ?? false
                    }
            })
        else { throw FrameFailure("INVALID_REQUEST", "Invalid video plan parameters.") }
        let request: Parameters
        do {
            request = try JSONDecoder().decode(
                Parameters.self,
                from: JSONSerialization.data(withJSONObject: params))
        } catch {
            throw FrameFailure("INVALID_REQUEST", "Invalid video plan parameter types.")
        }
        guard request.source.hasPrefix("/"), request.output.hasPrefix("/"),
            !request.source.contains("\0"), !request.output.contains("\0")
        else {
            throw FrameFailure(
                "INVALID_REQUEST", "Video paths must be absolute and contain no NUL.")
        }
        return request
    }
    static func execute(_ params: [String: Any]) async throws -> RenderedVideo {
        let request = try parameters(params, evidence: false)
        return try await VideoRenderer.write(
            source: URL(fileURLWithPath: request.source),
            plan: request.plan, output: URL(fileURLWithPath: request.output))
    }
    static func presentationEvidence(_ params: [String: Any]) async throws
        -> PresentationEvidenceReceipt
    {
        let request = try parameters(params, evidence: true)
        guard let maxBytes = request.maxBytes else {
            throw FrameFailure("INVALID_REQUEST", "Evidence requires maxBytes.")
        }
        return try await PresentationEvidence.write(
            source: URL(fileURLWithPath: request.source), plan: request.plan,
            output: URL(fileURLWithPath: request.output), maxBytes: maxBytes)
    }
}
