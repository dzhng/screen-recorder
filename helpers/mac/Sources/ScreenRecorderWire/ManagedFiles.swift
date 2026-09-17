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
    struct Identity {
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

    /// Reject a selected directory whose ancestry includes a managed storage owner.
    static func requireOutsideDirectory(_ fd: Int32, ancestor: Identity) throws {
        var current = dup(fd)
        guard current >= 0 else { throw failure("Retain destination ancestry") }
        defer { close(current) }
        for _ in 0..<256 {
            var here = stat()
            guard fstat(current, &here) == 0, here.st_mode & S_IFMT == S_IFDIR else {
                throw StorageFailure("INVALID_STORAGE", "Destination must be a directory.", retryable: false)
            }
            guard UInt64(truncatingIfNeeded: here.st_dev) != ancestor.dev || here.st_ino != ancestor.ino else {
                throw StorageFailure("INVALID_STORAGE", "Destination must be outside managed storage.", retryable: false)
            }
            let parent = openat(current, "..", O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC)
            guard parent >= 0 else { throw failure("Inspect destination ancestry") }
            var above = stat()
            guard fstat(parent, &above) == 0 else { close(parent); throw failure("Inspect destination ancestor") }
            if above.st_dev == here.st_dev && above.st_ino == here.st_ino { close(parent); return }
            close(current)
            current = parent
        }
        throw StorageFailure("LIMIT_EXCEEDED", "Destination ancestry exceeds 256 directories.", retryable: false)
    }

    static func externalDirectory(_ params: [String: Any]) throws -> [String: String] {
        guard Set(params.keys) == ["home", "expectedHome"], let home = params["home"] as? String,
            home.hasPrefix("/"), !home.contains("\0") else { throw invalidRequest("Invalid external destination check.") }
        let expected = try Identity(params["expectedHome"])
        let owned = open(home, O_RDONLY | O_DIRECTORY | O_NOFOLLOW_ANY | O_CLOEXEC)
        guard owned >= 0 else { throw failure("Open managed home") }
        defer { close(owned) }
        try expected.check(owned)
        try requireOutsideDirectory(3, ancestor: expected)
        var destination = stat()
        guard fstat(3, &destination) == 0 else { throw failure("Inspect selected destination") }
        return ["dev": String(UInt64(truncatingIfNeeded: destination.st_dev)), "ino": String(destination.st_ino)]
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
        defer { close(fd) }
        var opened = stat()
        guard fstat(fd, &opened) == 0 else { throw failure("Inspect opened directory") }
        guard opened.st_dev == info.st_dev, opened.st_ino == info.st_ino else {
            throw StorageFailure("INVALID_STORAGE", "Recording directory changed while opening.")
        }
        try removeContents(fd, depth: depth)
        if unlinkat(parent, name, AT_REMOVEDIR) != 0 && errno != ENOENT {
            throw failure("Remove emptied recording directory")
        }
    }

    /// The lock follows the shared open-file description while the parent retains its FD.
    static func lockPrivateDirectory(_ fd: Int32, busyCode: String? = nil) throws {
        var info = stat()
        guard fstat(fd, &info) == 0, info.st_mode & S_IFMT == S_IFDIR,
            info.st_uid == getuid(), info.st_mode & 0o777 == 0o700 else {
            throw StorageFailure("INVALID_STORAGE",
                "Workspace must be a private directory owned exclusively by this attempt.",
                retryable: false)
        }
        guard flock(fd, LOCK_EX | LOCK_NB) == 0 else {
            let number = errno
            if let busyCode, number == EWOULDBLOCK || number == EAGAIN {
                throw StorageFailure(busyCode, "Workspace is still held by a live owner.", retryable: true)
            }
            throw StorageFailure("INVALID_STORAGE",
                "Workspace must be a private directory owned exclusively by this attempt.",
                retryable: false)
        }
    }

    // The caller exclusively owns the directory; cleanup never re-resolves its path.
    static func removeContents(_ fd: Int32, depth: Int = 0) throws {
        let scan = openat(fd, ".", O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC)
        guard scan >= 0 else { throw failure("Open owned directory") }
        guard let stream = fdopendir(scan) else {
            close(scan)
            throw failure("Enumerate owned directory")
        }
        defer { closedir(stream) }
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
