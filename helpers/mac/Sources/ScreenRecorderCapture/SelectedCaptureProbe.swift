@preconcurrency import AVFoundation
import CoreGraphics
import Foundation
@preconcurrency import ScreenCaptureKit

/// An app-identity measurement entry point, not a production recording operation.
@MainActor
public final class SelectedCaptureProbe {
    public init() {}
    private var stopping = false
    private var stopStartup: (() -> Void)?

    /// Graceful user stop wakes waits; it never cancels the shared publication task.
    public func requestStop() {
        guard !stopping else { return }
        stopping = true
        stopStartup?()
    }

    public func run(action: String, requestPath: String? = nil) async throws -> Data {
        switch action {
        case "validate":
            let request = try Self.read(requestPath)
            try request.validate()
            return try JSONEncoder().encode(request)
        case "recover":
            let request = try Self.read(requestPath)
            try request.validate()
            let root = URL(fileURLWithPath: request.outputDirectory)
            let lease = try CaptureJournalLease(directory: root.appendingPathComponent("camera").path)
            defer { lease.release() }
            return try JSONEncoder().encode(await ProbeCameraMedia.publish(lease: lease,
                observationURL: root.appendingPathComponent("timestamps.jsonl")))
        case "status":
            return try JSONSerialization.data(withJSONObject: [
                "screen": NativeCapture.screenPermission,
                "camera": NativeCapture.cameraPermission, "microphone": NativeCapture.microphonePermission,
                "bundleIdentifier": Bundle.main.bundleIdentifier ?? "unbundled",
                "executable": Bundle.main.executableURL?.path ?? "unknown",
            ])
        case "sources":
            guard NativeCapture.screenPermission else {
                throw CaptureFailure("PERMISSION_REQUIRED", "Screen access must already be authorized for discovery.")
            }
            let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)
            return try JSONSerialization.data(withJSONObject: [
                "cameras": NativeCapture.cameraDevices().map { ["id": $0.id, "name": $0.name] },
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
            let request = try Self.read(requestPath)
            try request.validate()
            // Every grant is checked before enumeration, capture inputs or output creation.
            try request.requireAuthorization(screen: NativeCapture.screenPermission,
                camera: NativeCapture.cameraPermission == "authorized",
                microphone: NativeCapture.microphonePermission == "authorized")
            let root = URL(fileURLWithPath: request.outputDirectory)
            guard !FileManager.default.fileExists(atPath: root.path) else {
                throw CaptureFailure("INVALID_REQUEST", "Evidence destination must not already exist.")
            }
            let devices = NativeCapture.cameraCandidates()
            try SelectedCaptureRequest.requireDevice(request.cameraID, among: devices.map(\.uniqueID), role: "camera")
            guard let camera = devices.first(where: { $0.uniqueID == request.cameraID }) else {
                throw CaptureFailure("SOURCE_UNAVAILABLE", "Selected camera disappeared.")
            }
            let screenRequest = CaptureRequest(source: request.source,
                outputDirectory: root.appendingPathComponent("screen").path,
                microphone: request.microphone.enabled, microphoneDeviceID: request.microphone.deviceID)
            guard !stopping else { throw CancellationError() }
            let screen = try await ScreenCaptureInput.prepare(screenRequest)
            guard !stopping else { throw CancellationError() }
            let input = try SelectedProbeInput(screen: screen, camera: camera, request: request)
            try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true,
                attributes: [.posixPermissions: 0o700])
            try JSONEncoder().encode(request).write(to: root.appendingPathComponent("request.json"), options: .atomic)
            let capture = NativeCapture(prepareInput: { _ in input })
            stopStartup = { input.requestStop() }
            capture.onInterruption = { _ in input.interruptStartup() }
            defer { stopStartup = nil }
            if stopping { input.requestStop() }
            return try await record(capture, request: request, screenRequest: screenRequest)

        default: throw CaptureFailure("INVALID_REQUEST", "Unknown selected-device probe action.")
        }
    }
    /// Shared selected-probe run: physical closure and publication stay in NativeCapture.
    package func record(_ capture: NativeCapture, request: SelectedCaptureRequest,
        screenRequest: CaptureRequest) async throws -> Data {
        var interrupted = false
        let priorInterruption = capture.onInterruption
        capture.onInterruption = { reason in interrupted = true; priorInterruption?(reason) }
        func wait(_ seconds: Double) async throws {
            let deadline = ContinuousClock.now.advanced(by: .seconds(seconds))
            while !stopping && !interrupted && ContinuousClock.now < deadline {
                try await Task.sleep(for: .milliseconds(50))
            }
        }
        do {
            try await capture.start(screenRequest)
            if let pause = request.pause {
                let before = pause.atSeconds - request.cameraDelaySeconds
                guard before > 0 else { throw CaptureFailure("INVALID_REQUEST", "Pause must follow camera startup.") }
                try await wait(before)
                if !stopping && !interrupted { try capture.pause() }
                try await wait(pause.durationSeconds)
                if !stopping && !interrupted { try capture.resume() }
                try await wait(request.durationSeconds - pause.atSeconds - pause.durationSeconds)
            } else { try await wait(request.durationSeconds - request.cameraDelaySeconds) }
            let result = try await capture.stop()
            let data = try JSONEncoder().encode(result)
            try data.write(to: URL(fileURLWithPath: request.outputDirectory)
                .appendingPathComponent("screen-result.json"), options: .atomic)
            return data
        } catch {
            if capture.deviceState != "idle" { _ = try? await capture.stop() }
            throw error
        }
    }
    private static func read(_ path: String?) throws -> SelectedCaptureRequest {
        guard let path else { throw CaptureFailure("INVALID_REQUEST", "Supply a selected-device request file.") }
        return try JSONDecoder().decode(SelectedCaptureRequest.self, from: Data(contentsOf: URL(fileURLWithPath: path)))
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
        if stopRequested { return }
        try await delayedStart.wait(seconds: request.cameraDelaySeconds)
        if stopRequested { return }
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
    private var stopRequested = false
    func requestStop() { stopRequested = true; delayedStart.finish() }
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
    private var finished = false
    package func wait(seconds: Double) async throws {
        if finished { return }
        let pending = Task { try await Task.sleep(for: .seconds(seconds)) }
        task = pending
        defer { task = nil }
        do { try await withTaskCancellationHandler { try await pending.value } onCancel: { pending.cancel() } }
        catch is CancellationError where finished && !Task.isCancelled { return }
    }
    package func finish() { finished = true; task?.cancel() }
    package func cancel() { task?.cancel() }
}
