import Darwin
import Foundation
import YapMedia

/// Private execution mode; the service has already resolved the packaged tool.
/// The owning process group is created by the service, so cancellation and an
/// unexpected wrapper exit can retire every inherited descendant without PID discovery.
enum CommandWorker {
    static func run(_ arguments: [String]) -> Never {
        guard arguments.count >= 5, arguments[0] == "--run-cli",
              let completion = Int32(arguments[1]), completion >= 3,
              arguments[4].hasPrefix("/"), getpgrp() == getpid()
        else { exit(64) }
        guard fcntl(completion, F_SETFD, FD_CLOEXEC) == 0 else { exit(64) }
        let slots = arguments[2] == "-" ? [] : arguments[2].split(separator: ",", omittingEmptySubsequences: false)
        let rewind = slots.compactMap { Int32($0) }
        guard rewind.count == slots.count, Set(rewind).count == rewind.count else { exit(64) }
        for descriptor in rewind {
            var info = stat()
            let flags = fcntl(descriptor, F_GETFL)
            guard descriptor >= 3, descriptor < completion,
                  flags >= 0, flags & O_ACCMODE == O_RDONLY,
                  fstat(descriptor, &info) == 0, info.st_mode & S_IFMT == S_IFREG,
                  lseek(descriptor, 0, SEEK_SET) == 0 else { exit(64) }
        }
        var allocated: FileHandle?
        var identity: [String: String]?
        if arguments[3] != "-" {
            do {
                guard let data = arguments[3].data(using: .utf8),
                      let request = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                      Set(request.keys) == ["directoryDescriptor", "descriptor", "name"],
                      let directory = request["directoryDescriptor"] as? Int32,
                      let output = request["descriptor"] as? Int32,
                      let name = request["name"] as? String,
                      directory >= 3, directory < completion, output >= 3, output < completion,
                      directory != output, !rewind.contains(output)
                else { exit(64) }
                var placeholder = stat(), null = stat()
                guard fstat(output, &placeholder) == 0, stat("/dev/null", &null) == 0,
                      placeholder.st_mode & S_IFMT == S_IFCHR,
                      placeholder.st_rdev == null.st_rdev
                else { exit(64) }
                let file = try ExclusiveFile.create(in: directory, named: name,
                    access: O_RDWR, permissions: 0o600)
                var info = stat()
                guard fstat(file.fileDescriptor, &info) == 0,
                      dup2(file.fileDescriptor, output) == output else { exit(64) }
                allocated = file
                identity = ["device": String(info.st_dev), "inode": String(info.st_ino)]
            } catch { exit(64) }
        }
        let ownedGroup = getpid()
        let parentExit = ParentLifetime.endWorkWhenParentExits {
            // The service no longer exists to retire this group. SIGKILL includes
            // this wrapper, closing its pipes along with the command's descendants.
            kill(-ownedGroup, SIGKILL)
        }
        return withExtendedLifetime((parentExit, allocated)) { () -> Never in
            let strings = arguments.dropFirst(4).map { strdup($0)! }
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
            if let identity {
                let response: [String: Any] = ["exitCode": code, "output": identity]
                guard let data = try? JSONSerialization.data(withJSONObject: response) else { exit(70) }
                completed.write(data + Data([10]))
            } else {
                completed.write(Data("\(code)\n".utf8))
            }
            // Completion is separate from lifetime. Keep watching the parent even
            // if the command left descendants; only the service retires this group.
            while true { pause() }
        }
    }
}
