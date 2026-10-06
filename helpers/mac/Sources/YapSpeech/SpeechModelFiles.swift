import CryptoKit
import Darwin
import Foundation
import YapMedia

/// One pinned model file, named relative to the model directory.
public struct SpeechModelFile: Codable, Sendable {
    public let path: String
    public let bytes: Int64
    public let sha256: String
}

/// The model assets a request pins: a directory and the complete list of files it must hold. The
/// worker proves the directory matches the list before an engine is allowed to read it, so an
/// engine's own download or repair path can never run at inference.
public struct SpeechModelFiles: Codable, Sendable {
    public let directory: String
    public let files: [SpeechModelFile]

    static let maximumFiles = 256

    /// Refuses a list that could name something outside the directory or say nothing checkable.
    func checkShape() throws {
        guard directory.hasPrefix("/"), !directory.contains("\0") else {
            throw invalidRequest("The model directory must be an absolute path.")
        }
        guard (1...Self.maximumFiles).contains(files.count) else {
            throw invalidRequest("A model list names between 1 and \(Self.maximumFiles) files.")
        }
        var seen = Set<String>()
        for file in files {
            let parts = file.path.split(separator: "/", omittingEmptySubsequences: false)
            guard !file.path.hasPrefix("/"), !file.path.contains("\0"),
                parts.allSatisfy({ !$0.isEmpty && $0 != "." && $0 != ".." })
            else { throw invalidRequest("Model file path \(file.path) is not a safe relative path.") }
            guard seen.insert(file.path).inserted else {
                throw invalidRequest("Model file \(file.path) is listed twice.")
            }
            guard file.bytes >= 0,
                file.sha256.utf8.count == 64,
                file.sha256.utf8.allSatisfy({ (48...57).contains($0) || (97...102).contains($0) })
            else {
                throw invalidRequest("Model file \(file.path) needs a size and a lowercase sha256.")
            }
        }
    }

    /// Proves the directory holds exactly the listed regular files with their sizes and digests.
    /// Anything absent is `MODEL_UNAVAILABLE`; anything present but different, including an
    /// unlisted entry or a symbolic link, is `MODEL_INVALID`. Neither is retryable: the identical
    /// request cannot succeed until the assets are prepared again.
    func verify() throws {
        var info = stat()
        guard lstat(directory, &info) == 0 else {
            if errno == ENOENT { throw unavailable("No model directory at \(directory).") }
            throw invalid("Cannot inspect model directory \(directory): \(reason()).")
        }
        guard info.st_mode & S_IFMT == S_IFDIR else {
            throw invalid("Model directory \(directory) is not a plain directory.")
        }
        let listed = Dictionary(uniqueKeysWithValues: files.map { ($0.path, $0) })
        let ancestors = Set(
            files.flatMap { file in
                let parts = file.path.split(separator: "/").dropLast()
                return parts.indices.map { parts[...$0].joined(separator: "/") }
            })
        var found = Set<String>()
        try walk("", listed: listed, ancestors: ancestors, found: &found)
        if let missing = files.first(where: { !found.contains($0.path) }) {
            throw unavailable("Model file \(missing.path) is missing.")
        }
        for file in files {
            try check(file)
        }
    }

    private func walk(
        _ relative: String, listed: [String: SpeechModelFile], ancestors: Set<String>,
        found: inout Set<String>
    ) throws {
        let absolute = relative.isEmpty ? directory : directory + "/" + relative
        let names: [String]
        do { names = try FileManager.default.contentsOfDirectory(atPath: absolute) } catch {
            throw invalid("Cannot list model directory \(absolute).")
        }
        for name in names.sorted() {
            let path = relative.isEmpty ? name : relative + "/" + name
            var info = stat()
            guard lstat(directory + "/" + path, &info) == 0 else {
                throw invalid("Cannot inspect model entry \(path): \(reason()).")
            }
            switch info.st_mode & S_IFMT {
            case S_IFDIR where ancestors.contains(path):
                try walk(path, listed: listed, ancestors: ancestors, found: &found)
            case S_IFREG where listed[path] != nil:
                found.insert(path)
            default:
                throw invalid("Model directory holds \(path), which is not a pinned regular file.")
            }
        }
    }

    private func check(_ file: SpeechModelFile) throws {
        let path = directory + "/" + file.path
        let descriptor = open(path, O_RDONLY | O_NOFOLLOW | O_CLOEXEC)
        guard descriptor >= 0 else { throw invalid("Cannot open model file \(file.path): \(reason()).") }
        defer { close(descriptor) }
        var info = stat()
        guard fstat(descriptor, &info) == 0, info.st_mode & S_IFMT == S_IFREG else {
            throw invalid("Model file \(file.path) is not a regular file.")
        }
        guard Int64(info.st_size) == file.bytes else {
            throw invalid("Model file \(file.path) holds \(info.st_size) bytes, not \(file.bytes).")
        }
        var hash = SHA256()
        var buffer = [UInt8](repeating: 0, count: 1 << 20)
        var total: Int64 = 0
        while true {
            let count = buffer.withUnsafeMutableBytes { read(descriptor, $0.baseAddress, $0.count) }
            if count < 0 && errno == EINTR { continue }
            guard count >= 0 else { throw invalid("Cannot read model file \(file.path): \(reason()).") }
            if count == 0 { break }
            buffer.withUnsafeBytes { hash.update(bufferPointer: UnsafeRawBufferPointer(rebasing: $0[..<count])) }
            total += Int64(count)
        }
        let digest = hash.finalize().map { String(format: "%02x", $0) }.joined()
        guard total == file.bytes, digest == file.sha256 else {
            throw invalid("Model file \(file.path) does not match its pinned digest.")
        }
    }

    private func invalidRequest(_ message: String) -> NativeFailure {
        NativeFailure("INVALID_REQUEST", message)
    }
    private func unavailable(_ message: String) -> NativeFailure {
        NativeFailure("MODEL_UNAVAILABLE", message)
    }
    private func invalid(_ message: String) -> NativeFailure { NativeFailure("MODEL_INVALID", message) }
    private func reason() -> String { String(cString: strerror(errno)) }
}
