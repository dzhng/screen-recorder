import Foundation
import ScreenRecorderAudio
import ScreenRecorderMedia

/// The core resolves the revision's retained spans, the per-track source offsets and the derivative
/// path before calling this worker. Each track's `available` intervals are required: a plan that
/// omitted them would let the container decide what was acquired, which it cannot know.
enum AudioOperation {
    private struct Request: Codable {
        let output: String
        let spans: [TimeSpan]
        let tracks: [AudioTrackPlan]
    }

    static func execute(_ params: [String: Any]) async throws -> AudioExcerpt {
        let request = try WireRequest.decode(Request.self, from: params)
        // A relative path would silently resolve against the worker's working directory.
        guard request.output.hasPrefix("/") else {
            throw NativeFailure("INVALID_OUTPUT", "Excerpt output path must be absolute.")
        }
        return try await AudioExcerpts.write(
            AudioExcerptRequest(
                tracks: request.tracks, spans: request.spans,
                output: URL(fileURLWithPath: request.output)))
    }
}
