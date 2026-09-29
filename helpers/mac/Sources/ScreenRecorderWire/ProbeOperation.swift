import CryptoKit
import Foundation
import ScreenRecorderMedia

enum ProbeOperation {
    private struct Request: Codable { let path: String; let output: String? }
    struct FileReceipt: Encodable { let file: String; let bytes: Int; let sha256: String }
    enum Response: Encodable {
        case metadata(ProbedMedia)
        case file(FileReceipt)
        func encode(to encoder: Encoder) throws {
            switch self {
            case .metadata(let value): try value.encode(to: encoder)
            case .file(let value): try value.encode(to: encoder)
            }
        }
    }

    static func execute(_ params: [String: Any]) async throws -> Response {
        let request = try WireRequest.decode(Request.self, from: params)
        try WireRequest.requireAbsolute(request.path)
        let source = URL(fileURLWithPath: request.path)
        let metadata = try await MediaProbe.inspect(url: source)
        guard let destination = request.output else { return .metadata(metadata) }
        try WireRequest.requireAbsolute(destination)
        try Task.checkCancellation()
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        let bytes = try encoder.encode(metadata)
        guard bytes.count <= 64 * 1024 * 1024 else {
            throw NativeFailure("LIMIT_EXCEEDED", "Media probe metadata exceeds the 64 MiB delivery budget.")
        }
        let output = try OutputFile(destination, assembledAs: "metadata.json", distinctFrom: [source])
        defer { output.discard() }
        try Task.checkCancellation()
        try output.write(bytes)
        try Task.checkCancellation()
        let count = try output.finish()
        return .file(FileReceipt(file: destination, bytes: count,
            sha256: SHA256.hash(data: bytes).map { String(format: "%02x", $0) }.joined()))
    }
}
