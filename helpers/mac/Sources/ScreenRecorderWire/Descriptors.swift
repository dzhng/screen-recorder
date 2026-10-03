import Darwin
import Foundation
import ScreenRecorderMedia

/// The device and inode that pin a directory or file the service already resolved. Decimal
/// strings on the wire, so 64-bit values survive JSON; canonical, so equality is exact.
struct InodeIdentity: Codable, Equatable {
    let dev: String
    let ino: String

    init(_ info: stat) {
        dev = String(UInt64(truncatingIfNeeded: info.st_dev))
        ino = String(info.st_ino)
    }

    init(from decoder: Decoder) throws {
        let fields = try decoder.container(keyedBy: CodingKeys.self)
        let dev = try fields.decode(String.self, forKey: .dev)
        let ino = try fields.decode(String.self, forKey: .ino)
        guard let device = Self.decimal(dev), let inode = Self.decimal(ino) else {
            throw NativeFailure(
                "INVALID_REQUEST", "Identities require decimal dev and ino strings.")
        }
        self.dev = String(device)
        self.ino = String(inode)
    }

    /// An identity field of a request that is otherwise parsed by hand.
    init(_ value: Any?) throws {
        guard let fields = value as? [String: Any] else {
            throw NativeFailure(
                "INVALID_REQUEST", "Identities require decimal dev and ino strings.")
        }
        self = try WireRequest.decode(Self.self, from: fields)
    }

    /// Fails unless `fd` still names this identity.
    func check(_ fd: Int32) throws {
        var info = stat()
        guard fstat(fd, &info) == 0 else { throw DirectoryContents.failure("Inspect directory") }
        guard Self(info) == self else {
            throw NativeFailure("INVALID_STORAGE", "Managed directory identity changed.")
        }
    }

    private static func decimal(_ value: String) -> UInt64? {
        guard !value.isEmpty, value.utf8.allSatisfy({ $0 >= 48 && $0 <= 57 }) else { return nil }
        return UInt64(value)
    }
}

/// Descriptor-relative primitives shared by every storage operation. They never resolve a path
/// above the descriptor they are given.
enum Descriptors {
    static func isEmpty(_ fd: Int32, failing: (String) -> NativeFailure = DirectoryContents.failure) throws -> Bool {
        var empty = true
        try DirectoryContents.forEachName(in: fd, failing: failing) { _ in
            empty = false
            return false
        }
        return empty
    }

    /// Writes all of `data` at the descriptor's current offset. Returns false with `errno` set.
    static func writeAll(_ fd: Int32, _ data: Data) -> Bool {
        data.withUnsafeBytes { buffer in
            var offset = 0
            while offset < buffer.count {
                let n = write(fd, buffer.baseAddress!.advanced(by: offset), buffer.count - offset)
                if n < 0 && errno == EINTR { continue }
                guard n > 0 else { return false }
                offset += n
            }
            return true
        }
    }
}
