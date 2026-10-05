@preconcurrency import AVFoundation
import Foundation
import ScreenRecorderCapture
import ScreenRecorderMedia
import ScreenRecorderWire

@MainActor
func runPrimaryCameraInputTests(output: String? = nil) async throws {
    let root = output.map { URL(fileURLWithPath: $0) } ?? RecoveryFixture.directory("primary-camera-input")
    if output != nil { try FileManager.default.createDirectory(at: root, withIntermediateDirectories: false) }
    defer { if output == nil { try? FileManager.default.removeItem(at: root) } }
    let source = root.appendingPathComponent("input.mov")
    try await RecoveryFixture.writeVariableDurationVideo(to: source,
        timesUs: [0, 100000, 200000], endUs: 300000)
    let origin = CaptureHostTime.nowUs() - 600000
    let wrong = FixtureCameraDevice("other", session: FixtureCameraSession(source: source, origin: { origin }))
    let chosen = FixtureCameraDevice("chosen", session: FixtureCameraSession(source: source, origin: { origin }))
    var preparation = CaptureInputPreparation()
    preparation.requireScreenAuthorization = { _ in throw CaptureFailure("UNREQUESTED_SCREEN", "Camera-only must not authorize screen IO") }
    preparation.prepareScreen = { _ in throw CaptureFailure("UNREQUESTED_SCREEN", "Camera-only must not prepare screen IO") }
    preparation.cameraAuthorized = { true }
    preparation.cameras = { [wrong, chosen] }
    let capture = NativeCapture(prepareInput: { request, check in
        try await preparation.prepare(request, checkInterruption: check)
    })
    let folder = root.appendingPathComponent("selected")
    try await capture.start(.init(source: .init(kind: "camera", deviceID: "chosen"),
        outputDirectory: folder.path, microphone: false, systemAudio: false))
    let result = try await capture.stop()
    try JSONEncoder().encode(result).write(to: root.appendingPathComponent("selected-result.json"))
    precondition(result.state == "complete" && result.failure == nil && result.camera == nil)
    precondition(chosen.opens == 1 && chosen.session.starts == 1 && chosen.session.stops == 1 && wrong.opens == 0)
    precondition(result.width == RecoveryFixture.width && result.height == RecoveryFixture.height && result.cursor.sampled == 0)
    let times = await RecoveryFixture.decodedPresentationMicroseconds(of: folder.appendingPathComponent("video.mov"))
    precondition(Array(times.prefix(3)) == [0, 100000, 200000])
    let files = try FileManager.default.contentsOfDirectory(atPath: folder.path)
    precondition(!files.contains(CameraMedia.mappingFile) && !files.contains("camera.publication.json"), "Primary pictures must allocate no companion proof")
    let evidence = try await SourceEvidenceExport.write(directory: folder.path, output: root.appendingPathComponent("selected-evidence.jsonl").path)
    precondition(evidence.header?.source.deviceID == "chosen" && evidence.geometryRecords == 0 && evidence.cursorSamples == 0)
    print("PASS primary camera exact selection publishes ordinary primary pictures with no screen IO, cursor or companion allocation")
}
