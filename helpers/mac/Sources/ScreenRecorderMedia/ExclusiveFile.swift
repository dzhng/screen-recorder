import Darwin
import Foundation

/// Exclusive allocation in a held private directory, never through its mutable locator.
public enum ExclusiveFile {
    public static func create(in directory: Int32, named name: String,
        access: Int32, permissions: mode_t) throws -> FileHandle {
        var info = stat()
        guard !name.isEmpty, name != ".", name != "..", !name.contains("/"),
              !name.contains("\0"), access == O_WRONLY || access == O_RDWR,
              fstat(directory, &info) == 0, info.st_mode & S_IFMT == S_IFDIR,
              info.st_mode & 0o777 == 0o700, info.st_uid == getuid()
        else { throw POSIXError(.EINVAL) }
        let descriptor = openat(directory, name,
            access | O_CREAT | O_EXCL | O_NOFOLLOW | O_CLOEXEC, permissions)
        guard descriptor >= 0 else { throw POSIXError(POSIXErrorCode(rawValue: errno) ?? .EIO) }
        return FileHandle(fileDescriptor: descriptor, closeOnDealloc: true)
    }
}
