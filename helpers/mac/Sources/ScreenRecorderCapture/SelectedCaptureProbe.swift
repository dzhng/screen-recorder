@preconcurrency import AVFoundation
import CoreGraphics
import Foundation
@preconcurrency import ScreenCaptureKit

/// An app-identity measurement entry point, not a production recording operation.
@MainActor
public enum SelectedCaptureProbe {
    public static func run(action: String, requestPath: String? = nil) async throws -> Data {
        switch action {
        case "validate":
            let request = try read(requestPath)
            try request.validate()
            return try JSONEncoder().encode(request)
        case "recover":
            let request = try read(requestPath)
            try request.validate()
            let root = URL(fileURLWithPath: request.outputDirectory)
            let lease = try CaptureJournalLease(directory: root.appendingPathComponent("camera").path)
            defer { lease.release() }
            return try JSONEncoder().encode(await ProbeCameraMedia.publish(lease: lease,
                observationURL: root.appendingPathComponent("timestamps.jsonl")))
        case "status":
            return try JSONSerialization.data(withJSONObject: [
                "screen": NativeCapture.screenPermission,
                "camera": permission(.video), "microphone": permission(.audio),
                "bundleIdentifier": Bundle.main.bundleIdentifier ?? "unbundled",
                "executable": Bundle.main.executableURL?.path ?? "unknown",
            ])
        case "sources":
            guard NativeCapture.screenPermission else {
                throw CaptureFailure("PERMISSION_REQUIRED", "Screen access must already be authorized for discovery.")
            }
            let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)
            return try JSONSerialization.data(withJSONObject: [
                "cameras": cameras().map { ["id": $0.uniqueID, "name": $0.localizedName] },
                "microphones": ScreenCaptureInput.microphoneCandidates().map { ["id": $0.uniqueID, "name": $0.localizedName] },
                "displays": content.displays.map { ["id": $0.displayID, "width": $0.width, "height": $0.height] },
                "windows": content.windows.map { ["id": $0.windowID, "title": $0.title ?? ""] as [String: Any] },
            ])
        case "permission-camera":
            let granted = await AVCaptureDevice.requestAccess(for: .video)
            return try JSONSerialization.data(withJSONObject: ["camera": granted])
        case "permission-screen", "permission-microphone":
            let kind = String(action.dropFirst("permission-".count))
            let granted = try await NativeCapture.requestPermission(kind)
            return try JSONSerialization.data(withJSONObject: [kind: granted])
        case "capture":
            let request = try read(requestPath)
            try request.validate()
            // Every grant is checked before enumeration, capture inputs or output creation.
            try request.requireAuthorization(screen: NativeCapture.screenPermission,
                camera: AVCaptureDevice.authorizationStatus(for: .video) == .authorized,
                microphone: AVCaptureDevice.authorizationStatus(for: .audio) == .authorized)
            let root = URL(fileURLWithPath: request.outputDirectory)
            guard !FileManager.default.fileExists(atPath: root.path) else {
                throw CaptureFailure("INVALID_REQUEST", "Evidence destination must not already exist.")
            }
            let devices = cameras()
            try SelectedCaptureRequest.requireDevice(request.cameraID, among: devices.map(\.uniqueID), role: "camera")
            guard let camera = devices.first(where: { $0.uniqueID == request.cameraID }) else {
                throw CaptureFailure("SOURCE_UNAVAILABLE", "Selected camera disappeared.")
            }
            let screenRequest = CaptureRequest(source: request.source,
                outputDirectory: root.appendingPathComponent("screen").path,
                microphone: request.microphone.enabled, microphoneDeviceID: request.microphone.deviceID)
            let screen = try await ScreenCaptureInput.prepare(screenRequest)
            let input = try SelectedProbeInput(screen: screen, camera: camera, request: request)
            try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true,
                attributes: [.posixPermissions: 0o700])
            try JSONEncoder().encode(request).write(to: root.appendingPathComponent("request.json"), options: .atomic)
            let capture = NativeCapture(prepareInput: { _ in input })
            var interrupted = false
            capture.onInterruption = { _ in interrupted = true; input.interruptStartup() }
            func wait(_ seconds: Double) async throws {
                let deadline = ContinuousClock.now.advanced(by: .seconds(seconds))
                while !interrupted && ContinuousClock.now < deadline {
                    try await Task.sleep(for: .milliseconds(50))
                }
            }
            do {
                try await capture.start(screenRequest)
                // The duration begins with screen startup, including the declared camera delay.
                let remaining = request.durationSeconds - request.cameraDelaySeconds
                if let pause = request.pause {
                    let before = pause.atSeconds - request.cameraDelaySeconds
                    guard before > 0 else { throw CaptureFailure("INVALID_REQUEST", "Pause must follow camera startup.") }
                    try await wait(before)
                    if !interrupted { try capture.pause() }
                    try await wait(pause.durationSeconds)
                    if !interrupted { try capture.resume() }
                    try await wait(request.durationSeconds - pause.atSeconds - pause.durationSeconds)
                } else { try await wait(remaining) }
                let result = try await capture.stop()
                let data = try JSONEncoder().encode(result)
                try data.write(to: root.appendingPathComponent("screen-result.json"), options: .atomic)
                return data
            } catch {
                if capture.deviceState != "idle" { _ = try? await capture.stop() }
                throw error
            }
        default: throw CaptureFailure("INVALID_REQUEST", "Unknown selected-device probe action.")
        }
    }
    private static func read(_ path: String?) throws -> SelectedCaptureRequest {
        guard let path else { throw CaptureFailure("INVALID_REQUEST", "Supply a selected-device request file.") }
        return try JSONDecoder().decode(SelectedCaptureRequest.self, from: Data(contentsOf: URL(fileURLWithPath: path)))
    }
    private static func permission(_ kind: AVMediaType) -> String {
        switch AVCaptureDevice.authorizationStatus(for: kind) {
        case .authorized: "authorized"
        case .denied: "denied"
        case .restricted: "restricted"
        case .notDetermined: "not_determined"
        @unknown default: "unknown"
        }
    }
    private static func cameras() -> [AVCaptureDevice] {
        AVCaptureDevice.DiscoverySession(deviceTypes: [.builtInWideAngleCamera, .external, .continuityCamera],
            mediaType: .video, position: .unspecified).devices
    }
}

/// Session start/stop blocks only this dedicated queue, never the app's control actor.
private final class ProbeCameraSession: @unchecked Sendable {
    let session = AVCaptureSession()
    private let queue = DispatchQueue(label: "com.david.screenrec.probe-camera-session")
    func start() async { await withCheckedContinuation { c in queue.async { self.session.startRunning(); c.resume() } } }
    func stop() async { await withCheckedContinuation { c in queue.async { self.session.stopRunning(); c.resume() } } }
}

@MainActor
private final class SelectedProbeInput: CaptureInputSession {
    let screen: ScreenCaptureInput
    let camera: AVCaptureDevice
    let request: SelectedCaptureRequest
    let session = ProbeCameraSession()
    let output = AVCaptureVideoDataOutput()
    var sink: ProbeClockIngress?
    var observers: [NSObjectProtocol] = []
    let delayedStart = ProbeStartDelay()
    var stopped = false
    var priorFrameDurations: (minimum: CMTime, maximum: CMTime, format: AVCaptureDevice.Format)?
    var width: Int { screen.width }
    var height: Int { screen.height }
    var requestedSourceRect: CGRect? { screen.requestedSourceRect }

    init(screen: ScreenCaptureInput, camera: AVCaptureDevice, request: SelectedCaptureRequest) throws {
        self.screen = screen; self.camera = camera; self.request = request
        let fps = Double(request.framesPerSecond)
        guard camera.activeFormat.videoSupportedFrameRateRanges.contains(where: { $0.minFrameRate <= fps && fps <= $0.maxFrameRate }) else {
            throw CaptureFailure("FORMAT_UNAVAILABLE", "Selected camera's active format does not support requested fps.")
        }
        session.session.beginConfiguration()
        defer { session.session.commitConfiguration() }
        let input = try AVCaptureDeviceInput(device: camera)
        guard session.session.canAddInput(input), session.session.canAddOutput(output) else {
            throw CaptureFailure("SOURCE_UNAVAILABLE", "Selected camera cannot provide video callbacks.")
        }
        session.session.addInput(input)
        output.videoSettings = [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA]
        output.alwaysDiscardsLateVideoFrames = true
        session.session.addOutput(output)
    }
    func start(writer: CaptureWriter, onFailure: @escaping @Sendable (CaptureFailure) -> Void,
        checkInterruption: () throws -> Void) async throws {
        let root = URL(fileURLWithPath: request.outputDirectory)
        let cameraWriter = try ProbeCameraWriter(directory: root.appendingPathComponent("camera"), framesPerSecond: request.framesPerSecond)
        let sink = try ProbeClockIngress(writer: writer, camera: cameraWriter,
            observations: root.appendingPathComponent("timestamps.jsonl"), failure: onFailure)
        self.sink = sink
        sink.cameraSession = session.session
        screen.probeOutput = sink; screen.probeFramesPerSecond = request.framesPerSecond
        output.setSampleBufferDelegate(sink, queue: writer.queue)
        observeDeviceLoss(onFailure: onFailure)
        try await screen.start(writer: writer, onFailure: onFailure, checkInterruption: checkInterruption)
        try checkInterruption()
        try await delayedStart.wait(seconds: request.cameraDelaySeconds)
        try Task.checkCancellation(); try checkInterruption()
        guard !stopped else { throw CancellationError() }
        guard camera.activeFormat.videoSupportedFrameRateRanges.contains(where: {
            $0.minFrameRate <= Double(request.framesPerSecond) && Double(request.framesPerSecond) <= $0.maxFrameRate
        }) else { throw CaptureFailure("FORMAT_UNAVAILABLE", "Configured camera format does not support requested fps.") }
        try camera.lockForConfiguration()
        priorFrameDurations = (camera.activeVideoMinFrameDuration, camera.activeVideoMaxFrameDuration, camera.activeFormat)
        camera.activeVideoMinFrameDuration = CMTime(value: 1, timescale: Int32(request.framesPerSecond))
        camera.activeVideoMaxFrameDuration = CMTime(value: 1, timescale: Int32(request.framesPerSecond))
        camera.unlockForConfiguration()
        await session.start()
        try checkInterruption()
        guard !stopped else { throw CancellationError() }
        guard session.session.isRunning else { throw CaptureFailure("SOURCE_UNAVAILABLE", "Camera session did not start.") }
    }
    func startCursorSampling(writer: CaptureWriter) {} // Measurements contain clean media only.
    func observeDeviceLoss(onFailure: @escaping @Sendable (CaptureFailure) -> Void) {
        guard observers.isEmpty else { return }
        screen.observeDeviceLoss(onFailure: onFailure)
        observers.append(NotificationCenter.default.addObserver(forName: AVCaptureDevice.wasDisconnectedNotification,
            object: camera, queue: nil) { _ in onFailure(CaptureFailure("SOURCE_LOST", "Selected camera disconnected.")) })
        for event in [AVCaptureSession.runtimeErrorNotification, AVCaptureSession.wasInterruptedNotification] {
            observers.append(NotificationCenter.default.addObserver(forName: event, object: session.session, queue: nil) { _ in
                onFailure(CaptureFailure("SOURCE_LOST", "Selected camera session interrupted."))
            })
        }
    }
    func interruptStartup() { delayedStart.cancel() }
    func stop() async -> CaptureFailure? {
        stopped = true
        delayedStart.cancel()
        for observer in observers { NotificationCenter.default.removeObserver(observer) }; observers = []
        await session.stop()
        var restorationFailure: CaptureFailure?
        if let prior = priorFrameDurations, camera.activeFormat == prior.format {
            do {
                try camera.lockForConfiguration()
                camera.activeVideoMinFrameDuration = prior.minimum
                camera.activeVideoMaxFrameDuration = prior.maximum
                camera.unlockForConfiguration()
            } catch { restorationFailure = CaptureFailure("DEVICE_RESTORE_FAILED", error.localizedDescription) }
        }
        priorFrameDurations = nil
        let failure = await screen.stop()
        output.setSampleBufferDelegate(nil, queue: nil)
        if let sink { sink.writer.queue.sync {} }
        return failure ?? restorationFailure
    }
    func finalizeMedia(clock: CaptureClock, failure: CaptureFailure?) async -> CaptureFailure? {
        guard let sink else { return nil }
        var reason = failure
        do { try sink.close() } catch { reason = reason ?? CaptureFailure("WRITE_FAILED", error.localizedDescription) }
        return await sink.camera.finish(clock: clock, failure: reason, observations: sink.observationURL)
    }
    func discardMedia() async {
        guard let sink else { return }
        sink.camera.discard()
        try? sink.close()
    }
}

/// Only the deliberately staggered start wait; NativeCapture remains the termination owner.
@MainActor
package final class ProbeStartDelay {
    package init() {}
    private var task: Task<Void, Error>?
    package func wait(seconds: Double) async throws {
        let pending = Task { try await Task.sleep(for: .seconds(seconds)) }
        task = pending
        defer { task = nil }
        try await withTaskCancellationHandler { try await pending.value } onCancel: { pending.cancel() }
    }
    package func cancel() { task?.cancel() }
}
