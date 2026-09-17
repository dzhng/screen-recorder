import CLibArchive
import CryptoKit
import Darwin
import Foundation
import ScreenRecorderMedia

/// Internal extraction into an inherited, exclusively owned directory. The parent retains fd 3's
/// original across worker death and invokes cleanup only after the extraction worker is reaped.
enum ArchiveOperation {
    static let operations = [
        "archive.createOutput", "archive.removeOutput", "archive.cleanup", "archive.prepare",
        "archive.extract", "archive.write", "archive.copy",
    ]
    private static let root: Int32 = 3
    private static let chunkBytes = 65_536
    private struct Limits: Codable {
        let compressedBytes, expandedBytes, memberBytes, entries, pathBytes: Int
        let componentBytes, depth, manifestBytes, revisionBytes, history: Int
        let initialReadBytes, receiptBytes: Int

        func check() throws {
            let values = [
                compressedBytes, expandedBytes, memberBytes, entries, pathBytes, componentBytes,
                depth, manifestBytes, revisionBytes, history, initialReadBytes, receiptBytes,
            ]
            guard values.allSatisfy({ (1...Int.max / 2).contains($0) }), depth <= 32,
                receiptBytes <= 7 * 1024 * 1024
            else { throw error("INVALID_REQUEST", "Unsupported archive limits.") }
        }
    }
    /// A file pinned by content version, not only by inode: a rewrite in place changes it.
    private struct FileVersion: Codable, Equatable {
        let device: String
        let inode: String
        let modifiedNs: String
        let changedNs: String

        init(of fd: Int32) throws {
            var info = stat()
            guard fstat(fd, &info) == 0 else { throw io("Inspect package member") }
            device = String(UInt64(truncatingIfNeeded: info.st_dev))
            inode = String(info.st_ino)
            modifiedNs = String(
                Int64(info.st_mtimespec.tv_sec) * 1_000_000_000 + Int64(info.st_mtimespec.tv_nsec))
            changedNs = String(
                Int64(info.st_ctimespec.tv_sec) * 1_000_000_000 + Int64(info.st_ctimespec.tv_nsec))
        }

        var json: [String: String] {
            ["device": device, "inode": inode, "modifiedNs": modifiedNs, "changedNs": changedNs]
        }
    }
    private struct Workspace: Codable {
        let identity: InodeIdentity
    }
    private struct NewOutput: Codable {
        let identity: InodeIdentity
        let name: String
    }
    private struct ReleasedOutput: Codable {
        let identity: InodeIdentity
        let name: String
        let fileIdentity: FileVersion
    }
    private struct Extraction: Codable {
        /// The archive the service admitted, before its change time is part of the pin.
        struct Admitted: Codable {
            struct Version: Codable {
                let device: String
                let inode: String
                let modifiedNs: String
            }
            let bytes: Int64
            let identity: Version
        }
        let identity: InodeIdentity
        let limits: Limits
        let input: Admitted
    }
    private struct Copy: Codable {
        struct Member: Codable {
            let source: String
            let target: String
            let bytes: Int
            let identity: FileVersion
        }
        let identity: InodeIdentity
        let inputIdentity: InodeIdentity
        let members: [Member]
        let limits: Limits
    }
    private struct Write: Codable {
        struct Plan: Codable {
            let bytes: Int
            let identity: FileVersion
        }
        let identity: InodeIdentity
        let inputIdentity: InodeIdentity
        let inputBytes: Int
        let plan: Plan
        let limits: Limits
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
        switch operation {
        case "archive.copy": return try copyMembers(WireRequest.decode(Copy.self, from: params))
        case "archive.write": return try writeArchive(WireRequest.decode(Write.self, from: params))
        case "archive.extract": return try extract(WireRequest.decode(Extraction.self, from: params))
        case "archive.createOutput":
            let request = try WireRequest.decode(NewOutput.self, from: params)
            try outputWorkspace(request.identity, name: request.name)
            let fd = openat(
                root, request.name, O_RDWR | O_CREAT | O_EXCL | O_NOFOLLOW | O_CLOEXEC, 0o600)
            guard fd >= 0 else { throw io("Create context output") }
            defer { close(fd) }
            return ["path": request.name, "bytes": 0, "identity": try FileVersion(of: fd).json]
        case "archive.removeOutput":
            let request = try WireRequest.decode(ReleasedOutput.self, from: params)
            try outputWorkspace(request.identity, name: request.name)
            let fd = openat(root, request.name, O_RDONLY | O_NOFOLLOW | O_NONBLOCK | O_CLOEXEC)
            guard fd >= 0 else { throw io("Open released output") }
            defer { close(fd) }
            var info = stat()
            guard fstat(fd, &info) == 0, info.st_mode & S_IFMT == S_IFREG, info.st_nlink == 1,
                try FileVersion(of: fd) == request.fileIdentity
            else { throw error("INVALID_STORAGE", "Output changed before release.") }
            guard unlinkat(root, request.name, 0) == 0 else { throw io("Remove released output") }
            return ["removed": true]
        default:
            let request = try WireRequest.decode(Workspace.self, from: params)
            try request.identity.check(root)
            try ManagedFiles.lockPrivateDirectory(root)
            if operation == "archive.cleanup" {
                try ManagedFiles.removeContents(root)
                return ["removed": true]
            }
            try requireEmpty()
            return ["empty": true]
        }
    }

    /// Pins the context workspace and admits only a unique media leaf inside it.
    private static func outputWorkspace(_ identity: InodeIdentity, name: String) throws {
        try identity.check(root)
        try ManagedFiles.lockPrivateDirectory(root)
        guard name.count == 40, [".png", ".wav"].contains(String(name.suffix(4))),
            UUID(uuidString: String(name.prefix(36))) != nil
        else { throw error("INVALID_REQUEST", "Output name must be a unique media leaf.") }
    }

    private static func extract(_ request: Extraction) throws -> [String: Any] {
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
            "initialReadBytes": input.bytes, "peakResidentBytes": peakResidentBytes(),
            "parser": String(cString: archive_version_string()),
        ]
        guard try JSONSerialization.data(withJSONObject: result).count <= limits.receiptBytes else {
            throw error("LIMIT_EXCEEDED", "Archive receipt exceeds transport budget.")
        }
        return result
    }

    private static func copyMembers(_ request: Copy) throws -> [String: Any] {
        try request.identity.check(root)
        try ManagedFiles.lockPrivateDirectory(root)
        let limits = request.limits
        try limits.check()
        try request.inputIdentity.check(4)
        try ManagedFiles.lockPrivateDirectory(4)
        guard (1...4).contains(request.members.count) else {
            throw error("INVALID_REQUEST", "Source copy requires one to four selected members.")
        }
        func parts(_ path: String) throws -> [String] {
            guard case .safe(let components) = memberPath(path, limits) else {
                throw error("INVALID_REQUEST", "Unsafe source copy path.")
            }
            return components
        }
        var selected: [(member: Copy.Member, parts: [String])] = []
        var names = Set<String>()
        for member in request.members {
            guard member.bytes >= 0, names.insert(member.target.lowercased()).inserted else {
                throw error("INVALID_REQUEST", "Invalid source copy selection.")
            }
            _ = try parts(member.source)
            selected.append((member, try parts(member.target)))
        }
        let buffer = UnsafeMutableRawPointer.allocate(byteCount: chunkBytes, alignment: 8)
        defer { buffer.deallocate() }
        var receipts: [[String: Any]] = [], total = 0
        for (member, parts) in selected {
            let input = try openWriteInput(member.source)
            defer { close(input) }
            var info = stat()
            guard fstat(input, &info) == 0, info.st_mode & S_IFMT == S_IFREG, info.st_nlink == 1,
                info.st_size >= 0, info.st_size <= limits.memberBytes else {
                throw error("INVALID_STORAGE", "Source copy requires a bounded regular file.")
            }
            let before = try FileVersion(of: input)
            guard info.st_size == member.bytes, before == member.identity else {
                throw error("ARCHIVE_CHANGED", "Selected source differs from admission.")
            }
            let output = try createMember(root, parts, false)
            defer { close(output) }
            var copied = 0, hash = SHA256()
            while copied < info.st_size {
                let n = pread(input, buffer, min(chunkBytes, Int(info.st_size) - copied), off_t(copied))
                if n < 0 && errno == EINTR { continue }
                guard n > 0 else { throw error("ARCHIVE_CHANGED", "Source changed during copy.") }
                try charge(n, &total, limits.expandedBytes)
                let bytes = Data(bytes: buffer, count: n)
                try writeAll(output, bytes)
                hash.update(data: bytes)
                copied += n
            }
            guard try FileVersion(of: input) == before else { throw error("ARCHIVE_CHANGED", "Source changed during copy.") }
            guard fsync(output) == 0 else { throw io("Flush selected source") }
            receipts.append(["path": member.target, "bytes": copied, "sha256": hex(hash.finalize()), "identity": try FileVersion(of: output).json])
        }
        return ["members": receipts, "bytes": total]
    }

    private struct WriteMember: Decodable {
        let path: String
        let bytes: Int
        let sha256: String
        let identity: FileVersion
    }
    private final class Output {
        let fd: Int32
        let limit: Int
        var bytes = 0
        var hash = SHA256()
        var failed = false
        init(_ fd: Int32, _ limit: Int) { self.fd = fd; self.limit = limit }
    }

    private static func writeArchive(_ request: Write) throws -> [String: Any] {
        try request.identity.check(root)
        try ManagedFiles.lockPrivateDirectory(root)
        let limits = request.limits
        try limits.check()
        try requireEmpty()
        try request.inputIdentity.check(4)
        try ManagedFiles.lockPrivateDirectory(4)
        var sourceRoot = stat(), outputRoot = stat(), planInfo = stat()
        guard fstat(4, &sourceRoot) == 0, fstat(root, &outputRoot) == 0,
            sourceRoot.st_dev != outputRoot.st_dev || sourceRoot.st_ino != outputRoot.st_ino else {
            throw error("INVALID_STORAGE", "ZIP input and output must be separate directories.")
        }
        guard fstat(5, &planInfo) == 0, planInfo.st_mode & S_IFMT == S_IFREG,
            planInfo.st_size > 0, planInfo.st_size <= limits.receiptBytes else {
            throw error("LIMIT_EXCEEDED", "ZIP member plan must be a bounded regular file.")
        }
        let planIdentity = try FileVersion(of: 5)
        guard request.plan.bytes == planInfo.st_size, request.plan.identity == planIdentity else {
            throw error("ARCHIVE_CHANGED", "ZIP plan differs from admission.")
        }
        var plan = Data(count: Int(planInfo.st_size))
        try plan.withUnsafeMutableBytes { raw in
            var offset = 0
            while offset < raw.count {
                let n = pread(5, raw.baseAddress!.advanced(by: offset), raw.count - offset, off_t(offset))
                if n < 0 && errno == EINTR { continue }
                guard n > 0 else { throw io("Read ZIP member plan") }
                offset += n
            }
        }
        guard try FileVersion(of: 5) == planIdentity else { throw error("ARCHIVE_CHANGED", "ZIP plan changed during read.") }
        let members = try JSONDecoder().decode([WriteMember].self, from: plan)
        guard !members.isEmpty, members.count <= limits.entries else {
            throw error("LIMIT_EXCEEDED", "ZIP member count exceeds limit.")
        }
        var names = Set<String>(), parents = Set<String>(), expectedTotal = 0
        for member in members {
            let folded = member.path.lowercased()
            guard case .safe(let parts) = memberPath(member.path, limits),
                !parents.contains(folded), names.insert(folded).inserted,
                member.bytes >= 0, member.bytes <= limits.memberBytes,
                member.sha256.count == 64, member.sha256.utf8.allSatisfy({ (48...57).contains($0) || (97...102).contains($0) }) else {
                throw error("INVALID_PACKAGE", "Invalid ZIP member plan.")
            }
            for count in 1..<parts.count {
                let parent = parts.prefix(count).joined(separator: "/").lowercased()
                guard !names.contains(parent) else { throw error("INVALID_PACKAGE", "ZIP file/directory collision.") }
                parents.insert(parent)
            }
            try charge(member.bytes, &expectedTotal, limits.expandedBytes)
        }
        guard request.inputBytes == expectedTotal else {
            throw error("ARCHIVE_CHANGED", "ZIP byte total differs from admission.")
        }
        let fd = openat(root, "payload.zip", O_RDWR | O_CREAT | O_EXCL | O_NOFOLLOW | O_CLOEXEC, 0o600)
        guard fd >= 0 else { throw io("Create ZIP output") }
        defer { close(fd) }
        guard let writer = archive_write_new() else { throw error("INVALID_PACKAGE", "Cannot create ZIP writer.") }
        defer { archive_write_free(writer) }
        let output = Output(fd, limits.compressedBytes)
        func checked(_ status: Int32) throws {
            guard status == ARCHIVE_OK else {
                if output.failed { throw error("LIMIT_EXCEEDED", "ZIP output limit or write failure.") }
                throw error("INVALID_PACKAGE", archive_error_string(writer).map { String(cString: $0) } ?? "ZIP write failed.")
            }
        }
        try checked(archive_write_set_format_zip(writer))
        try checked(archive_write_set_format_option(writer, "zip", "compression", "store"))
        try checked(archive_write_set_bytes_per_block(writer, 0))
        try checked(archive_write_open(writer, Unmanaged.passUnretained(output).toOpaque(), nil, { _, raw, buffer, count in
            let state = Unmanaged<Output>.fromOpaque(raw!).takeUnretainedValue()
            guard count <= state.limit - state.bytes else { state.failed = true; return -1 }
            var offset = 0
            while offset < count {
                let n = write(state.fd, buffer!.advanced(by: offset), count - offset)
                if n < 0 && errno == EINTR { continue }
                guard n > 0 else { state.failed = true; return -1 }
                offset += n
            }
            state.hash.update(data: Data(bytes: buffer!, count: count))
            state.bytes += count
            return count
        }, nil))
        let buffer = UnsafeMutableRawPointer.allocate(byteCount: chunkBytes, alignment: 8)
        defer { buffer.deallocate() }
        var total = 0
        for member in members {
            let input = try openWriteInput(member.path)
            defer { close(input) }
            var info = stat()
            guard fstat(input, &info) == 0, info.st_mode & S_IFMT == S_IFREG, info.st_nlink == 1,
                info.st_size == member.bytes, try FileVersion(of: input) == member.identity else {
                throw error("ARCHIVE_CHANGED", "ZIP member differs from selected input.")
            }
            guard let entry = archive_entry_new() else { throw error("INVALID_PACKAGE", "Cannot create ZIP entry.") }
            defer { archive_entry_free(entry) }
            archive_entry_set_pathname(entry, member.path)
            archive_entry_set_filetype(entry, UInt32(S_IFREG))
            archive_entry_set_perm(entry, 0o600)
            archive_entry_set_size(entry, Int64(member.bytes))
            try checked(archive_write_header(writer, entry))
            var copied = 0, hash = SHA256()
            while copied < member.bytes {
                let n = pread(input, buffer, min(chunkBytes, member.bytes - copied), off_t(copied))
                if n < 0 && errno == EINTR { continue }
                guard n > 0 else { throw error("ARCHIVE_CHANGED", "ZIP member ended before expected size.") }
                hash.update(data: Data(bytes: buffer, count: n))
                guard archive_write_data(writer, buffer, n) == n else {
                    throw error(output.failed ? "LIMIT_EXCEEDED" : "INVALID_PACKAGE", "ZIP member write failed.")
                }
                copied += n
                try charge(n, &total, limits.expandedBytes)
            }
            guard try FileVersion(of: input) == member.identity, hex(hash.finalize()) == member.sha256 else {
                throw error("ARCHIVE_CHANGED", "ZIP member changed while copying.")
            }
            try checked(archive_write_finish_entry(writer))
        }
        try checked(archive_write_close(writer))
        guard fsync(fd) == 0 else { throw io("Flush ZIP output") }
        return ["path": "payload.zip", "bytes": output.bytes, "sha256": hex(output.hash.finalize()),
            "identity": try FileVersion(of: fd).json, "expandedBytes": total, "entries": members.count,
            "peakResidentBytes": peakResidentBytes(), "writer": String(cString: archive_version_string())]
    }
    private static func openWriteInput(_ path: String) throws -> Int32 {
        var fd = dup(4)
        guard fd >= 0 else { throw io("Retain ZIP input root") }
        do {
            let parts = path.split(separator: "/").map(String.init)
            for (index, part) in parts.enumerated() {
                let flags = O_RDONLY | O_NOFOLLOW | O_NONBLOCK | O_CLOEXEC | (index + 1 < parts.count ? O_DIRECTORY : 0)
                let next = openat(fd, part, flags)
                guard next >= 0 else { throw io("Open ZIP input member") }
                close(fd); fd = next
            }
            return fd
        } catch { close(fd); throw error }
    }

    private enum MemberPath {
        case safe([String])
        case exceedsLimits
        case unsafe
    }

    /// A relative member path of plain ASCII components, none empty or a dot segment, within the
    /// request's path, depth and component limits.
    private static func memberPath(_ path: String, _ limits: Limits) -> MemberPath {
        let parts = path.split(separator: "/", omittingEmptySubsequences: false).map(String.init)
        guard path.utf8.count <= limits.pathBytes, parts.count <= limits.depth,
            parts.allSatisfy({ $0.utf8.count <= limits.componentBytes })
        else { return .exceedsLimits }
        guard !path.isEmpty,
            path.utf8.allSatisfy({
                (48...57).contains($0) || (65...90).contains($0) || (97...122).contains($0)
                    || [45, 46, 47, 95].contains($0)
            }),
            parts.allSatisfy({ !$0.isEmpty && $0 != "." && $0 != ".." })
        else { return .unsafe }
        return .safe(parts)
    }

    static func peakResidentBytes() -> Int64 {
        var usage = rusage()
        getrusage(RUSAGE_SELF, &usage)
        return Int64(usage.ru_maxrss)
    }

    private static func requireEmpty() throws {
        guard try Descriptors.isEmpty(root, failing: io) else {
            throw error("INVALID_STORAGE", "Archive workspace is not empty.")
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
        guard Descriptors.writeAll(fd, bytes) else { throw io("Write archive member") }
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
    private static func error(_ code: String, _ message: String) -> NativeFailure {
        NativeFailure(code, message, retryable: false)
    }
    private static func io(_ action: String) -> NativeFailure {
        error("INVALID_STORAGE", "\(action): \(String(cString: strerror(errno)))")
    }
}
