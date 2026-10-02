@preconcurrency import AVFoundation
import Foundation
import ScreenRecorderCapture
import ScreenRecorderMedia

private func cameraPublicationFixture(_ name: String, rows: Data) throws
    -> (URL, URL, CaptureJournal)
{
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent("camera-publication-\(name)-\(UUID().uuidString)")
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: false)
    let fixture = URL(fileURLWithPath: "/Users/david/.codex/worktrees/parakeet-model-readiness/screen-recorder/helpers/mac/Tests/ScreenRecorderCaptureTests/fixtures/camera-visible32.mov")
    let raw = directory.appendingPathComponent("camera.raw.mov")
    try FileManager.default.copyItem(at: fixture, to: raw)
    let binding = CameraCaptureBinding(recordingId: "fixture-take", sourceId: "fixture-camera", deviceId: "fixture-device")
    let journal = try CaptureJournal(directory: directory.path,
        header: CaptureJournalHeader(schemaVersion: 1, sessionID: binding.sourceId,
            source: CaptureSource(kind: "camera"), width: 32, height: 16,
            microphone: false, systemAudio: false, cameraBinding: binding))
    try journal.recordOrigin(hostUs: 1_000_000)
    let observations = directory.appendingPathComponent(CameraMedia.mappingFile)
    try rows.write(to: observations)
    try CameraMedia.recordClosed(raw: raw, marker: directory.appendingPathComponent("camera.closed.json"))
    return (directory, observations, journal)
}

private func cameraPublicationRows(count: Int = 3, lastEnd: Int = 1536, firstStart: Int = 0) throws -> Data {
    var rows = Data()
    for ordinal in 0..<count {
        let row: [String: Any] = ["role": "camera", "disposition": "accepted", "cameraFrame": [
            "ordinal": ordinal,
            "start": ["value": ordinal == 0 ? firstStart : ordinal * 512, "timescale": 15360, "epoch": 0],
            "end": ["value": ordinal == count - 1 ? lastEnd : (ordinal + 1) * 512, "timescale": 15360, "epoch": 0],
        ]]
        rows.append(try JSONSerialization.data(withJSONObject: row) + Data([10]))
    }
    return rows
}

func observeCameraReaderCancellation(output: URL) async throws {
    let (directory, observations, journal) = try cameraPublicationFixture("cancel-observation", rows: cameraPublicationRows())
    defer { journal.lease.release(); try? FileManager.default.removeItem(at: directory) }
    let (events, continuation) = AsyncStream<Void>.makeStream()
    var installError: NSError?
    guard CameraReadersObserve({ continuation.yield(()) }, &installError) else { throw installError! }
    let lease = journal.lease
    let task = Task { try await CameraMedia.publish(lease: lease, observationURL: observations) }
    let canceller = Task { () -> Bool in
        for await _ in events { task.cancel(); return true }
        return false
    }
    let result = await task.result
    continuation.finish()
    let delivered = await canceller.value
    var report = CameraReadersFinish() as! [String: Any]
    report["cancelDelivered"] = delivered
    switch result {
    case .success(let receipt):
        report["taskOutcome"] = "completed"
        report["hash"] = receipt.pictureSHA256
        precondition(receipt.pictureSHA256 == "a25957a308051415c014091d3859d675729f6d437d1a5982b07bc76007868094")
    case .failure(let error):
        report["taskOutcome"] = error is CancellationError ? "cancelled" : "failed"
        report["error"] = String(describing: error)
    }
    report["publicFile"] = FileManager.default.fileExists(atPath: directory.appendingPathComponent("video.mov").path)
    report["receipt"] = FileManager.default.fileExists(atPath: directory.appendingPathComponent("camera.publication.json").path)
    try JSONSerialization.data(withJSONObject: report, options: [.sortedKeys, .prettyPrinted]).write(to: output)
    precondition(report["restored"] as? Bool == true && report["active"] as? Int == 0 && report["readingAfterJoin"] as? Int == 0)
    if delivered {
        precondition(report["taskOutcome"] as? String == "cancelled"
            && report["publicFile"] as? Bool == false && report["receipt"] as? Bool == false)
    }
    print("OBSERVED two-reader cancellation: \(report)")
}
