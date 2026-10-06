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
    static func execute(_ params: [String: Any], expectedFrames: Int64? = nil) async throws -> SourceChannelPCMResult {
        let request = try WireRequest.decode(Request.self, from: params)
        try WireRequest.requireAbsolute(request.output)
        if let expectedFrames {
            guard try request.range.endUs.subtract(request.range.startUs).compare(
                ExactTime(Int128(expectedFrames) * 1_000_000, 16_000)) == .orderedSame else {
                throw NativeFailure("INVALID_REQUEST", "Speaker PCM requires exactly 30 seconds.")
            }
        }
        return try await SourceChannelPCM.write(source: request.source, range: request.range,
            channel: request.channel, output: URL(fileURLWithPath: request.output))
    }
}
