import Foundation

/// Recording and project identifiers remain separate namespaces, including in service receipts.
public enum MediaTarget: Hashable, Sendable, Decodable {
    case recording(String)
    case project(String)

    public var id: String {
        switch self {
        case .recording(let id), .project(let id): id
        }
    }

    public var parameters: [String: String] {
        switch self {
        case .recording(let id): ["recordingId": id]
        case .project(let id): ["projectId": id]
        }
    }

    private enum Keys: String, CodingKey { case recordingId, projectId }

    public init(from decoder: Decoder) throws {
        let fields = try decoder.container(keyedBy: Keys.self)
        switch (fields.contains(.recordingId), fields.contains(.projectId)) {
        case (true, false): self = .recording(try fields.decode(String.self, forKey: .recordingId))
        case (false, true): self = .project(try fields.decode(String.self, forKey: .projectId))
        default:
            throw DecodingError.dataCorrupted(.init(
                codingPath: decoder.codingPath, debugDescription: "Media requires exactly one recording or project owner"))
        }
    }
}
