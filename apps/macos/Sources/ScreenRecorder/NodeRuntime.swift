import Foundation

/// Node 24 is an explicit prerequisite of this personal build, so the app resolves an
/// absolute interpreter itself. A Finder-launched bundle inherits launchd's minimal
/// PATH rather than the developer shell's, which is why the build records the
/// interpreter it was built against and PATH is only ever the last resort.
enum NodeRuntime {
    static let requiredMajorVersion = "v24."

    static func resolve(recorded: String, environment: [String: String]) -> Result<
        String, ServiceFailure
    > {
        let attempted = candidates(recorded: recorded, environment: environment)
        for candidate in attempted where FileManager.default.isExecutableFile(atPath: candidate) {
            if let version = version(of: candidate), version.hasPrefix(requiredMajorVersion) {
                return .success(candidate)
            }
        }
        return .failure(
            ServiceFailure(
                code: "NODE_UNAVAILABLE",
                message:
                    "No Node \(requiredMajorVersion)x interpreter found. Set SCREENREC_NODE to an absolute path. Tried: "
                    + attempted.joined(separator: ", ")))
    }

    private static func candidates(recorded: String, environment: [String: String]) -> [String] {
        // An explicit override is the only candidate: silently falling back would hide
        // the very misconfiguration the override exists to correct.
        if let override = environment["SCREENREC_NODE"], !override.isEmpty { return [override] }
        var paths = [recorded, "/opt/homebrew/bin/node", "/usr/local/bin/node", "/usr/bin/node"]
        for directory in (environment["PATH"] ?? "").split(separator: ":") where !directory.isEmpty
        {
            paths.append("\(directory)/node")
        }
        var seen = Set<String>()
        return paths.filter { seen.insert($0).inserted }
    }

    private static func version(of path: String) -> String? {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: path)
        process.arguments = ["--version"]
        let output = Pipe()
        process.standardOutput = output
        process.standardError = FileHandle.nullDevice
        guard (try? process.run()) != nil else { return nil }
        // A candidate that never answers must not stall launch behind a blocking read.
        let watchdog = DispatchWorkItem { process.terminate() }
        DispatchQueue.global().asyncAfter(deadline: .now() + 5, execute: watchdog)
        let data = try? output.fileHandleForReading.readToEnd()
        process.waitUntilExit()
        watchdog.cancel()
        guard process.terminationStatus == 0, let data else { return nil }
        return String(decoding: data, as: UTF8.self).trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
