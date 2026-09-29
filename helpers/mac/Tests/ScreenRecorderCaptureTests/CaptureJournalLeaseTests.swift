import Darwin
import Foundation
import ScreenRecorderCapture

func runCaptureJournalLeaseChild(directory: String) {
    do {
        let lease = try CaptureJournalLease(directory: directory)
        try lease.check()
        exit(0)
    } catch let failure as CaptureFailure {
        exit(failure.code == "CAPTURE_BUSY" ? 75 : 76)
    } catch { exit(77) }
}

func runCaptureJournalLeaseTests() throws {
    func require(_ value: Bool, _ message: String = "Journal lease assertion failed") throws {
        if !value { throw NSError(domain: "JournalLeaseTest", code: 1, userInfo: [NSLocalizedDescriptionKey: message]) }
    }
    func journal(_ directory: URL) throws -> CaptureJournal {
        try CaptureJournal(directory: directory.path, header: CaptureJournalHeader(
            schemaVersion: 2, sessionID: "lease", source: CaptureSource(kind: "fixture"),
            width: 160, height: 96, microphone: true, systemAudio: false))
    }
    func contend(_ directory: URL) throws -> Int32 {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: CommandLine.arguments[0])
        process.arguments = [directory.path]
        var environment = ProcessInfo.processInfo.environment
        environment["SCREENREC_JOURNAL_LEASE_CHILD"] = "1"
        process.environment = environment
        process.standardOutput = FileHandle.nullDevice
        process.standardError = FileHandle.nullDevice
        try process.run()
        process.waitUntilExit()
        try require(process.terminationReason == .exit)
        return process.terminationStatus
    }
    func sleeper() throws -> pid_t {
        var child: pid_t = 0
        var arguments = [strdup("/bin/sleep"), strdup("20"), nil]
        defer { for argument in arguments { free(argument) } }
        var environment: [UnsafeMutablePointer<CChar>?] = [nil]
        let result = arguments.withUnsafeMutableBufferPointer { arguments in
            environment.withUnsafeMutableBufferPointer { environment in
                posix_spawn(&child, "/bin/sleep", nil, nil, arguments.baseAddress!, environment.baseAddress!)
            }
        }
        try require(result == 0)
        return child
    }
    func stop(_ child: pid_t) {
        kill(child, SIGTERM)
        var status: Int32 = 0
        while waitpid(child, &status, 0) < 0 && errno == EINTR {}
    }
    let protected = RecoveryFixture.directory("journal-lease")
    defer { try? FileManager.default.removeItem(at: protected) }
    var writer: CaptureJournal? = try journal(protected)
    try require(try contend(protected) == 75, "A competing process cannot own the writer's journal")
    let descriptor = writer!.lease.descriptor
    try require(fcntl(descriptor, F_GETFD) & FD_CLOEXEC != 0)
    let child = try sleeper()
    defer { stop(child) }
    writer = nil
    try require(kill(child, 0) == 0)
    try require(try contend(protected) == 0, "Exec must not keep the released writer lease alive")

    let inherited = RecoveryFixture.directory("journal-lease-inherited-negative")
    defer { try? FileManager.default.removeItem(at: inherited) }
    var negative: CaptureJournal? = try journal(inherited)
    let inheritedFD = negative!.lease.descriptor
    try require(fcntl(inheritedFD, F_SETFD, 0) == 0)
    var holder: pid_t? = try sleeper()
    defer { if let holder { stop(holder) } }
    try require(fcntl(inheritedFD, F_SETFD, FD_CLOEXEC) == 0)
    negative = nil
    try require(try contend(inherited) == 75, "Negative control proves inherited FD retains the lock")
    stop(holder!)
    holder = nil
    try require(try contend(inherited) == 0)

    let replaced = RecoveryFixture.directory("journal-lease-replaced")
    defer { try? FileManager.default.removeItem(at: replaced) }
    let original = try journal(replaced)
    let file = replaced.appendingPathComponent("capture.journal.jsonl")
    try FileManager.default.moveItem(at: file, to: replaced.appendingPathComponent("original.jsonl"))
    try Data("replacement".utf8).write(to: file)
    do { try original.lease.check(); try require(false, "A lease cannot authorize a replacement inode") }
    catch let failure as CaptureFailure { try require(failure.code == "JOURNAL_CHANGED") }
    try require(try contend(replaced) == 0, "A new inode can be locked independently; identity check is necessary")

    let missing = RecoveryFixture.directory("journal-lease-missing")
    defer { try? FileManager.default.removeItem(at: missing) }
    do { _ = try CaptureJournalLease(directory: missing.path); try require(false, "Missing journal must refuse") }
    catch let failure as CaptureFailure { try require(failure.code == "JOURNAL_UNAVAILABLE") }
    try require(!FileManager.default.fileExists(atPath: missing.appendingPathComponent("capture.journal.jsonl").path))
    print("PASS journal inode lease: competing process, exec inheritance and negative control, replaced inode, missing journal")
}
