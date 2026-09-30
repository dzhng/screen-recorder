import Foundation
import ScreenRecorderCapture

@MainActor
func runProbeCameraReplayTests(source: String, output: String) async throws {
    let original = URL(fileURLWithPath: source)
    let root = URL(fileURLWithPath: output)
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: false)
    func fixture(_ name: String, fresh: Bool = false) throws -> URL {
        let result = root.appendingPathComponent(name)
        try FileManager.default.createDirectory(at: result, withIntermediateDirectories: false)
        try FileManager.default.copyItem(at: original.appendingPathComponent("camera"), to: result.appendingPathComponent("camera"))
        try FileManager.default.copyItem(at: original.appendingPathComponent("timestamps.jsonl"), to: result.appendingPathComponent("timestamps.jsonl"))
        if fresh {
            for file in ["video.mov", "camera.publication.json"] {
                try FileManager.default.removeItem(at: result.appendingPathComponent("camera/" + file))
            }
        }
        return result
    }
    func publish(_ root: URL) async throws -> ProbeCameraMedia.Receipt {
        let lease = try CaptureJournalLease(directory: root.appendingPathComponent("camera").path)
        defer { lease.release() }
        return try await ProbeCameraMedia.publish(lease: lease, observationURL: root.appendingPathComponent("timestamps.jsonl"))
    }
    func record(_ receipt: ProbeCameraMedia.Receipt, at root: URL) throws {
        try JSONEncoder().encode(receipt).write(to: root.appendingPathComponent("replay-result.json"))
    }
    func refused(_ root: URL) async throws {
        do { _ = try await publish(root); preconditionFailure("Changed camera input was accepted") }
        catch {
            try Data(String(describing: error).utf8).write(to: root.appendingPathComponent("refusal.txt"))
        }
    }
    let replay = try fixture("replay")
    let first = try await publish(replay)
    let second = try await publish(replay)
    precondition(first.canonical == second.canonical && first.pictureSHA256 == second.pictureSHA256)
    let canonical = replay.appendingPathComponent("camera/video.mov")
    try FileManager.default.removeItem(at: canonical)
    let linked = try await publish(replay)
    precondition(linked.canonical == first.canonical)
    let actualIdentity = try CaptureMediaIdentity.read(canonical)
    precondition(actualIdentity == first.canonical)
    try record(linked, at: replay)

    for policy in [nil, "nominal-gaps"] as [String?] {
        let historical = try fixture(policy ?? "missing-presentation")
        let receiptURL = historical.appendingPathComponent("camera/camera.publication.json")
        var old = try JSONSerialization.jsonObject(with: Data(contentsOf: receiptURL)) as! [String: Any]
        old["presentation"] = policy
        try JSONSerialization.data(withJSONObject: old).write(to: receiptURL)
        let members = ["camera/video.mov", "camera/camera.raw.mov", "timestamps.jsonl", "camera/camera.publication.json"]
        let identities = try members.map { try CaptureMediaIdentity.read(historical.appendingPathComponent($0)) }
        try await refused(historical)
        let after = try members.map { try CaptureMediaIdentity.read(historical.appendingPathComponent($0)) }
        precondition(after == identities, "Unsupported presentation receipt changed retained bytes")
    }

    let conflict = try fixture("conflict")
    let conflictingPath = conflict.appendingPathComponent("camera/video.mov")
    try Data("other output".utf8).write(to: conflictingPath, options: .atomic)
    try await refused(conflict)
    let conflictBytes = try Data(contentsOf: conflictingPath)
    precondition(conflictBytes == Data("other output".utf8))
    for member in ["timestamps.jsonl", "camera/camera.raw.mov", "camera/camera.closed.json"] {
        let changed = try fixture("changed-" + URL(fileURLWithPath: member).lastPathComponent)
        let path = changed.appendingPathComponent(member)
        let handle = try FileHandle(forWritingTo: path)
        try handle.seekToEnd(); try handle.write(contentsOf: Data([10])); try handle.close()
        try await refused(changed)
    }
    let canceled = try fixture("canceled", fresh: true)
    let task = Task { try Task.checkCancellation(); return try await publish(canceled) }
    task.cancel()
    do { _ = try await task.value; preconditionFailure("Canceled publication succeeded") }
    catch is CancellationError {}
    precondition(!FileManager.default.fileExists(atPath: canceled.appendingPathComponent("camera/video.mov").path))

    let torn = try fixture("torn", fresh: true)
    let tail = try FileHandle(forWritingTo: torn.appendingPathComponent("timestamps.jsonl"))
    try tail.seekToEnd(); try tail.write(contentsOf: Data("{\"role\":".utf8)); try tail.close()
    let partial = try await publish(torn)
    precondition(partial.diagnostics == ["tornMappingTail"] && partial.pictureSHA256 == first.pictureSHA256)
    try record(partial, at: torn)

    let missing = try fixture("unmapped-tail", fresh: true)
    let observation = missing.appendingPathComponent("timestamps.jsonl")
    var lines = try String(contentsOf: observation, encoding: .utf8).split(separator: "\n").map(String.init)
    let accepted = try lines.indices.filter {
        let row = try JSONSerialization.jsonObject(with: Data(lines[$0].utf8)) as! [String: Any]
        return row["role"] as? String == "camera" && row["disposition"] as? String == "accepted"
    }
    lines.remove(at: accepted.last!)
    try Data((lines.joined(separator: "\n") + "\n").utf8).write(to: observation)
    let prefix = try await publish(missing)
    precondition(prefix.representedFrames == first.representedFrames - 1 && prefix.diagnostics == ["unmappedRawTail"])
    try record(prefix, at: missing)

    let interior = try fixture("missing-interior", fresh: true)
    let interiorURL = interior.appendingPathComponent("timestamps.jsonl")
    var interiorLines = try String(contentsOf: interiorURL, encoding: .utf8).split(separator: "\n").map(String.init)
    interiorLines.remove(at: accepted[0])
    try Data((interiorLines.joined(separator: "\n") + "\n").utf8).write(to: interiorURL)
    try await refused(interior)
    precondition(!FileManager.default.fileExists(atPath: interior.appendingPathComponent("camera/video.mov").path))

    let crash = try fixture("unsealed", fresh: true)
    try FileManager.default.removeItem(at: crash.appendingPathComponent("camera/camera.closed.json"))
    let unsealed = try await publish(crash)
    precondition(unsealed.diagnostics == ["unsealedRaw"] && unsealed.pictureSHA256 == first.pictureSHA256)
    try record(unsealed, at: crash)
    let truncated = try fixture("truncated", fresh: true)
    try FileManager.default.removeItem(at: truncated.appendingPathComponent("camera/camera.closed.json"))
    let raw = truncated.appendingPathComponent("camera/camera.raw.mov")
    let bytes = try Data(contentsOf: raw)
    try bytes.prefix(bytes.count / 2).write(to: raw)
    try await refused(truncated)
    precondition(!FileManager.default.fileExists(atPath: truncated.appendingPathComponent("camera/video.mov").path))
    let unchangedRaw = try CaptureMediaIdentity.read(original.appendingPathComponent("camera/camera.raw.mov"))
    precondition(unchangedRaw == first.raw)
    print("PASS camera content-identity replay, receipt/link resume, conflict/input refusal, cancellation, torn/unmapped prefix and unsealed/truncated raw")
}
