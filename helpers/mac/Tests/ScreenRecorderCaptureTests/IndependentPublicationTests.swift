import Foundation
import Synchronization
import ScreenRecorderCapture

@MainActor
func runIndependentPublicationTests(output: String? = nil) async throws {
    let root = output.map { URL(fileURLWithPath: $0) } ?? RecoveryFixture.directory("independent-publication")
    if output != nil { try FileManager.default.createDirectory(at: root, withIntermediateDirectories: false) }
    defer { if output == nil { try? FileManager.default.removeItem(at: root) } }
    let source = root.appendingPathComponent("input.mov")
    try await RecoveryFixture.writeVariableDurationVideo(to: source,
        timesUs: [0, 100000, 200000, 500000, 700000], endUs: 800000)
    let folder = root.appendingPathComponent("camera-pending")
    let cameraDirectory = folder.appendingPathComponent("camera")
    let input = PrerecordedCaptureInput(source: source)
    input.probeDirectory = folder
    input.videoDeliveryInterval = .milliseconds(10)
    input.afterCameraClose = {
        try FileManager.default.setAttributes([.posixPermissions: 0o500], ofItemAtPath: cameraDirectory.path)
    }
    defer { try? FileManager.default.setAttributes([.posixPermissions: 0o700], ofItemAtPath: cameraDirectory.path) }
    let capture = NativeCapture(prepareInput: { _, _ in input })
    let request = CaptureRequest(source: CaptureSource(kind: "offline-prerecorded"),
        outputDirectory: folder.path, sourceId: "primary-independent", microphone: false)
    try await capture.start(request)
    try JSONEncoder().encode(request).write(to: folder.appendingPathComponent("request.json"))
    try capture.pause()
    do { _ = try await capture.stop(); preconditionFailure("Camera publication must remain pending") }
    catch { precondition(CaptureFinalizationError(error).retryable) }
    precondition(FileManager.default.fileExists(atPath: folder.appendingPathComponent("source.journal.jsonl").path),
        "A published primary source needs immutable journal authority while camera remains pending")
    guard let observation = capture.publication, observation.inputsClosed,
        case .published(let primary) = observation.primary,
        case .pending(let cameraFailure) = observation.camera else {
        preconditionFailure("Closed inputs must expose independent published and pending source outcomes")
    }
    precondition(cameraFailure.retryable && primary.sourceId == "primary-independent"
        && primary.sourceDurationUs > 0 && primary.originHostUs == input.fixtureOrigin)
    let frozenURL = folder.appendingPathComponent(primary.journal.file)
    let frozen = try Data(contentsOf: frozenURL)
    let liveURL = folder.appendingPathComponent("capture.journal.jsonl")
    let liveBefore = try Data(contentsOf: liveURL)
    let laterSequence = capture.note("finalizing", reason: "CAMERA_PUBLICATION_PENDING")!
    let liveAfter = try Data(contentsOf: liveURL)
    precondition(laterSequence > primary.journal.lastSequence && liveAfter.count > liveBefore.count)
    let afterNote = try Data(contentsOf: frozenURL)
    precondition(afterNote == frozen, "Take lifecycle suffixes cannot mutate source evidence")
    capture.cancelPublication()
    do { _ = try await capture.stop(); preconditionFailure("Explicit cancellation must end the pending retry") }
    catch is CancellationError {}
    guard case .published(let afterCancellation) = capture.publication?.primary else {
        preconditionFailure("Canceling sibling publication cannot erase the already-published primary outcome")
    }
    precondition(afterCancellation.journal == primary.journal)
    try FileManager.default.setAttributes([.posixPermissions: 0o700], ofItemAtPath: cameraDirectory.path)
    let result = try await capture.stop()
    precondition(result.failure == nil && result.camera?.failure == nil)
    precondition(input.stops == 1 && input.finalizations == 1 && input.discards == 0)
    precondition(result.durationUs == primary.sourceDurationUs && result.hostOriginUs == primary.originHostUs)
    let recovered = try await CapturePublishedSource.recover(directory: folder.path)
    precondition(recovered.journal == primary.journal && recovered.sourceId == primary.sourceId)
    // Substituting the live whole journal is the precise authority error this snapshot prevents.
    try Data(contentsOf: liveURL).write(to: frozenURL, options: .atomic)
    do { _ = try await CapturePublishedSource.recover(directory: folder.path); preconditionFailure("Live whole journal must not pass as frozen authority") }
    catch { precondition(CaptureFinalizationError(error).code == "INVALID_JOURNAL_PREFIX") }
    try frozen.write(to: frozenURL, options: .atomic)
    _ = try await CapturePublishedSource.recover(directory: folder.path)
    try JSONEncoder().encode(result).write(to: folder.appendingPathComponent("native-result.json"))
    try JSONEncoder().encode(observation).write(to: folder.appendingPathComponent("pending-observation.json"))
    try retainClosureFacts(input, in: folder)
    print("PASS primary publication survives camera refusal, lifecycle growth, retry and recovery; live journal substitution refused")
    try await independentCameraRecovery(root: root, source: source)
    try await changedPrimaryAuthority(root: root, source: source)
    try await changedPrimaryAuthority(root: root, source: source, removingSnapshot: true)
    try await absentCameraPublication(root: root, source: source)
}

@MainActor
private func independentCameraRecovery(root: URL, source: URL) async throws {
    let audio = try captureMaterializerFixture(in: root, name: "audio-input", accepted: 96000)
    let folder = root.appendingPathComponent("primary-pending")
    let packed = folder.appendingPathComponent("narration.packed.mov")
    let binding = CameraCaptureBinding(recordingId: "independent-take", sourceId: "independent-camera", deviceId: "prerecorded-camera")
    let input = PrerecordedCaptureInput(source: source)
    input.probeDirectory = folder
    input.cameraBinding = binding
    input.audio = audio.appendingPathComponent("narration.packed.mov")
    input.videoDeliveryInterval = .milliseconds(10)
    input.holdStop = true
    input.afterCameraClose = {
        try FileManager.default.setAttributes([.posixPermissions: 0o000], ofItemAtPath: packed.path)
    }
    defer { try? FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: packed.path) }
    let capture = NativeCapture(prepareInput: { _, _ in input })
    var reports: [CapturePublicationObservation] = []
    capture.onPublication = { [weak capture] report in
        reports.append(report)
        capture?.note("finalizing", reason: "SOURCE_PUBLICATION_OBSERVED")
    }
    let request = CaptureRequest(source: CaptureSource(kind: "offline-prerecorded"),
        outputDirectory: folder.path, sourceId: "independent-primary", microphone: true)
    try await capture.start(request)
    let stopping = Task { try await capture.stop() }
    await input.stopEntered.wait()
    precondition(capture.publication?.inputsClosed == false && reports.isEmpty,
        "A draining input cannot release capture priority")
    input.releaseStop.release()
    do { _ = try await stopping.value; preconditionFailure("Primary audio refusal must remain pending") }
    catch { precondition(CaptureFinalizationError(error).retryable) }
    guard let report = reports.last, report.inputsClosed,
        case .published(let camera) = report.camera,
        case .pending(let primaryFailure) = report.primary else {
        preconditionFailure("Published camera must remain independently usable while primary audio is pending")
    }
    precondition(primaryFailure.retryable && camera.binding == binding && camera.sourceId == binding.sourceId
        && camera.sourceDurationUs > 0 && camera.originHostUs == input.fixtureOrigin)
    capture.cancelPublication()
    await capture.discard()
    precondition(input.stops == 1 && input.finalizations == 1 && input.discards == 0 && capture.publication == nil)
    let recovered = try await CapturePublishedSource.recover(directory: folder.appendingPathComponent("camera").path)
    precondition(recovered.binding == binding && recovered.journal == camera.journal
        && recovered.sourceDurationUs == camera.sourceDurationUs && recovered.originHostUs == camera.originHostUs)
    precondition(!FileManager.default.fileExists(atPath: folder.appendingPathComponent("source.publication.json").path),
        "Recovery cannot invent authority for the still-pending source")
    try JSONEncoder().encode(request).write(to: folder.appendingPathComponent("request.json"))
    try JSONEncoder().encode(report).write(to: folder.appendingPathComponent("pending-observation.json"))
    try retainClosureFacts(input, in: folder)
    print("PASS bound camera survives primary refusal and cancellation; physical closure and restart recovery stay independent")
}

@MainActor
private func changedPrimaryAuthority(root: URL, source: URL, removingSnapshot: Bool = false) async throws {
    let folder = root.appendingPathComponent(removingSnapshot ? "missing-primary-snapshot" : "changed-primary")
    let cameraDirectory = folder.appendingPathComponent("camera")
    let input = PrerecordedCaptureInput(source: source)
    input.probeDirectory = folder
    input.videoDeliveryInterval = .milliseconds(10)
    input.afterCameraClose = {
        try FileManager.default.setAttributes([.posixPermissions: 0o500], ofItemAtPath: cameraDirectory.path)
    }
    defer { try? FileManager.default.setAttributes([.posixPermissions: 0o700], ofItemAtPath: cameraDirectory.path) }
    let capture = NativeCapture(prepareInput: { _, _ in input })
    let request = CaptureRequest(source: CaptureSource(kind: "offline-prerecorded"),
        outputDirectory: folder.path, sourceId: "changed-primary", microphone: false)
    try await capture.start(request)
    try JSONEncoder().encode(request).write(to: folder.appendingPathComponent("request.json"))
    do { _ = try await capture.stop(); preconditionFailure("Camera refusal must remain pending") }
    catch { precondition(CaptureFinalizationError(error).retryable) }
    guard case .published = capture.publication?.primary else { preconditionFailure("Primary must initially publish") }
    let frozen = folder.appendingPathComponent("source.journal.jsonl")
    try FileManager.default.copyItem(at: frozen, to: folder.appendingPathComponent("original-source.journal.jsonl"))
    if removingSnapshot { try FileManager.default.removeItem(at: frozen) }
    else {
        let handle = try FileHandle(forWritingTo: frozen)
        try handle.seekToEnd(); try handle.write(contentsOf: Data([10])); try handle.close()
    }
    try FileManager.default.setAttributes([.posixPermissions: 0o700], ofItemAtPath: cameraDirectory.path)
    let result: CaptureResult
    do { result = try await capture.stop() }
    catch { preconditionFailure("Terminal source proof refusal must settle instead of leaving endless publication retries: \(error)") }
    try JSONEncoder().encode(result).write(to: folder.appendingPathComponent("native-result.json"))
    try JSONEncoder().encode(capture.publication).write(to: folder.appendingPathComponent("publication-observation.json"))
    try retainClosureFacts(input, in: folder)
    guard case .unavailable(let reason) = capture.publication?.primary,
        case .published(let camera) = capture.publication?.camera else {
        preconditionFailure("Changed source authority cannot reuse cached published success or starve its sibling")
    }
    precondition(reason.code == (removingSnapshot ? "INVALID_MEDIA" : "INVALID_JOURNAL_PREFIX")
        && (!removingSnapshot || !FileManager.default.fileExists(atPath: frozen.path)),
        "Retry must verify existing source authority without recreating a missing snapshot")
    precondition(result.failure?.code == reason.code && result.camera?.failure == nil && camera.sourceDurationUs > 0)
    precondition(capture.deviceState == "idle" && input.stops == 1 && input.finalizations == 1)
    _ = try await CapturePublishedSource.recover(directory: cameraDirectory.path)
    do { _ = try await CapturePublishedSource.recover(directory: folder.path); preconditionFailure("Changed primary cannot recover") }
    catch { precondition(CaptureFinalizationError(error).code == reason.code) }
    print("PASS retry rechecks immutable source proof and settles terminal unavailability without blocking the sibling: \(removingSnapshot ? "missing snapshot" : "changed snapshot")")
}

/// Required camera-only admission through the actual native lifecycle.
@MainActor
func runCameraWithoutPrimaryTests(output: String? = nil) async throws {
    let root = output.map { URL(fileURLWithPath: $0) } ?? RecoveryFixture.directory("camera-without-primary")
    if output != nil { try FileManager.default.createDirectory(at: root, withIntermediateDirectories: false) }
    defer { if output == nil { try? FileManager.default.removeItem(at: root) } }
    let source = root.appendingPathComponent("input.mov")
    try await RecoveryFixture.writeVariableDurationVideo(to: source,
        timesUs: [0, 100000, 200000, 500000, 700000], endUs: 800000)
    let folder = root.appendingPathComponent("capture")
    let input = PrerecordedCaptureInput(source: source)
    input.probeDirectory = folder
    input.cameraBinding = CameraCaptureBinding(recordingId: "camera-only-take",
        sourceId: "camera-only-source", deviceId: "prerecorded-camera")
    input.primaryFramesEnabled = false
    input.videoDeliveryInterval = .milliseconds(10)
    let capture = NativeCapture(prepareInput: { _, _ in input })
    let request = CaptureRequest(source: CaptureSource(kind: "offline-prerecorded"),
        outputDirectory: folder.path, sourceId: "missing-primary", microphone: false)
    try await capture.start(request)
    let result = try await capture.stop()
    try JSONEncoder().encode(request).write(to: folder.appendingPathComponent("request.json"))
    try JSONEncoder().encode(result).write(to: folder.appendingPathComponent("native-result.json"))
    try JSONEncoder().encode(capture.publication).write(to: folder.appendingPathComponent("publication-observation.json"))
    precondition(result.durationUs == 0 && result.tracks.allSatisfy { $0.samples == 0 })
    precondition(input.stops == 1 && input.finalizations == 1 && capture.deviceState == "idle")
    try retainClosureFacts(input, in: folder)
    guard case .published(let camera) = capture.publication?.camera, camera.sourceDurationUs > 0 else {
        throw CaptureFailure("CAMERA_ORIGIN_REQUIRED", "Camera-only ingress must retain usable support when primary video never arrives.")
    }
    precondition(camera.binding == input.cameraBinding)
    precondition(camera.diagnostic == nil && result.camera?.failure == nil && result.failure?.code == "NO_VIDEO",
        "Primary-only completion failure must not become a healthy camera diagnostic")
    _ = try await CapturePublishedSource.recover(directory: folder.appendingPathComponent("camera").path)
    print("PASS usable bound camera publishes independently when primary video never arrives")
}

@MainActor
private func absentCameraPublication(root: URL, source: URL) async throws {
    let folder = root.appendingPathComponent("camera-unavailable")
    let input = PrerecordedCaptureInput(source: source)
    input.probeDirectory = folder
    input.cameraFramesEnabled = false
    input.videoDeliveryInterval = .milliseconds(10)
    let capture = NativeCapture(prepareInput: { _, _ in input })
    let request = CaptureRequest(source: CaptureSource(kind: "offline-prerecorded"),
        outputDirectory: folder.path, sourceId: "available-primary", microphone: false)
    try await capture.start(request)
    try JSONEncoder().encode(request).write(to: folder.appendingPathComponent("request.json"))
    let result = try await capture.stop()
    guard case .published(let primary) = capture.publication?.primary,
        case .unavailable(let cameraFailure) = capture.publication?.camera else {
        preconditionFailure("Missing camera frames cannot suppress usable primary authority")
    }
    precondition(cameraFailure.code == "NO_CAMERA" && result.failure?.code == "NO_CAMERA"
        && primary.diagnostic == nil && primary.sourceDurationUs == result.durationUs)
    let recovered = try await CapturePublishedSource.recover(directory: folder.path)
    precondition(recovered.diagnostic == nil && recovered.journal == primary.journal)
    precondition(input.stops == 1 && input.finalizations == 1 && capture.deviceState == "idle")
    try JSONEncoder().encode(result).write(to: folder.appendingPathComponent("native-result.json"))
    try retainClosureFacts(input, in: folder)
    print("PASS terminal camera absence preserves primary support and its own completion diagnostic")
}

@MainActor
private func retainClosureFacts(_ input: PrerecordedCaptureInput, in folder: URL) throws {
    if let binding = input.cameraBinding {
        try JSONEncoder().encode(binding).write(to: folder.appendingPathComponent("fixture-camera-binding.json"))
    }
    try JSONSerialization.data(withJSONObject: ["physicalInputStops": input.stops,
        "companionClosureCalls": input.finalizations, "inputDiscards": input.discards], options: [.sortedKeys])
        .write(to: folder.appendingPathComponent("closure-counts.json"))
}

/// A primary journal failure during encoder closure still traverses the shared interruption callback.
@MainActor
func runSharedInterruptionDuringFinishTests(output: String? = nil) async throws {
    let root = output.map { URL(fileURLWithPath: $0) } ?? RecoveryFixture.directory("shared-interruption-during-finish")
    if output != nil { try FileManager.default.createDirectory(at: root, withIntermediateDirectories: false) }
    defer { if output == nil { try? FileManager.default.removeItem(at: root) } }
    let source = root.appendingPathComponent("input.mov")
    try await RecoveryFixture.writeVariableDurationVideo(to: source,
        timesUs: [0, 100000, 200000, 500000, 700000], endUs: 800000)
    let directory = root.appendingPathComponent("capture")
    let input = PrerecordedCaptureInput(source: source)
    input.probeDirectory = directory
    input.cameraBinding = CameraCaptureBinding(recordingId: "shared-interruption-take",
        sourceId: "shared-interruption-camera", deviceId: "prerecorded-camera")
    input.videoDeliveryInterval = .milliseconds(10)
    input.holdStop = true
    let capture = NativeCapture(prepareInput: { _, _ in input })
    var events: [String] = []
    capture.onInterruption = { failure in events.append("interruption:\(failure.code)") }
    input.beforeCameraClose = {
        precondition(events == ["interruption:JOURNAL_FAILED"],
            "The shared interruption must have reached NativeCapture before camera closure")
        events.append("camera-close")
    }
    try await capture.start(CaptureRequest(source: CaptureSource(kind: "offline-prerecorded"),
        outputDirectory: directory.path, sourceId: "shared-interruption-primary", microphone: false))
    try capture.pause()
    let stopping = Task { try await capture.stop() }
    await input.stopEntered.wait()
    precondition(events.isEmpty)
    // Finish must close the open pause. Its next journal write detects this replaced inode.
    let journal = directory.appendingPathComponent("capture.journal.jsonl")
    let original = directory.appendingPathComponent("original-primary.journal.jsonl")
    try FileManager.default.moveItem(at: journal, to: original)
    try FileManager.default.copyItem(at: original, to: journal)
    input.releaseStop.release()
    let result = try await stopping.value
    try JSONEncoder().encode(result).write(to: directory.appendingPathComponent("native-result.json"))
    try JSONEncoder().encode(capture.publication).write(to: directory.appendingPathComponent("publication-observation.json"))
    try JSONEncoder().encode(events).write(to: directory.appendingPathComponent("closure-events.json"))
    try retainClosureFacts(input, in: directory)
    guard case .published(let camera) = capture.publication?.camera else {
        preconditionFailure("A shared interruption must preserve usable camera support")
    }
    precondition(result.failure?.code == "JOURNAL_FAILED" && result.camera?.failure?.code == "JOURNAL_FAILED"
        && camera.diagnostic?.code == "JOURNAL_FAILED",
        "A shared interruption arriving during primary finish cannot disappear from camera authority")
    precondition(camera.binding == input.cameraBinding && input.stops == 1 && input.finalizations == 1
        && capture.deviceState == "idle")
    let recovered = try await CapturePublishedSource.recover(directory: directory.appendingPathComponent("camera").path)
    precondition(recovered.journal == camera.journal && recovered.diagnostic?.code == "JOURNAL_FAILED")
    print("PASS shared journal interruption during primary finish survives camera closure, publication and recovery")
}

/// Holds the SDK reader itself; NativeCapture and both real source publishers remain untouched.
private final class SourcePublicationBarrier: Sendable {
    private struct State: Sendable { var held = false; var released = false; var observed: CapturePublicationObservation? }
    private let kind: CapturePublishedSource.Kind
    init(kind: CapturePublishedSource.Kind = .primary) { self.kind = kind }
    private let state = Mutex(State())
    private let release = DispatchSemaphore(value: 0)
    func hold() {
        let first = state.withLock { value in
            guard !value.held else { return false }
            value.held = true
            return true
        }
        guard first else { return }
        // A bounded escape diagnoses serialization without making elapsed time the assertion.
        let released = release.wait(timeout: .now() + 5) == .success
        state.withLock { $0.released = released }
    }
    func observe(_ observation: CapturePublicationObservation) {
        let held = state.withLock { value in
            guard !value.released, value.observed == nil, observation.inputsClosed else { return false }
            switch kind {
            case .primary:
                guard observation.camera == nil, case .published = observation.primary else { return false }
            case .camera:
                guard observation.primary == nil, case .published = observation.camera else { return false }
            }
            value.observed = observation
            return true
        }
        if held { release.signal() }
    }
    var observation: CapturePublicationObservation? { state.withLock { $0.observed } }
    var released: Bool { state.withLock { $0.released } }
}

@MainActor
func runSourcePublicationOverlapTest(output: String? = nil) async throws {
    let root = output.map { URL(fileURLWithPath: $0) } ?? RecoveryFixture.directory("source-publication-overlap")
    if output != nil { try FileManager.default.createDirectory(at: root, withIntermediateDirectories: false) }
    defer { if output == nil { try? FileManager.default.removeItem(at: root) } }
    let source = root.appendingPathComponent("input.mov")
    try await RecoveryFixture.writeVariableDurationVideo(to: source,
        timesUs: [0, 100000, 200000, 500000, 700000], endUs: 800000)
    let folder = root.appendingPathComponent("capture")
    let cameraDirectory = folder.appendingPathComponent("camera")
    let input = PrerecordedCaptureInput(source: source)
    input.probeDirectory = folder
    input.cameraBinding = CameraCaptureBinding(recordingId: "overlap-take", sourceId: "overlap-camera", deviceId: "prerecorded-camera")
    input.videoDeliveryInterval = .milliseconds(10)
    let barrier = SourcePublicationBarrier()
    let readers = try CameraReaderStarts(directory: cameraDirectory, beforeReading: { _ in
        if FileManager.default.fileExists(atPath: cameraDirectory.appendingPathComponent("camera.closed.json").path) {
            barrier.hold()
        }
    })
    defer { readers.restore() }
    let capture = NativeCapture(prepareInput: { _, _ in input })
    capture.onPublication = { barrier.observe($0) }
    let request = CaptureRequest(source: CaptureSource(kind: "offline-prerecorded"),
        outputDirectory: folder.path, sourceId: "overlap-primary", microphone: false)
    try await capture.start(request)
    let result = try await capture.stop()
    // Keep both complete outcomes before the acceptance guard, including a serialized red result.
    try JSONEncoder().encode(request).write(to: root.appendingPathComponent("request.json"))
    try JSONEncoder().encode(result).write(to: root.appendingPathComponent("native-result.json"))
    try JSONEncoder().encode(capture.publication).write(to: root.appendingPathComponent("final-observation.json"))
    try JSONEncoder().encode(barrier.observation).write(to: root.appendingPathComponent("primary-before-camera-publication.json"))
    try JSONEncoder().encode(readers.readings).write(to: root.appendingPathComponent("camera-readers.json"))
    try retainClosureFacts(input, in: folder)
    guard barrier.released, let observed = barrier.observation, case .published(let primary) = observed.primary else {
        throw CaptureFailure("SOURCE_PUBLICATION_SERIALIZED", "Primary must become usable before independent camera publication completes.")
    }
    precondition(primary.sourceId == "overlap-primary" && primary.sourceDurationUs > 0
        && primary.originHostUs == input.fixtureOrigin && primary.diagnostic == nil)
    let recovered = try await CapturePublishedSource.recover(directory: folder.path)
    let recoveredCamera = try await CapturePublishedSource.recover(directory: cameraDirectory.path)
    precondition(recovered.journal == primary.journal && recovered.sourceId == primary.sourceId
        && recoveredCamera.binding == input.cameraBinding && recoveredCamera.diagnostic == nil)
    precondition(result.failure == nil && result.camera?.failure == nil && capture.deviceState == "idle"
        && input.stops == 1 && input.finalizations == 1 && input.discards == 0)
    print("PASS durable primary becomes usable before camera publication completes; both sources recover after joined closure")
    try await cameraBeforePrimaryPublication(root: root, source: source)
}

@MainActor
private func cameraBeforePrimaryPublication(root: URL, source: URL) async throws {
    let audio = try captureMaterializerFixture(in: root, name: "audio-input", accepted: 96000)
    let folder = root.appendingPathComponent("primary-reader-pending")
    let input = PrerecordedCaptureInput(source: source)
    input.probeDirectory = folder
    input.cameraBinding = CameraCaptureBinding(recordingId: "camera-overlap-take", sourceId: "camera-overlap-source", deviceId: "prerecorded-camera")
    input.audio = audio.appendingPathComponent("narration.packed.mov")
    input.videoDeliveryInterval = .milliseconds(10)
    let barrier = SourcePublicationBarrier(kind: .camera)
    let readers = try CameraReaderStarts(directory: folder, beforeReading: { url in
        if url.lastPathComponent == "narration.packed.mov" { barrier.hold() }
    })
    defer { readers.restore() }
    let capture = NativeCapture(prepareInput: { _, _ in input })
    capture.onPublication = { report in
        // Match the app observer: reporting either source also appends take lifecycle evidence.
        capture.note("finalizing", reason: "SOURCE_PUBLICATION_OBSERVED")
        barrier.observe(report)
    }
    let request = CaptureRequest(source: CaptureSource(kind: "offline-prerecorded"),
        outputDirectory: folder.path, sourceId: "camera-overlap-primary", microphone: true)
    try await capture.start(request)
    let result = try await capture.stop()
    try JSONEncoder().encode(request).write(to: folder.appendingPathComponent("request.json"))
    try JSONEncoder().encode(result).write(to: folder.appendingPathComponent("native-result.json"))
    try JSONEncoder().encode(capture.publication).write(to: folder.appendingPathComponent("final-observation.json"))
    try JSONEncoder().encode(barrier.observation).write(to: folder.appendingPathComponent("camera-before-primary-publication.json"))
    try JSONEncoder().encode(readers.readings).write(to: folder.appendingPathComponent("source-readers.json"))
    try retainClosureFacts(input, in: folder)
    guard barrier.released, let observed = barrier.observation, case .published(let camera) = observed.camera else {
        throw CaptureFailure("SOURCE_PUBLICATION_SERIALIZED", "Camera must become usable before independent primary audio publication completes.")
    }
    let primary = try await CapturePublishedSource.recover(directory: folder.path)
    let recoveredCamera = try await CapturePublishedSource.recover(directory: folder.appendingPathComponent("camera").path)
    precondition(primary.sourceId == "camera-overlap-primary" && primary.diagnostic == nil
        && recoveredCamera.journal == camera.journal && recoveredCamera.binding == input.cameraBinding
        && camera.sourceDurationUs > 0 && camera.originHostUs == input.fixtureOrigin && camera.diagnostic == nil)
    precondition(result.failure == nil && result.camera?.failure == nil && capture.deviceState == "idle"
        && input.stops == 1 && input.finalizations == 1 && input.discards == 0)
    print("PASS durable camera becomes usable before primary audio publication completes; lifecycle suffixes and both source proofs recover")
}
