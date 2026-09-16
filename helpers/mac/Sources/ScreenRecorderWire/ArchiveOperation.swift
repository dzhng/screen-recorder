import CLibArchive
import CryptoKit
import Darwin
import Foundation

/// Internal extraction into an inherited, exclusively owned directory. The parent retains fd 3's
/// original across worker death and invokes cleanup only after the extraction worker is reaped.
enum ArchiveOperation {
    private static let root: Int32 = 3
    private static let chunkBytes = 65_536
    private struct Limits: Decodable {
        let compressedBytes, expandedBytes, memberBytes, entries, pathBytes: Int
        let componentBytes, depth, manifestBytes, revisionBytes, history: Int
        let initialReadBytes, receiptBytes: Int
    }
    private final class Input {
        let fd: Int32
        let size: Int64
        let limit: Int
        let buffer = UnsafeMutableRawPointer.allocate(byteCount: chunkBytes, alignment: 8)
        var initial = true
        var bytes = 0
        var failed = false
        init(_ fd: Int32, _ size: Int64, _ limit: Int) {
            self.fd = fd
            self.size = size
            self.limit = limit
        }
        deinit { buffer.deallocate() }
    }

    static func execute(_ operation: String, _ params: [String: Any]) throws -> [String: Any] {
        try ManagedFiles.Identity(params["identity"]).check(root)
        try ManagedFiles.lockPrivateDirectory(root)
        if operation == "archive.createOutput" || operation == "archive.removeOutput" {
            guard let name = params["name"] as? String,
                name.count == 40, [".png", ".wav"].contains(String(name.suffix(4))),
                UUID(uuidString: String(name.prefix(36))) != nil else {
                throw error("INVALID_REQUEST", "Output name must be a unique media leaf.")
            }
            if operation == "archive.removeOutput" {
                guard let expected = params["fileIdentity"] as? [String: String] else {
                    throw error("INVALID_REQUEST", "Output removal requires its admitted identity.")
                }
                let fd = openat(root, name, O_RDONLY | O_NOFOLLOW | O_NONBLOCK | O_CLOEXEC)
                guard fd >= 0 else { throw io("Open released output") }
                defer { close(fd) }
                var info = stat()
                guard fstat(fd, &info) == 0, info.st_mode & S_IFMT == S_IFREG,
                    info.st_nlink == 1, try identity(fd) == expected else {
                    throw error("INVALID_STORAGE", "Output changed before release.")
                }
                guard unlinkat(root, name, 0) == 0 else { throw io("Remove released output") }
                return ["removed": true]
            }
            let fd = openat(root, name, O_RDWR | O_CREAT | O_EXCL | O_NOFOLLOW | O_CLOEXEC, 0o600)
            guard fd >= 0 else { throw io("Create context output") }
            defer { close(fd) }
            return ["path": name, "bytes": 0, "identity": try identity(fd)]
        }
        if operation == "archive.cleanup" {
            try ManagedFiles.removeContents(root)
            return ["removed": true]
        }
        if operation == "archive.prepare" {
            try requireEmpty()
            return ["empty": true]
        }
        guard operation == "archive.extract", let path = params["archive"] as? String,
            path.hasPrefix("/"), !path.contains("\0"),
            let values = params["limits"] as? [String: Any],
            values.values.allSatisfy({ value in
                guard let n = value as? NSNumber else { return false }
                return n.doubleValue >= 1 && n.doubleValue <= Double(Int.max / 2)
                    && n.doubleValue.rounded() == n.doubleValue
            })
        else { throw error("INVALID_REQUEST", "Invalid archive request.") }
        let limits = try JSONDecoder().decode(
            Limits.self, from: JSONSerialization.data(withJSONObject: values))
        guard limits.depth <= 32, limits.receiptBytes <= 7 * 1024 * 1024 else {
            throw error("INVALID_REQUEST", "Unsupported archive limits.")
        }
        try requireEmpty()
        let source = open(path, O_RDONLY | O_NOFOLLOW_ANY | O_CLOEXEC | O_NONBLOCK)
        guard source >= 0 else { throw io("Open archive") }
        defer { close(source) }
        var sourceInfo = stat()
        guard fstat(source, &sourceInfo) == 0, sourceInfo.st_mode & S_IFMT == S_IFREG else {
            throw error("INVALID_PACKAGE", "Archive must be a regular file.")
        }
        let snapshot = openat(
            root, ".input", O_RDWR | O_CREAT | O_EXCL | O_NOFOLLOW | O_CLOEXEC, 0o600)
        guard snapshot >= 0 else { throw io("Create archive snapshot") }
        defer { close(snapshot) }
        let buffer = UnsafeMutableRawPointer.allocate(byteCount: chunkBytes, alignment: 8)
        defer { buffer.deallocate() }
        var copied = 0
        var archiveHash = SHA256()
        while true {
            let n = read(source, buffer, chunkBytes)
            if n < 0 {
                if errno == EINTR { continue }
                throw io("Read archive")
            }
            if n == 0 { break }
            try charge(n, &copied, limits.compressedBytes)
            let bytes = Data(bytes: buffer, count: n)
            archiveHash.update(data: bytes)
            try writeAll(snapshot, bytes)
        }
        guard lseek(snapshot, 0, SEEK_SET) == 0 else { throw io("Rewind archive snapshot") }
        guard mkdirat(root, "content", 0o700) == 0 else { throw io("Create extraction directory") }
        let content = openat(root, "content", O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC)
        guard content >= 0 else { throw io("Open extraction directory") }
        defer { close(content) }
        let input = Input(snapshot, Int64(copied), limits.initialReadBytes)
        guard let reader = archive_read_new() else {
            throw error("INVALID_PACKAGE", "Cannot create ZIP reader.")
        }
        defer { archive_read_free(reader) }
        try parser(archive_read_support_format_zip_seekable(reader), reader, input)
        try parser(archive_read_set_format_option(reader, "zip", "mac-ext", nil), reader, input)
        try parser(
            archive_read_set_seek_callback(
                reader,
                { _, raw, offset, whence in
                    let state = Unmanaged<Input>.fromOpaque(raw!).takeUnretainedValue()
                    let position = lseek(state.fd, offset, whence)
                    return position >= 0 && position <= state.size ? position : Int64(ARCHIVE_FATAL)
                }), reader, input)
        let context = Unmanaged.passUnretained(input).toOpaque()
        try parser(
            archive_read_open2(
                reader, context, nil,
                { _, raw, output in
                    let state = Unmanaged<Input>.fromOpaque(raw!).takeUnretainedValue()
                    // Do not expose a byte beyond the metadata budget to the parser's eager allocation.
                    let allowance =
                        state.initial
                        ? min(ArchiveOperation.chunkBytes, state.limit - state.bytes)
                        : ArchiveOperation.chunkBytes
                    guard allowance > 0 else {
                        state.failed = true
                        return -1
                    }
                    let n = read(state.fd, state.buffer, allowance)
                    if n > 0 && state.initial { state.bytes += n }
                    output?.pointee = UnsafeRawPointer(state.buffer)
                    return n
                }, nil, nil), reader, input)
        var entries = [[String: Any]]()
        var revisions = [String: String]()
        var manifest = ""
        var total = 0
        var revisionBytes = 0
        var receiptEstimate = 256
        var names = Set<String>()
        var nodes = [String: (path: String, directory: Bool)]()
        while true {
            var entry: OpaquePointer?
            let status = archive_read_next_header(reader, &entry)
            if status == ARCHIVE_EOF { break }
            try parser(status, reader, input)
            input.initial = false
            guard let entry, let rawName = archive_entry_pathname(entry) else {
                throw error("INVALID_PACKAGE", "ZIP member has no pathname.")
            }
            guard entries.count < limits.entries else {
                throw error("LIMIT_EXCEEDED", "Archive entry limit exceeded.")
            }
            let directory = archive_entry_filetype(entry) == S_IFDIR
            guard directory || archive_entry_filetype(entry) == S_IFREG,
                archive_entry_symlink(entry) == nil, archive_entry_hardlink(entry) == nil,
                archive_entry_is_encrypted(entry) == 0, archive_entry_sparse_count(entry) == 0
            else {
                throw error(
                    "INVALID_PACKAGE", "Links, encrypted and special ZIP entries are unsupported.")
            }
            var name = String(cString: rawName)
            if directory && name.hasSuffix("/") { name.removeLast() }
            let parts = name.split(separator: "/", omittingEmptySubsequences: false).map(
                String.init)
            guard name.utf8.count <= limits.pathBytes, parts.count <= limits.depth,
                parts.allSatisfy({ $0.utf8.count <= limits.componentBytes })
            else {
                throw error("LIMIT_EXCEEDED", "ZIP member path limit exceeded.")
            }
            guard !name.isEmpty,
                name.utf8.allSatisfy({
                    (65...90).contains($0) || (97...122).contains($0) || (48...57).contains($0)
                        || [95, 46, 47, 45].contains($0)
                }),
                parts.allSatisfy({
                    !$0.isEmpty && $0 != "." && $0 != ".." && $0.utf8.count <= limits.componentBytes
                }),
                names.insert(name.lowercased()).inserted
            else { throw error("INVALID_PACKAGE", "Invalid or duplicate ZIP member name.") }
            for count in 1...parts.count {
                let component = parts.prefix(count).joined(separator: "/")
                let isDirectory = count < parts.count || directory
                if let existing = nodes[component.lowercased()] {
                    guard existing.path == component, existing.directory, isDirectory else {
                        throw error("INVALID_PACKAGE", "ZIP file/directory or case collision.")
                    }
                } else {
                    nodes[component.lowercased()] = (component, isDirectory)
                }
            }
            if archive_entry_size_is_set(entry) != 0 {
                let size = archive_entry_size(entry)
                guard size >= 0, size <= limits.memberBytes, !directory || size == 0 else {
                    throw error("LIMIT_EXCEEDED", "ZIP declared member size exceeds its limit.")
                }
            }
            let fd = try createMember(content, parts, directory)
            defer { close(fd) }
            var bytes = 0
            var hash = SHA256()
            var metadata = Data()
            let text = name == "manifest.json" || name.hasPrefix("revisions/") && !directory
            while true {
                let n = archive_read_data(reader, buffer, chunkBytes)
                if n < 0 { try parser(Int32(n), reader, input) }
                if n == 0 { break }
                guard !directory else {
                    throw error("INVALID_PACKAGE", "ZIP directory contains payload.")
                }
                try charge(n, &bytes, limits.memberBytes)
                try charge(n, &total, limits.expandedBytes)
                let block = Data(bytes: buffer, count: n)
                hash.update(data: block)
                if text {
                    if name == "manifest.json" {
                        guard bytes <= limits.manifestBytes else {
                            throw error("LIMIT_EXCEEDED", "Manifest exceeds byte limit.")
                        }
                    } else {
                        try charge(n, &revisionBytes, limits.revisionBytes)
                    }
                    metadata.append(block)
                }
                try writeAll(fd, block)
            }
            if text {
                guard let value = String(data: metadata, encoding: .utf8) else {
                    throw error("INVALID_PACKAGE", "Metadata is not UTF-8.")
                }
                if name == "manifest.json" {
                    manifest = value
                } else {
                    guard revisions.count < limits.history else {
                        throw error("LIMIT_EXCEEDED", "Revision count limit exceeded.")
                    }
                    revisions[name] = value
                }
                try charge(
                    try JSONSerialization.data(withJSONObject: [value]).count, &receiptEstimate,
                    limits.receiptBytes)
            }
            let row: [String: Any] = [
                "path": name, "directory": directory, "bytes": bytes,
                "sha256": hex(hash.finalize()),
                "identity": directory ? NSNull() : try identity(fd),
            ]
            try charge(
                try JSONSerialization.data(withJSONObject: row).count + 1, &receiptEstimate,
                limits.receiptBytes)
            entries.append(row)
        }
        guard archive_read_has_encrypted_entries(reader) == 0 else {
            throw error("INVALID_PACKAGE", "Encrypted archive is unsupported.")
        }

        let result: [String: Any] = [
            "manifest": manifest, "revisions": revisions, "members": entries,
            "archiveSha256": hex(archiveHash.finalize()), "expandedBytes": total,
            "initialReadBytes": input.bytes, "peakResidentBytes": peakResidentBytes(),
            "parser": String(cString: archive_version_string()),
        ]
        guard try JSONSerialization.data(withJSONObject: result).count <= limits.receiptBytes else {
            throw error("LIMIT_EXCEEDED", "Archive receipt exceeds transport budget.")
        }
        return result
    }

    private static func identity(_ fd: Int32) throws -> [String: String] {
        var info = stat()
        guard fstat(fd, &info) == 0 else { throw io("Inspect package member") }
        return ["device": String(UInt64(truncatingIfNeeded: info.st_dev)), "inode": String(info.st_ino),
            "modifiedNs": String(Int64(info.st_mtimespec.tv_sec) * 1_000_000_000 + Int64(info.st_mtimespec.tv_nsec)),
            "changedNs": String(Int64(info.st_ctimespec.tv_sec) * 1_000_000_000 + Int64(info.st_ctimespec.tv_nsec))]
    }

    static func peakResidentBytes() -> Int64 {
        var usage = rusage()
        getrusage(RUSAGE_SELF, &usage)
        return Int64(usage.ru_maxrss)
    }

    private static func requireEmpty() throws {
        let fd = openat(root, ".", O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC)
        guard fd >= 0 else { throw io("Open workspace") }
        guard let stream = fdopendir(fd) else {
            close(fd)
            throw io("Inspect workspace")
        }
        defer { closedir(stream) }
        while true {
            errno = 0
            guard let entry = readdir(stream) else {
                if errno != 0 { throw io("Enumerate workspace") }
                break
            }
            let name = withUnsafePointer(to: &entry.pointee.d_name) { pointer in
                pointer.withMemoryRebound(to: CChar.self, capacity: 256) { String(cString: $0) }
            }
            guard name == "." || name == ".." else {
                throw error("INVALID_STORAGE", "Archive workspace is not empty.")
            }
        }
    }
    private static func createMember(_ base: Int32, _ parts: [String], _ directory: Bool) throws
        -> Int32
    {
        var fd = dup(base)
        guard fd >= 0 else { throw io("Duplicate extraction directory") }
        do {
            for (i, part) in parts.enumerated() {
                let isDirectory = i < parts.count - 1 || directory
                if isDirectory && mkdirat(fd, part, 0o700) != 0 && errno != EEXIST {
                    throw io("Create member directory")
                }
                let next =
                    isDirectory
                    ? openat(fd, part, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC)
                    : openat(fd, part, O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW | O_CLOEXEC, 0o600)
                guard next >= 0 else { throw io("Create archive member") }
                close(fd)
                fd = next
            }
            return fd
        } catch {
            close(fd)
            throw error
        }
    }
    private static func writeAll(_ fd: Int32, _ bytes: Data) throws {
        try bytes.withUnsafeBytes { raw in
            var offset = 0
            while offset < raw.count {
                let n = write(fd, raw.baseAddress!.advanced(by: offset), raw.count - offset)
                if n < 0 && errno == EINTR { continue }
                guard n > 0 else { throw io("Write archive member") }
                offset += n
            }
        }
    }
    private static func charge(_ value: Int, _ total: inout Int, _ limit: Int) throws {
        guard value <= limit - total else {
            throw error("LIMIT_EXCEEDED", "Archive byte limit exceeded.")
        }
        total += value
    }
    private static func parser(_ status: Int32, _ reader: OpaquePointer, _ input: Input) throws {
        guard status == ARCHIVE_OK else {
            if input.failed {
                throw error("LIMIT_EXCEEDED", "ZIP initial metadata read limit exceeded.")
            }
            throw error(
                "INVALID_PACKAGE",
                archive_error_string(reader).map { String(cString: $0) } ?? "ZIP parser failed.")
        }
    }
    private static func hex<D: Sequence>(_ digest: D) -> String where D.Element == UInt8 {
        digest.map { String(format: "%02x", $0) }.joined()
    }
    private static func error(_ code: String, _ message: String) -> StorageFailure {
        StorageFailure(code, message, retryable: false)
    }
    private static func io(_ action: String) -> StorageFailure {
        error("INVALID_STORAGE", "\(action): \(String(cString: strerror(errno)))")
    }
}
