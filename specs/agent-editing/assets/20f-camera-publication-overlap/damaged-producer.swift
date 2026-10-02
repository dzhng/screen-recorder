@preconcurrency import AVFoundation
import Foundation
import ScreenRecorderCapture
import ScreenRecorderMedia

private func cameraPublicationFixture(_ name: String, rows: Data) throws
    -> (URL, URL, CaptureJournal)
{
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent("camera-publication-\(name)-\(UUID().uuidString)")
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: false)
    let fixture = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("fixtures/camera-visible32.mov")
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

func runCameraPublicationClippedSupportTest() async throws {
    let (directory, observations, journal) = try cameraPublicationFixture("clipped", rows: cameraPublicationRows(lastEnd: 1401))
    defer { journal.lease.release(); try? FileManager.default.removeItem(at: directory) }
    let receipt = try await CameraMedia.publish(lease: journal.lease, observationURL: observations)
    precondition(receipt.representedFrames == 3 && receipt.diagnostics.isEmpty)
    precondition(receipt.support == ExactRange(startUs: ExactTime(0), endUs: ExactTime(1_459_375, 16)))
    precondition(receipt.pictureSHA256 == "a25957a308051415c014091d3859d675729f6d437d1a5982b07bc76007868094")
    precondition(receipt.firstUs == 0 && receipt.endUs == 91211 && receipt.pictureTimeScale == 15360)
    precondition(receipt.binding?.sourceId == "fixture-camera" && receipt.originHostUs == 1_000_000)
    let verified = try await CameraMedia.readPublished(lease: journal.lease, canonical: directory.appendingPathComponent("video.mov"))
    precondition(verified.identity.support == receipt.support && verified.identity.representedFrames == 3)
    print("PASS exact fractional terminal clipping preserves all three picture digests and bound camera proof")
}

/// One malformed payload experiment, retaining the real decoder outcome rather than assuming failure.
func runCameraPublicationDamagedPayload(output: URL) async throws {
    try FileManager.default.createDirectory(at: output, withIntermediateDirectories: false)
    let (directory, observations, journal) = try cameraPublicationFixture("damaged", rows: cameraPublicationRows())
    defer { journal.lease.release(); try? FileManager.default.removeItem(at: directory) }
    let raw = directory.appendingPathComponent("camera.raw.mov")
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.sortedKeys]
    let before = try encoder.encode(await MediaProbe.inspect(url: raw))
    let asset = AVURLAsset(url: raw)
    let track = try await asset.loadTracks(withMediaType: .video).first!
    let cursor = track.makeSampleCursor(presentationTimeStamp: .zero)!
    precondition(cursor.stepInPresentationOrder(byCount: 2) == 2)
    let storage = cursor.currentSampleStorageRange
    var bytes = try Data(contentsOf: raw)
    precondition(storage.offset >= 36 && storage.length > 0 && storage.offset + storage.length <= bytes.count)
    let offset = Int(storage.offset), length = Int(storage.length)
    bytes.replaceSubrange(offset..<(offset + length), with: repeatElement(UInt8(255), count: length))
    try bytes.write(to: raw, options: .atomic)
    let after = try encoder.encode(await MediaProbe.inspect(url: raw))
    precondition(before == after, "Payload damage must preserve complete native timing metadata")
    let marker = directory.appendingPathComponent("camera.closed.json")
    try FileManager.default.removeItem(at: marker)
    try CameraMedia.recordClosed(raw: raw, marker: marker)
    try bytes.write(to: output.appendingPathComponent("fixture.mov"))
    try before.write(to: output.appendingPathComponent("timing.json"))
    try JSONSerialization.data(withJSONObject: ["offset": offset, "length": length, "fill": 255])
        .write(to: output.appendingPathComponent("damage.json"))
    do {
        let receipt = try await CameraMedia.publish(lease: journal.lease, observationURL: observations)
        try encoder.encode(receipt).write(to: output.appendingPathComponent("receipt.json"))
        print("OBSERVED damaged raw represented=\(receipt.representedFrames) diagnostics=\(receipt.diagnostics) hash=\(receipt.pictureSHA256)")
    } catch {
        let error = error as NSError
        try JSONSerialization.data(withJSONObject: ["domain": error.domain, "code": error.code, "message": error.localizedDescription])
            .write(to: output.appendingPathComponent("failure.json"))
        print("OBSERVED damaged raw failure \(error.domain)/\(error.code): \(error.localizedDescription)")
    }
    precondition(!FileManager.default.fileExists(atPath: directory.appendingPathComponent("video.mov").path)
        || FileManager.default.fileExists(atPath: directory.appendingPathComponent("camera.publication.json").path))
}
