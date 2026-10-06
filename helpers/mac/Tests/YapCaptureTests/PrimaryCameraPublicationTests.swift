@preconcurrency import AVFoundation
import Darwin
import Foundation
import YapCapture
import YapMedia
import YapWire

@MainActor
func runPrimaryCameraPublicationTests(output: String? = nil) async throws {
    let root = output.map { URL(fileURLWithPath: $0) } ?? RecoveryFixture.directory("primary-camera-publication")
    if output != nil { try FileManager.default.createDirectory(at: root, withIntermediateDirectories: false) }
    defer { if output == nil { try? FileManager.default.removeItem(at: root) } }
    let inputURL = root.appendingPathComponent("input.mov")
    try await RecoveryFixture.writeVariableDurationVideo(to: inputURL,
        timesUs: [0, 100000, 200000], keyFrameInterval: 1, endUs: 300000)
    let finishedFolder = root.appendingPathComponent("finished")
    let input = PrerecordedCaptureInput(source: inputURL)
    input.primaryVideoIngress = true
    input.videoDeliveryInterval = .milliseconds(10)
    let capture = NativeCapture(prepareInput: { _, _ in input })
    try await capture.start(.init(source: .init(kind: "camera"), outputDirectory: finishedFolder.path,
        sourceId: "finished-primary-camera"))
    let result = try await capture.stop()
    try JSONEncoder().encode(result).write(to: root.appendingPathComponent("finished-result.json"))
    guard case .published(let finished) = capture.publication?.primary else {
        preconditionFailure("Primary video must publish without ScreenCaptureKit frame attachments")
    }
    precondition(finished.kind == .primary && finished.binding == nil && finished.sourceId == "finished-primary-camera"
        && capture.publication?.camera == nil && result.camera == nil && result.durationUs > 0)
    let pictureStarts = await RecoveryFixture.decodedPresentationMicroseconds(of: finishedFolder.appendingPathComponent("video.mov"))
    precondition(Array(pictureStarts.prefix(3)) == [0, 100000, 200000],
        "Primary camera must preserve authored picture placement before the ordinary healthy tail")
    let finishedMedia = try Data(contentsOf: finishedFolder.appendingPathComponent("video.mov"))
    let finishedReceipt = try Data(contentsOf: finishedFolder.appendingPathComponent("source.publication.json"))
    _ = try await CapturePublishedSource.recover(directory: finishedFolder.path)
    let finishedRecovery = try await MediaRecovery.recover(directory: finishedFolder.path,
        sourceAuthority: .init(kind: .primary, sourceId: "finished-primary-camera"))
    let finishedEvidence = try await SourceEvidenceExport.write(directory: finishedFolder.path,
        output: root.appendingPathComponent("finished-evidence.jsonl").path)
    precondition(finishedRecovery.durationUs == result.durationUs && finishedEvidence.finished
        && finishedEvidence.geometryRecords == 0 && finishedEvidence.cursorSamples == 0
        && finishedEvidence.header?.cameraBinding == nil)
    try JSONEncoder().encode(capture.publication).write(to: root.appendingPathComponent("finished-publication.json"))
    try JSONEncoder().encode(finishedEvidence).write(to: root.appendingPathComponent("finished-evidence-receipt.json"))
    try requireCamera(try Data(contentsOf: finishedFolder.appendingPathComponent("video.mov")) == finishedMedia)
    try requireCamera(try Data(contentsOf: finishedFolder.appendingPathComponent("source.publication.json")) == finishedReceipt)
    try await primaryCameraRefusals(root: root, folder: finishedFolder)
    let folder = root.appendingPathComponent("unfinished")
    try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: false)
    try await RecoveryFixture.writeVariableDurationVideo(to: folder.appendingPathComponent("video.mov"),
        timesUs: [0, 100000, 200000], keyFrameInterval: 1, endUs: 300000)
    let journal = try CaptureJournal(directory: folder.path, header: .init(schemaVersion: 2,
        sessionID: "primary-camera", source: .init(kind: "camera"), width: RecoveryFixture.width,
        height: RecoveryFixture.height, microphone: false, systemAudio: false))
    try journal.recordPCMOrigin(.init(rawPTS: time(microseconds: 1000000), declaredHostUs: 1000000))
    journal.lease.release()
    let originalMedia = try Data(contentsOf: folder.appendingPathComponent("video.mov"))
    let originalJournal = try Data(contentsOf: folder.appendingPathComponent("capture.journal.jsonl"))
    let recovery = try await MediaRecovery.recover(directory: folder.path,
        sourceAuthority: .init(kind: .primary, sourceId: "primary-camera"))
    try JSONEncoder().encode(recovery).write(to: root.appendingPathComponent("recovery.json"))
    guard case .published(let source) = recovery.sourcePublication else {
        preconditionFailure("A camera device in primary layout must publish ordinary primary authority")
    }
    precondition(source.kind == .primary && source.binding == nil && source.sourceId == "primary-camera"
        && source.journal.layout == 2 && source.journal.file == "source.journal.jsonl"
        && source.sourceDurationUs == 300000 && source.originHostUs == 1000000)
    let evidence = try await SourceEvidenceExport.write(directory: folder.path,
        output: root.appendingPathComponent("evidence.jsonl").path)
    try JSONEncoder().encode(evidence).write(to: root.appendingPathComponent("evidence-receipt.json"))
    precondition(evidence.header?.source.kind == "camera" && evidence.header?.cameraBinding == nil)
    try requireCamera(try Data(contentsOf: folder.appendingPathComponent("video.mov")) == originalMedia)
    try requireCamera(try Data(contentsOf: folder.appendingPathComponent("capture.journal.jsonl")) == originalJournal)
    try requireCamera(try Data(contentsOf: folder.appendingPathComponent("source.journal.jsonl")) == originalJournal)
    for tail in ["torn", "corrupt"] {
        let target = root.appendingPathComponent(tail)
        try FileManager.default.createDirectory(at: target, withIntermediateDirectories: false)
        try originalMedia.write(to: target.appendingPathComponent("video.mov"))
        let bytes = originalJournal + Data((tail == "torn" ? "{\"sequence\":3" : "broken record\n").utf8)
        try bytes.write(to: target.appendingPathComponent("capture.journal.jsonl"))
        let recovered = try await MediaRecovery.recover(directory: target.path,
            sourceAuthority: .init(kind: .primary, sourceId: "primary-camera"))
        guard case .published(let prefix) = recovered.sourcePublication else {
            preconditionFailure("Primary camera must retain its recoverable journal prefix")
        }
        precondition(prefix.sourceDurationUs == 300000)
        _ = try await CapturePublishedSource.recover(directory: target.path)
        _ = try await SourceEvidenceExport.write(directory: target.path,
            output: root.appendingPathComponent("\(tail)-evidence.jsonl").path)
        try requireCamera(try Data(contentsOf: target.appendingPathComponent("capture.journal.jsonl")) == bytes)
        try requireCamera(try Data(contentsOf: target.appendingPathComponent("source.journal.jsonl")) == bytes)
        try requireCamera(try Data(contentsOf: target.appendingPathComponent("video.mov")) == originalMedia)
    }
    print("PASS primary camera recovers and exports evidence as an unbound layout-2 primary source")
}

@MainActor
private func primaryCameraRefusals(root: URL, folder: URL) async throws {
    let binding = CameraCaptureBinding(recordingId: "foreign-take", sourceId: "finished-primary-camera", deviceId: "fixture-camera")
    for mutation in ["role", "source-id", "layout", "binding"] {
        let target = root.appendingPathComponent("refuse-\(mutation)")
        try FileManager.default.copyItem(at: folder, to: target)
        let authority = CaptureRecoveryAuthority(kind: mutation == "role" ? .camera : .primary,
            sourceId: mutation == "source-id" ? "foreign-primary" : "finished-primary-camera",
            binding: mutation == "role" ? binding : nil)
        if mutation == "layout" || mutation == "binding" {
            let file = target.appendingPathComponent("capture.journal.jsonl")
            var rows = try Data(contentsOf: file).split(separator: 10).map {
                try JSONSerialization.jsonObject(with: Data($0)) as! [String: Any]
            }
            var header = rows[0]["data"] as! [String: Any]
            if mutation == "layout" { header["schemaVersion"] = 1 }
            else { header["cameraBinding"] = try JSONSerialization.jsonObject(with: JSONEncoder().encode(binding)) }
            rows[0]["data"] = header
            var bytes = Data()
            for row in rows { bytes += try JSONSerialization.data(withJSONObject: row, options: .sortedKeys) + Data([10]) }
            try bytes.write(to: file)
        }
        let refused = try await MediaRecovery.recover(directory: target.path, sourceAuthority: authority)
        guard case .unavailable = refused.sourcePublication else {
            preconditionFailure("Wrong \(mutation) cannot publish primary-camera authority")
        }
        try JSONEncoder().encode(refused).write(to: root.appendingPathComponent("refuse-\(mutation).json"))
    }
    let source = try await CapturePublishedSource.recover(directory: folder.path)
    let stage = root.appendingPathComponent("stage")
    try FileManager.default.createDirectory(at: stage, withIntermediateDirectories: false)
    try FileManager.default.copyItem(at: folder.appendingPathComponent(source.journal.file),
        to: stage.appendingPathComponent("capture.journal.jsonl"))
    try FileManager.default.copyItem(at: folder.appendingPathComponent("source.publication.json"),
        to: stage.appendingPathComponent("source.publication.json"))
    let receipt = try CaptureMediaIdentity.read(stage.appendingPathComponent("source.publication.json"))
    let fd = Darwin.open(folder.appendingPathComponent("video.mov").path, O_RDONLY | O_NOFOLLOW)
    precondition(fd >= 0); defer { close(fd) }
    let pinned = ["video": "/dev/fd/\(fd)"]
    let verified = try await SourceEvidenceExport.write(directory: stage.path,
        output: root.appendingPathComponent("staged-evidence.jsonl").path, canonical: pinned,
        sourceAuthority: .init(source: source, receipt: receipt))
    precondition(verified.verifiedSourceAuthority?.sourceId == source.sourceId)
    var foreign = try JSONSerialization.jsonObject(with: JSONEncoder().encode(source)) as! [String: Any]
    foreign["sourceId"] = "foreign-primary"
    let expectation = try JSONDecoder().decode(CapturePublishedSource.self,
        from: JSONSerialization.data(withJSONObject: foreign))
    do {
        _ = try await SourceEvidenceExport.write(directory: stage.path,
            output: root.appendingPathComponent("foreign-evidence.jsonl").path, canonical: pinned,
            sourceAuthority: .init(source: expectation, receipt: receipt))
        preconditionFailure("Foreign expected authority cannot admit original camera-primary bytes")
    } catch { precondition(CaptureFinalizationError(error).code == "INVALID_JOURNAL_PREFIX") }
}

private func requireCamera(_ condition: @autoclosure () throws -> Bool) rethrows {
    let accepted = try condition(); precondition(accepted)
}
