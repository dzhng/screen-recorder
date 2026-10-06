@preconcurrency import AVFoundation
import Foundation
import ScreenCaptureKit
@testable import YapCapture
import YapMedia

@MainActor
func runIndependentCameraClockTests(output: String? = nil) async throws {
    let root = output.map { URL(fileURLWithPath: $0) } ?? RecoveryFixture.directory("independent-camera-clock")
    if output != nil { try FileManager.default.createDirectory(at: root, withIntermediateDirectories: false) }
    defer { if output == nil { try? FileManager.default.removeItem(at: root) } }
    let source = root.appendingPathComponent("input.mov")
    try await RecoveryFixture.writeVariableDurationVideo(to: source,
        timesUs: [0, 50000, 100000, 150000], endUs: 200000)
    let samples = try await cameraClockSamples(source)
    let alone = try await literalCameraProjection(root: root, samples: samples, laterPrimary: false)
    let later = try await literalCameraProjection(root: root, samples: samples, laterPrimary: true)
    precondition(alone.pictureSHA256 == later.pictureSHA256 && alone.support == later.support,
        "A later primary origin cannot change accepted camera pictures or their support")
    try await cameraOriginAfterPause(root: root, samples: samples)
    try await fractionalCameraOrigin(root: root, samples: samples)
    try await nativeCameraClock(root: root, samples: samples)
    try await cameraCallbackOrder(root: root)
    print("PASS literal camera pause projection and later-primary correspondence")
}

@MainActor
private func literalCameraProjection(root: URL, samples: [CMSampleBuffer], laterPrimary: Bool) async throws -> CameraMedia.Receipt {
    let directory = root.appendingPathComponent(laterPrimary ? "literal-later-primary" : "literal-no-primary")
    let binding = CameraCaptureBinding(recordingId: directory.lastPathComponent,
        sourceId: "literal-camera", deviceId: "prerecorded-camera")
    let camera = try CameraWriter(directory: directory, framesPerSecond: 30, binding: binding)
    let observations = directory.appendingPathComponent(CameraMedia.mappingFile)
    precondition(FileManager.default.createFile(atPath: observations.path, contents: nil))
    let output = try FileHandle(forWritingTo: observations)
    defer { try? output.close() }
    var clock = CaptureClock()
    clock.pause(at: 1100000)
    clock.resume(at: 1300000)
    var frames: [CameraFrameMapping] = []
    func offer(_ sample: CMSampleBuffer, hostUs: Int64) throws -> CaptureWriter.IngressReceipt {
        let timed = try captureFixtureRetimed(sample, at: time(microseconds: hostUs), duration: time(microseconds: 50000))
        let result = try camera.append(timed, state: .init(clock: clock, accepting: true))
        try recordCameraClockOffer(result, host: timed.presentationTimeStamp, to: output)
        if let frame = result.frame { frames.append(frame) }
        return result.receipt
    }
    let paused = try offer(samples[0], hostUs: 1200000)
    let spanning = try offer(samples[0], hostUs: 1075000)
    precondition(paused.disposition == "outside-support" && spanning.disposition == "outside-support")
    let first = try offer(samples[0], hostUs: 1000000)
    precondition(first.disposition == "accepted" && first.sourceUs == 0,
        "A delayed camera picture before completed controls must establish its own source zero")
    try await Task.sleep(for: .milliseconds(10))
    let second = try offer(samples[1], hostUs: 1400000)
    try await Task.sleep(for: .milliseconds(10))
    let third = try offer(samples[2], hostUs: 1500000)
    precondition(second.sourceUs == 200000 && third.sourceUs == 300000)
    let retainedStarts = frames.map { $0.start.time }
    precondition(clock.originUs == nil && clock.pauses.isEmpty && clock.elapsedSourceUs(at: 1500000) == nil,
        "Camera admission cannot establish the primary clock or its elapsed display")
    if laterPrimary { precondition(clock.start(at: 1600000)) }
    try await Task.sleep(for: .milliseconds(10))
    let final = try offer(samples[3], hostUs: 1700000)
    precondition(final.disposition == "accepted" && final.sourceUs == 500000,
        "A later primary picture must not rebase the camera")
    precondition(Array(frames.prefix(3)).map { $0.start.time } == retainedStarts)
    if laterPrimary {
        precondition(clock.originUs == 1600000 && clock.sourceTime(for: 1700000) == 100000 && clock.pauses.isEmpty)
        precondition(final.sourceUs! - clock.sourceTime(for: 1700000)! == 400000,
            "Source correspondence removes the intervening pause instead of using the raw origin difference")
    }
    try output.synchronize()
    try output.close()
    let closed = await camera.close(clock: clock, failure: nil, observations: observations)
    defer { closed.releaseJournal() }
    let result = try await CameraMedia.publish(closed)
    precondition(result.failure == nil && result.hostOriginUs == 1000000 && result.cameraBinding == binding)
    precondition(result.pauses.map { [$0.atSourceUs, $0.elapsedPauseUs] } == [[100000, 200000]])
    precondition(result.durationUs == 550000 && result.tracks.first?.samples == 4)
    let receiptURL = directory.appendingPathComponent("camera.publication.json")
    let receipt = try JSONDecoder().decode(CameraMedia.Receipt.self, from: Data(contentsOf: receiptURL))
    precondition(receipt.firstUs == 0 && receipt.endUs == 550000
        && receipt.support == ExactRange(startUs: 0, endUs: 550000))
    let journalURL = directory.appendingPathComponent("capture.journal.jsonl")
    let journal = try Data(contentsOf: journalURL)
    let controls = try String(decoding: journal, as: UTF8.self).split(separator: "\n").map {
        try JSONSerialization.jsonObject(with: Data($0.utf8)) as! [String: Any]
    }
    let began = controls.first { $0["event"] as? String == "pauseBegan" }!["data"] as! [String: Any]
    let ended = controls.first { $0["event"] as? String == "pauseEnded" }!["data"] as! [String: Any]
    precondition(began["hostUs"] as? Int64 == 1100000 && ended["hostUs"] as? Int64 == 1300000,
        "Camera recovery must retain actual host controls independently of primary-relative pauses")
    closed.releaseJournal()
    let lease = try CaptureJournalLease(directory: directory.path)
    defer { lease.release() }
    let replay = try await CameraMedia.publish(lease: lease, observationURL: observations)
    let verified = try await CameraMedia.readPublished(lease: lease, canonical: directory.appendingPathComponent("video.mov"))
    precondition(replay.pictureSHA256 == receipt.pictureSHA256 && verified.identity.support == receipt.support)
    let journalAfter = try Data(contentsOf: journalURL)
    precondition(journalAfter == journal, "Recovery cannot rewrite the camera's stable clock authority")
    let decoded = try await cameraClockSamples(directory.appendingPathComponent("video.mov"))
    precondition(decoded.map { microseconds($0.presentationTimeStamp) } == [0, 200000, 300000, 500000])
    try JSONSerialization.data(withJSONObject: ["primaryOriginUs": clock.originUs as Any? ?? NSNull(),
        "cameraOriginUs": result.hostOriginUs!, "pauseStartHostUs": 1100000, "pauseEndHostUs": 1300000,
        "cameraSourceUs": [0, 200000, 300000, 500000], "cameraEndUs": 550000], options: [.sortedKeys])
        .write(to: directory.appendingPathComponent("oracle.json"))
    return receipt
}

private func recordCameraClockOffer(_ result: (receipt: CaptureWriter.IngressReceipt, frame: CameraFrameMapping?),
    host: CMTime, to output: FileHandle) throws {
    struct Row: Encodable {
        let role = "camera"
        let disposition: String
        let convertedHostPTS: CaptureRationalTime
        let sourceUs: Int64?
        let cameraFrame: CameraFrameMapping?
    }
    let row = Row(disposition: result.receipt.disposition, convertedHostPTS: CaptureRationalTime(host),
        sourceUs: result.receipt.sourceUs, cameraFrame: result.frame)
    try output.write(contentsOf: JSONEncoder().encode(row) + Data([10]))
}

private func cameraClockSamples(_ source: URL) async throws -> [CMSampleBuffer] {
    let asset = AVURLAsset(url: source)
    let track = try await asset.loadTracks(withMediaType: .video).first!
    let occupied = SourceSegment.occupied(of: try await track.load(.segments))
    let reader = try AVAssetReader(asset: asset)
    let output = AVAssetReaderTrackOutput(track: track,
        outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA])
    reader.add(output)
    precondition(reader.startReading())
    var samples: [CMSampleBuffer] = []
    while let sample = output.copyNextSampleBuffer() {
        if assetEnd(ofSamplePresentedAt: sample.presentationTimeStamp, in: occupied, of: track) != nil { samples.append(sample) }
    }
    precondition(reader.status == .completed)
    return samples
}

@MainActor
private func fractionalCameraOrigin(root: URL, samples: [CMSampleBuffer]) async throws {
    let directory = root.appendingPathComponent("fractional-origin")
    let camera = try CameraWriter(directory: directory, framesPerSecond: 30)
    let observations = directory.appendingPathComponent(CameraMedia.mappingFile)
    precondition(FileManager.default.createFile(atPath: observations.path, contents: nil))
    let output = try FileHandle(forWritingTo: observations)
    defer { try? output.close() }
    let clock = CaptureClock()
    for index in 0..<2 {
        let exactHost = CMTime(value: 4_000_003 + Int64(index) * 400_000, timescale: 4_000_000)
        let sample = try captureFixtureRetimed(samples[index], at: exactHost, duration: time(microseconds: 50000))
        let accepted = try camera.append(sample, state: .init(clock: clock, accepting: true))
        precondition(accepted.receipt.disposition == "accepted",
            "Fractional first host PTS must survive independent origin conversion")
        precondition(accepted.frame!.start.time == CMTime(value: 3 + Int64(index) * 400_000, timescale: 4_000_000))
        try recordCameraClockOffer(accepted, host: exactHost, to: output)
        try await Task.sleep(for: .milliseconds(10))
    }
    try output.synchronize()
    try output.close()
    let closed = await camera.close(clock: clock, failure: nil, observations: observations)
    defer { closed.releaseJournal() }
    let result = try await CameraMedia.publish(closed)
    precondition(result.hostOriginUs == 1_000_000 && result.tracks.first?.samples == 2)
    let receipt = try JSONDecoder().decode(CameraMedia.Receipt.self,
        from: Data(contentsOf: directory.appendingPathComponent("camera.publication.json")))
    precondition(receipt.firstUs == 1 && receipt.endUs == 150001)
    precondition(receipt.support == ExactRange(startUs: 1, endUs: 150001))
    print("PASS fractional host 1000000.75 floors independent origin, retains exact mapping and microsecond published support")
}

@MainActor
private func nativeCameraClock(root: URL, samples: [CMSampleBuffer]) async throws {
    let directory = root.appendingPathComponent("native-pause-later-primary")
    let input = SteppedCameraInput(directory: directory)
    let capture = NativeCapture(prepareInput: { _, _ in input })
    try await capture.start(CaptureRequest(source: CaptureSource(kind: "offline-prerecorded"),
        outputDirectory: directory.path, sourceId: "later-primary", microphone: false))
    try capture.pause()
    try await Task.sleep(for: .milliseconds(25))
    try capture.resume()
    let events = try String(contentsOf: directory.appendingPathComponent("capture.journal.jsonl"), encoding: .utf8)
        .split(separator: "\n").map { try JSONSerialization.jsonObject(with: Data($0.utf8)) as! [String: Any] }
    let began = events.first { $0["event"] as? String == "pauseBegan" }!["data"] as! [String: Any]
    let ended = events.first { $0["event"] as? String == "pauseEnded" }!["data"] as! [String: Any]
    let pauseStart = began["hostUs"] as! Int64
    let pauseEnd = ended["hostUs"] as! Int64
    let cameraOrigin = pauseStart - 100000
    let first = try input.offer(samples[0], role: .camera, hostUs: cameraOrigin)
    precondition(first?.disposition == "accepted" && first?.sourceUs == 0)
    let paused = try input.offer(samples[1], role: .camera, hostUs: pauseStart)
    precondition(paused?.disposition == "outside-support")
    try await Task.sleep(for: .milliseconds(10))
    let second = try input.offer(samples[1], role: .camera, hostUs: pauseEnd + 100000)
    precondition(second?.sourceUs == 200000)
    let primaryOrigin = pauseEnd + 200000
    let primary = try input.offer(samples[2], role: .screen, hostUs: primaryOrigin)
    precondition(primary?.disposition == "accepted" && primary?.sourceUs == 0)
    try await Task.sleep(for: .milliseconds(10))
    let third = try input.offer(samples[2], role: .camera, hostUs: pauseEnd + 300000)
    precondition(third?.sourceUs == 400000)
    let primaryLater = try input.offer(samples[3], role: .screen, hostUs: pauseEnd + 300000)
    precondition(primaryLater?.sourceUs == 100000)
    let waitUs = pauseEnd + 350000 - CaptureHostTime.nowUs()
    if waitUs > 0 { try await Task.sleep(for: .microseconds(waitUs)) }
    let result = try await capture.stop()
    precondition(result.hostOriginUs == primaryOrigin && result.pauses.isEmpty && result.durationUs >= 150000)
    precondition(result.durationUs == input.finalClock!.elapsedSourceUs(at: CaptureHostTime.nowUs()),
        "Primary duration still follows its own sealed elapsed clock")
    precondition(result.camera?.hostOriginUs == cameraOrigin && result.camera?.durationUs == 450000)
    precondition(result.camera?.pauses.map { [$0.atSourceUs, $0.elapsedPauseUs] } == [[100000, pauseEnd - pauseStart]])
    guard case .published(let camera) = capture.publication?.camera,
          case .published = capture.publication?.primary else { preconditionFailure("Both real paths must publish") }
    precondition(camera.binding == input.binding && camera.diagnostic == nil)
    precondition(input.stops == 1 && input.closures == 1 && capture.deviceState == "idle")
    let cameraDirectory = directory.appendingPathComponent("camera")
    let journalURL = cameraDirectory.appendingPathComponent("capture.journal.jsonl")
    let journal = try Data(contentsOf: journalURL)
    let recovered = try await CapturePublishedSource.recover(directory: cameraDirectory.path)
    precondition(recovered.journal == camera.journal && recovered.originHostUs == cameraOrigin && recovered.binding == camera.binding)
    let recoveredJournal = try Data(contentsOf: journalURL)
    precondition(recoveredJournal == journal)
    let decoded = try await cameraClockSamples(cameraDirectory.appendingPathComponent("video.mov"))
    precondition(decoded.map { microseconds($0.presentationTimeStamp) } == [0, 200000, 400000])
    try JSONEncoder().encode(result).write(to: directory.appendingPathComponent("native-result.json"))
    try JSONEncoder().encode(capture.publication).write(to: directory.appendingPathComponent("publication-observation.json"))
    try JSONSerialization.data(withJSONObject: ["pauseStartHostUs": pauseStart, "pauseEndHostUs": pauseEnd,
        "cameraOriginUs": cameraOrigin, "primaryOriginUs": primaryOrigin,
        "cameraSourceUs": [0, 200000, 400000], "sameHostPrimarySourceUs": 100000,
        "sourceDifferenceUs": 300000, "physicalStops": input.stops, "mediaClosures": input.closures], options: [.sortedKeys])
        .write(to: directory.appendingPathComponent("oracle.json"))
    print("PASS native lifecycle actual host pause controls, late primary, correspondence, bound recovery and decoded order")
}

@MainActor
private final class SteppedCameraInput: CaptureInputSession {
    let width = RecoveryFixture.width
    let height = RecoveryFixture.height
    let requestedSourceRect: CGRect? = nil
    let directory: URL
    let binding = CameraCaptureBinding(recordingId: "native-paused-take", sourceId: "native-camera", deviceId: "prerecorded-camera")
    var ingress: CaptureClockIngress!
    var stops = 0
    var closures = 0
    var finalClock: CaptureClock?
    init(directory: URL) { self.directory = directory }
    func start(writer: CaptureWriter, output: any SCStreamOutput, framesPerSecond: Int?,
        onFailure: @escaping @Sendable (CaptureFailure) -> Void,
        checkInterruption: @escaping @MainActor () throws -> Void) async throws {
        let camera = try CameraWriter(directory: directory.appendingPathComponent("camera"), framesPerSecond: 30, binding: binding)
        ingress = try CaptureClockIngress(writer: writer, destination: .companion(camera),
            observations: directory.appendingPathComponent("timestamps.jsonl"), failure: onFailure)
    }
    func offer(_ sample: CMSampleBuffer, role: CaptureIngressRole, hostUs: Int64) throws -> CaptureWriter.IngressReceipt? {
        let timed = try captureFixtureRetimed(sample, at: time(microseconds: hostUs), duration: time(microseconds: 50000))
        let attachments = CMSampleBufferGetSampleAttachmentsArray(timed, createIfNecessary: true)! as NSArray
        (attachments[0] as! NSMutableDictionary)[SCStreamFrameInfo.status.rawValue] = SCFrameStatus.complete.rawValue
        return ingress.writer.queue.sync { ingress.accept(timed, role: role, from: CMClockGetHostTimeClock()) }
    }
    func startCursorSampling(writer: CaptureWriter) {}
    func observeDeviceLoss(onFailure: @escaping @Sendable (CaptureFailure) -> Void) {}
    func stop() async -> CaptureFailure? { stops += 1; return nil }
    func closeMedia(clock: CaptureClock, failure: CaptureFailure?) async -> CaptureInputClosure {
        closures += 1
        finalClock = clock
        try? ingress.close()
        return CaptureInputClosure(camera: await ingress.companion!.close(clock: clock, failure: failure, observations: ingress.observationURL!))
    }
    func discardMedia() async { await ingress.companion!.discard(); try? ingress.close() }
}

@MainActor
private func cameraCallbackOrder(root: URL) async throws {
    let source = root.appendingPathComponent("callback-order-input.mov")
    try await RecoveryFixture.writeVariableDurationVideo(to: source,
        timesUs: [0, 100000, 200000, 500000, 700000], endUs: 800000)
    for cameraFirst in [false, true] {
        let directory = root.appendingPathComponent(cameraFirst ? "camera-first" : "primary-first")
        let input = PrerecordedCaptureInput(source: source)
        input.probeDirectory = directory
        input.cameraBeforePrimary = cameraFirst
        input.videoDeliveryInterval = .milliseconds(10)
        let capture = NativeCapture(prepareInput: { _, _ in input })
        try await capture.start(CaptureRequest(source: CaptureSource(kind: "offline-prerecorded"),
            outputDirectory: directory.path, microphone: false))
        let result = try await capture.stop()
        let camera = result.camera!
        precondition(result.tracks.first { $0.role == "video" }!.samples == 5)
        precondition(camera.hostOriginUs == result.hostOriginUs && camera.durationUs == 933333)
        precondition(camera.tracks[0].firstSampleUs == (cameraFirst ? 0 : 200000))
        precondition(camera.tracks[0].samples == (cameraFirst ? 6 : 5)
            && camera.tracks[0].omittedSamples == (cameraFirst ? 0 : 1))
        let rows = try String(contentsOf: directory.appendingPathComponent("timestamps.jsonl"), encoding: .utf8)
            .split(separator: "\n").map { try JSONSerialization.jsonObject(with: Data($0.utf8)) as! [String: Any] }
        let dispositions = rows.filter { $0["role"] as? String == "camera" }.map { $0["disposition"] as! String }
        let expected = cameraFirst ? Array(repeating: "accepted", count: 6)
            : ["accepted", "duplicate-or-reordered"] + Array(repeating: "accepted", count: 4)
        precondition(dispositions == expected + ["sealed-or-failed"], "Every offered callback stays observable")
        let decoded = try await cameraClockSamples(directory.appendingPathComponent("camera/video.mov"))
        precondition(decoded.map { microseconds($0.presentationTimeStamp) } == (cameraFirst
            ? [0, 200000, 300000, 400000, 700000, 900000] : [200000, 300000, 400000, 700000, 900000]))
        try JSONEncoder().encode(result).write(to: directory.appendingPathComponent("native-result.json"))
    }
    print("PASS established-primary retains five pictures; camera-first deliberately retains the sixth prologue picture")
}

@MainActor
private func cameraOriginAfterPause(root: URL, samples: [CMSampleBuffer]) async throws {
    let directory = root.appendingPathComponent("origin-after-pause")
    let camera = try CameraWriter(directory: directory, framesPerSecond: 30)
    let observations = directory.appendingPathComponent(CameraMedia.mappingFile)
    precondition(FileManager.default.createFile(atPath: observations.path, contents: nil))
    let output = try FileHandle(forWritingTo: observations)
    defer { try? output.close() }
    var clock = CaptureClock()
    clock.pause(at: 1100000)
    clock.resume(at: 1300000)
    func offer(_ index: Int, _ hostUs: Int64) throws -> CaptureWriter.IngressReceipt {
        let sample = try captureFixtureRetimed(samples[index], at: time(microseconds: hostUs), duration: time(microseconds: 50000))
        let accepted = try camera.append(sample, state: .init(clock: clock, accepting: true))
        try recordCameraClockOffer(accepted, host: sample.presentationTimeStamp, to: output)
        return accepted.receipt
    }
    let first = try offer(0, 1400000)
    precondition(first.disposition == "accepted" && first.sourceUs == 0)
    clock.pause(at: 1450000)
    let paused = try offer(1, 1450000)
    precondition(paused.disposition == "outside-support")
    clock.resume(at: 1550000)
    let delayed = try offer(1, 1450000)
    precondition(delayed.disposition == "outside-support")
    try await Task.sleep(for: .milliseconds(10))
    let next = try offer(1, 1600000)
    precondition(next.disposition == "accepted" && next.sourceUs == 100000)
    try output.synchronize()
    try output.close()
    let closed = await camera.close(clock: clock, failure: nil, observations: observations)
    defer { closed.releaseJournal() }
    let result = try await CameraMedia.publish(closed)
    precondition(result.hostOriginUs == 1400000 && result.durationUs == 150000)
    precondition(result.pauses.map { [$0.atSourceUs, $0.elapsedPauseUs] } == [[50000, 100000]])
    let journalURL = directory.appendingPathComponent("capture.journal.jsonl")
    let journal = try Data(contentsOf: journalURL)
    let events = try String(decoding: journal, as: UTF8.self).split(separator: "\n")
        .map { try JSONSerialization.jsonObject(with: Data($0.utf8)) as! [String: Any] }
    let controlHosts = events.filter { ["pauseBegan", "pauseEnded"].contains($0["event"] as! String) }
        .map { ($0["data"] as! [String: Any])["hostUs"] as! Int64 }
    precondition(controlHosts == [1100000, 1300000, 1450000, 1550000])
    closed.releaseJournal()
    let lease = try CaptureJournalLease(directory: directory.path)
    defer { lease.release() }
    let recovered = try await CameraMedia.publish(lease: lease, observationURL: observations)
    precondition(recovered.firstUs == 0 && recovered.endUs == 150000)
    let retained = try Data(contentsOf: journalURL)
    precondition(retained == journal)
    print("PASS pre-origin raw pause controls survive recovery without removing camera time; open and delayed paused samples rejected")
}
