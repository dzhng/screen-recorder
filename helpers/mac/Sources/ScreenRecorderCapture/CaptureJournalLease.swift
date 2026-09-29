import Darwin
import Foundation
import Synchronization

/// Exclusive ownership of one existing take's journal inode, retained across publication work.
package final class CaptureJournalLease: Sendable {
    package let directory: String
    private struct Handles: Sendable { var journal: Int32; var directory: Int32 }
    private let handles: Mutex<Handles>
    package var descriptor: Int32 { handles.withLock { $0.journal } }
    private let journalIdentity: (dev_t, ino_t)
    private let directoryIdentity: (dev_t, ino_t)

    package convenience init(directory: String) throws {
        try self.init(directory: directory, creating: false)
    }
    static func create(directory: String) throws -> CaptureJournalLease {
        try CaptureJournalLease(directory: directory, creating: true)
    }
    private init(directory: String, creating: Bool) throws {
        guard let canonical = realpath(directory, nil) else { throw Self.failure("Cannot resolve journal directory.") }
        let resolved = String(cString: canonical)
        free(canonical)
        let parent = Darwin.open(resolved, O_RDONLY | O_DIRECTORY | O_NOFOLLOW_ANY | O_CLOEXEC)
        guard parent >= 0 else { throw Self.failure("Cannot open journal directory.") }
        let flags = O_CLOEXEC | O_NOFOLLOW | O_NONBLOCK | (creating ? O_RDWR | O_CREAT | O_EXCL : O_RDONLY)
        let descriptor = openat(parent, "capture.journal.jsonl", flags, S_IRUSR | S_IWUSR)
        guard descriptor >= 0 else {
            let reason = Self.failure("Cannot open capture journal.")
            close(parent)
            throw reason
        }
        do {
            var file = stat(), folder = stat()
            guard fstat(descriptor, &file) == 0, file.st_mode & S_IFMT == S_IFREG,
                file.st_uid == getuid(), file.st_nlink == 1,
                fstat(parent, &folder) == 0, folder.st_mode & S_IFMT == S_IFDIR,
                folder.st_uid == getuid()
            else { throw CaptureFailure("INVALID_JOURNAL", "Journal lease requires an owned regular file.") }
            guard flock(descriptor, LOCK_EX | LOCK_NB) == 0 else {
                if errno == EWOULDBLOCK || errno == EAGAIN {
                    throw CaptureFailure("CAPTURE_BUSY", "Another process owns the capture journal.")
                }
                throw Self.failure("Cannot acquire capture journal lease.")
            }
            var located = stat(), selected = stat()
            guard lstat(resolved, &located) == 0,
                located.st_dev == folder.st_dev, located.st_ino == folder.st_ino,
                fstatat(parent, "capture.journal.jsonl", &selected, AT_SYMLINK_NOFOLLOW) == 0,
                selected.st_dev == file.st_dev, selected.st_ino == file.st_ino
            else { throw CaptureFailure("JOURNAL_CHANGED", "Journal changed while acquiring its lease.") }
            self.directory = resolved
            handles = Mutex(Handles(journal: descriptor, directory: parent))
            journalIdentity = (file.st_dev, file.st_ino)
            directoryIdentity = (folder.st_dev, folder.st_ino)
        } catch {
            close(descriptor)
            close(parent)
            throw error
        }
    }
    deinit { release() }

    /// The lifecycle owner ends authority after all leased work, independently of retained callbacks.
    package func release() {
        handles.withLock { state in
            if state.journal >= 0 { close(state.journal); state.journal = -1 }
            if state.directory >= 0 { close(state.directory); state.directory = -1 }
        }
    }

    package func check() throws {
        try handles.withLock { state in
            guard state.journal >= 0, state.directory >= 0 else {
                throw CaptureFailure("JOURNAL_CLOSED", "Capture journal ownership has ended.")
            }
            let descriptor = state.journal
            let parent = state.directory
            var folder = stat(), entry = stat(), held = stat()
            guard lstat(directory, &folder) == 0,
                (folder.st_dev, folder.st_ino) == directoryIdentity,
                fstatat(parent, "capture.journal.jsonl", &entry, AT_SYMLINK_NOFOLLOW) == 0,
                fstat(descriptor, &held) == 0,
                entry.st_mode & S_IFMT == S_IFREG, held.st_nlink == 1,
                (entry.st_dev, entry.st_ino) == journalIdentity,
                (held.st_dev, held.st_ino) == journalIdentity
            else { throw CaptureFailure("JOURNAL_CHANGED", "Leased journal or directory was replaced.") }
        }
    }
    /// A persisted publication pin must not outlive the raw journal bytes that authorize it.
    package func synchronize() throws {
        try check()
        guard fsync(descriptor) == 0 else { throw Self.failure("Cannot synchronize capture journal.") }
        try check()
    }

    private static func failure(_ message: String) -> CaptureFailure {
        CaptureFailure("JOURNAL_UNAVAILABLE", "\(message) \(String(cString: strerror(errno)))")
    }
}
