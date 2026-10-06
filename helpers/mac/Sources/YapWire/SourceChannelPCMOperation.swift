import Foundation
import YapAudio
import YapMedia

enum SourceChannelPCMOperation {
    private struct Request: Codable {
        let source: AudioSourceSelection
        let range: ExactRange
        let channel: Int
        let output: String
    }
    static func execute(_ params: [String: Any]) async throws -> SourceChannelPCMResult {
        let request = try WireRequest.decode(Request.self, from: params)
        try WireRequest.requireAbsolute(request.output)
        return try await SourceChannelPCM.write(source: request.source, range: request.range,
            channel: request.channel, output: URL(fileURLWithPath: request.output))
    }
}
