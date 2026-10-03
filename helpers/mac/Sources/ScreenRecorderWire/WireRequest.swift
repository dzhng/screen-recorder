import Darwin
import Foundation
import ScreenRecorderMedia

/// Requests are parsed strictly: a field the request type does not read is a caller mistake, not
/// something to ignore, at any depth. The type's own `Codable` shape is the single statement of
/// which fields exist, so no operation restates its key sets.
enum WireRequest {
    static func requireEmpty(_ params: [String: Any]) throws {
        guard params.isEmpty else { throw invalid("This operation requires empty params.") }
    }

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

    /// Bulk composition metadata uses the same typed decoder after bounded file admission.
    static func compositionParameters(_ params: [String: Any]) throws -> [String: Any] {
        guard params["planFile"] != nil else { return params }
        struct Reference: Codable { let planFile: String }
        let reference = try decode(Reference.self, from: params)
        try requireAbsolute(reference.planFile)
        let descriptor = open(reference.planFile, O_RDONLY | O_NONBLOCK | O_NOFOLLOW | O_CLOEXEC)
        guard descriptor >= 0 else { throw invalid("Cannot open compiled composition plan.") }
        let file = FileHandle(fileDescriptor: descriptor, closeOnDealloc: true)
        defer { try? file.close() }
        var info = stat()
        let limit = 64 * 1024 * 1024
        guard fstat(descriptor, &info) == 0, info.st_mode & S_IFMT == S_IFREG,
            info.st_size > 0, info.st_size <= limit else {
            throw invalid("Compiled composition plan must be a regular file of at most 64 MiB.")
        }
        try Task.checkCancellation()
        var bytes = Data()
        bytes.reserveCapacity(Int(info.st_size))
        while bytes.count <= Int(info.st_size) {
            try Task.checkCancellation()
            let chunk = try file.read(upToCount: min(65_536, Int(info.st_size) + 1 - bytes.count)) ?? Data()
            if chunk.isEmpty { break }
            bytes.append(chunk)
        }
        guard bytes.count == Int(info.st_size) else { throw invalid("Compiled composition plan changed while reading.") }
        let object: Any
        do { object = try JSONSerialization.jsonObject(with: bytes) }
        catch { throw invalid("Compiled composition plan is not valid JSON.") }
        guard let parameters = object as? [String: Any] else {
            throw invalid("Compiled composition plan must contain an object.")
        }
        try Task.checkCancellation()
        return parameters
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
