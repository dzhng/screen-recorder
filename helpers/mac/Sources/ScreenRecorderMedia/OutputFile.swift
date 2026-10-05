import Darwin
import Foundation

/// A new file published at a caller-chosen path. The path must not exist when the operation
/// starts; the file is assembled in a private directory beside it and appears there only once
/// complete, through one `link(2)` that never replaces a name created meanwhile. Nothing an
/// operation writes is ever visible at the path in a partial state, and nothing that already
/// exists there is ever replaced, so a path output can never alias a source.
public final class NewFile: @unchecked Sendable {
    /// Where the operation writes the file's bytes.
    public let url: URL
    private let requested: String
    private let staging: URL
    private var parentDirectory: FileHandle?
    private var stagingDirectory: FileHandle?
    private let stagingIdentity: stat
    private var assembledIdentity: stat?
    private let ownershipLock = NSLock()

    /// `name` is what the file is called while assembled: platform writers infer behavior from
    /// its extension, and the published path's own name need not carry one.
    public init(at path: String, assembledAs name: String) throws {
        var info = stat()
        guard path.hasPrefix("/"), !path.contains("\0"), lstat(path, &info) != 0, errno == ENOENT
        else { throw NativeFailure("INVALID_OUTPUT", "Output must be a new absolute path.") }
        let destination = URL(fileURLWithPath: path)
        let staging = destination.deletingLastPathComponent().appendingPathComponent(
            ".screenrec-output-\(UUID().uuidString)")
        let parentFD = open(destination.deletingLastPathComponent().path,
            O_RDONLY | O_DIRECTORY | O_CLOEXEC)
        guard parentFD >= 0 else {
            throw NativeFailure("INVALID_OUTPUT", "Cannot retain output parent: \(Self.reason()).")
        }
        let parent = FileHandle(fileDescriptor: parentFD, closeOnDealloc: true)
        guard mkdirat(parentFD, staging.lastPathComponent, 0o700) == 0 else {
            try? parent.close()
            throw NativeFailure(
                "INVALID_OUTPUT", "Cannot create private staging beside \(path): \(Self.reason()).")
        }
        let stageFD = openat(parentFD, staging.lastPathComponent,
            O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC)
        guard stageFD >= 0 else {
            try? parent.close()
            throw NativeFailure("INVALID_OUTPUT", "Cannot retain private staging: \(Self.reason()).")
        }
        let stage = FileHandle(fileDescriptor: stageFD, closeOnDealloc: true)
        var identity = stat()
        guard fstat(stageFD, &identity) == 0 else {
            try? stage.close()
            try? parent.close()
            throw NativeFailure("INVALID_OUTPUT", "Cannot inspect private staging: \(Self.reason()).")
        }
        parentDirectory = parent
        stagingDirectory = stage
        stagingIdentity = identity
        requested = path
        self.staging = staging
        url = staging.appendingPathComponent(name)
    }

    /// Private space for intermediate files that never become the published output.
    public func scratch(named name: String) -> URL { staging.appendingPathComponent(name) }

    /// Writes complete bytes as the file.
    public func write(_ data: Data) throws {
        ownershipLock.lock()
        defer { ownershipLock.unlock() }
        guard let directory = stagingDirectory else {
            throw NativeFailure("INVALID_OUTPUT", "Output staging is closed.")
        }
        let allocated: FileHandle
        do {
            allocated = try ExclusiveFile.create(in: directory.fileDescriptor,
                named: url.lastPathComponent, access: O_WRONLY, permissions: 0o666)
        } catch { throw NativeFailure.decodeFailed("Cannot create output: \(error).") }
        defer { try? allocated.close() }
        let descriptor = allocated.fileDescriptor
        try Self.write(data, to: descriptor)
        var identity = stat()
        guard fstat(descriptor, &identity) == 0 else {
            throw NativeFailure.decodeFailed("Cannot identify written output: \(Self.reason()).")
        }
        assembledIdentity = identity
    }

    /// Makes the finished file visible at the requested path and returns its size. The receipt is
    /// only issued after the path is proven to name the inode this operation assembled.
    public func publish() throws -> Int {
        ownershipLock.lock()
        defer { ownershipLock.unlock() }
        guard let stage = stagingDirectory, let parent = parentDirectory else {
            throw NativeFailure("INVALID_OUTPUT", "Output staging is closed.")
        }
        return try Self.publish(stage.fileDescriptor, url.lastPathComponent,
            parent.fileDescriptor, at: requested, expected: assembledIdentity)
    }

    /// A retained attempt can resume publication of the same inode without replacing other bytes.
    package static func publish(staged url: URL, at requested: String) throws -> Int {
        let stage = open(url.deletingLastPathComponent().path, O_RDONLY | O_DIRECTORY | O_CLOEXEC)
        guard stage >= 0 else { throw NativeFailure.decodeFailed("Output was not written.") }
        defer { close(stage) }
        let parent = open(URL(fileURLWithPath: requested).deletingLastPathComponent().path,
            O_RDONLY | O_DIRECTORY | O_CLOEXEC)
        guard parent >= 0 else { throw NativeFailure("INVALID_OUTPUT", "Output parent is unavailable.") }
        defer { close(parent) }
        return try publish(stage, url.lastPathComponent, parent, at: requested, expected: nil)
    }

    private static func publish(_ stage: Int32, _ name: String, _ parent: Int32,
        at requested: String, expected: stat?) throws -> Int {
        let descriptor = openat(stage, name, O_RDONLY | O_NOFOLLOW | O_CLOEXEC)
        guard descriptor >= 0 else { throw NativeFailure.decodeFailed("Output was not written.") }
        defer { close(descriptor) }
        var staged = stat()
        guard fstat(descriptor, &staged) == 0, staged.st_mode & S_IFMT == S_IFREG,
            fsync(descriptor) == 0
        else { throw NativeFailure.decodeFailed("Cannot finish output: \(Self.reason()).") }
        if let expected, staged.st_dev != expected.st_dev || staged.st_ino != expected.st_ino {
            throw NativeFailure("INVALID_OUTPUT", "Assembled output changed before publication.")
        }
        var retained = stat(), current = stat()
        guard fstat(parent, &retained) == 0,
            stat(URL(fileURLWithPath: requested).deletingLastPathComponent().path, &current) == 0,
            current.st_dev == retained.st_dev, current.st_ino == retained.st_ino
        else { throw NativeFailure("INVALID_OUTPUT", "Output parent changed before publication.") }
        let target = URL(fileURLWithPath: requested).lastPathComponent
        let linked = linkat(stage, name, parent, target, 0)
        let created = linked == 0
        if !created && errno != EEXIST {
            throw NativeFailure("INVALID_OUTPUT", "Cannot publish to \(requested): \(Self.reason()).")
        }
        var published = stat(), confirmed = stat()
        guard fstat(descriptor, &confirmed) == 0, confirmed.st_size == staged.st_size,
            lstat(requested, &published) == 0, published.st_dev == staged.st_dev,
            published.st_ino == staged.st_ino, published.st_size == staged.st_size
        else {
            var owned = stat()
            if created, fstatat(parent, target, &owned, AT_SYMLINK_NOFOLLOW) == 0,
                owned.st_dev == staged.st_dev, owned.st_ino == staged.st_ino {
                _ = unlinkat(parent, target, 0)
            }
            throw NativeFailure("INVALID_OUTPUT", "Output locator changed before its receipt.")
        }
        return Int(staged.st_size)
    }

    /// Removes only the retained staging inode. A published file survives through its own link.
    public func discard() {
        ownershipLock.lock()
        defer { ownershipLock.unlock() }
        guard let stage = stagingDirectory, let parent = parentDirectory else { return }
        stagingDirectory = nil
        parentDirectory = nil
        defer { try? stage.close(); try? parent.close() }
        let stageFD = stage.fileDescriptor, parentFD = parent.fileDescriptor
        try? DirectoryContents.removeContents(stageFD)
        // A renamed attempt remains ours; a replacement at its previous name does not.
        try? DirectoryContents.forEachName(in: parentFD) { name in
            var current = stat()
            guard fstatat(parentFD, name, &current, AT_SYMLINK_NOFOLLOW) == 0,
                current.st_dev == stagingIdentity.st_dev, current.st_ino == stagingIdentity.st_ino
            else { return true }
            if unlinkat(parentFD, name, AT_REMOVEDIR) != 0 && errno != ENOENT {
                throw DirectoryContents.failure("Remove owned staging directory")
            }
            return false
        }
    }

    deinit {
        try? stagingDirectory?.close()
        try? parentDirectory?.close()
    }

    static func write(_ data: Data, to descriptor: Int32) throws {
        try data.withUnsafeBytes { bytes in
            var offset = 0
            while offset < bytes.count {
                let count = pwrite(
                    descriptor, bytes.baseAddress!.advanced(by: offset), bytes.count - offset,
                    off_t(offset))
                if count < 0 && errno == EINTR { continue }
                guard count > 0 else { throw NativeFailure.decodeFailed(
                    "Cannot write output: \(reason()).") }
                offset += count
            }
        }
        guard ftruncate(descriptor, off_t(data.count)) == 0, fsync(descriptor) == 0 else {
            throw NativeFailure.decodeFailed("Cannot finish output: \(reason()).")
        }
    }

    static func reason() -> String { String(cString: strerror(errno)) }
}

/// An output an operation accepts either as a caller-created writable handle, `/dev/fd/N`, which is
/// filled in place, or as a new path. A handle cannot name one of the operation's sources.
public enum OutputFile: Sendable {
    case handle(MediaDescriptor)
    case new(NewFile)

    public init(_ path: String, assembledAs name: String, distinctFrom sources: [URL]) throws {
        let handle: MediaDescriptor?
        do {
            handle = try MediaDescriptor(url: URL(fileURLWithPath: path), writable: true)
        } catch let failure as NativeFailure {
            throw NativeFailure("INVALID_OUTPUT", failure.message)
        }
        guard let handle else {
            self = .new(try NewFile(at: path, assembledAs: name))
            return
        }
        var output = stat()
        guard fstat(handle.descriptor, &output) == 0 else {
            throw NativeFailure("INVALID_OUTPUT", "Cannot inspect output handle.")
        }
        for source in sources {
            var info = stat()
            if stat(source.path, &info) == 0, info.st_dev == output.st_dev, info.st_ino == output.st_ino {
                throw NativeFailure(
                    "INVALID_OUTPUT", "Output handle names a source of this operation.")
            }
        }
        self = .handle(handle)
    }

    public var url: URL {
        switch self {
        case .handle(let handle): handle.url
        case .new(let file): file.url
        }
    }

    public func write(_ data: Data) throws {
        switch self {
        case .handle(let handle): try NewFile.write(data, to: handle.descriptor)
        case .new(let file): try file.write(data)
        }
    }

    /// Completes the output and returns its size.
    public func finish() throws -> Int {
        switch self {
        case .handle(let handle):
            guard fsync(handle.descriptor) == 0 else {
                throw NativeFailure.decodeFailed(
                    "Cannot finish output handle: \(NewFile.reason()).")
            }
            return Int(try handle.size)
        case .new(let file): return try file.publish()
        }
    }

    public func discard() {
        if case .new(let file) = self { file.discard() }
    }
}
