import Foundation
import ScreenRecorderAudio
import ScreenRecorderMedia

enum SourceAudioOperation {
    private struct Request: Codable {
        let source: AudioSourceSelection
        let range: TimeSpan
        let output: String
    }
    static func execute(_ params: [String: Any]) async throws -> SourceAudioResult {
        let request = try WireRequest.decode(Request.self, from: params)
        try WireRequest.requireAbsolute(request.output)
        return try await SourceAudio.write(
            source: request.source, range: request.range,
            output: URL(fileURLWithPath: request.output))
    }
}
