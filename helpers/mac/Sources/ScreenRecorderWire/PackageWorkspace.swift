import Darwin
import Foundation

/// All mutation is relative to the caller's retained parent, never its locator.
enum PackageWorkspace {
    static func execute(_ operation: String, _ params: [String: Any]) throws -> [String: Any] {
        if operation == "packageWorkspace.recover"
            || operation == "packageWorkspace.recoverUnconfirmed"
        {
            let selected = operation == "packageWorkspace.recoverUnconfirmed"
            let name = params["name"] as? String
            guard Set(params.keys) == (selected ? ["parent", "name"] : ["parent"]),
                !selected
                    || (name.map { UUID(uuidString: $0) != nil && $0.utf8.count == 36 } ?? false)
            else {
                throw StorageFailure(
                    "INVALID_REQUEST", "Invalid recovery request.", retryable: false)
            }
            try ManagedFiles.Identity(params["parent"]).check(3)
            try ManagedFiles.lockPrivateDirectory(3, busyCode: "RECOVERY_BUSY")
            return try recover(name)
        }
        let creating = operation == "packageWorkspace.create"
        guard
            ["packageWorkspace.create", "packageWorkspace.admit", "packageWorkspace.remove"]
                .contains(operation),
            Set(params.keys) == (creating ? ["parent", "name"] : ["parent", "name", "identity"]),
            let name = params["name"] as? String, UUID(uuidString: name) != nil,
            name.utf8.count == 36
        else {
            throw StorageFailure(
                "INVALID_REQUEST", "Invalid package workspace request.", retryable: false)
        }
        try ManagedFiles.Identity(params["parent"]).check(3)
        try ManagedFiles.lockPrivateDirectory(3)
        if creating {
            guard mkdirat(3, name, 0o700) == 0 else { throw failure("Create workspace") }
            // A created entry is identified before any path-based admission is attempted.
            var info = stat()
            guard fstatat(3, name, &info, AT_SYMLINK_NOFOLLOW) == 0,
                info.st_mode & S_IFMT == S_IFDIR
            else { throw failure("Inspect created workspace") }
            return [
                "name": name,
                "identity": [
                    "dev": String(UInt64(truncatingIfNeeded: info.st_dev)),
                    "ino": String(info.st_ino),
                ],
            ]
        }
        let expected = try ManagedFiles.Identity(params["identity"])
        let child = openat(3, name, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC)
        // The exclusively owned parent never relocates child entries. Absence therefore also
        // covers a completed removal whose worker reply was lost; existing replacements still fail.
        if child < 0 && errno == ENOENT && operation == "packageWorkspace.remove" {
            return ["removed": true]
        }
        guard child >= 0 else { throw failure("Open owned workspace; ownership may be lost") }
        defer { close(child) }
        try expected.check(child)
        if operation == "packageWorkspace.admit" {
            try expected.check(4)
            try ManagedFiles.lockPrivateDirectory(4)
            return ["admitted": true]
        }
        // Independent open-file description: surviving inherited workers still hold the old lock.
        try ManagedFiles.lockPrivateDirectory(child)
        try removeChild(name, child, expected)
        return ["removed": true]
    }

    private static func checkEntry(_ name: String, _ expected: ManagedFiles.Identity) throws {
        var entry = stat()
        guard fstatat(3, name, &entry, AT_SYMLINK_NOFOLLOW) == 0,
            UInt64(truncatingIfNeeded: entry.st_dev) == expected.dev, entry.st_ino == expected.ino,
            entry.st_mode & S_IFMT == S_IFDIR
        else { throw failure("Workspace entry ownership lost") }
    }

    private static func removeChild(_ name: String, _ fd: Int32, _ expected: ManagedFiles.Identity)
        throws
    {
        try checkEntry(name, expected)
        try ManagedFiles.removeContents(fd)
        try checkEntry(name, expected)
        guard unlinkat(3, name, AT_REMOVEDIR) == 0 else { throw failure("Remove workspace") }
    }

    private static func namesInDirectory(_ fd: Int32, maximum: Int) throws -> [String] {
        let scan = openat(fd, ".", O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC)
        guard scan >= 0 else { throw failure("Open workspace root") }
        guard let stream = fdopendir(scan) else {
            close(scan)
            throw failure("Enumerate workspace root")
        }
        defer { closedir(stream) }
        var names: [String] = []
        while true {
            errno = 0
            guard let entry = readdir(stream) else {
                if errno != 0 { throw failure("Read workspace root") }
                break
            }
            let capacity = MemoryLayout.size(ofValue: entry.pointee.d_name)
            let name = withUnsafePointer(to: &entry.pointee.d_name) { pointer in
                pointer.withMemoryRebound(to: CChar.self, capacity: capacity) {
                    String(cString: $0)
                }
            }
            if name == "." || name == ".." { continue }
            guard UUID(uuidString: name) != nil, name.utf8.count == 36, names.count < maximum else {
                throw StorageFailure(
                    "INVALID_STORAGE", "Workspace root contains unexpected or too many entries.",
                    retryable: false)
            }
            names.append(name)
        }
        return names
    }

    private static func recover(_ unconfirmed: String?) throws -> [String: Any] {
        let names = try unconfirmed.map { [$0] } ?? namesInDirectory(3, maximum: 4)
        var children: [(name: String, fd: Int32, identity: ManagedFiles.Identity)] = []
        defer { for child in children { close(child.fd) } }
        // Keep every independently acquired lock until the entire pass has completed.
        for name in names {
            let fd = openat(3, name, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC)
            if fd < 0 && errno == ENOENT && unconfirmed != nil { continue }
            guard fd >= 0 else { throw failure("Open orphan workspace") }
            do {
                var info = stat()
                guard fstat(fd, &info) == 0 else { throw failure("Inspect orphan workspace") }
                let identity = try ManagedFiles.Identity([
                    "dev": String(UInt64(truncatingIfNeeded: info.st_dev)),
                    "ino": String(info.st_ino),
                ])
                try checkEntry(name, identity)
                try ManagedFiles.lockPrivateDirectory(fd, busyCode: "RECOVERY_BUSY")
                // No payload writer may run before a creation receipt: unknown identity admits only empty children.
                if unconfirmed != nil { _ = try namesInDirectory(fd, maximum: 0) }
                children.append((name, fd, identity))
            } catch {
                close(fd)
                throw error
            }
        }
        for child in children { try checkEntry(child.name, child.identity) }
        for child in children { try removeChild(child.name, child.fd, child.identity) }
        return ["recovered": children.count]
    }

    private static func failure(_ action: String) -> StorageFailure {
        StorageFailure("INVALID_STORAGE", "\(action): \(String(cString: strerror(errno)))")
    }
}
