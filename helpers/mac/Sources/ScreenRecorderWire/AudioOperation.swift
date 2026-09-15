import Foundation
import ScreenRecorderAudio

// The core resolves the revision's retained spans, the per-track source offsets and the derivative
// path before calling this worker.
enum AudioOperation {
    private struct Parameters: Decodable {
        let output: String
        let spans: [SourceSpan]
        let tracks: [AudioTrackPlan]
    }

    static func execute(_ params: [String: Any]) async throws -> AudioExcerpt {
        guard Set(params.keys) == ["output", "spans", "tracks"],
            let spans = params["spans"] as? [[String: Any]],
            spans.allSatisfy({ Set($0.keys) == ["startUs", "endUs"] }),
            let tracks = params["tracks"] as? [[String: Any]],
            tracks.allSatisfy({ Set($0.keys) == ["role", "source", "sourceOffsetUs"] })
        else { throw AudioFailure("INVALID_REQUEST", "Invalid media.audio parameters.") }
        let parameters: Parameters
        do {
            parameters = try JSONDecoder().decode(
                Parameters.self, from: JSONSerialization.data(withJSONObject: params))
        } catch {
            throw AudioFailure("INVALID_REQUEST", "Invalid media.audio parameter types.")
        }
        guard parameters.output.hasPrefix("/") else {
            throw AudioFailure("INVALID_OUTPUT", "Excerpt output path must be absolute.")
        }
        return try await AudioExcerpts.write(
            AudioExcerptRequest(
                tracks: parameters.tracks, spans: parameters.spans,
                output: URL(fileURLWithPath: parameters.output)))
    }
}
