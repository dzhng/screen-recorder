import Darwin
import Foundation

/// The release bundles Node 24; personal builds may record an installed interpreter.
/// A Finder launch has a minimal PATH, so the manifest's interpreter is preferred
/// and PATH is only the last resort.
///
/// Resolution runs real child processes, so it never runs on the main thread and never
/// waits on one unbounded read or exit. A candidate that answers nothing, or answers
/// endlessly, is abandoned within its own budget and inside the shared startup deadline.
enum NodeRuntime {
    static let requiredMajorVersion = "v24."
    /// One unresponsive candidate must not consume the whole startup deadline, and no
    /// candidate may outlive it; both bounds apply to every probe.
    static let candidateBudget: TimeInterval = 2
    /// A working interpreter answers `--version` in one short line. Anything past this
    /// is the wrong executable, so the probe drains and discards rather than buffers it.
    static let maxVersionBytes = 1024
    /// How long a probe waits for the pipe to reach EOF after its process has exited.
    static let drainBudget: TimeInterval = 0.25
    /// How long an abandoned candidate is given to honour a signal before the next one.
    static let escalationBudget: TimeInterval = 0.25

    static func resolve(
        recorded: String, environment: [String: String], deadline: Date,
        isCancelled: () -> Bool = { false }
    ) -> Result<
        String, ServiceFailure
    > {
        let attempted = candidates(recorded: recorded, environment: environment)
        for candidate in attempted where FileManager.default.isExecutableFile(atPath: candidate) {
            if isCancelled() { break }
            let budget = min(candidateBudget, deadline.timeIntervalSinceNow)
            if budget <= 0 { break }
            if let version = version(of: candidate, budget: budget),
                version.hasPrefix(requiredMajorVersion)
            {
                return .success(candidate)
            }
        }
        return .failure(
            ServiceFailure(
                code: "NODE_UNAVAILABLE",
                message:
                    "No Node \(requiredMajorVersion)x interpreter answered within the startup budget. Set YAP_NODE to an absolute path. Tried: "
                    + attempted.joined(separator: ", ")))
    }

    private static func candidates(recorded: String, environment: [String: String]) -> [String] {
        // An explicit override is the only candidate: silently falling back would hide
        // the very misconfiguration the override exists to correct.
        if let override = environment["YAP_NODE"], !override.isEmpty { return [override] }
        var paths = [recorded, "/opt/homebrew/bin/node", "/usr/local/bin/node", "/usr/bin/node"]
        for directory in (environment["PATH"] ?? "").split(separator: ":") where !directory.isEmpty
        {
            paths.append("\(directory)/node")
        }
        var seen = Set<String>()
        return paths.filter { seen.insert($0).inserted }
    }

    private static func version(of path: String, budget: TimeInterval) -> String? {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: path)
        process.arguments = ["--version"]
        let output = Pipe()
        process.standardOutput = output
        process.standardError = FileHandle.nullDevice
        process.standardInput = FileHandle.nullDevice
        let exited = DispatchSemaphore(value: 0)
        process.terminationHandler = { _ in exited.signal() }
        let collected = BoundedOutput(limit: maxVersionBytes)
        let reader = output.fileHandleForReading
        reader.readabilityHandler = { handle in
            let data = handle.availableData
            if data.isEmpty {
                handle.readabilityHandler = nil
                collected.end()
                return
            }
            collected.append(data)
        }
        guard (try? process.run()) != nil else {
            reader.readabilityHandler = nil
            return nil
        }
        defer { reader.readabilityHandler = nil }
        guard exited.wait(timeout: .now() + budget) == .success else {
            abandon(process, exited: exited)
            return nil
        }
        // The process is gone but its bytes may still be in the pipe; a grandchild could
        // also be holding the write end, so even this last wait is bounded.
        collected.settle(within: drainBudget)
        guard process.terminationStatus == 0 else { return nil }
        return collected.firstLine
    }

    /// Ends exactly the process this probe launched, never a PID it merely remembers:
    /// `terminate()` and the escalation both act on a child Foundation still owns.
    private static func abandon(_ process: Process, exited: DispatchSemaphore) {
        guard process.isRunning else { return }
        process.terminate()
        if exited.wait(timeout: .now() + escalationBudget) == .success { return }
        if process.isRunning { kill(process.processIdentifier, SIGKILL) }
        _ = exited.wait(timeout: .now() + escalationBudget)
    }
}

/// Keeps a bounded prefix of one child's output. Bytes past the cap are read and thrown
/// away so a noisy candidate can neither grow this process's memory nor wedge itself on
/// a full pipe while the probe is deciding to kill it.
private final class BoundedOutput: @unchecked Sendable {
    private let limit: Int
    private let lock = NSLock()
    private let ended = DispatchSemaphore(value: 0)
    private var bytes = Data()

    init(limit: Int) { self.limit = limit }

    func append(_ data: Data) {
        lock.lock()
        defer { lock.unlock() }
        guard bytes.count < limit else { return }
        bytes.append(data.prefix(limit - bytes.count))
    }

    func end() { ended.signal() }

    func settle(within seconds: TimeInterval) {
        _ = ended.wait(timeout: .now() + max(0, seconds))
    }

    var firstLine: String? {
        lock.lock()
        defer { lock.unlock() }
        return String(decoding: bytes, as: UTF8.self)
            .split(separator: "\n", omittingEmptySubsequences: false).first
            .map { $0.trimmingCharacters(in: .whitespaces) }
    }
}
