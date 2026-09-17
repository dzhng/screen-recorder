import Darwin
import Foundation

/// All mutation is relative to the caller's retained parent, never its locator.
enum PackageWorkspace {
    static func execute(_ operation: String, _ params: [String: Any]) throws -> [String: Any] {
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
        try ManagedFiles.removeContents(child)
        var entry = stat()
        guard fstatat(3, name, &entry, AT_SYMLINK_NOFOLLOW) == 0,
            UInt64(truncatingIfNeeded: entry.st_dev) == expected.dev, entry.st_ino == expected.ino,
            entry.st_mode & S_IFMT == S_IFDIR
        else { throw failure("Workspace entry ownership lost") }
        guard unlinkat(3, name, AT_REMOVEDIR) == 0 else { throw failure("Remove workspace") }
        return ["removed": true]
    }

    private static func failure(_ action: String) -> StorageFailure {
        StorageFailure("INVALID_STORAGE", "\(action): \(String(cString: strerror(errno)))")
    }
}
