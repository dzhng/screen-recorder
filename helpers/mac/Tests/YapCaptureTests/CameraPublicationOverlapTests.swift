@preconcurrency import AVFoundation
import Foundation
import YapCapture
import YapMedia

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


func runCameraPublicationPrefixTests() async throws {
    for mode in ["torn", "unmapped", "missing-physical", "unsealed"] {
        var rows = try cameraPublicationRows(count: mode == "unmapped" ? 2 : mode == "missing-physical" ? 4 : 3,
            lastEnd: mode == "missing-physical" ? 2048 : 1536)
        if mode == "torn" { rows.append(Data("{\"role\":".utf8)) }
        let (directory, observations, journal) = try cameraPublicationFixture(mode, rows: rows)
        defer { journal.lease.release(); try? FileManager.default.removeItem(at: directory) }
        if mode == "unsealed" { try FileManager.default.removeItem(at: directory.appendingPathComponent("camera.closed.json")) }
        let receipt = try await CameraMedia.publish(lease: journal.lease, observationURL: observations)
        let diagnostic = mode == "torn" ? "tornMappingTail" : mode == "unmapped" ? "unmappedRawTail" : mode == "missing-physical" ? "acceptedBeyondPhysicalEOF" : "unsealedRaw"
        precondition(receipt.diagnostics == [diagnostic])
        precondition(receipt.representedFrames == (mode == "unmapped" ? 2 : 3))
        precondition(receipt.support == ExactRange(startUs: ExactTime(0),
            endUs: mode == "unmapped" ? ExactTime(200_000, 3) : ExactTime(100_000)))
        if mode != "unmapped" {
            precondition(receipt.pictureSHA256 == "a25957a308051415c014091d3859d675729f6d437d1a5982b07bc76007868094")
        }
        let verified = try await CameraMedia.readPublished(lease: journal.lease, canonical: directory.appendingPathComponent("video.mov"))
        precondition(verified.identity.support == receipt.support && verified.diagnostics == receipt.diagnostics)
        print("PASS camera \(mode) retains physical prefix/support and exact diagnostics")
    }
}

func runCameraPublicationErrorOrderTest() async throws {
    var rows = try cameraPublicationRows(firstStart: 1)
    rows.append(Data("malformed\n".utf8))
    let (directory, observations, journal) = try cameraPublicationFixture("error-order", rows: rows)
    defer { journal.lease.release(); try? FileManager.default.removeItem(at: directory) }
    do {
        _ = try await CameraMedia.publish(lease: journal.lease, observationURL: observations)
        preconditionFailure("Timestamp mismatch must refuse")
    } catch let error as CaptureFailure {
        precondition(error.code == "INVALID_CAMERA_MAPPING" && error.message == "Raw picture does not match its exact mapped ordinal.",
            "Qualification must not surface a later malformed mapping before raw validation")
    }
    precondition(!FileManager.default.fileExists(atPath: directory.appendingPathComponent("video.mov").path)
        && !FileManager.default.fileExists(atPath: directory.appendingPathComponent("camera.publication.json").path))
    print("PASS earlier raw timestamp refusal precedes later malformed qualification row; no publication")
}

/// Synthetic Result combinations test arbitration only, not physically reproduced decoder failures.
func runCameraPublicationDecisionTests() throws {
    struct Failure: Error, Equatable { let id: Int }
    let rawFailure = Failure(id: 1), candidateFailure = Failure(id: 2)
    let badRaw: Result<Int, any Error> = .failure(rawFailure)
    let badCandidate: Result<Int, any Error> = .failure(candidateFailure)
    let goodRaw: Result<Int, any Error> = .success(3)
    let goodCandidate: Result<Int, any Error> = .success(3)
    let support = ExactRange(startUs: 0, endUs: 100_000)
    do {
        _ = try CameraMedia.acceptScans(raw: badRaw, canonical: badCandidate,
            complete: { _ in true }, verify: { _, _ in support })
        preconditionFailure("Raw refusal must win")
    } catch let failure as Failure { precondition(failure == rawFailure) }
    let prefix = try CameraMedia.acceptScans(raw: goodRaw, canonical: badCandidate,
        complete: { _ in false }, verify: { _, _ in preconditionFailure("Prefix cannot validate speculative canonical") })
    precondition(prefix.raw == 3 && prefix.support == nil)
    do {
        _ = try CameraMedia.acceptScans(raw: goodRaw, canonical: badCandidate,
            complete: { _ in true }, verify: { _, _ in support })
        preconditionFailure("Full raw validation must retain canonical refusal")
    } catch let failure as Failure { precondition(failure == candidateFailure) }
    let accepted = try CameraMedia.acceptScans(raw: goodRaw, canonical: goodCandidate,
        complete: { _ in true }, verify: { raw, canonical in
            precondition(raw == canonical)
            return support
        })
    precondition(accepted.raw == 3 && accepted.support == support)
    let canceled: Result<Int, any Error> = .failure(CancellationError())
    do {
        _ = try CameraMedia.acceptScans(raw: canceled, canonical: badCandidate,
            complete: { _ in true }, verify: { _, _ in support })
        preconditionFailure("Raw cancellation must propagate")
    } catch is CancellationError {}
    print("PASS synthetic scan-result raw-first refusal, prefix deferral, complete acceptance and cancellation policy")
}

func runCameraPublicationReplayTests() async throws {
    let (directory, observations, journal) = try cameraPublicationFixture("replay", rows: cameraPublicationRows())
    defer { journal.lease.release(); try? FileManager.default.removeItem(at: directory) }
    let first = try await CameraMedia.publish(lease: journal.lease, observationURL: observations)
    let canonical = directory.appendingPathComponent("video.mov")
    try FileManager.default.removeItem(at: canonical)
    let resumed = try await CameraMedia.publish(lease: journal.lease, observationURL: observations)
    precondition(resumed.canonical == first.canonical && resumed.pictureSHA256 == first.pictureSHA256
        && resumed.support == first.support && resumed.journal == first.journal)
    try Data("conflicting output".utf8).write(to: canonical, options: .atomic)
    do {
        _ = try await CameraMedia.publish(lease: journal.lease, observationURL: observations)
        preconditionFailure("Conflicting published bytes must refuse")
    } catch let failure as CaptureFailure { precondition(failure.code == "INVALID_CAMERA_MAPPING") }
    let retained = try Data(contentsOf: canonical)
    precondition(retained == Data("conflicting output".utf8))
    print("PASS retained receipt/link continuation and conflicting-byte refusal without replacement")
}
