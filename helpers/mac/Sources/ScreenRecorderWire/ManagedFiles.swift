import Darwin
import Foundation

struct StorageFailure: Error {
    let code: String
    let message: String
    let retryable: Bool

    init(_ code: String, _ message: String, retryable: Bool = true) {
        self.code = code
        self.message = message
        self.retryable = retryable
    }
}

/// Core selects owned identities; this boundary resolves and removes only beneath pinned directories.
enum ManagedFiles {
    private struct Identity {
        let dev: UInt64
        let ino: UInt64

        init(_ value: Any?) throws {
            guard let fields = value as? [String: Any], Set(fields.keys) == ["dev", "ino"],
                let dev = fields["dev"] as? String, let ino = fields["ino"] as? String,
                !dev.isEmpty, !ino.isEmpty,
                dev.utf8.allSatisfy({ $0 >= 48 && $0 <= 57 }),
                ino.utf8.allSatisfy({ $0 >= 48 && $0 <= 57 }),
                let device = UInt64(dev), let inode = UInt64(ino)
            else {
                throw invalidRequest("Directory identities require decimal dev and ino strings.")
            }
            self.dev = device
            self.ino = inode
        }

        func check(_ fd: Int32) throws {
            var info = stat()
            guard fstat(fd, &info) == 0 else { throw failure("Inspect directory") }
            guard UInt64(truncatingIfNeeded: info.st_dev) == dev, info.st_ino == ino else {
                throw StorageFailure("INVALID_STORAGE", "Managed directory identity changed.")
            }
        }
    }

    static func execute(_ operation: String, _ params: [String: Any]) throws {
        let recording = operation == "storage.removeRecordingDirectory"
        let fields: Set<String> =
            recording
            ? ["home", "expectedHome", "recordingId"]
            : ["home", "expectedHome", "expectedCacheRoot", "ids"]
        guard Set(params.keys) == fields, let home = params["home"] as? String,
            home.hasPrefix("/"), !home.contains("\0")
        else { throw invalidRequest("Invalid managed file removal parameters.") }
        let expectedHome = try Identity(params["expectedHome"])
        let names: [String]
        let expectedCache: Identity?
        if recording {
            guard let id = params["recordingId"] as? String, validID(id) else {
                throw invalidRequest("Recording identity must be a UUID.")
            }
            names = [id]
            expectedCache = nil
        } else {
            guard let ids = params["ids"] as? [String], (1...64).contains(ids.count),
                ids.allSatisfy(validID)
            else { throw invalidRequest("Cache removal requires one to 64 UUIDs.") }
            names = ids
            expectedCache = try Identity(params["expectedCacheRoot"])
        }
        // Darwin rejects symlinks in every component, including ancestors of the supplied home.
        let homeFD = open(home, O_RDONLY | O_DIRECTORY | O_NOFOLLOW_ANY | O_CLOEXEC)
        guard homeFD >= 0 else { throw failure("Open managed home") }
        defer { close(homeFD) }
        try expectedHome.check(homeFD)
        if recording {
            guard let parent = try directory(homeFD, "recordings") else { return }
            defer { close(parent) }
            try names[0].withCString {
                try removeEntry(parent, $0, depth: 0, requireDirectory: true)
            }
        } else {
            guard let cache = try directory(homeFD, "cache") else { return }
            defer { close(cache) }
            guard let derived = try directory(cache, "derived") else { return }
            defer { close(derived) }
            try expectedCache!.check(derived)
            for id in names {
                if unlinkat(derived, "\(id).cache", 0) != 0 && errno != ENOENT {
                    throw failure("Remove owned cache file")
                }
            }
        }
    }

    private static func validID(_ value: String) -> Bool {
        value.utf8.count == 36 && UUID(uuidString: value) != nil
    }

    private static func directory(_ parent: Int32, _ name: String) throws -> Int32? {
        let fd = openat(parent, name, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC)
        if fd >= 0 { return fd }
        if errno == ENOENT { return nil }
        throw failure("Open managed directory")
    }

    private static func removeEntry(
        _ parent: Int32, _ name: UnsafePointer<CChar>, depth: Int, requireDirectory: Bool = false
    ) throws {
        var info = stat()
        if fstatat(parent, name, &info, AT_SYMLINK_NOFOLLOW) != 0 {
            if errno == ENOENT { return }
            throw failure("Inspect managed entry")
        }
        guard (info.st_mode & S_IFMT) == S_IFDIR else {
            if requireDirectory {
                throw StorageFailure("INVALID_STORAGE", "Recording root must be a real directory.")
            }
            if unlinkat(parent, name, 0) != 0 && errno != ENOENT {
                throw failure("Remove managed entry")
            }
            return
        }
        guard depth < 64 else {
            throw StorageFailure(
                "LIMIT_EXCEEDED", "Managed directory nesting exceeds 64 levels.", retryable: false)
        }
        let fd = openat(parent, name, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC)
        if fd < 0 {
            if errno == ENOENT { return }
            throw failure("Open recording directory")
        }
        guard let stream = fdopendir(fd) else {
            let error = failure("Enumerate recording directory")
            close(fd)
            throw error
        }
        defer { closedir(stream) }
        var opened = stat()
        guard fstat(fd, &opened) == 0 else { throw failure("Inspect opened directory") }
        guard opened.st_dev == info.st_dev, opened.st_ino == info.st_ino else {
            throw StorageFailure("INVALID_STORAGE", "Recording directory changed while opening.")
        }
        while true {
            errno = 0
            guard let entry = readdir(stream) else {
                if errno != 0 { throw failure("Read recording directory") }
                break
            }
            let nameCapacity = MemoryLayout.size(ofValue: entry.pointee.d_name)
            try withUnsafePointer(to: &entry.pointee.d_name) { pointer in
                try pointer.withMemoryRebound(to: CChar.self, capacity: nameCapacity) {
                    child in
                    if strcmp(child, ".") == 0 || strcmp(child, "..") == 0 { return }
                    try removeEntry(fd, child, depth: depth + 1)
                }
            }
        }
        if unlinkat(parent, name, AT_REMOVEDIR) != 0 && errno != ENOENT {
            throw failure("Remove emptied recording directory")
        }
    }

    private static func invalidRequest(_ message: String) -> StorageFailure {
        StorageFailure("INVALID_REQUEST", message, retryable: false)
    }

    private static func failure(_ action: String) -> StorageFailure {
        let number = errno
        let code = number == ELOOP || number == ENOTDIR ? "INVALID_STORAGE" : "DELETE_FAILED"
        return StorageFailure(code, "\(action): \(String(cString: strerror(number))).")
    }
}
