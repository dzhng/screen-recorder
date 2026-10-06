@preconcurrency import AVFoundation
import CoreGraphics
import Foundation
import CryptoKit
@preconcurrency import ScreenCaptureKit
import YapCapture
import YapMedia

@MainActor
func runSelectedCameraInputTests(output: String? = nil) async throws {
    let root = output.map { URL(fileURLWithPath: $0) } ?? RecoveryFixture.directory("selected-camera-input")
    if output != nil { try FileManager.default.createDirectory(at: root, withIntermediateDirectories: false) }
    defer { if output == nil { try? FileManager.default.removeItem(at: root) } }
    let screenSource = root.appendingPathComponent("screen-input.mov")
    let cameraSource = root.appendingPathComponent("camera-input.mov")
    try await RecoveryFixture.writeVariableDurationVideo(to: screenSource,
        timesUs: [0, 100000, 200000, 500000, 700000], endUs: 800000)
    try await RecoveryFixture.writeVariableDurationVideo(to: cameraSource,
        timesUs: [0, 100000, 200000], endUs: 300000)
    let audioFolder = try captureMaterializerFixture(in: root, name: "audio-input", accepted: 96000)
    for mode in ["selected", "both-audio"] {
        let folder = root.appendingPathComponent(mode)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: false)
        let screen = PrerecordedCaptureInput(source: screenSource)
        screen.cursorFixture = true
        if mode == "both-audio" { screen.audio = audioFolder.appendingPathComponent("narration.packed.mov"); screen.audioRoles = [.microphone, .audio] }
        let wrong = FixtureCameraDevice("other", session: FixtureCameraSession(source: screenSource, origin: { screen.fixtureOrigin! }))
        let chosen = FixtureCameraDevice("chosen", session: FixtureCameraSession(source: cameraSource, origin: { screen.fixtureOrigin! }))
        var preparation = CaptureInputPreparation()
        preparation.requireScreenAuthorization = { _ in }
        preparation.prepareScreen = { _ in screen }
        preparation.cameraAuthorized = { true }
        preparation.cameras = { [wrong, chosen] }
        let capture = NativeCapture(prepareInput: { [preparation] request, check in
            try await preparation.prepare(request, camera: CaptureCameraSelection(id: "chosen",
                directory: folder.appendingPathComponent("camera"), observations: folder.appendingPathComponent("timestamps.jsonl")), checkInterruption: check)
        })
        try await capture.start(CaptureRequest(source: CaptureSource(kind: "offline-prerecorded"),
            outputDirectory: folder.appendingPathComponent("screen").path, microphone: mode == "both-audio", systemAudio: mode == "both-audio"))
        let result = try await capture.stop()
        precondition(result.state == "complete" && result.failure == nil, "Requested routed capture must complete: \(String(describing: result.failure))")
        precondition(result.camera?.state == "complete" && result.camera?.failure == nil)
        precondition(result.camera?.tracks.first?.firstSampleUs == 200000)
        precondition(result.camera?.tracks.first?.samples == 3)
        precondition(result.cursor.sampled == 1 && screen.cursorSamplingStarts == 1, "Ordinary selected input must forward cursor sampling")
        precondition(wrong.opens == 0 && wrong.session.starts == 0 && chosen.opens == 1 && chosen.session.starts == 1 && chosen.session.stops == 1)
        let cameraTimes = await RecoveryFixture.decodedPresentationMicroseconds(of: folder.appendingPathComponent("camera/video.mov"))
        precondition(cameraTimes.filter { $0 >= 200000 } == [200000, 300000, 400000], "The exact selected fixture must survive independent publication")
        var cursorSamples: [CursorSample] = []
        let screenJournal = try CaptureJournal.readEvidence(directory: folder.appendingPathComponent("screen").path,
            maximumBytes: nil, retainTiming: true, geometry: { _ in }, samples: { cursorSamples.append(contentsOf: $0) }, displaySpace: { _ in }, layout: 2)
        precondition(screenJournal.finished && cursorSamples.count == 1)
        let cursor = cursorSamples[0]
        precondition(cursor.sourceUs == 150000 && cursor.globalX == 50 && cursor.globalY == 40 && cursor.buttons == 0)
        if mode == "both-audio" {
            var hash = SHA256(); hash.update(data: Data("yap.capture-pcm.v1\0".utf8))
            for value in [screen.expectedRate, screen.expectedChannels] {
                var little = value.littleEndian
                hash.update(data: withUnsafeBytes(of: &little) { Data($0) })
            }
            hash.update(data: screen.expectedPCM)
            let expected = hash.finalize().map { String(format: "%02x", $0) }.joined()
            var receipts: [CaptureAudioPublication.Receipt] = []
            for role in ["narration", "system"] {
                let receipt = try JSONDecoder().decode(CaptureAudioPublication.Receipt.self,
                    from: Data(contentsOf: folder.appendingPathComponent("screen/\(role).publication.json")))
                precondition(receipt.pcmSHA256 == expected && receipt.acceptedFrames == receipt.representedFrames)
                receipts.append(receipt)
            }
            precondition(receipts[0].supportSHA256 == receipts[1].supportSHA256)
            let rows = try String(contentsOf: folder.appendingPathComponent("timestamps.jsonl"), encoding: .utf8)
                .split(separator: "\n").map { try JSONSerialization.jsonObject(with: Data($0.utf8)) as! [String: Any] }
            precondition(Set(rows.compactMap { $0["role"] as? String }) == Set(["screen", "camera", "microphone", "system"]))
        }
        try JSONEncoder().encode(result).write(to: folder.appendingPathComponent("native-result.json"))
        print("PASS \(mode): exact selected camera, independent native timing, cursor and requested audio routing")
    }
    try await verifyCameraAcquisition(root: root, source: screenSource)
    try await verifyDiscardedStartup(root: root, screenSource: screenSource, cameraSource: cameraSource)
    try await verifySelectedLifecycle(root: root, screenSource: screenSource, cameraSource: cameraSource)
    try await verifyDiscardedPreparation(root: root, screenSource: screenSource, cameraSource: cameraSource)
    try await verifyWriterRefusal(root: root, screenSource: screenSource, cameraSource: cameraSource)
    try await runCaptureStreamInputTests(root: root)

}


@MainActor
private func verifyCameraAcquisition(root: URL, source: URL) async throws {
    for mode in ["omitted", "denied", "screen-denied", "absent", "disappeared", "empty-selection"] {
        let folder = root.appendingPathComponent(mode)
        let screen = PrerecordedCaptureInput(source: source)
        let device = FixtureCameraDevice("selected", session: FixtureCameraSession(source: source, origin: { screen.fixtureOrigin! }))
        device.unavailable = mode == "disappeared"
        var cameraChecks = 0, discoveries = 0, screenPreparations = 0
        var preparation = CaptureInputPreparation()
        preparation.requireScreenAuthorization = { _ in
            if mode == "screen-denied" { throw CaptureFailure("PERMISSION_REQUIRED", "Fixture screen permission denied") }
        }
        preparation.prepareScreen = { _ in screenPreparations += 1; return screen }
        preparation.cameraAuthorized = { cameraChecks += 1; return mode != "denied" }
        preparation.cameras = { discoveries += 1; return mode == "absent" ? [] : [device] }
        let capture = NativeCapture(prepareInput: { [preparation] request, check in
            try await preparation.prepare(request, camera: mode == "omitted" ? nil : CaptureCameraSelection(
                id: mode == "empty-selection" ? "" : "selected", directory: folder.appendingPathComponent("camera"),
                observations: folder.appendingPathComponent("timestamps.jsonl")), checkInterruption: check)
        })
        let request = CaptureRequest(source: CaptureSource(kind: "offline-prerecorded"),
            outputDirectory: folder.path, microphone: false, systemAudio: false)
        if mode == "omitted" {
            try await capture.start(request)
            let result = try await capture.stop()
            precondition(result.state == "complete" && result.camera == nil && cameraChecks == 0 && discoveries == 0 && device.opens == 0)
            try JSONEncoder().encode(result).write(to: folder.appendingPathComponent("native-result.json"))
        } else {
            do { try await capture.start(request); preconditionFailure("Camera preparation must refuse \(mode)") }
            catch let error as CaptureFailure {
                let expected = mode == "denied" ? "CAMERA_PERMISSION_REQUIRED" : mode == "screen-denied" ? "PERMISSION_REQUIRED" : mode == "empty-selection" ? "INVALID_REQUEST" : "SOURCE_UNAVAILABLE"
                precondition(error.code == expected && capture.deviceState == "idle")
                precondition(!FileManager.default.fileExists(atPath: folder.path), "Refused preparation must create no recording output")
                let evidence = ["code": error.code, "cameraChecks": cameraChecks, "discoveries": discoveries,
                    "screenPreparations": screenPreparations, "openedSelectedDevices": device.opens,
                    "physicalStarts": device.session.starts, "physicalStops": device.session.stops] as [String: Any]
                try JSONSerialization.data(withJSONObject: evidence, options: [.sortedKeys])
                    .write(to: root.appendingPathComponent("\(mode).json"))
            }
            precondition(device.session.starts == 0 && device.session.stops == 0)
            if ["denied", "screen-denied", "empty-selection"].contains(mode) { precondition(discoveries == 0 && device.opens == 0 && screenPreparations == 0) }
            if mode == "absent" { precondition(discoveries == 1 && device.opens == 0 && screenPreparations == 0) }
            if mode == "disappeared" { precondition(discoveries == 1 && device.opens == 1 && screenPreparations == 1) }
        }
        print("PASS camera acquisition \(mode): exact refusal/no fallback and no unauthorized or unselected IO")
    }
}


@MainActor
private func fixturePreparation(screen: PrerecordedCaptureInput, session: FixtureCameraSession) -> CaptureInputPreparation {
    let device = FixtureCameraDevice("chosen", session: session)
    var preparation = CaptureInputPreparation()
    preparation.requireScreenAuthorization = { _ in }
    preparation.prepareScreen = { _ in screen }
    preparation.cameraAuthorized = { true }
    preparation.cameras = { [device] }
    return preparation
}

@MainActor
private func verifyDiscardedStartup(root: URL, screenSource: URL, cameraSource: URL) async throws {
    let oldFolder = root.appendingPathComponent("discarded-startup")
    let newFolder = root.appendingPathComponent("after-discarded-startup")
    for folder in [oldFolder, newFolder] { try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: false) }
    let oldScreen = PrerecordedCaptureInput(source: screenSource)
    let newScreen = PrerecordedCaptureInput(source: screenSource)
    newScreen.cursorFixture = true
    let oldCamera = FixtureCameraSession(source: cameraSource, origin: { oldScreen.fixtureOrigin! })
    let newCamera = FixtureCameraSession(source: cameraSource, origin: { newScreen.fixtureOrigin! })
    oldCamera.holdStart = true
    var inputs = [(oldScreen, oldCamera, oldFolder), (newScreen, newCamera, newFolder)]
    let capture = NativeCapture(prepareInput: { request, check in
        let (screen, camera, folder) = inputs.removeFirst()
        return try await fixturePreparation(screen: screen, session: camera).prepare(request,
            camera: CaptureCameraSelection(id: "chosen", directory: folder.appendingPathComponent("camera"),
                observations: folder.appendingPathComponent("timestamps.jsonl")), checkInterruption: check)
    })
    func request(_ folder: URL) -> CaptureRequest {
        CaptureRequest(source: CaptureSource(kind: "offline-prerecorded"),
            outputDirectory: folder.appendingPathComponent("screen").path, microphone: false, systemAudio: false)
    }
    let oldStartup = Task { try await capture.start(request(oldFolder)) }
    await oldCamera.startEntered.wait()
    do { _ = try await capture.stop(); preconditionFailure("Startup is not ready for publication") }
    catch let error as CaptureFailure { precondition(error.code == "INVALID_STATE") }
    await capture.discard()
    precondition(oldCamera.stops == 1 && oldScreen.stops == 1 && capture.deviceState == "idle")
    try await capture.start(request(newFolder))
    oldCamera.onFailure?(CaptureFailure("STALE_CAMERA", "Discarded device callback"))
    oldCamera.releaseStart.release()
    do { try await oldStartup.value; preconditionFailure("Discarded startup must not become recording") }
    catch let error as CaptureFailure { precondition(error.code == "NATIVE_CAPTURE_FAILED") }
    precondition(capture.deviceState == "recording" && oldCamera.stops == 1 && oldScreen.stops == 1)
    let result = try await capture.stop()
    precondition(result.state == "complete" && result.failure == nil && result.camera?.state == "complete" && result.camera?.tracks.first?.samples == 3)
    precondition(result.cursor.sampled == 1 && newCamera.stops == 1 && newScreen.stops == 1)
    precondition(!FileManager.default.fileExists(atPath: oldFolder.appendingPathComponent("camera/capture-result.json").path))
    try JSONEncoder().encode(result).write(to: newFolder.appendingPathComponent("native-result.json"))
    try JSONSerialization.data(withJSONObject: ["oldInputStops": oldScreen.stops, "oldCameraStops": oldCamera.stops,
        "newInputStops": newScreen.stops, "newCameraStops": newCamera.stops, "state": capture.deviceState], options: [.sortedKeys])
        .write(to: oldFolder.appendingPathComponent("drain-counts.json"))
    print("PASS discarded startup is fenced across await/rollback; stale callback cannot clear or cancel a newer take; physical drain once")
}


@MainActor
private func verifySelectedLifecycle(root: URL, screenSource: URL, cameraSource: URL) async throws {
    for mode in ["screen-start-failure", "camera-start-failure", "interrupted", "pause-resume", "cancel-retry", "discard", "concurrent", "no-camera", "probe-stopped-start"] {
        let folder = root.appendingPathComponent(mode)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: false)
        let screen = PrerecordedCaptureInput(source: screenSource, refusesAfterDelivery: mode == "screen-start-failure")
        screen.cursorFixture = true
        screen.holdStop = ["cancel-retry", "concurrent"].contains(mode)
        let camera = FixtureCameraSession(source: cameraSource, origin: { screen.fixtureOrigin! })
        camera.deliverFrames = mode != "no-camera"
        if mode == "camera-start-failure" { camera.failureAfterDelivery = CaptureFailure("INPUT_START_FAILED", "Fixture camera startup failed") }
        let preparation = fixturePreparation(screen: screen, session: camera)
        let capture = NativeCapture(prepareInput: { request, check in
            try await preparation.prepare(request, camera: CaptureCameraSelection(id: "chosen",
                directory: folder.appendingPathComponent("camera"), observations: folder.appendingPathComponent("timestamps.jsonl")),
                measurement: mode == "probe-stopped-start" ? CameraCaptureMeasurement(framesPerSecond: 24,
                    samplesCursor: false, beforeStart: { false }) : .init(), checkInterruption: check)
        })
        let request = CaptureRequest(source: CaptureSource(kind: "offline-prerecorded"),
            outputDirectory: folder.appendingPathComponent("screen").path, microphone: false, systemAudio: false)
        if mode.hasSuffix("start-failure") {
            do { try await capture.start(request); preconditionFailure("Partial startup must refuse") }
            catch let error as CaptureFailure { precondition(error.code == "INPUT_START_FAILED") }
            precondition(capture.deviceState == "idle" && capture.outputSize == nil && screen.stops == 1 && camera.stops == 1)
            precondition(!FileManager.default.fileExists(atPath: folder.appendingPathComponent("camera/capture-result.json").path))
            try JSONSerialization.data(withJSONObject: ["failure": "INPUT_START_FAILED", "inputStops": screen.stops, "cameraStops": camera.stops], options: [.sortedKeys])
                .write(to: folder.appendingPathComponent("drain-counts.json"))
            print("PASS \(mode): startup rollback drains once and publishes no completed camera")
            continue
        }
        try await capture.start(request)
        if mode == "discard" {
            await capture.discard(); await capture.discard()
            precondition(screen.stops == 1 && camera.stops == 1 && capture.deviceState == "idle")
            precondition(!FileManager.default.fileExists(atPath: folder.appendingPathComponent("camera/capture-result.json").path))
            do { _ = try await capture.stop(); preconditionFailure("Discarded capture must refuse stop") }
            catch let error as CaptureFailure { precondition(error.code == "INVALID_STATE") }
            try JSONSerialization.data(withJSONObject: ["inputStops": screen.stops, "cameraStops": camera.stops, "state": capture.deviceState], options: [.sortedKeys])
                .write(to: folder.appendingPathComponent("drain-counts.json"))
            print("PASS discard: both physical inputs drain once; no camera publication")
            continue
        }
        if mode == "interrupted" {
            let interrupted = InputGate()
            capture.onInterruption = { _ in interrupted.release() }
            camera.onFailure?(CaptureFailure("SOURCE_LOST", "Fixture selected camera interrupted"))
            await interrupted.wait()
        }
        var resumedHost: Int64?
        if mode == "pause-resume" {
            try capture.pause()
            try camera.offer(at: CaptureHostTime.nowUs())
            try await Task.sleep(for: .milliseconds(20))
            try capture.resume()
            resumedHost = CaptureHostTime.nowUs()
            try camera.offer(at: resumedHost!)
        }
        let result: CaptureResult
        if screen.holdStop {
            let first = Task { try await capture.stop() }
            await screen.stopEntered.wait()
            if mode == "cancel-retry" {
                capture.cancelPublication(); screen.releaseStop.release()
                do { _ = try await first.value; preconditionFailure("Publication must observe cancellation") }
                catch is CancellationError {}
                let raw = try Data(contentsOf: folder.appendingPathComponent("camera/camera.raw.mov"))
                do { _ = try CaptureJournalLease(directory: folder.appendingPathComponent("camera").path); preconditionFailure("Closed snapshot must retain its lease") }
                catch let error as CaptureFailure { precondition(error.code == "CAPTURE_BUSY") }
                result = try await capture.stop()
                let retained = try Data(contentsOf: folder.appendingPathComponent("camera/camera.raw.mov"))
                precondition(raw == retained, "Retry must not refinish camera encoding")
            } else {
                let second = Task { try await capture.stop() }
                let discard = Task { await capture.discard() }
                await Task.yield()
                screen.releaseStop.release()
                result = try await first.value
                let joined = try await second.value
                await discard.value
                precondition(joined.hostOriginUs == result.hostOriginUs && joined.durationUs == result.durationUs && joined.camera?.durationUs == result.camera?.durationUs)
            }
        } else { result = try await capture.stop() }
        precondition(screen.stops == 1 && camera.stops == 1 && capture.deviceState == "idle")
        if ["no-camera", "probe-stopped-start"].contains(mode) {
            precondition(result.state == "interrupted" && result.failure?.code == "NO_CAMERA" && result.camera?.failure?.code == "NO_CAMERA" && result.camera?.tracks.isEmpty == true)
            if mode == "probe-stopped-start" { precondition(camera.starts == 0 && result.cursor.sampled == 0 && screen.cursorSamplingStarts == 0) }
        } else {
            precondition(result.camera?.tracks.first?.samples == (mode == "pause-resume" ? 4 : 3))
            precondition(result.state == (mode == "interrupted" ? "interrupted" : "complete"))
            precondition(result.failure?.code == (mode == "interrupted" ? "SOURCE_LOST" : nil))
            let rows = try String(contentsOf: folder.appendingPathComponent("camera/capture.journal.jsonl"), encoding: .utf8).split(separator: "\n")
            let terminal = try rows.filter { (try JSONSerialization.jsonObject(with: Data($0.utf8)) as! [String: Any])["event"] as? String == "finished" }
            precondition(terminal.count == 1, "Joined/retried termination must record one camera completion")
            _ = try await assertProbePresentation(directory: folder.appendingPathComponent("camera"), observations: folder.appendingPathComponent("timestamps.jsonl"))
        }
        if let resumedHost {
            precondition(result.pauses.count == 1 && result.camera?.pauses == result.pauses)
            let rows = try String(contentsOf: folder.appendingPathComponent("timestamps.jsonl"), encoding: .utf8).split(separator: "\n")
                .map { try JSONSerialization.jsonObject(with: Data($0.utf8)) as! [String: Any] }
                .filter { $0["role"] as? String == "camera" }
            precondition(rows.filter { $0["disposition"] as? String == "outside-support" }.count == 1)
            let expected = resumedHost - result.hostOriginUs! - result.pauses[0].elapsedPauseUs
            precondition(rows.last?["sourceUs"] as? Int64 == expected && result.camera?.tracks.first?.omittedSamples == 1)
        }
        try JSONEncoder().encode(result).write(to: folder.appendingPathComponent("native-result.json"))
        try JSONSerialization.data(withJSONObject: ["inputStops": screen.stops, "cameraStops": camera.stops, "state": capture.deviceState], options: [.sortedKeys])
            .write(to: folder.appendingPathComponent("drain-counts.json"))
        do { _ = try await capture.stop(); preconditionFailure("Settled termination must not close again") }
        catch let error as CaptureFailure { precondition(error.code == "INVALID_STATE") }
        await capture.discard()
        precondition(screen.stops == 1 && camera.stops == 1)
        print("PASS \(mode): shared NativeCapture lifecycle, truthful camera source and single physical drain")
    }
}


@MainActor
private func verifyDiscardedPreparation(root: URL, screenSource: URL, cameraSource: URL) async throws {
    for mode in ["discarded-preparation", "canceled-preparation", "returned-preparation"] {
        let oldFolder = root.appendingPathComponent(mode)
        let newFolder = root.appendingPathComponent("after-\(mode)")
        for folder in [oldFolder, newFolder] { try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: false) }
        let oldScreen = PrerecordedCaptureInput(source: screenSource)
        let newScreen = PrerecordedCaptureInput(source: screenSource)
        let oldDevice = FixtureCameraDevice("chosen", session: FixtureCameraSession(source: cameraSource, origin: { oldScreen.fixtureOrigin! }))
        let newCamera = FixtureCameraSession(source: cameraSource, origin: { newScreen.fixtureOrigin! })
        let entered = InputGate(), release = InputGate()
        var oldPreparation = CaptureInputPreparation()
        oldPreparation.requireScreenAuthorization = { _ in }
        oldPreparation.cameraAuthorized = { true }
        oldPreparation.cameras = { [oldDevice] }
        oldPreparation.prepareScreen = { _ in entered.release(); await release.wait(); return oldScreen }
        var first = true
        let capture = NativeCapture(prepareInput: { [oldPreparation] request, check in
            let old = first; first = false
            if old && mode == "returned-preparation" { entered.release(); await release.wait(); return oldScreen }
            let folder = old ? oldFolder : newFolder
            let preparation = old ? oldPreparation : fixturePreparation(screen: newScreen, session: newCamera)
            return try await preparation.prepare(request, camera: CaptureCameraSelection(id: "chosen",
                directory: folder.appendingPathComponent("camera"), observations: folder.appendingPathComponent("timestamps.jsonl")), checkInterruption: check)
        })
        func request(_ folder: URL) -> CaptureRequest { CaptureRequest(source: CaptureSource(kind: "offline-prerecorded"),
            outputDirectory: folder.appendingPathComponent("screen").path, microphone: false, systemAudio: false) }
        let oldStartup = Task { try await capture.start(request(oldFolder)) }
        await entered.wait()
        if mode == "canceled-preparation" { oldStartup.cancel() }
        await capture.discard()
        precondition(capture.deviceState == "idle", "Discard must invalidate preparation before a writer exists")
        try await capture.start(request(newFolder))
        release.release()
        do { try await oldStartup.value; preconditionFailure("Obsolete preparation must refuse startup") }
        catch is CancellationError {}
        catch let error as CaptureFailure { precondition(error.code == "NATIVE_CAPTURE_FAILED") }
        precondition(oldDevice.opens == 0 && oldDevice.session.starts == 0 && oldDevice.session.stops == 0)
        precondition(oldScreen.offeredVideoFrames == 0 && oldScreen.stops == 1 && oldScreen.discards == 1,
            "Obsolete prepared resources must be released locally without starting a writer")
        precondition(!FileManager.default.fileExists(atPath: oldFolder.appendingPathComponent("screen").path)
            && !FileManager.default.fileExists(atPath: oldFolder.appendingPathComponent("camera").path))
        let result = try await capture.stop()
        precondition(result.state == "complete" && result.failure == nil && result.camera?.tracks.first?.samples == 3 && newCamera.stops == 1)
        try JSONEncoder().encode(result).write(to: newFolder.appendingPathComponent("native-result.json"))
        try JSONSerialization.data(withJSONObject: ["oldDeviceOpens": oldDevice.opens, "oldCameraStarts": oldDevice.session.starts,
            "oldCameraStops": oldDevice.session.stops, "newCameraStops": newCamera.stops, "state": capture.deviceState], options: [.sortedKeys])
            .write(to: oldFolder.appendingPathComponent("preparation-counts.json"))
        print("PASS \(mode): generation ends before writer; obsolete lookup cannot open selected IO or overwrite newer take")
    }
}


@MainActor
private func verifyWriterRefusal(root: URL, screenSource: URL, cameraSource: URL) async throws {
    for held in [false, true] {
        let folder = root.appendingPathComponent(held ? "writer-refusal-generation" : "writer-refusal")
        let newFolder = root.appendingPathComponent("after-writer-refusal")
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: false)
        if held { try FileManager.default.createDirectory(at: newFolder, withIntermediateDirectories: false) }
        let occupied = folder.appendingPathComponent("screen")
        let bytes = Data("occupied output path".utf8)
        try bytes.write(to: occupied)
        let screen = PrerecordedCaptureInput(source: screenSource)
        let camera = FixtureCameraSession(source: cameraSource, origin: { screen.fixtureOrigin! })
        camera.holdStop = held
        let newScreen = PrerecordedCaptureInput(source: screenSource)
        let newCamera = FixtureCameraSession(source: cameraSource, origin: { newScreen.fixtureOrigin! })
        let preparation = fixturePreparation(screen: screen, session: camera)
        let capture = NativeCapture(prepareInput: { request, check in
            let old = request.outputDirectory == occupied.path
            let selected = old ? preparation : fixturePreparation(screen: newScreen, session: newCamera)
            let directory = old ? folder : newFolder
            return try await selected.prepare(request, camera: CaptureCameraSelection(id: "chosen",
                directory: directory.appendingPathComponent("camera"), observations: directory.appendingPathComponent("timestamps.jsonl")), checkInterruption: check)
        })
        let startup = Task { try await capture.start(CaptureRequest(source: CaptureSource(kind: "offline-prerecorded"),
            outputDirectory: occupied.path, microphone: false, systemAudio: false)) }
        if held {
            await camera.stopEntered.wait()
            await capture.discard()
            try await capture.start(CaptureRequest(source: CaptureSource(kind: "offline-prerecorded"),
                outputDirectory: newFolder.appendingPathComponent("screen").path, microphone: false, systemAudio: false))
            camera.releaseStop.release()
        }
        do { try await startup.value; preconditionFailure("Occupied writer destination must refuse") }
        catch {
            precondition(screen.stops == 1 && camera.stops == 1,
                "Writer-init refusal must release prepared resources once")
            if !held { precondition(capture.deviceState == "idle" && capture.outputSize == nil,
                "Writer-init refusal must publish no output size") }
        }
        precondition(camera.starts == 0 && screen.offeredVideoFrames == 0 && !FileManager.default.fileExists(atPath: folder.appendingPathComponent("camera").path))
        let retained = try Data(contentsOf: occupied)
        precondition(retained == bytes)
        if held {
            precondition(capture.deviceState == "recording" && capture.outputSize?.width == newScreen.width)
            let result = try await capture.stop()
            precondition(result.state == "complete" && result.failure == nil && result.camera?.tracks.first?.samples == 3 && newCamera.stops == 1)
            try JSONEncoder().encode(result).write(to: newFolder.appendingPathComponent("native-result.json"))
        }
        try JSONSerialization.data(withJSONObject: ["inputStops": screen.stops, "cameraStops": camera.stops,
            "cameraStarts": camera.starts, "state": capture.deviceState], options: [.sortedKeys])
            .write(to: folder.appendingPathComponent("drain-counts.json"))
        print("PASS writer refusal\(held ? " across new generation" : ""): local resource cleanup once, no activation/output overwrite or newer-take mutation")
    }
}
