import Foundation
import ScreenRecorderMedia

/// Requests are parsed strictly: a field the request type does not read is a caller mistake, not
/// something to ignore, at any depth. The type's own `Codable` shape is the single statement of
/// which fields exist, so no operation restates its key sets.
enum WireRequest {
    static func decode<Request: Codable>(_ type: Request.Type, from params: [String: Any]) throws
        -> Request
    {
        let request: Request
        do {
            request = try JSONDecoder().decode(
                type, from: JSONSerialization.data(withJSONObject: params))
        } catch {
            throw invalid("Invalid parameters: \(error.localizedDescription)")
        }
        // Re-encoding keeps exactly the fields the type read; anything the caller sent beyond
        // them, other than an explicit null for an absent optional, was not understood.
        let read = try JSONSerialization.jsonObject(with: JSONEncoder().encode(request))
        guard onlyRead(params, read) else { throw invalid("Request has fields this operation does not read.") }
        return request
    }

    /// Paths the worker opens itself must be absolute, and a NUL would silently truncate them.
    static func requireAbsolute(_ paths: String...) throws {
        guard paths.allSatisfy({ $0.hasPrefix("/") && !$0.contains("\0") }) else {
            throw invalid("Paths must be absolute and contain no NUL.")
        }
    }

    private static func onlyRead(_ sent: Any, _ read: Any) -> Bool {
        switch (sent, read) {
        case (let sent as [String: Any], let read as [String: Any]):
            return sent.allSatisfy { key, value in
                guard let kept = read[key] else { return value is NSNull }
                return onlyRead(value, kept)
            }
        case (let sent as [Any], let read as [Any]):
            return sent.count == read.count && zip(sent, read).allSatisfy(onlyRead)
        case (is [String: Any], _), (is [Any], _):
            return false
        default:
            return true
        }
    }

    private static func invalid(_ message: String) -> NativeFailure {
        NativeFailure("INVALID_REQUEST", message)
    }
}
