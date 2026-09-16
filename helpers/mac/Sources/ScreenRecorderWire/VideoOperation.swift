import Foundation
import ScreenRecorderFrames

enum VideoOperation {
    private struct Parameters: Decodable {
        let source: String
        let output: String
        let plan: [VideoRenderSpan]
    }
    static func execute(_ params: [String: Any]) async throws -> RenderedVideo {
        guard Set(params.keys) == ["source", "output", "plan"],
            let plan = params["plan"] as? [[String: Any]],
            plan.allSatisfy({ span in
                Set(span.keys) == ["source", "playback"]
                    && ["source", "playback"].allSatisfy {
                        (span[$0] as? [String: Any]).map { Set($0.keys) == ["startUs", "endUs"] }
                            ?? false
                    }
            })
        else { throw FrameFailure("INVALID_REQUEST", "Invalid media.renderVideo parameters.") }
        let request: Parameters
        do {
            request = try JSONDecoder().decode(
                Parameters.self,
                from: JSONSerialization.data(withJSONObject: params))
        } catch {
            throw FrameFailure("INVALID_REQUEST", "Invalid media.renderVideo parameter types.")
        }
        guard request.source.hasPrefix("/"), request.output.hasPrefix("/"),
            !request.source.contains("\0"), !request.output.contains("\0")
        else {
            throw FrameFailure(
                "INVALID_REQUEST", "Video paths must be absolute and contain no NUL.")
        }
        return try await VideoRenderer.write(
            source: URL(fileURLWithPath: request.source),
            plan: request.plan, output: URL(fileURLWithPath: request.output))
    }
}
