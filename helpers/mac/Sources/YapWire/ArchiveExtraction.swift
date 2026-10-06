import CLibArchive
import CryptoKit
import Darwin
import Foundation
import YapMedia

/// Reading an admitted ZIP into the exclusively owned workspace. Only plain files and directories
/// with safe, case-unique names are materialized, and every byte the parser sees is bounded.
extension ArchiveOperation {
    final class Input {
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

    static func extract(_ request: Extraction) throws -> [String: Any] {
        try request.identity.check(root)
        try ManagedFiles.lockPrivateDirectory(root)
        let limits = request.limits
        try limits.check()
        try requireEmpty()
        let source: Int32 = 4
        defer { close(source) }
        var sourceInfo = stat()
        guard fstat(source, &sourceInfo) == 0, sourceInfo.st_mode & S_IFMT == S_IFREG else {
            throw error("INVALID_PACKAGE", "Archive must be a regular file.")
        }
        let before = try FileVersion(of: source)
        let admitted = request.input
        guard sourceInfo.st_size > 0, admitted.bytes == sourceInfo.st_size,
            admitted.identity.device == before.device, admitted.identity.inode == before.inode,
            admitted.identity.modifiedNs == before.modifiedNs
        else {
            throw error("ARCHIVE_CHANGED", "Admitted archive changed before copying.")
        }
        guard sourceInfo.st_size <= limits.compressedBytes else {
            throw error("LIMIT_EXCEEDED", "Archive exceeds compressed byte limit.")
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
            let n = pread(source, buffer, chunkBytes, off_t(copied))
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
        var afterInfo = stat()
        guard fstat(source, &afterInfo) == 0, afterInfo.st_size == sourceInfo.st_size,
            copied == sourceInfo.st_size, try FileVersion(of: source) == before else {
            throw error("ARCHIVE_CHANGED", "Admitted archive changed during copying.")
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
        // The reader's callbacks read `input` through an unretained pointer until it is freed.
        defer { withExtendedLifetime(input) { _ = archive_read_free(reader) } }
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
            let parts: [String]
            switch memberPath(name, limits) {
            case .exceedsLimits: throw error("LIMIT_EXCEEDED", "ZIP member path limit exceeded.")
            case .unsafe: throw error("INVALID_PACKAGE", "Invalid or duplicate ZIP member name.")
            case .safe(let components): parts = components
            }
            guard names.insert(name.lowercased()).inserted else {
                throw error("INVALID_PACKAGE", "Invalid or duplicate ZIP member name.")
            }
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
            let text = name == "manifest.json" || request.inlineRevisions != false && name.hasPrefix("revisions/") && !directory
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
                "identity": directory ? NSNull() : try FileVersion(of: fd).json,
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
            "archiveSha256": hex(archiveHash.finalize()), "expandedBytes": total, "copiedBytes": copied,
            "initialReadBytes": input.bytes, "peakResidentBytes": ProcessResources.peakResidentBytes(),
            "parser": String(cString: archive_version_string()),
        ]
        guard try JSONSerialization.data(withJSONObject: result).count <= limits.receiptBytes else {
            throw error("LIMIT_EXCEEDED", "Archive receipt exceeds transport budget.")
        }
        return result
    }

    static func parser(_ status: Int32, _ reader: OpaquePointer, _ input: Input) throws {
        guard status == ARCHIVE_OK else {
            if input.failed {
                throw error("LIMIT_EXCEEDED", "ZIP initial metadata read limit exceeded.")
            }
            throw error(
                "INVALID_PACKAGE",
                archive_error_string(reader).map { String(cString: $0) } ?? "ZIP parser failed.")
        }
    }
}
