import Foundation
import ScreenRecorderCapture
import ScreenRecorderMedia
import ScreenRecorderWire

func runCanonicalRecoveryTests() async throws {
    let root = RecoveryFixture.directory("canonical-recovery")
    defer { try? FileManager.default.removeItem(at: root) }
    for mode in ["healthy", "cleanup-pending", "zero", "missing-mapping", "absent-role", "conflict"] {
        let folder = try captureMaterializerFixture(in: root, name: mode,
            accepted: mode == "zero" ? 0 : 96000)
        if mode == "missing-mapping" || mode == "absent-role" {
            let path = folder.appendingPathComponent("capture.journal.jsonl")
            let prefix = try String(contentsOf: path, encoding: .utf8)
                .split(separator: "\n").prefix(2).joined(separator: "\n") + "\n"
            try Data(prefix.utf8).write(to: path)
        }
        if mode == "absent-role" { try FileManager.default.removeItem(at: folder.appendingPathComponent("narration.packed.mov")) }
        if mode == "conflict" { try Data("not canonical media".utf8).write(to: folder.appendingPathComponent("narration.mov")) }
        try await RecoveryFixture.writeVariableDurationVideo(to: folder.appendingPathComponent("video.mov"),
            timesUs: [0, 500000, 1500000], endUs: 2500000)
        if mode == "cleanup-pending" {
            do {
                let lease = try CaptureJournalLease(directory: folder.path)
                _ = try await CaptureAudioPublication.publish(lease: lease, role: "narration")
            }
            try Data("unknown owned diagnostic".utf8).write(to: folder.appendingPathComponent(".capture-publication-narration/retained-diagnostic"))
        }
        let result = try await MediaRecovery.recover(directory: folder.path)
        precondition(result.durationUs == 2500000)
        let audio = result.tracks.first { $0.role == "narration" }!
        if mode == "healthy" || mode == "cleanup-pending" {
            precondition(audio.failure == nil && audio.acquisitionVerified && audio.decodeReachedEnd)
            precondition(result.cleanupFailure?.code == (mode == "cleanup-pending" ? "CLEANUP_PENDING" : nil))
            precondition(audio.decodedSamples == nil && audio.representedFrames?.wrappedValue == 96000)
            precondition(audio.intervals == [TimeSpan(startUs: 100001, endUs: 782668), TimeSpan(startUs: 1141668, endUs: 2459001)])
            precondition(!FileManager.default.fileExists(atPath: folder.appendingPathComponent("narration.packed.mov").path))
            let repeated = try await MediaRecovery.recover(directory: folder.path)
            precondition(repeated.tracks.first { $0.role == "narration" }!.intervals == audio.intervals)
            let bytes = try JSONEncoder().encode(result)
            let json = try JSONSerialization.jsonObject(with: bytes) as! [String: Any]
            let tracks = json["tracks"] as! [[String: Any]]
            precondition(tracks.first { $0["role"] as? String == "narration" }!["representedFrames"] as? String == "96000")
        } else {
            precondition(audio.intervals.isEmpty && !audio.acquisitionVerified)
            precondition(audio.failure?.code == (mode == "conflict" ? "PUBLICATION_CONFLICT" : "AUDIO_UNAVAILABLE"))
            if mode != "absent-role" {
                precondition(FileManager.default.fileExists(atPath: folder.appendingPathComponent("narration.packed.mov").path))
            }
        }
        if mode == "conflict" {
            do {
                _ = try await SourceEvidenceExport.write(directory: folder.path, output: root.appendingPathComponent("conflict-export.jsonl").path)
                preconditionFailure("Recovery of video does not authorize corrupt audio admission")
            } catch let failure as CaptureFailure { precondition(failure.code == "INVALID_MEDIA", "Unexpected admission refusal: \(failure.code): \(failure.message)") }
        } else {
            let exported = try await SourceEvidenceExport.write(directory: folder.path,
                output: root.appendingPathComponent("\(mode)-export.jsonl").path)
            precondition(exported.audioIntervals == (["healthy", "cleanup-pending"].contains(mode) ? 2 : 0))
        }
    }
    let retry = try captureMaterializerFixture(in: root, name: "operational-retry", accepted: 96000)
    try FileManager.default.copyItem(at: retry.appendingPathComponent("narration.packed.mov"),
        to: retry.appendingPathComponent("system.packed.mov"))
    let journalURL = retry.appendingPathComponent("capture.journal.jsonl")
    let records = try Data(contentsOf: journalURL).split(separator: 10).map {
        try JSONSerialization.jsonObject(with: Data($0)) as! [String: Any]
    }
    var expanded: [[String: Any]] = []
    for var record in records {
        var data = record["data"] as! [String: Any]
        if record["event"] as? String == "header" { data["systemAudio"] = true }
        record["data"] = data
        expanded.append(record)
        if data["role"] as? String == "narration" {
            data["role"] = "system"
            if data["file"] != nil { data["file"] = "system.packed.mov" }
            record["data"] = data
            expanded.append(record)
        }
    }
    var journalBytes = Data()
    for (index, var record) in expanded.enumerated() {
        record["sequence"] = index + 1
        journalBytes.append(try JSONSerialization.data(withJSONObject: record, options: [.sortedKeys]))
        journalBytes.append(10)
    }
    try journalBytes.write(to: journalURL)
    let blocked = retry.appendingPathComponent(".capture-publication-narration")
    try FileManager.default.createDirectory(at: blocked, withIntermediateDirectories: false)
    try FileManager.default.setAttributes([.posixPermissions: 0o500], ofItemAtPath: blocked.path)
    defer { try? FileManager.default.setAttributes([.posixPermissions: 0o700], ofItemAtPath: blocked.path) }
    do {
        _ = try await MediaRecovery.recover(directory: retry.path)
        preconditionFailure("Operational publication failure must remain retryable")
    } catch {
        precondition(FileManager.default.fileExists(atPath: retry.appendingPathComponent("system.publication.json").path),
            "A failed role must not starve the healthy later role")
        precondition(FileManager.default.fileExists(atPath: retry.appendingPathComponent("narration.packed.mov").path))
    }
    try FileManager.default.setAttributes([.posixPermissions: 0o700], ofItemAtPath: blocked.path)
    let retried = try await MediaRecovery.recover(directory: retry.path)
    for role in ["narration", "system"] {
        let audio = retried.tracks.first { $0.role == role }!
        precondition(audio.acquisitionVerified && audio.representedFrames?.wrappedValue == 96000)
    }
    let unreadableVideo = try captureMaterializerFixture(in: root, name: "unreadable-video", accepted: 96000)
    let videoURL = unreadableVideo.appendingPathComponent("video.mov")
    try await RecoveryFixture.writeVariableDurationVideo(to: videoURL,
        timesUs: [0, 500000, 1500000], endUs: 2500000)
    try FileManager.default.setAttributes([.posixPermissions: 0o000], ofItemAtPath: videoURL.path)
    defer { try? FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: videoURL.path) }
    do {
        let outcome = try await MediaRecovery.recover(directory: unreadableVideo.path)
        print("unreadable video outcome: \(String(data: try JSONEncoder().encode(RecoveryReceipt(outcome)), encoding: .utf8)!)")
        preconditionFailure("Temporary video access failure must remain retryable")
    } catch let failure as CaptureFailure { precondition(CaptureFinalizationError(failure).retryable) }
    try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: videoURL.path)
    let restoredVideo = try await MediaRecovery.recover(directory: unreadableVideo.path)
    precondition(restoredVideo.durationUs == 2500000)
    try Data("corrupt video container".utf8).write(to: videoURL)
    let corruptVideo = try await MediaRecovery.recover(directory: unreadableVideo.path)
    precondition(corruptVideo.durationUs == 0 && corruptVideo.tracks.first { $0.role == "video" }!.failure?.code == "DECODE_FAILED")
    precondition(corruptVideo.tracks.first { $0.role == "narration" }!.acquisitionVerified)
    let inaccessible = try captureMaterializerFixture(in: root, name: "inaccessible-payload", accepted: 96000)
    let inaccessiblePayload = inaccessible.appendingPathComponent("narration.packed.mov")
    try FileManager.default.setAttributes([.posixPermissions: 0o000], ofItemAtPath: inaccessiblePayload.path)
    defer { try? FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: inaccessiblePayload.path) }
    do {
        _ = try await MediaRecovery.recover(directory: inaccessible.path)
        preconditionFailure("Temporary payload access failure must remain retryable")
    } catch let failure as CaptureFailure { precondition(CaptureFinalizationError(failure).retryable) }
    try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: inaccessiblePayload.path)
    let accessible = try await MediaRecovery.recover(directory: inaccessible.path)
    precondition(accessible.tracks.first { $0.role == "narration" }!.representedFrames?.wrappedValue == 96000)
    let unreadable = try captureMaterializerFixture(in: root, name: "unreadable-journal", accepted: 96000)
    let unreadableJournal = unreadable.appendingPathComponent("capture.journal.jsonl")
    try FileManager.default.setAttributes([.posixPermissions: 0o000], ofItemAtPath: unreadableJournal.path)
    defer { try? FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: unreadableJournal.path) }
    do {
        _ = try await MediaRecovery.recover(directory: unreadable.path)
        preconditionFailure("Unreadable journal is not authority to choose legacy recovery")
    } catch let failure as CaptureFailure { precondition(failure.code == "JOURNAL_UNAVAILABLE") }
    try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: unreadableJournal.path)
    let repaired = try await MediaRecovery.recover(directory: unreadable.path)
    precondition(repaired.tracks.first { $0.role == "narration" }!.representedFrames?.wrappedValue == 96000)
    let busy = try captureMaterializerFixture(in: root, name: "busy", accepted: 96000)
    let lease = try CaptureJournalLease(directory: busy.path)
    do { _ = try await MediaRecovery.recover(directory: busy.path); preconditionFailure("Active ownership must refuse recovery") }
    catch let failure as CaptureFailure { precondition(failure.code == "CAPTURE_BUSY") }
    try lease.check()
    let canceled = Task {
        withUnsafeCurrentTask { $0?.cancel() }
        return try await MediaRecovery.recover(directory: busy.path)
    }
    do { _ = try await canceled.value; preconditionFailure("Canceled recovery cannot report absence") }
    catch is CancellationError {}
    print("PASS canonical recovery preserves exact support, distinguishes unavailable/conflicting roles, retains video, and propagates lease/cancellation")
}
