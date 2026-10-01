@preconcurrency import AVFoundation
import Darwin
import Foundation
import ScreenCaptureKit
import ScreenRecorderCapture
import ScreenRecorderMedia
import ScreenRecorderWire

/// Real camera writer/publication and native admission around tiny authored pictures, never hardware IO.
@MainActor
func runCameraSourceAdmissionTests(output: String? = nil) async throws {
    try runCameraJournalProvenanceTests()
    let root = output.map { URL(fileURLWithPath: $0) } ?? RecoveryFixture.directory("camera-source-admission")
    if output != nil { try FileManager.default.createDirectory(at: root, withIntermediateDirectories: false) }
    defer { if output == nil { try? FileManager.default.removeItem(at: root) } }
    let fixture = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
        .appendingPathComponent("fixtures/camera-visible32.mov")
    let normal = root.appendingPathComponent("normal")
    try FileManager.default.createDirectory(at: normal, withIntermediateDirectories: false)
    let directory = normal.appendingPathComponent("camera")
    let binding = CameraCaptureBinding(recordingId: "fixture-take", sourceId: "fixture-camera-source", deviceId: "fixture-selected-device")
    let writer = try CameraWriter(directory: directory, framesPerSecond: 30, binding: binding)
    let asset = AVURLAsset(url: fixture)
    let track = try await asset.loadTracks(withMediaType: .video).first!
    let reader = try AVAssetReader(asset: asset)
    let decoded = AVAssetReaderTrackOutput(track: track, outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA])
    reader.add(decoded); precondition(reader.startReading())
    let first = decoded.copyNextSampleBuffer()!
    let primary = try CaptureWriter(request: CaptureRequest(source: CaptureSource(kind: "authored-camera-primary"), outputDirectory: normal.path),
        width: 32, height: 16, sessionID: "fixture-primary-source", requestedSourceRect: nil, onFailure: { _ in })
    let primed = try captureFixtureRetimed(first, at: time(microseconds: CaptureHostTime.nowUs() - 100_000))
    let attachments = CMSampleBufferGetSampleAttachmentsArray(primed, createIfNecessary: true)! as NSArray
    (attachments[0] as! NSMutableDictionary)[SCStreamFrameInfo.status.rawValue] = SCFrameStatus.complete.rawValue
    primary.queue.sync { _ = primary.ingestObserved(primed, of: .screen) }
    primary.pause(); try await Task.sleep(for: .milliseconds(10)); primary.resume()
    let clock = primary.queue.sync { primary.ingressState.clock }
    let cameraHost = clock.originUs! + clock.pauses.reduce(Int64(0)) { $0 + $1.elapsedPauseUs } + 200_000
    struct Row: Encodable { let role = "camera"; let disposition = "accepted"; let cameraFrame: CameraFrameMapping }
    var observations = Data()
    var next: CMSampleBuffer? = first
    while let sample = next {
        let hosted = try captureFixtureRetimed(sample, at: CMTimeAdd(time(microseconds: cameraHost), sample.presentationTimeStamp))
        let waitUs = microseconds(hosted.presentationTimeStamp) - CaptureHostTime.nowUs()
        if waitUs > 0 { try await Task.sleep(for: .microseconds(waitUs)) }
        let (_, frame) = try writer.append(hosted, state: primary.queue.sync { primary.ingressState })
        guard let frame else { preconditionFailure("Tiny paced camera fixture must be accepted") }
        observations.append(try JSONEncoder().encode(Row(cameraFrame: frame)) + Data([10]))
        try await Task.sleep(for: .milliseconds(10))
        next = decoded.copyNextSampleBuffer()
    }
    precondition(reader.status == .completed)
    let remaining = cameraHost + 100_000 - CaptureHostTime.nowUs()
    if remaining > 0 { try await Task.sleep(for: .microseconds(remaining)) }
    primary.seal(); _ = await primary.finish(failure: nil); primary.releaseJournal()
    let originalMapping = normal.appendingPathComponent("timestamps.jsonl")
    try observations.write(to: originalMapping)
    let closed = await writer.close(clock: clock, failure: nil, observations: originalMapping)
    let result = try await CameraMedia.publish(closed)
    closed.releaseJournal()
    precondition(result.source.kind == "camera" && result.cameraBinding == binding && result.failure == nil)
    let header = try CaptureJournal.inspect(directory: directory.path).header!
    precondition(header.sessionID == binding.sourceId && header.cameraBinding == binding)
    let retainedMapping = try Data(contentsOf: directory.appendingPathComponent("camera.mapping.jsonl"))
    precondition(retainedMapping == observations)
    let exported = try await SourceEvidenceExport.write(directory: directory.path, output: root.appendingPathComponent("normal-evidence.jsonl").path)
    guard case .video(let proof) = exported.publications?["video"] else { preconditionFailure("Camera proof must be on ordinary video") }
    precondition(proof.representedFrames == 3 && proof.support.startUs == ExactTime(200_000))
    precondition(exported.originHostUs == clock.originUs && exported.pauseEvents == 1)

    do {
        let lease = try CaptureJournalLease(directory: directory.path)
        let canonical = directory.appendingPathComponent("video.mov")
        let saved = directory.appendingPathComponent("original-video.mov")
        let descriptor = Darwin.open(canonical.path, O_RDONLY | O_NOFOLLOW | O_CLOEXEC)
        precondition(descriptor >= 0)
        try FileManager.default.moveItem(at: canonical, to: saved)
        try FileManager.default.copyItem(at: fixture.deletingLastPathComponent().appendingPathComponent("camera-visible34.mov"), to: canonical)
        defer {
            Darwin.close(descriptor); lease.release()
            try? FileManager.default.removeItem(at: canonical)
            try? FileManager.default.moveItem(at: saved, to: canonical)
        }
        let fdProof = try await CameraMedia.readPublished(lease: lease, canonical: URL(fileURLWithPath: "/dev/fd/\(descriptor)"))
        precondition(fdProof.identity.canonical == proof.canonical && fdProof.identity.support == proof.support)
    }
    print("PASS bound camera writer/header/result, common origin/pauses and canonical path replacement after descriptor open")

    // Portable admission is independent of raw movies, markers and the external observation location.
    let independent = root.appendingPathComponent("self-contained")
    try FileManager.default.copyItem(at: directory, to: independent)
    try FileManager.default.removeItem(at: independent.appendingPathComponent("camera.raw.mov"))
    try FileManager.default.removeItem(at: independent.appendingPathComponent("camera.closed.json"))
    try FileManager.default.removeItem(at: originalMapping)
    let retained = try await SourceEvidenceExport.write(directory: independent.path, output: root.appendingPathComponent("self-contained-evidence.jsonl").path)
    let retainedEvidence = try Data(contentsOf: URL(fileURLWithPath: retained.file))
    let originalEvidence = try Data(contentsOf: URL(fileURLWithPath: exported.file))
    precondition(retainedEvidence == originalEvidence)
    print("PASS self-contained retained receipt/mapping after original raw/observation dependencies disappear")

    for field in ["support", "firstUs", "pictureSHA256"] {
        let changed = root.appendingPathComponent("retry-\(field)")
        try FileManager.default.copyItem(at: directory, to: changed)
        let url = changed.appendingPathComponent("camera.publication.json")
        var receipt = try JSONSerialization.jsonObject(with: Data(contentsOf: url)) as! [String: Any]
        if field == "support" { receipt[field] = ["startUs": 200000, "endUs": 300001] }
        if field == "firstUs" { receipt[field] = 199999 }
        if field == "pictureSHA256" { receipt[field] = String(repeating: "0", count: 64) }
        try JSONSerialization.data(withJSONObject: receipt).write(to: url)
        let lease = try CaptureJournalLease(directory: changed.path)
        defer { lease.release() }
        do { _ = try await CameraMedia.publish(lease: lease, observationURL: changed.appendingPathComponent("camera.mapping.jsonl")); preconditionFailure("Changed persisted \(field) must refuse publication retry") }
        catch let failure as CaptureFailure { precondition(failure.code == "INVALID_CAMERA_MAPPING") }
    }
    print("PASS persisted receipt support/timing/picture digest mutations refuse publication retry")

    let appended = root.appendingPathComponent("post-prefix-clock")
    try FileManager.default.copyItem(at: directory, to: appended)
    let originalSummary = try CaptureJournal.inspect(directory: appended.path)
    let append = try FileHandle(forWritingTo: appended.appendingPathComponent("capture.journal.jsonl"))
    try append.seekToEnd()
    try append.write(contentsOf: JSONSerialization.data(withJSONObject: ["sequence": originalSummary.lastSequence + 1, "event": "origin", "data": ["hostUs": clock.originUs! + 1]]) + Data([10]))
    try append.close()
    let appendedLease = try CaptureJournalLease(directory: appended.path)
    do { _ = try await CameraMedia.readPublished(lease: appendedLease, canonical: appended.appendingPathComponent("video.mov")); preconditionFailure("Post-prefix shared clock changes must refuse") }
    catch let failure as CaptureFailure { precondition(failure.code == "INVALID_CAMERA_MAPPING") }
    appendedLease.release()
    print("PASS post-prefix clock append refused while original terminal append remains allowed")

    let fractional = root.appendingPathComponent("fractional")
    try FileManager.default.createDirectory(at: fractional, withIntermediateDirectories: false)
    let raw = fractional.appendingPathComponent("camera.raw.mov")
    try FileManager.default.copyItem(at: fixture, to: raw)
    let fractionalBinding = CameraCaptureBinding(recordingId: "fixture-take", sourceId: "fixture-camera-fractional", deviceId: "fixture-selected-device")
    let journal = try CaptureJournal(directory: fractional.path, header: CaptureJournalHeader(schemaVersion: 1,
        sessionID: fractionalBinding.sourceId, source: CaptureSource(kind: "camera"), width: 32, height: 16,
        microphone: false, systemAudio: false, cameraBinding: fractionalBinding))
    try journal.recordOrigin(hostUs: 1_000_000)
    var rows = Data()
    for ordinal in 0..<2 {
        let row: [String: Any] = ["role": "camera", "disposition": "accepted", "cameraFrame": [
            "ordinal": ordinal, "start": ["value": ordinal * 512, "timescale": 15360, "epoch": 0],
            "end": ["value": ordinal == 1 ? 1536 : 512, "timescale": 15360, "epoch": 0]]]
        rows.append(try JSONSerialization.data(withJSONObject: row) + Data([10]))
    }
    let mapping = fractional.appendingPathComponent("camera.mapping.jsonl")
    try rows.write(to: mapping)
    // The actual read owner captures an existing regular-file boundary, independent of SDK scheduling.
    let growingURL = root.appendingPathComponent("growing-mapping.jsonl")
    try rows.write(to: growingURL)
    let growing = try CameraMedia.Mapping(growingURL)
    let growth = try FileHandle(forWritingTo: growingURL)
    try growth.seekToEnd(); try growth.write(contentsOf: Data([10])); try growth.close()
    while true {
        do {
            if try growing.next() == nil { preconditionFailure("A growing mapping must not read beyond its captured boundary") }
        } catch let failure as CaptureFailure { precondition(failure.code == "INVALID_CAMERA_MAPPING"); break }
    }
    let stable = try CameraMedia.Mapping(mapping)
    let stableFirst = try stable.next(), stableSecond = try stable.next(), stableEnd = try stable.next()
    precondition(stableFirst != nil && stableSecond != nil && stableEnd == nil)
    let tornURL = root.appendingPathComponent("torn-mapping.jsonl")
    try (rows + Data([123])).write(to: tornURL)
    let torn = try CameraMedia.Mapping(tornURL)
    let tornFirst = try torn.next(), tornSecond = try torn.next(), tornEnd = try torn.next()
    precondition(tornFirst != nil && tornSecond != nil && tornEnd == nil)
    print("PASS bounded regular-file mapping growth refusal and stable/torn input behavior")
    try CameraMedia.recordClosed(raw: raw, marker: fractional.appendingPathComponent("camera.closed.json"))
    let partial = try await CameraMedia.publish(lease: journal.lease, observationURL: mapping)
    let exact = ExactRange(startUs: ExactTime(0), endUs: ExactTime(200_000, 3))
    precondition(partial.support == exact && partial.representedFrames == 2 && partial.diagnostics == ["unmappedRawTail"])
    let clipped = try exact.endUs.compare(ExactTime(100_000))
    precondition(clipped == .orderedAscending,
        "Native terminal support must clip strictly inside the last accepted nominal interval")
    // The receipt pins the pre-terminal prefix; a truthful later terminal append stays allowed.
    try journal.recordFinished(CaptureResult(state: "interrupted", source: CaptureSource(kind: "camera"), width: 32, height: 16,
        durationUs: 66667, hostOriginUs: 1_000_000, pauses: [], tracks: [], failure: CaptureFailure("PARTIAL_CAMERA", "unmappedRawTail"),
        systemAudioScope: "disabled", cameraBinding: fractionalBinding))
    journal.lease.release()
    let fractionalExport = try await SourceEvidenceExport.write(directory: fractional.path, output: root.appendingPathComponent("fractional-evidence.jsonl").path)
    guard case .video(let verifiedPartial) = fractionalExport.publications?["video"] else { preconditionFailure("Partial prefix lacks proof") }
    precondition(verifiedPartial.support == exact && verifiedPartial.representedFrames == 2)
    let recovered = try await MediaRecovery.recover(directory: fractional.path)
    precondition(recovered.tracks.first?.acquisitionVerified == true && recovered.tracks.first?.representedFrames?.wrappedValue == 2)
    print("PASS exact fractional native support and represented partial prefix through evidence/recovery")

    let legacy = root.appendingPathComponent("legacy-scale")
    try FileManager.default.createDirectory(at: legacy, withIntermediateDirectories: false)
    let legacyRaw = legacy.appendingPathComponent("camera.raw.mov")
    try FileManager.default.copyItem(at: fixture, to: legacyRaw)
    let legacyMapping = legacy.appendingPathComponent("camera.mapping.jsonl")
    try rows.write(to: legacyMapping)
    let legacyJournal = try CaptureJournal(directory: legacy.path, header: CaptureJournalHeader(schemaVersion: 1,
        sessionID: "authored-unbound-source", source: CaptureSource(kind: "authored-camera-pixels"), width: 32, height: 16,
        microphone: false, systemAudio: false))
    try CameraMedia.recordClosed(raw: legacyRaw, marker: legacy.appendingPathComponent("camera.closed.json"))
    _ = try await CameraMedia.publish(lease: legacyJournal.lease, observationURL: legacyMapping)
    let legacyReceipt = legacy.appendingPathComponent("camera.publication.json")
    var old = try JSONSerialization.jsonObject(with: Data(contentsOf: legacyReceipt)) as! [String: Any]
    old.removeValue(forKey: "pictureTimeScale")
    try JSONSerialization.data(withJSONObject: old).write(to: legacyReceipt)
    let oldScope = try await CameraMedia.readPublished(lease: legacyJournal.lease, canonical: legacy.appendingPathComponent("video.mov"))
    precondition(oldScope.identity.support == exact)
    try FileManager.default.removeItem(at: legacyRaw)
    do { _ = try await CameraMedia.readPublished(lease: legacyJournal.lease, canonical: legacy.appendingPathComponent("video.mov")); preconditionFailure("Absent historical native scale cannot borrow canonical scale") }
    catch let failure as CaptureFailure { precondition(failure.code == "INVALID_CAMERA_MAPPING") }
    legacyJournal.lease.release()
    print("PASS historical unbound digest scale requires actual raw authority and refuses when it disappears")

    // Refusal before device IO: supplied selection must agree with its retained device identity.
    var preparation = CaptureInputPreparation()
    preparation.requireScreenAuthorization = { _ in preconditionFailure("Invalid binding reached screen authorization") }
    do {
        _ = try await preparation.prepare(CaptureRequest(source: CaptureSource(kind: "fixture"), outputDirectory: root.appendingPathComponent("unused").path),
            camera: CaptureCameraSelection(id: "another-device", directory: root.appendingPathComponent("unused-camera"), observations: root.appendingPathComponent("unused-mapping"), binding: binding),
            checkInterruption: {})
        preconditionFailure("Mismatched camera binding must refuse before IO")
    } catch let failure as CaptureFailure { precondition(failure.code == "INVALID_REQUEST") }
    print("PASS selected-device binding mismatch refuses before authorization/device IO")
}
