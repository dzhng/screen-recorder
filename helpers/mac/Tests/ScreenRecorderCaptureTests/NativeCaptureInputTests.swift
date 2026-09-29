@preconcurrency import AVFoundation
import Foundation
import CryptoKit
import ScreenCaptureKit
import ScreenRecorderCapture
import ScreenRecorderMedia
import ScreenRecorderWire

@MainActor
func runNativeCaptureInputTests() async throws {
    let root = RecoveryFixture.directory("native-prerecorded-input")
    defer { try? FileManager.default.removeItem(at: root) }
    let source = root.appendingPathComponent("input.mov")
    try await RecoveryFixture.writeVariableDurationVideo(to: source,
        timesUs: [0, 100_000, 200_000], endUs: 300_000)
    let failed = PrerecordedCaptureInput(source: source, refusesAfterDelivery: true)
    let healthy = PrerecordedCaptureInput(source: source)
    var inputs = [failed, healthy]
    let capture = NativeCapture(prepareInput: { _ in inputs.removeFirst() })
    func request(_ name: String) -> CaptureRequest {
        CaptureRequest(source: CaptureSource(kind: "offline-prerecorded"),
            outputDirectory: root.appendingPathComponent(name).path, microphone: false, systemAudio: false)
    }
    do { try await capture.start(request("failed")); preconditionFailure("Partial input must refuse") }
    catch let error as CaptureFailure { precondition(error.code == "INPUT_START_FAILED") }
    precondition(failed.stops == 1 && capture.deviceState == "idle")
    try await capture.start(request("healthy"))
    failed.onFailure?(CaptureFailure("STALE_DEVICE_LOSS", "Old input callback"))
    await Task.yield()
    precondition(capture.deviceState == "recording")
    let result = try await capture.stop()
    precondition(result.state == "complete" && result.failure == nil && healthy.stops == 1)
    precondition(result.cursor.sampled == 0, "Prerecorded input cannot acquire the live cursor")
    let recovered = try await MediaRecovery.recover(directory: root.appendingPathComponent("healthy").path)
    precondition(recovered.journalFailure == nil)
    precondition(recovered.durationUs == result.durationUs && result.durationUs >= 300_000)
    precondition(capture.deviceState == "idle")
    print("PASS actual NativeCapture closes prerecorded writer, tears down partial input, ignores stale generation, and acquires no live cursor")
}


@MainActor
func runNativeCapturePublicationProbe(output: String, corpus: String) async throws {
    let root = URL(fileURLWithPath: output)
    let child = ProcessInfo.processInfo.environment["SCREENREC_NATIVE_PUBLICATION_CHILD"] == "1"
    let video = root.appendingPathComponent("input.mov")
    if !child {
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: false)
        try await RecoveryFixture.writeVariableDurationVideo(to: video,
            timesUs: [0, 500000, 1500000, 2300000], endUs: 2500000)
    }
    var supportHashes: [String] = []
    var normalPCMHash: String?
    for mode in child ? ["interrupted-before-publication"] : ["normal", "retry-before-publication", "interrupted-before-publication", "publication-conflict", "unreadable-packed", "requested-missing"] {
        let folder = root.appendingPathComponent(mode)
        let input = PrerecordedCaptureInput(source: video)
        if mode != "requested-missing" {
            input.audio = URL(fileURLWithPath: corpus).appendingPathComponent("a-audio.wav")
            input.omittedAudioBuffer = 4
            input.audioRoles = [.microphone, .audio]
        }
        input.holdStop = ["interrupted-before-publication", "retry-before-publication", "unreadable-packed"].contains(mode)
        let crashedChild = mode == "interrupted-before-publication" && !child
        if crashedChild {
            let process = Process()
            process.executableURL = URL(fileURLWithPath: CommandLine.arguments[0])
            var environment = ProcessInfo.processInfo.environment
            environment["SCREENREC_NATIVE_PUBLICATION_CHILD"] = "1"
            process.environment = environment
            try process.run()
            process.waitUntilExit()
            precondition(process.terminationStatus == 0, "Interrupted writer child must close before recovery")
        } else {
            var capture: NativeCapture? = NativeCapture(prepareInput: { _ in input })
            try await capture!.start(CaptureRequest(source: CaptureSource(kind: "offline-prerecorded"),
                outputDirectory: folder.path, sourceId: mode, microphone: true, systemAudio: true))
            if input.holdStop {
                let stopping = Task { [active = capture!] in try await active.stop() }
                await input.stopEntered.wait()
                capture!.cancelPublication()
                input.releaseStop.release()
                do { _ = try await stopping.value; preconditionFailure("Publication should observe cancellation after encoder closure") }
                catch is CancellationError {}
                do { _ = try await MediaRecovery.recover(directory: folder.path); preconditionFailure("Failed publication retains retry authority") }
                catch let error as CaptureFailure { precondition(error.code == "CAPTURE_BUSY") }
                if child {
                    // Exiting this owned process, rather than dropping an ARC reference, models abandoned ownership.
                    return
                }
                if mode == "unreadable-packed" {
                    try Data("corrupted immutable packed media".utf8).write(to: folder.appendingPathComponent("narration.packed.mov"))
                }
                let retried: CaptureResult
                do { retried = try await capture!.stop() }
                catch {
                    let native = error as NSError
                    try JSONSerialization.data(withJSONObject: ["domain": native.domain, "code": native.code,
                        "description": native.localizedDescription, "underlying": String(describing: native.userInfo[NSUnderlyingErrorKey])], options: [.prettyPrinted])
                        .write(to: folder.appendingPathComponent("publication-error.json"))
                    throw error
                }
                precondition(retried.state == (mode == "unreadable-packed" ? "interrupted" : "complete"))
                try JSONEncoder().encode(retried).write(to: folder.appendingPathComponent("capture-result.json"))
                capture = nil
            } else {
                if mode == "publication-conflict" {
                    try Data("occupied canonical name".utf8).write(to: folder.appendingPathComponent("narration.mov"))
                }
                let result = try await capture!.stop()
                try JSONEncoder().encode(result).write(to: folder.appendingPathComponent("capture-result.json"))
                precondition(result.state == (["requested-missing", "publication-conflict"].contains(mode) ? "interrupted" : "complete"))
                if mode == "publication-conflict" { precondition(result.failure?.code == "PUBLICATION_CONFLICT") }
                if mode == "requested-missing" { precondition(result.failure?.code == "NO_NARRATION") }
                else {
                    for track in result.tracks where track.role != "video" {
                        precondition(track.samples == input.offeredAudioBuffers && track.droppedSamples == 0)
                    }
                }
                precondition(result.cursor.sampled == 0)
                capture = nil
            }
        }
        let recovered = try await MediaRecovery.recover(directory: folder.path)
        try JSONEncoder().encode(recovered).write(to: folder.appendingPathComponent("recovery.json"))
        precondition(recovered.durationUs >= 2500000 || mode == "requested-missing")
        if mode == "requested-missing" {
            precondition(recovered.tracks.filter { $0.role != "video" }.allSatisfy { $0.failure?.code == "AUDIO_UNAVAILABLE" && $0.intervals.isEmpty })
            continue
        }
        var expected = SHA256()
        expected.update(data: Data("screenrec.capture-pcm.v1\0".utf8))
        for value in [input.expectedRate, input.expectedChannels] {
            var little = value.littleEndian
            expected.update(data: withUnsafeBytes(of: &little) { Data($0) })
        }
        expected.update(data: input.expectedPCM)
        let offeredHash = expected.finalize().map { String(format: "%02x", $0) }.joined()
        if mode == "normal" { normalPCMHash = offeredHash }
        let expectedHash = crashedChild ? normalPCMHash! : offeredHash
        if ["publication-conflict", "unreadable-packed"].contains(mode) {
            precondition(recovered.tracks.first { $0.role == "narration" }!.failure?.code == (mode == "publication-conflict" ? "PUBLICATION_CONFLICT" : "PACKED_MEDIA_INVALID"))
            precondition(recovered.tracks.first { $0.role == "video" }!.intervals.isEmpty == false)
            let retainedConflict = try Data(contentsOf: folder.appendingPathComponent(mode == "publication-conflict" ? "narration.mov" : "narration.packed.mov"))
            precondition(retainedConflict == Data((mode == "publication-conflict" ? "occupied canonical name" : "corrupted immutable packed media").utf8))
        }
        for role in ["publication-conflict", "unreadable-packed"].contains(mode) ? ["system"] : ["narration", "system"] {
            let receipt = try JSONDecoder().decode(CaptureAudioPublication.Receipt.self,
                from: Data(contentsOf: folder.appendingPathComponent("\(role).publication.json")))
            precondition(receipt.pcmSHA256 == expectedHash, "Canonical PCM must equal independently decoded offered samples excluding the known omission")
            precondition(receipt.acceptedFrames == receipt.representedFrames)
            supportHashes.append(receipt.supportSHA256)
            precondition(recovered.tracks.first { $0.role == role }!.intervals.count == 2)
        }
    }
    precondition(Set(supportHashes).count == 1, "Normal and interrupted recovery preserve the same admitted source support")
    print("PASS actual NativeCapture normal/interrupted publication preserves independent PCM, both roles, exact shared support and requested-missing refusal")
}
