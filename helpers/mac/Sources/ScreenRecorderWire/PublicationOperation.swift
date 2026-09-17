import CryptoKit
import Darwin
import Foundation

/// A completed staging hard link survives until its caller durably acknowledges the outcome.
/// Mutations inherit locked staging on fd 3 and destination on fd 4; usage only observes fd 3.
enum PublicationOperation {
    private static let privateFiles = ["payload", "receipt.pending", "prepared.json"]
    private struct Identity: Codable, Equatable {
        let dev: String
        let ino: String
        init(_ info: stat) {
            dev = String(UInt64(truncatingIfNeeded: info.st_dev))
            ino = String(info.st_ino)
        }
    }
    private struct Receipt: Codable {
        let stage: Identity
        let destination: Identity
        let file: Identity
        let leaf: String
        let bytes: Int64
        let sha256: String
    }
    private static func failure(_ code: String, _ message: String) -> StorageFailure {
        StorageFailure(code, message, retryable: false)
    }
    private static func io(_ action: String) -> StorageFailure {
        StorageFailure("PUBLICATION_IO", "\(action): \(String(cString: strerror(errno)))")
    }
    private static func info(_ fd: Int32, directory: Bool = false) throws -> stat {
        var value = stat()
        guard fstat(fd, &value) == 0 else { throw io("Inspect publication descriptor") }
        guard value.st_mode & S_IFMT == (directory ? S_IFDIR : S_IFREG) else {
            throw failure("INVALID_STORAGE", "Publication descriptor has the wrong file type.")
        }
        return value
    }
    private static func leaf(_ value: String) -> Bool {
        !value.isEmpty && value != "." && value != ".." && !value.contains("/")
            && !value.contains("\0") && value.utf8.count <= 255
    }
    private static func writeAll(_ fd: Int32, _ data: Data) throws {
        try data.withUnsafeBytes { buffer in
            var offset = 0
            while offset < buffer.count {
                let n = write(fd, buffer.baseAddress!.advanced(by: offset), buffer.count - offset)
                if n < 0 && errno == EINTR { continue }
                guard n > 0 else { throw io("Write publication file") }
                offset += n
            }
        }
    }
    private static func digest(_ fd: Int32, bytes: Int64, copyTo: Int32? = nil) throws -> String {
        let initial = try info(fd)
        guard initial.st_size == bytes else { throw failure("PUBLICATION_CHANGED", "Publication size changed.") }
        let buffer = UnsafeMutableRawPointer.allocate(byteCount: 65_536, alignment: 8)
        defer { buffer.deallocate() }
        var hash = SHA256()
        var offset: Int64 = 0
        while offset < bytes {
            let n = pread(fd, buffer, Int(min(65_536, bytes - offset)), off_t(offset))
            if n < 0 && errno == EINTR { continue }
            guard n > 0 else { throw io("Read publication bytes") }
            let data = Data(bytes: buffer, count: n)
            hash.update(data: data)
            if let copyTo { try writeAll(copyTo, data) }
            offset += Int64(n)
        }
        let final = try info(fd)
        guard final.st_size == initial.st_size,
            final.st_mtimespec.tv_sec == initial.st_mtimespec.tv_sec,
            final.st_mtimespec.tv_nsec == initial.st_mtimespec.tv_nsec,
            final.st_ctimespec.tv_sec == initial.st_ctimespec.tv_sec,
            final.st_ctimespec.tv_nsec == initial.st_ctimespec.tv_nsec else {
            throw failure("PUBLICATION_CHANGED", "Publication bytes changed while reading.")
        }
        return hash.finalize().map { String(format: "%02x", $0) }.joined()
    }
    private static func readReceipt() throws -> Receipt {
        let fd = openat(3, "prepared.json", O_RDONLY | O_NOFOLLOW | O_NONBLOCK | O_CLOEXEC)
        guard fd >= 0 else { throw io("Open prepared receipt") }
        defer { close(fd) }
        let size = try info(fd).st_size
        guard size > 0 && size <= 4096 else { throw failure("INVALID_STORAGE", "Invalid prepared receipt size.") }
        var data = Data(count: Int(size))
        let n = data.withUnsafeMutableBytes { pread(fd, $0.baseAddress, $0.count, 0) }
        guard n == size else { throw io("Read prepared receipt") }
        let receipt = try JSONDecoder().decode(Receipt.self, from: data)
        guard leaf(receipt.leaf), receipt.bytes >= 0, receipt.bytes <= 9_007_199_254_740_991,
            receipt.sha256.count == 64, receipt.sha256.allSatisfy({ $0.isHexDigit }),
            receipt.stage == Identity(try info(3, directory: true)),
            receipt.destination == Identity(try info(4, directory: true)) else {
            throw failure("PUBLICATION_CHANGED", "Prepared publication ownership changed.")
        }
        return receipt
    }
    private static func payload(_ receipt: Receipt) throws -> Int32 {
        let fd = openat(3, "payload", O_RDONLY | O_NOFOLLOW | O_NONBLOCK | O_CLOEXEC)
        guard fd >= 0 else { throw io("Open publication payload") }
        do {
            guard Identity(try info(fd)) == receipt.file,
                try digest(fd, bytes: receipt.bytes) == receipt.sha256 else {
                throw failure("PUBLICATION_CHANGED", "Prepared publication bytes changed.")
            }
            return fd
        } catch { close(fd); throw error }
    }
    private static func reconcile(_ receipt: Receipt) throws -> String {
        let fd = openat(4, receipt.leaf, O_RDONLY | O_NOFOLLOW | O_NONBLOCK | O_CLOEXEC)
        if fd < 0 {
            if errno == ENOENT { return "missing" }
            if errno == ELOOP { return "replaced" }
            throw io("Open published destination")
        }
        defer { close(fd) }
        var value = stat()
        guard fstat(fd, &value) == 0 else { throw io("Inspect published destination") }
        guard value.st_mode & S_IFMT == S_IFREG, Identity(value) == receipt.file else { return "replaced" }
        guard value.st_size == receipt.bytes else { return "modified" }
        do { return try digest(fd, bytes: receipt.bytes) == receipt.sha256 ? "committed" : "modified" }
        catch let error as StorageFailure where error.code == "PUBLICATION_CHANGED" { return "modified" }
    }
    private static func requireEmpty(_ directory: Int32 = 3) throws {
        let fd = openat(directory, ".", O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC)
        guard fd >= 0 else { throw io("Inspect empty publication staging") }
        guard let entries = fdopendir(fd) else { close(fd); throw io("Enumerate publication staging") }
        defer { closedir(entries) }
        while true {
            errno = 0
            guard let entry = readdir(entries) else {
                if errno != 0 { throw io("Read publication staging") }
                return
            }
            let name = withUnsafePointer(to: &entry.pointee.d_name) {
                $0.withMemoryRebound(to: CChar.self, capacity: Int(entry.pointee.d_namlen) + 1) { String(cString: $0) }
            }
            if name != "." && name != ".." {
                throw failure("INVALID_STORAGE", "Publication preparation requires empty private staging.")
            }
        }
    }
    private static func cleanup() throws {
        // Only this owner's known leaves are disposable; never recurse into an unexpected entry.
        for name in privateFiles {
            if unlinkat(3, name, 0) != 0 && errno != ENOENT { throw io("Remove private publication evidence") }
        }
    }
    static func execute(_ operation: String, _ params: [String: Any]) throws -> [String: Any] {
        if operation == "publication.usage" {
            guard Set(params.keys) == ["stage", "committed"],
                let committed = params["committed"] as? NSNumber, CFGetTypeID(committed) == CFBooleanGetTypeID() else {
                throw failure("INVALID_REQUEST", "Invalid staging measurement.")
            }
            try ManagedFiles.Identity(params["stage"]).check(3)
            let stage = try info(3, directory: true)
            guard stage.st_uid == getuid(), stage.st_mode & 0o777 == 0o700 else {
                throw failure("INVALID_STORAGE", "Publication staging must be private and owned.")
            }
            // Metadata-only observation can coexist with the inherited writer lock. No pathname
            // traversal or receipt parsing is needed to report an interrupted preparation.
            var bytes: Int64 = 0
            for name in privateFiles {
                var entry = stat()
                if fstatat(3, name, &entry, AT_SYMLINK_NOFOLLOW) != 0 {
                    if errno == ENOENT { continue }
                    throw io("Measure private publication file")
                }
                guard entry.st_mode & S_IFMT == S_IFREG, entry.st_size >= 0 else {
                    throw failure("INVALID_STORAGE", "Unexpected private publication file type.")
                }
                // Only commit creates another payload link. This also sees a completed
                // link before its catalog receipt; no destination read or digest is needed.
                if name == "payload" && (committed.boolValue || entry.st_nlink > 1) { continue }
                guard entry.st_size <= 9_007_199_254_740_991 - bytes else {
                    throw failure("LIMIT_EXCEEDED", "Publication storage exceeds safe byte range.")
                }
                bytes += entry.st_size
            }
            return ["bytes": bytes]
        }
        if operation == "publication.absent" {
            guard Set(params.keys) == ["destination", "name"], let name = params["name"] as? String,
                leaf(name), name.hasPrefix(".screenrec-export-") else { throw failure("INVALID_REQUEST", "Invalid staging lookup.") }
            try ManagedFiles.Identity(params["destination"]).check(3)
            _ = try info(3, directory: true)
            var entry = stat()
            if fstatat(3, name, &entry, AT_SYMLINK_NOFOLLOW) == 0 { return ["absent": false] }
            guard errno == ENOENT else { throw io("Inspect retired staging") }
            return ["absent": true]
        }
        if operation == "publication.allocate" {
            guard Set(params.keys) == ["destination", "name"], let name = params["name"] as? String,
                leaf(name), name.hasPrefix(".screenrec-export-") else {
                throw failure("INVALID_REQUEST", "Invalid publication staging allocation.")
            }
            try ManagedFiles.Identity(params["destination"]).check(3)
            _ = try info(3, directory: true)
            if mkdirat(3, name, 0o700) != 0 && errno != EEXIST { throw io("Allocate publication staging") }
            let fd = openat(3, name, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC | O_NONBLOCK)
            guard fd >= 0 else { throw io("Open allocated publication staging") }
            defer { close(fd) }
            try ManagedFiles.lockPrivateDirectory(fd)
            // Before identity registration, no writer may enter: crash recovery adopts only empty staging.
            try requireEmpty(fd)
            let data = try JSONEncoder().encode(Identity(try info(fd, directory: true)))
            return ["identity": try JSONSerialization.jsonObject(with: data)]
        }

        let preparing = operation == "publication.prepare"
        let retiring = operation == "publication.retire"
        guard Set(params.keys) == (preparing ? ["stage", "destination", "leaf", "maxBytes"] : retiring ? ["stage", "destination", "name"] : ["stage", "destination"]) else {
            throw failure("INVALID_REQUEST", "Invalid publication parameters.")
        }
        try ManagedFiles.Identity(params["stage"]).check(3)
        try ManagedFiles.lockPrivateDirectory(3)
        try ManagedFiles.Identity(params["destination"]).check(4)
        let stage = try info(3, directory: true), destination = try info(4, directory: true)
        guard stage.st_dev == destination.st_dev else {
            throw failure("CROSS_DEVICE_PUBLICATION", "Staging and destination must share a filesystem.")
        }
        try ManagedFiles.requireOutsideDirectory(4, ancestor: ManagedFiles.Identity(params["stage"]))
        if preparing {
            try requireEmpty()
            guard let name = params["leaf"] as? String, leaf(name),
                let limit = params["maxBytes"] as? NSNumber,
                CFGetTypeID(limit) != CFBooleanGetTypeID(), limit.doubleValue >= 1,
                limit.doubleValue <= 9_007_199_254_740_991,
                limit.doubleValue.rounded() == limit.doubleValue else {
                throw failure("INVALID_REQUEST", "Publication needs a destination leaf and byte budget.")
            }
            let source = try info(5)
            guard source.st_size <= limit.int64Value else {
                throw failure("LIMIT_EXCEEDED", "Publication exceeds its byte budget.")
            }
            let fd = openat(3, "payload", O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW | O_CLOEXEC, 0o600)
            guard fd >= 0 else { throw io("Create publication payload") }
            defer { close(fd) }
            let sha = try digest(5, bytes: source.st_size, copyTo: fd)
            guard fsync(fd) == 0 else { throw io("Synchronize publication payload") }
            let receipt = Receipt(stage: Identity(stage), destination: Identity(destination),
                file: Identity(try info(fd)), leaf: name, bytes: source.st_size, sha256: sha)
            let data = try JSONEncoder().encode(receipt)
            let record = openat(3, "receipt.pending", O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW | O_CLOEXEC, 0o600)
            guard record >= 0 else { throw io("Create publication receipt") }
            defer { close(record) }
            try writeAll(record, data)
            guard fsync(record) == 0 else { throw io("Synchronize publication receipt") }
            // Only a complete synchronized receipt may authorize external publication after restart.
            guard linkat(3, "receipt.pending", 3, "prepared.json", 0) == 0 else { throw io("Publish prepared receipt") }
            guard unlinkat(3, "receipt.pending", 0) == 0 else { throw io("Remove pending receipt") }
            return ["receipt": try JSONSerialization.jsonObject(with: data)]
        }
        if retiring {
            guard let name = params["name"] as? String, leaf(name), name.hasPrefix(".screenrec-export-") else {
                throw failure("INVALID_REQUEST", "Invalid publication staging name.")
            }
            var entry = stat()
            guard fstatat(4, name, &entry, AT_SYMLINK_NOFOLLOW) == 0,
                entry.st_mode & S_IFMT == S_IFDIR, Identity(entry) == Identity(stage) else {
                throw failure("PUBLICATION_CHANGED", "Publication staging entry changed.")
            }
            try cleanup()
            try requireEmpty()
            guard unlinkat(4, name, AT_REMOVEDIR) == 0 else { throw io("Retire publication staging") }
            return ["removed": true]
        }
        if operation == "publication.discard" {
            // Explicit abandonment is private cleanup only, including an interrupted prepare.
            try cleanup()
            return ["removed": true]
        }
        if operation == "publication.acknowledge" {
            var entry = stat()
            if fstatat(3, "prepared.json", &entry, AT_SYMLINK_NOFOLLOW) != 0 && errno == ENOENT {
                if fstatat(3, "payload", &entry, AT_SYMLINK_NOFOLLOW) != 0 && errno == ENOENT {
                    return ["removed": true]
                }
            }
        }
        if operation == "publication.reconcile" {
            var entry = stat()
            if fstatat(3, "prepared.json", &entry, AT_SYMLINK_NOFOLLOW) != 0 && errno == ENOENT {
                return ["state": "unprepared", "receipt": NSNull()]
            }
        }
        let receipt = try readReceipt()
        if operation == "publication.reconcile" {
            return ["state": try reconcile(receipt), "receipt": try JSONSerialization.jsonObject(with: JSONEncoder().encode(receipt))]
        }
        if operation == "publication.acknowledge" {
            guard try reconcile(receipt) == "committed" else {
                throw failure("PUBLICATION_CHANGED", "Only an observed committed publication can be acknowledged.")
            }
            try cleanup()
            return ["removed": true]
        }
        guard operation == "publication.commit" else { throw failure("INVALID_REQUEST", "Unknown publication operation.") }
        let existing = try reconcile(receipt)
        if existing != "missing" { return ["state": existing] }
        let fd = try payload(receipt)
        defer { close(fd) }
        // The private directory owner keeps this verified leaf stable while the syscall runs.
        if linkat(3, "payload", 4, receipt.leaf, 0) != 0 {
            if errno == EEXIST { return ["state": try reconcile(receipt)] }
            throw io("Publish completed file")
        }
        return ["state": try reconcile(receipt)]
    }
}
