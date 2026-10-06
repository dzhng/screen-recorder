import Foundation
import YapAudio
import YapMedia

enum SelectedAudioConversionOperation {
    private struct Request: Codable {
        let source: String
        let output: String
        let sampleRate: Int
        let channels: Int
    }
    static func execute(_ params: [String: Any]) async throws -> SelectedAudioConversionResult {
        let request = try WireRequest.decode(Request.self, from: params)
        try WireRequest.requireAbsolute(request.source, request.output)
        let conversion = try await SelectedAudioConversion.open(source: URL(fileURLWithPath: request.source),
            sampleRate: request.sampleRate, channels: request.channels)
        return try await conversion.write(to: URL(fileURLWithPath: request.output))
    }
}
