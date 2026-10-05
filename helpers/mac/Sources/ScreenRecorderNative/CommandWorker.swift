import Darwin
import Foundation

/// Private execution mode; the service has already resolved the packaged tool.
/// The owning process group is created by the service, so cancellation and an
/// unexpected wrapper exit can retire every inherited descendant without PID discovery.
enum CommandWorker {
    static func run(_ arguments: [String]) -> Never {
        guard arguments.count >= 3, arguments[0] == "--run-cli",
              let completion = Int32(arguments[1]), completion >= 3,
              arguments[2].hasPrefix("/"), getpgrp() == getpid()
        else { exit(64) }
        guard fcntl(completion, F_SETFD, FD_CLOEXEC) == 0 else { exit(64) }
        let ownedGroup = getpid()
        let parentExit = ParentLifetime.endWorkWhenParentExits {
            // The service no longer exists to retire this group. SIGKILL includes
            // this wrapper, closing its pipes along with the command's descendants.
            kill(-ownedGroup, SIGKILL)
        }
        return withExtendedLifetime(parentExit) { () -> Never in
            let strings = arguments.dropFirst(2).map { strdup($0)! }
            defer { strings.forEach { free($0) } }
            var argv: [UnsafeMutablePointer<CChar>?] = strings.map { $0 } + [nil]
            var child: pid_t = 0
            let spawned = argv.withUnsafeMutableBufferPointer { buffer in
                posix_spawn(&child, strings[0], nil, nil, buffer.baseAddress!, environ)
            }
            guard spawned == 0 else {
                FileHandle.standardError.write(Data("Cannot spawn owned CLI: \(spawned)\n".utf8))
                exit(69)
            }
            // No descriptor file actions: admitted descriptors and the standard
            // streams survive verbatim; the CLI inherits this worker's process group.
            var status: Int32 = 0
            while waitpid(child, &status, 0) < 0 {
                if errno != EINTR { exit(70) }
            }
            let signal = status & 0x7f
            let code = signal == 0 ? (status >> 8) & 0xff : 128 + signal
            let completed = FileHandle(fileDescriptor: completion, closeOnDealloc: false)
            completed.write(Data("\(code)\n".utf8))
            // Completion is separate from lifetime. Keep watching the parent even
            // if the command left descendants; only the service retires this group.
            while true { pause() }
        }
    }
}
