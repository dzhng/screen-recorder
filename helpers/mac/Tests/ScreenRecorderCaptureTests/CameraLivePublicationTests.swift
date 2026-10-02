@preconcurrency import AVFoundation
import Foundation
import Darwin
import ObjectiveC
import Synchronization
import ScreenRecorderCapture
import ScreenRecorderMedia

/// Delegates the SDK call unchanged; the retry case faults receipt staging through filesystem permissions.
private final class CameraReaderStarts: @unchecked Sendable {
    private struct Counts: Sendable { var raw = 0; var canonical = 0; var active = 0; var blocked = 0 }
    private final class Counter: Sendable { let values = Mutex(Counts()) }
    private let counter = Counter()
    private let method: Method
    private let original: IMP
    private let replacement: IMP
    init(blockPublicationIn directory: URL? = nil) throws {
        guard let method = class_getInstanceMethod(AVAssetReader.self, #selector(AVAssetReader.startReading)),
            let encoding = method_getTypeEncoding(method), String(cString: encoding) == "B16@0:8" else {
            throw CaptureFailure("UNSUPPORTED_OBSERVATION", "Unexpected SDK startReading ABI.")
        }
        self.method = method; original = method_getImplementation(method)
        typealias Start = @convention(c) (AnyObject, Selector) -> Bool
        let forward = unsafeBitCast(original, to: Start.self)
        let counter = self.counter
        let callback: @convention(block) (AVAssetReader) -> Bool = { reader in
            counter.values.withLock { $0.active += 1 }
            let started = forward(reader, #selector(AVAssetReader.startReading))
            if started, let asset = reader.asset as? AVURLAsset {
                counter.values.withLock { state in
                    if asset.url.lastPathComponent == "camera.raw.mov" { state.raw += 1 }
                    if asset.url.lastPathComponent == "camera.mov" {
                        state.canonical += 1
                        if let directory, state.blocked == 0,
                            FileManager.default.fileExists(atPath: directory.appendingPathComponent("camera.closed.json").path),
                            chmod(directory.path, 0o500) == 0 { state.blocked = 1 }
                    }
                }
            }
            counter.values.withLock { $0.active -= 1 }
            return started
        }
        replacement = imp_implementationWithBlock(callback)
        method_setImplementation(method, replacement)
    }
    var observed: [String: Int] { counter.values.withLock { ["raw": $0.raw, "canonical": $0.canonical, "active": $0.active, "blocked": $0.blocked] } }
    func restore() {
        precondition(counter.values.withLock { $0.active == 0 })
        precondition(method_getImplementation(method) == replacement)
        method_setImplementation(method, original)
        precondition(method_getImplementation(method) == original)
        imp_removeBlock(replacement)
    }
}

/// The device boundary is offline; NativeCapture owns real encoding, closure and publication.
@MainActor
func runCameraLivePublicationTests(output: String? = nil) async throws {
    let root = output.map { URL(fileURLWithPath: $0) } ?? FileManager.default.temporaryDirectory
        .appendingPathComponent("screenrec-camera-live-\(UUID().uuidString)")
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: false)
    defer { if output == nil { try? FileManager.default.removeItem(at: root) } }
    try await runCameraLivePublicationTest(output: root.appendingPathComponent("identity").path)
    try await runCameraLivePublicationTest(output: root.appendingPathComponent("delayed").path, firstCameraAfterPrimary: true)
    try await runCameraLivePublicationTest(output: root.appendingPathComponent("retry").path, changedCandidateRetry: true)
    try await runCameraLivePublicationTest(output: root.appendingPathComponent("discard").path, discardBeforeStop: true)
    try await runCameraLivePublicationTest(output: root.appendingPathComponent("terminal").path, invalidClosedMarker: true)
}

@MainActor
private func runCameraLivePublicationTest(output: String, firstCameraAfterPrimary: Bool = false,
    changedCandidateRetry: Bool = false, discardBeforeStop: Bool = false,
    invalidClosedMarker: Bool = false) async throws {
    let root = URL(fileURLWithPath: output)
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: false)
    let fixture = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
        .appendingPathComponent("fixtures/camera-visible32.mov")
    let input = PrerecordedCaptureInput(source: fixture, size: CGSize(width: 32, height: 16))
    input.cameraPrologueEnabled = !firstCameraAfterPrimary
    input.probeDirectory = root
    let capture = NativeCapture(prepareInput: { _, _ in input })
    let camera = root.appendingPathComponent("camera")
    let readers = try CameraReaderStarts(blockPublicationIn: changedCandidateRetry ? camera : nil)
    defer { _ = chmod(camera.path, 0o700); readers.restore() }
    do {
        try await capture.start(CaptureRequest(source: CaptureSource(kind: "offline-prerecorded"),
            outputDirectory: root.appendingPathComponent("screen").path))
        let sample = input.finalCameraSample!
        let ingress = input.probe!
        // Preserve the source image; only explicit callback clocks extend the authored take.
        for at in stride(from: Int64(300_000), through: 7_300_000, by: 33_333) {
            let next = try captureFixtureRetimed(sample,
                at: time(microseconds: input.fixtureOrigin! + at))
            ingress.writer.queue.sync { _ = ingress.accept(next, role: .camera, from: CMClockGetHostTimeClock()) }
            try await Task.sleep(for: .milliseconds(5))
        }
        input.finalCameraSample = nil
        func candidates() throws -> [String] {
            try FileManager.default.contentsOfDirectory(atPath: camera.path)
                .filter { $0.hasPrefix(".screenrec-output-") }
                .map { camera.appendingPathComponent($0).appendingPathComponent("camera.mov").path }
                .filter { FileManager.default.fileExists(atPath: $0) }
        }
        let deadline = ContinuousClock.now.advanced(by: .seconds(5))
        while (try candidates().isEmpty || readers.observed["canonical"] == 0) && ContinuousClock.now < deadline {
            try await Task.sleep(for: .milliseconds(10))
        }
        let activeCandidates = try candidates()
        let proof: [String: Any] = ["deviceState": capture.deviceState,
            "privateCandidates": activeCandidates, "readerStarts": readers.observed,
            "publicCanonicalExists": FileManager.default.fileExists(atPath: camera.appendingPathComponent("video.mov").path)]
        try JSONSerialization.data(withJSONObject: proof, options: [.sortedKeys, .prettyPrinted])
            .write(to: root.appendingPathComponent("before-stop.json"))
        var before = stat()
        if let candidate = activeCandidates.first, lstat(candidate, &before) == 0,
            before.st_size <= 2_097_152 {
            try FileManager.default.copyItem(atPath: candidate,
                toPath: root.appendingPathComponent("unverified-before-stop.mov").path)
        }
        for source in [camera.appendingPathComponent("camera.raw.mov"), root.appendingPathComponent("timestamps.jsonl")] {
            if FileManager.default.fileExists(atPath: source.path),
                let size = try source.resourceValues(forKeys: [.fileSizeKey]).fileSize, size <= 2_097_152 {
                try FileManager.default.copyItem(at: source, to: root.appendingPathComponent("before-stop-" + source.lastPathComponent))
            }
        }
        guard capture.deviceState == "recording", activeCandidates.count == 1,
            readers.observed["raw", default: 0] > 0, readers.observed["canonical", default: 0] > 0,
            !FileManager.default.fileExists(atPath: camera.appendingPathComponent("video.mov").path) else {
            throw CaptureFailure("LIVE_VERIFICATION_MISSING", "Camera has no distinct private canonical work before stop.")
        }
        if discardBeforeStop {
            await capture.discard()
            guard capture.deviceState == "idle", try candidates().isEmpty,
                !FileManager.default.fileExists(atPath: camera.appendingPathComponent("video.mov").path) else {
                throw CaptureFailure("LIVE_DISCARD_FAILED", "Discard must join active work and remove its private candidate.")
            }
            let released = try CaptureJournalLease(directory: camera.path)
            released.release()
            print("PASS live camera discard removes candidate before journal lease release")
            return
        }
        if changedCandidateRetry {
            do { _ = try await capture.stop(); throw CaptureFailure("RETRY_FAULT_MISSING", "Receipt publication unexpectedly succeeded.") }
            catch {
                _ = chmod(camera.path, 0o700)
                guard readers.observed["blocked"] == 1, CaptureFinalizationError(error).retryable,
                    !FileManager.default.fileExists(atPath: camera.appendingPathComponent("camera.publication.json").path) else { throw error }
                try Data(String(describing: error).utf8).write(to: root.appendingPathComponent("first-stop-error.txt"))
            }
            let file = try FileHandle(forWritingTo: URL(fileURLWithPath: activeCandidates[0]))
            try file.seekToEnd(); try file.write(contentsOf: Data([0])); try file.close()
        }
        if invalidClosedMarker {
            try Data("invalid closed marker".utf8).write(to: camera.appendingPathComponent("camera.closed.json"))
        }
        let result = try await capture.stop()
        try JSONEncoder().encode(result).write(to: root.appendingPathComponent("stop-result.json"))
        if invalidClosedMarker {
            guard result.camera?.failure?.code == "INVALID_CAMERA_MAPPING", try candidates().isEmpty,
                !FileManager.default.fileExists(atPath: camera.appendingPathComponent("video.mov").path) else {
                throw CaptureFailure("LIVE_TERMINAL_CLEANUP_FAILED", "Terminal marker refusal must remove unfinished work.")
            }
            let released = try CaptureJournalLease(directory: camera.path)
            released.release()
            print("PASS terminal camera refusal removes unused work before journal lease release")
            return
        }
        let observations = try Data(contentsOf: root.appendingPathComponent("timestamps.jsonl"))
        let retained = try Data(contentsOf: camera.appendingPathComponent(CameraMedia.mappingFile))
        precondition(observations.count > 65536 && retained == observations,
            "Publication must retain every byte across observation read chunks.")
        var published = stat()
        guard lstat(camera.appendingPathComponent("video.mov").path, &published) == 0 else {
            throw CaptureFailure("LIVE_PUBLICATION_MISSING", "Canonical publication is missing.")
        }
        let sameCandidate = before.st_dev == published.st_dev && before.st_ino == published.st_ino
        guard sameCandidate != changedCandidateRetry else {
            throw CaptureFailure("LIVE_PUBLICATION_IDENTITY", changedCandidateRetry
                ? "A changed candidate cannot reuse cached verification."
                : "Publication must finish the same actively verified private candidate.")
        }
        guard let cameraResult = result.camera, cameraResult.state == "complete",
            cameraResult.tracks.count == 1, cameraResult.tracks[0].samples > 200 else {
            throw CaptureFailure("LIVE_PUBLICATION_FAILED", "Camera did not publish the complete authored take.")
        }
        let receiptURL = camera.appendingPathComponent("camera.publication.json")
        let receipt = try JSONDecoder().decode(CameraMedia.Receipt.self, from: Data(contentsOf: receiptURL))
        precondition(receipt.representedFrames == cameraResult.tracks[0].samples && receipt.diagnostics.isEmpty)
        precondition(receipt.firstUs == (firstCameraAfterPrimary ? 200000 : 0),
            "A delayed camera must retain its absolute source clock and initial empty support.")
        let lease = try CaptureJournalLease(directory: camera.path)
        defer { lease.release() }
        let verified = try await CameraMedia.readPublished(lease: lease, canonical: camera.appendingPathComponent("video.mov"))
        precondition(verified.identity.support == receipt.support
            && verified.identity.representedFrames == receipt.representedFrames && verified.diagnostics.isEmpty)
        print("PASS active private camera work and exact final publication through NativeCapture")
    } catch {
        await capture.discard()
        throw error
    }
}
