@preconcurrency import AVFoundation
import Foundation
import ScreenCaptureKit
import ScreenRecorderCapture
import ScreenRecorderMedia
import ScreenRecorderWire

/// Only the physical input boundary is substituted. NativeCapture creates and closes the real writer.
@MainActor
private final class PrerecordedCaptureInput: CaptureInputSession {
    let width = RecoveryFixture.width
    let height = RecoveryFixture.height
    let requestedSourceRect: CGRect? = nil
    let source: URL
    let refusesAfterDelivery: Bool
    var stops = 0
    var onFailure: (@Sendable (CaptureFailure) -> Void)?

    init(source: URL, refusesAfterDelivery: Bool = false) {
        self.source = source
        self.refusesAfterDelivery = refusesAfterDelivery
    }

    func start(writer: CaptureWriter, onFailure: @escaping @Sendable (CaptureFailure) -> Void,
        checkInterruption: () throws -> Void) async throws {
        self.onFailure = onFailure
        let asset = AVURLAsset(url: source)
        let track = try await asset.loadTracks(withMediaType: .video).first!
        let reader = try AVAssetReader(asset: asset)
        let output = AVAssetReaderTrackOutput(track: track,
            outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA])
        reader.add(output)
        precondition(reader.startReading())
        // An inert SCStream only supplies the existing callback's identity. Never start it.
        let stream = SCStream(filter: SCContentFilter(), configuration: SCStreamConfiguration(), delegate: nil)
        let origin = CaptureHostTime.nowUs() - 400_000
        while let sample = output.copyNextSampleBuffer() {
            let timed = try captureFixtureRetimed(sample,
                at: CMTimeAdd(time(microseconds: origin), sample.presentationTimeStamp))
            let attachments = CMSampleBufferGetSampleAttachmentsArray(timed, createIfNecessary: true)! as NSArray
            (attachments[0] as! NSMutableDictionary)[SCStreamFrameInfo.status.rawValue] = SCFrameStatus.complete.rawValue
            writer.queue.sync { writer.stream(stream, didOutputSampleBuffer: timed, of: .screen) }
            try checkInterruption()
            if refusesAfterDelivery { throw CaptureFailure("INPUT_START_FAILED", "Prerecorded partial start") }
        }
        precondition(reader.status == .completed)
    }
    func startCursorSampling(writer: CaptureWriter) {}
    func observeDeviceLoss(onFailure: @escaping @Sendable (CaptureFailure) -> Void) {}
    func stop() async -> CaptureFailure? { stops += 1; return nil }
}

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
    let recovered = await MediaRecovery.inspect(directory: root.appendingPathComponent("healthy").path)
    precondition(recovered.durationUs == result.durationUs && result.durationUs >= 300_000)
    precondition(capture.deviceState == "idle")
    print("PASS actual NativeCapture closes prerecorded writer, tears down partial input, ignores stale generation, and acquires no live cursor")
}
