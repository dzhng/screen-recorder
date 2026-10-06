@preconcurrency import AVFoundation
import Foundation
import YapCapture
import YapMedia

@MainActor
final class FixtureCameraSession: CaptureCameraSession {
    let width = RecoveryFixture.width
    let height = RecoveryFixture.height
    let source: URL
    let origin: () -> Int64
    nonisolated var synchronizationClock: CMClockOrTimebase? { CMClockGetHostTimeClock() }
    var starts = 0
    var stops = 0
    var failureAfterDelivery: CaptureFailure?
    var deliverFrames = true
    var holdStart = false
    var holdStop = false
    let stopEntered = InputGate()
    let releaseStop = InputGate()
    let startEntered = InputGate()
    let releaseStart = InputGate()
    var onFailure: (@Sendable (CaptureFailure) -> Void)?
    private var ingress: CaptureClockIngress?
    private var lastSample: CMSampleBuffer?
    init(source: URL, origin: @escaping () -> Int64) { self.source = source; self.origin = origin }
    func start(ingress: CaptureClockIngress) async throws {
        starts += 1
        self.ingress = ingress
        if holdStart { startEntered.release(); await releaseStart.wait() }
        guard deliverFrames else { return }
        let asset = AVURLAsset(url: source)
        let track = try await asset.loadTracks(withMediaType: .video).first!
        let reader = try AVAssetReader(asset: asset)
        let output = AVAssetReaderTrackOutput(track: track,
            outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA])
        reader.add(output); precondition(reader.startReading())
        while let sample = output.copyNextSampleBuffer() {
            let host = CMTimeAdd(sample.presentationTimeStamp, CMTime(value: origin() + 200000, timescale: 1000000))
            lastSample = sample
            let timed = try CaptureClockIngress.retime(sample, to: host)
            ingress.writer.queue.sync { () -> Void in ingress.accept(timed, role: .camera, from: synchronizationClock) }
            try await Task.sleep(for: .milliseconds(5))
        }
        if let failureAfterDelivery { throw failureAfterDelivery }
    }
    func offer(at hostUs: Int64) throws {
        let ingress = ingress!
        let timed = try CaptureClockIngress.retime(lastSample!, to: CMTime(value: hostUs, timescale: 1000000))
        ingress.writer.queue.sync { () -> Void in ingress.accept(timed, role: .camera, from: synchronizationClock) }
    }
    func observeDeviceLoss(onFailure: @escaping @Sendable (CaptureFailure) -> Void) { self.onFailure = onFailure }
    func stop() async -> CaptureFailure? {
        stops += 1
        if holdStop { stopEntered.release(); await releaseStop.wait() }
        return nil
    }
}

@MainActor
final class FixtureCameraDevice: CaptureCameraDevice {
    let id: String
    let session: FixtureCameraSession
    var opens = 0
    var unavailable = false
    init(_ id: String, session: FixtureCameraSession) { self.id = id; self.session = session }
    func makeSession(framesPerSecond: Int?, microphone: AVCaptureDevice?) throws -> any CaptureCameraSession {
        opens += 1
        if unavailable { throw CaptureFailure("SOURCE_UNAVAILABLE", "Fixture camera disappeared") }
        return session
    }
}
