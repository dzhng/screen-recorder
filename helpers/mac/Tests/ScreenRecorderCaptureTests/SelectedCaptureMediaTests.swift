@preconcurrency import AVFoundation
import CryptoKit
import Foundation
import ScreenRecorderCapture
import ScreenRecorderMedia
import ScreenRecorderWire
import ScreenCaptureKit

@MainActor
func runSelectedCaptureMediaTests(output: String, corpus: String) async throws {
    let delayed = ProbeStartDelay()
    let waiting = Task { try await delayed.wait(seconds: 3600) }
    try await Task.sleep(for: .milliseconds(10))
    let cancelStart = ContinuousClock.now
    delayed.cancel()
    do { try await waiting.value; preconditionFailure("Canceled startup delay resumed normally") }
    catch is CancellationError {}
    precondition(cancelStart.duration(to: .now) < .seconds(1))
    let root = URL(fileURLWithPath: output)
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: false)
    let video = root.appendingPathComponent("input.mov")
    try await RecoveryFixture.writeVariableDurationVideo(to: video,
        timesUs: [0, 100000, 500000, 1500000, 2300000], endUs: 2500000)
    let folder = root.appendingPathComponent("take")
    let input = PrerecordedCaptureInput(source: video)
    input.audio = URL(fileURLWithPath: corpus).appendingPathComponent("a-audio.wav")
    input.probeDirectory = folder
    input.pauseJournal = folder.appendingPathComponent("capture.journal.jsonl")
    let capture = NativeCapture(prepareInput: { _ in input })
    try await capture.start(CaptureRequest(source: CaptureSource(kind: "offline-prerecorded"),
        outputDirectory: folder.path, microphone: true))
    try capture.pause()
    let result = try await capture.stop()
    precondition(result.failure == nil, "Probe publication failed: \(String(describing: result.failure))")
    precondition(result.tracks.allSatisfy { ["video", "narration"].contains($0.role) })
    precondition(input.finalizations == 1 && input.finalClock?.isPaused == false)
    let camera = try JSONDecoder().decode(CaptureResult.self,
        from: Data(contentsOf: folder.appendingPathComponent("camera/capture-result.json")))
    precondition(camera.hostOriginUs == result.hostOriginUs && camera.pauses == result.pauses)
    precondition(camera.tracks[0].firstSampleUs == 200000 && camera.tracks[0].heldTailUs == 0)
    precondition(camera.tracks[0].samples > 0 && camera.durationUs == camera.tracks[0].lastSampleEndUs)
    let recovered = await MediaRecovery.inspect(directory: folder.appendingPathComponent("camera").path)
    let recoveredVideo = recovered.tracks.first { $0.role == "video" }!
    precondition(recoveredVideo.failure == nil && recoveredVideo.decodeReachedEnd
        && (recoveredVideo.decodedSamples ?? 0) > 0)
    precondition(recoveredVideo.intervals.first?.startUs == 200000)
    precondition(recoveredVideo.intervals.count > 1, "Sparse camera callbacks must retain an actual decoded gap")
    try JSONEncoder().encode(recovered).write(to: root.appendingPathComponent("camera-recovery.json"))
    let receipt = try JSONDecoder().decode(CaptureAudioPublication.Receipt.self,
        from: Data(contentsOf: folder.appendingPathComponent("narration.publication.json")))
    var hash = SHA256(); hash.update(data: Data("screenrec.capture-pcm.v1\0".utf8))
    for number in [input.expectedRate,input.expectedChannels] {
        var little = number.littleEndian
        hash.update(data: withUnsafeBytes(of: &little) { Data($0) })
    }
    hash.update(data: input.expectedPCM)
    precondition(receipt.pcmSHA256 == hash.finalize().map { String(format: "%02x", $0) }.joined())
    precondition(receipt.acceptedFrames == receipt.representedFrames && input.rejectedAudioBuffers > 0)
    let rows = try String(contentsOf: folder.appendingPathComponent("timestamps.jsonl"), encoding: .utf8)
        .split(separator: "\n").map { try JSONSerialization.jsonObject(with: Data($0.utf8)) as! [String: Any] }
    precondition(Set(rows.compactMap { $0["role"] as? String }) == Set(["screen","camera","microphone"]))
    precondition(rows.contains { $0["disposition"] as? String == "outside-support" })
    precondition(rows.contains { $0["disposition"] as? String == "sealed-or-failed" })
    let earlier = CaptureFailure("EARLIER", "earlier failure")
    let later = CaptureFailure("CAMERA", "camera failure")
    let failed = result.withFailure(earlier).withFailure(later)
    precondition(failed.failure?.code == "EARLIER")
    func stable(_ r: CaptureResult) throws -> [String: Any] {
        var value = try JSONSerialization.jsonObject(with: JSONEncoder().encode(r)) as! [String: Any]
        value.removeValue(forKey: "failure"); value.removeValue(forKey: "state"); return value
    }
    let originalFields = try stable(result); let failedFields = try stable(failed)
    precondition(NSDictionary(dictionary: originalFields).isEqual(to: failedFields))
    try JSONEncoder().encode(result).write(to: root.appendingPathComponent("result.json"))
    let retryInput = PrerecordedCaptureInput(source: video)
    retryInput.audio = input.audio
    retryInput.holdStop = true
    retryInput.companionFailure = CaptureFailure("CAMERA_CLOSURE", "offline companion closure failure")
    let retry = NativeCapture(prepareInput: { _ in retryInput })
    let retryFolder = root.appendingPathComponent("retry")
    try await retry.start(CaptureRequest(source: CaptureSource(kind: "offline-prerecorded"),
        outputDirectory: retryFolder.path, microphone: true))
    let stopping = Task { try await retry.stop() }
    await retryInput.stopEntered.wait()
    retry.cancelPublication(); retryInput.releaseStop.release()
    do { _ = try await stopping.value; preconditionFailure("Expected canceled publication") }
    catch is CancellationError {}
    precondition(retryInput.finalizations == 1)
    retryInput.companionFailure = CaptureFailure("WRONG_RETRY", "Must not replace cached closure")
    let retried = try await retry.stop()
    precondition(retryInput.finalizations == 1 && retried.failure?.code == "CAMERA_CLOSURE")
    precondition(retried.hostOriginUs == retryInput.finalClock?.originUs && retried.pauses == retryInput.finalClock?.pauses)
    precondition(retried.tracks.map(\.role) == ["narration", "video"] && retried.cleanupFailure == nil)
    try JSONEncoder().encode(retried).write(to: root.appendingPathComponent("retry-result.json"))
    let limited = PrerecordedCaptureInput(source: video)
    limited.audio = input.audio
    limited.probeDirectory = root.appendingPathComponent("limited")
    limited.probeMaximumRows = 3
    let bounded = NativeCapture(prepareInput: { _ in limited })
    try await bounded.start(CaptureRequest(source: CaptureSource(kind: "offline-prerecorded"),
        outputDirectory: limited.probeDirectory!.path, microphone: true))
    let stopped = try await bounded.stop()
    precondition(stopped.state == "interrupted" && stopped.failure?.code == "EVIDENCE_LIMIT")
    let retained = try String(contentsOf: limited.probeDirectory!.appendingPathComponent("timestamps.jsonl"), encoding: .utf8)
    precondition(retained.split(separator: "\n").count == 3 && limited.finalizations == 1)
    try JSONEncoder().encode(stopped).write(to: root.appendingPathComponent("limit-result.json"))
    print("PASS shared ingress camera offset/pause, separate results, exact canonical microphone PCM, final pause closure and earlier failure precedence")
}

@MainActor
func runProbeFrameBoundary(output: String, sourcePath: String? = nil) async throws {
    let root = URL(fileURLWithPath: output)
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: false)
    let source = root.appendingPathComponent(sourcePath == nil ? "input.mov" : "input.mp4")
    if let sourcePath { try FileManager.default.copyItem(atPath: sourcePath, toPath: source.path) }
    else { try await RecoveryFixture.writeVariableDurationVideo(to: source, timesUs: [0], endUs: 100000) }
    let asset = AVURLAsset(url: source)
    let track = try await asset.loadTracks(withMediaType: .video).first!
    let reader = try AVAssetReader(asset: asset)
    let decoded = AVAssetReaderTrackOutput(track: track,
        outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA])
    reader.add(decoded); precondition(reader.startReading())
    let image = decoded.copyNextSampleBuffer()!
    reader.cancelReading()
    // Convert every timestamp and endpoint, including multiple timing entries, at a non-unit rate.
    var clock: CMTimebase?
    precondition(CMTimebaseCreateWithSourceClock(allocator: kCFAllocatorDefault,
        sourceClock: CMClockGetHostTimeClock(), timebaseOut: &clock) == noErr)
    let anchor = CMTime(value: 7000000, timescale: 1000000)
    let hostAnchor = CMTime(value: CaptureHostTime.nowUs(), timescale: 1000000)
    precondition(CMTimebaseSetRateAndAnchorTime(clock!, rate: 2, anchorTime: anchor,
        immediateSourceTime: hostAnchor) == noErr)
    var timing = [CMSampleTimingInfo(duration: CMTime(value: 1, timescale: 20),
        presentationTimeStamp: anchor, decodeTimeStamp: CMTimeSubtract(anchor, CMTime(value: 1, timescale: 20))),
        CMSampleTimingInfo(duration: CMTime(value: 1, timescale: 20),
        presentationTimeStamp: CMTimeAdd(anchor, CMTime(value: 1, timescale: 20)), decodeTimeStamp: .invalid)]
    var multi: CMSampleBuffer?
    precondition(CMSampleBufferCreate(allocator: kCFAllocatorDefault, dataBuffer: nil, dataReady: false,
        makeDataReadyCallback: nil, refcon: nil, formatDescription: image.formatDescription,
        sampleCount: 2, sampleTimingEntryCount: 2, sampleTimingArray: &timing,
        sampleSizeEntryCount: 0, sampleSizeArray: nil, sampleBufferOut: &multi) == noErr)
    let converted = try ProbeClockIngress.convert(multi!, from: clock!)
    var actual = [CMSampleTimingInfo](repeating: CMSampleTimingInfo(), count: 2)
    var count = 0
    precondition(CMSampleBufferGetSampleTimingInfoArray(converted, entryCount: 2,
        arrayToFill: &actual, entriesNeededOut: &count) == noErr && count == 2)
    precondition(actual[0].presentationTimeStamp == hostAnchor)
    precondition(actual[1].presentationTimeStamp == CMTimeAdd(hostAnchor, CMTime(value: 1, timescale: 40)))
    precondition(actual.allSatisfy { $0.duration == CMTime(value: 1, timescale: 40) })
    precondition(actual[0].decodeTimeStamp == CMTimeSubtract(hostAnchor, CMTime(value: 1, timescale: 40)))
    precondition(!actual[1].decodeTimeStamp.isNumeric)
    let writer = try CaptureWriter(request: CaptureRequest(source: CaptureSource(kind: "offline-prerecorded"),
        outputDirectory: root.appendingPathComponent("screen").path),
        width: CVPixelBufferGetWidth(image.imageBuffer!), height: CVPixelBufferGetHeight(image.imageBuffer!),
        sessionID: "rational-frame-boundary", requestedSourceRect: nil, onFailure: { _ in })
    let origin = CMTime(value: CaptureHostTime.nowUs() - 1000000, timescale: 1000000)
    let screen = try captureFixtureRetimed(image, at: origin, duration: CMTime(value: 1, timescale: 60))
    let attachments = CMSampleBufferGetSampleAttachmentsArray(screen, createIfNecessary: true)! as NSArray
    (attachments[0] as! NSMutableDictionary)[SCStreamFrameInfo.status.rawValue] = SCFrameStatus.complete.rawValue
    writer.queue.sync { writer.ingest(screen, of: .screen) }
    let camera = try ProbeCameraWriter(directory: root.appendingPathComponent("camera"), framesPerSecond: 60)
    let ingress = try ProbeClockIngress(writer: writer, camera: camera, observations: root.appendingPathComponent("observations.jsonl"), failure: { _ in preconditionFailure("Unexpected probe failure") })
    var receipts: [CaptureWriter.IngressReceipt] = []
    for i in (sourcePath == nil ? [0,1,2,2] : [0,1,3,3]) {
        let sample = try captureFixtureRetimed(image, at: CMTimeAdd(origin, CMTime(value: Int64(i), timescale: 60)),
            duration: CMTime(value: 1, timescale: 60))
        receipts.append(writer.queue.sync { ingress.accept(sample, role: .camera, from: CMClockGetHostTimeClock())! })
        try await Task.sleep(for: .milliseconds(10))
    }
    try JSONEncoder().encode(receipts).write(to: root.appendingPathComponent("receipts.json"))
    precondition(receipts.map(\.disposition) == ["accepted","accepted","accepted","overlapping-or-reordered"])
    // A later dropped callback must not append behind a torn row after ingress has failed.
    let stoppedURL = root.appendingPathComponent("stopped-observations.jsonl")
    let stoppedIngress = try ProbeClockIngress(writer: writer, camera: camera,
        observations: stoppedURL, failure: { failure in precondition(failure.code == "CLOCK_UNAVAILABLE") })
    writer.queue.sync { precondition(stoppedIngress.accept(image, role: .camera, from: nil) == nil) }
    let torn = Data("{\"role\":".utf8)
    let tail = try FileHandle(forWritingTo: stoppedURL)
    try tail.write(contentsOf: torn); try tail.close()
    let videoOutput = AVCaptureVideoDataOutput()
    let connection = AVCaptureConnection(inputPorts: [], output: videoOutput)
    writer.queue.sync { stoppedIngress.captureOutput(videoOutput, didDrop: image, from: connection) }
    try stoppedIngress.close()
    let retainedTail = try Data(contentsOf: stoppedURL)
    precondition(retainedTail == torn, "Dropped callback appended behind failed evidence")
    writer.seal(); let closed = await writer.finish(failure: nil)
    try ingress.close()
    let reason = await camera.finish(clock: writer.queue.sync { writer.ingressState.clock }, failure: closed.failure, observations: ingress.observationURL)
    writer.releaseJournal()
    precondition(reason == nil)
    let result = try JSONDecoder().decode(CaptureResult.self,
        from: Data(contentsOf: root.appendingPathComponent("camera/capture-result.json")))
    precondition(result.tracks[0].samples == 3 && result.tracks[0].omittedSamples == 1 && result.durationUs == (sourcePath == nil ? 50000 : 66667))
    print("PASS multi-entry 2x clock endpoints; rational60fps three accepted pictures and exact duplicate refusal; endpoint \(result.durationUs)us")
}
