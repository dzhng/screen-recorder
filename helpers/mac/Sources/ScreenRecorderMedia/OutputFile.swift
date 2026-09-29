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

    /// `name` is what the file is called while assembled: platform writers infer behavior from
    /// its extension, and the published path's own name need not carry one.
    public init(at path: String, assembledAs name: String) throws {
        var info = stat()
        guard path.hasPrefix("/"), !path.contains("\0"), lstat(path, &info) != 0, errno == ENOENT
        else { throw NativeFailure("INVALID_OUTPUT", "Output must be a new absolute path.") }
        let destination = URL(fileURLWithPath: path)
        let staging = destination.deletingLastPathComponent().appendingPathComponent(
            ".screenrec-output-\(UUID().uuidString)")
        guard mkdir(staging.path, 0o700) == 0 else {
            throw NativeFailure(
                "INVALID_OUTPUT", "Cannot create private staging beside \(path): \(Self.reason()).")
        }
        requested = path
        self.staging = staging
        url = staging.appendingPathComponent(name)
    }

    /// Private space for intermediate files that never become the published output.
    public func scratch(named name: String) -> URL { staging.appendingPathComponent(name) }

    /// Writes complete bytes as the file.
    public func write(_ data: Data) throws {
        let descriptor = open(url.path, O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW | O_CLOEXEC, 0o666)
        guard descriptor >= 0 else { throw NativeFailure.decodeFailed(
            "Cannot create output: \(Self.reason()).") }
        defer { close(descriptor) }
        try Self.write(data, to: descriptor)
    }

    /// Makes the finished file visible at the requested path and returns its size. The receipt is
    /// only issued after the path is proven to name the inode this operation assembled.
    public func publish() throws -> Int {
        try Self.publish(staged: url, at: requested)
    }

    /// A retained attempt can resume publication of the same inode without replacing other bytes.
    package static func publish(staged url: URL, at requested: String) throws -> Int {
        let descriptor = open(url.path, O_RDONLY | O_NOFOLLOW | O_CLOEXEC)
        guard descriptor >= 0 else { throw NativeFailure.decodeFailed("Output was not written.") }
        defer { close(descriptor) }
        var staged = stat()
        guard fstat(descriptor, &staged) == 0, staged.st_mode & S_IFMT == S_IFREG,
            fsync(descriptor) == 0
        else { throw NativeFailure.decodeFailed("Cannot finish output: \(Self.reason()).") }
        if link(url.path, requested) != 0 && errno != EEXIST {
            throw NativeFailure("INVALID_OUTPUT", "Cannot publish to \(requested): \(Self.reason()).")
        }
        var published = stat()
        guard lstat(requested, &published) == 0, published.st_dev == staged.st_dev,
            published.st_ino == staged.st_ino
        else { throw NativeFailure("INVALID_OUTPUT", "Output locator changed before its receipt.") }
        return Int(staged.st_size)
    }

    /// Removes the private staging directory. A published file survives through its own link.
    public func discard() { try? FileManager.default.removeItem(at: staging) }

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
