import Foundation
import ScreenRecorderMedia

enum ProbeOperation {
    private struct Request: Codable { let path: String }

    static func execute(_ params: [String: Any]) async throws -> ProbedMedia {
        let request = try WireRequest.decode(Request.self, from: params)
        try WireRequest.requireAbsolute(request.path)
        return try await MediaProbe.inspect(url: URL(fileURLWithPath: request.path))
    }
}
