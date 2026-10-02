@preconcurrency import AVFoundation
import CoreGraphics
import Foundation
@preconcurrency import ScreenCaptureKit

/// Explicit internal selection. Source allocation and public request admission are separate gates.
package struct CaptureCameraSelection {
    package let id: String
    package let directory: URL
    package let observations: URL
    package let binding: CameraCaptureBinding?
    package init(id: String, directory: URL, observations: URL, binding: CameraCaptureBinding? = nil) {
        self.id = id; self.directory = directory; self.observations = observations; self.binding = binding
    }
}

/// Probe orchestration controls; ordinary capture retains device cadence and cursor sampling.
@MainActor
package struct CameraCaptureMeasurement {
    package var framesPerSecond: Int? = nil
    package var samplesCursor = true
    package var beforeStart: @MainActor () async throws -> Bool = { true }
    package init(framesPerSecond: Int? = nil, samplesCursor: Bool = true,
        beforeStart: @escaping @MainActor () async throws -> Bool = { true }) {
        self.framesPerSecond = framesPerSecond; self.samplesCursor = samplesCursor; self.beforeStart = beforeStart
    }
}

@MainActor
package protocol CaptureCameraDevice {
    var id: String { get }
    func makeSession(framesPerSecond: Int?) throws -> any CaptureCameraSession
}

@MainActor
package protocol CaptureCameraSession: AnyObject, Sendable {
    nonisolated var synchronizationClock: CMClockOrTimebase? { get }
    func start(ingress: CaptureClockIngress) async throws
    func observeDeviceLoss(onFailure: @escaping @Sendable (CaptureFailure) -> Void)
    func stop() async -> CaptureFailure?
}

/// Permission and exact selection precede session creation. Only the selected descriptor opens IO.
@MainActor
package struct CaptureInputPreparation {
    package init() {}
    package var requireScreenAuthorization: @MainActor (CaptureRequest) throws -> Void = ScreenCaptureInput.requireAuthorization
    package var prepareScreen: @MainActor (CaptureRequest) async throws -> any CaptureInputSession = { try await ScreenCaptureInput.prepare($0) }
    package var cameraAuthorized: @MainActor () -> Bool = { NativeCapture.cameraPermission == "authorized" }
    package var cameras: @MainActor () -> [any CaptureCameraDevice] = { NativeCapture.cameraCandidates().map { NativeCameraDevice($0) } }

    package func prepare(_ request: CaptureRequest, camera: CaptureCameraSelection? = nil,
        measurement: CameraCaptureMeasurement = .init(),
        checkInterruption: @MainActor () throws -> Void) async throws -> any CaptureInputSession {
        try checkInterruption()
        guard let camera else { return try await prepareScreen(request) }
        guard !camera.id.isEmpty,
            measurement.framesPerSecond.map({ $0 > 0 && $0 <= Int(Int32.max) }) ?? true else {
            throw CaptureFailure("INVALID_REQUEST", "Camera selection and measurement cadence must be valid.")
        }
        try camera.binding?.validate()
        guard camera.binding.map({ $0.deviceId == camera.id }) ?? true else {
            throw CaptureFailure("INVALID_REQUEST", "Camera binding differs from the selected device.")
        }
        try requireScreenAuthorization(request)
        guard cameraAuthorized() else {
            throw CaptureFailure("CAMERA_PERMISSION_REQUIRED", "Camera access must already be authorized. No permission was requested automatically.")
        }
        guard let selected = cameras().first(where: { $0.id == camera.id }) else {
            throw CaptureFailure("SOURCE_UNAVAILABLE", "The selected camera is unavailable.")
        }
        let screen = try await prepareScreen(request)
        do {
            try Task.checkCancellation(); try checkInterruption()
            return CameraCaptureInput(primary: screen,
                camera: try selected.makeSession(framesPerSecond: measurement.framesPerSecond),
                selection: camera, measurement: measurement)
        } catch {
            _ = await screen.stop()
            await screen.discardMedia()
            throw error
        }
    }
}

/// One acquisition/ingress owner; NativeCapture owns termination, closed media and publication.
@MainActor
package final class CameraCaptureInput: CaptureInputSession {
    private let primary: any CaptureInputSession
    private let camera: any CaptureCameraSession
    private let selection: CaptureCameraSelection
    private let measurement: CameraCaptureMeasurement
    private var ingress: CaptureClockIngress?
    private var observing = false
    package var width: Int { primary.width }
    package var height: Int { primary.height }
    package var requestedSourceRect: CGRect? { primary.requestedSourceRect }

    package init(primary: any CaptureInputSession, camera: any CaptureCameraSession,
        selection: CaptureCameraSelection, measurement: CameraCaptureMeasurement = .init()) {
        self.primary = primary; self.camera = camera; self.selection = selection; self.measurement = measurement
    }
    package func start(writer: CaptureWriter, output: any SCStreamOutput, framesPerSecond: Int?,
        onFailure: @escaping @Sendable (CaptureFailure) -> Void, checkInterruption: @escaping @MainActor () throws -> Void) async throws {
        let cameraWriter = try CameraWriter(directory: selection.directory,
            framesPerSecond: measurement.framesPerSecond ?? 30, binding: selection.binding)
        let ingress = try CaptureClockIngress(writer: writer, camera: cameraWriter,
            observations: selection.binding == nil ? selection.observations : selection.directory.appendingPathComponent(CameraMedia.mappingFile),
            failure: onFailure)
        self.ingress = ingress
        ingress.cameraClock = { [camera] in camera.synchronizationClock }
        observeDeviceLoss(onFailure: onFailure)
        try await primary.start(writer: writer, output: ingress,
            framesPerSecond: measurement.framesPerSecond, onFailure: onFailure, checkInterruption: checkInterruption)
        try checkInterruption()
        guard try await measurement.beforeStart() else { return }
        try Task.checkCancellation(); try checkInterruption()
        try await camera.start(ingress: ingress)
        try Task.checkCancellation(); try checkInterruption()
    }
    package func startCursorSampling(writer: CaptureWriter) {
        if measurement.samplesCursor { primary.startCursorSampling(writer: writer) }
    }
    package func observeDeviceLoss(onFailure: @escaping @Sendable (CaptureFailure) -> Void) {
        guard !observing else { return }
        observing = true
        primary.observeDeviceLoss(onFailure: onFailure)
        camera.observeDeviceLoss(onFailure: onFailure)
    }
    package func stop() async -> CaptureFailure? {
        let cameraFailure = await camera.stop()
        let primaryFailure = await primary.stop()
        if let ingress { ingress.writer.queue.sync {} }
        return primaryFailure ?? cameraFailure
    }
    package func closeMedia(clock: CaptureClock, failure: CaptureFailure?) async -> CaptureInputClosure {
        guard let ingress else { return CaptureInputClosure() }
        var reason = failure
        do { try ingress.close() } catch { reason = reason ?? CaptureFailure("WRITE_FAILED", error.localizedDescription) }
        return CaptureInputClosure(camera: await ingress.camera.close(clock: clock, failure: reason,
            observations: ingress.observationURL))
    }
    package func discardMedia() async {
        guard let ingress else { return }
        await ingress.camera.discard()
        try? ingress.close()
    }
}

@MainActor
private struct NativeCameraDevice: CaptureCameraDevice {
    let device: AVCaptureDevice
    var id: String { device.uniqueID }
    init(_ device: AVCaptureDevice) { self.device = device }
    func makeSession(framesPerSecond: Int?) throws -> any CaptureCameraSession {
        try NativeCameraSession(camera: device, framesPerSecond: framesPerSecond)
    }
}

/// SDK start/stop blocks the dedicated queue, never the control actor.
private final class CameraSessionIO: @unchecked Sendable {
    let session = AVCaptureSession()
    private let queue = DispatchQueue(label: "com.david.screenrec.camera-session")
    func start() async { await withCheckedContinuation { c in queue.async { self.session.startRunning(); c.resume() } } }
    func stop() async { await withCheckedContinuation { c in queue.async { self.session.stopRunning(); c.resume() } } }
}

@MainActor
private final class NativeCameraSession: CaptureCameraSession {
    private let camera: AVCaptureDevice
    private let framesPerSecond: Int?
    nonisolated private let io = CameraSessionIO()
    nonisolated var synchronizationClock: CMClockOrTimebase? { io.session.synchronizationClock }
    private let output = AVCaptureVideoDataOutput()
    private var observers: [NSObjectProtocol] = []
    private var priorFrameDurations: (minimum: CMTime, maximum: CMTime, format: AVCaptureDevice.Format)?

    init(camera: AVCaptureDevice, framesPerSecond: Int?) throws {
        self.camera = camera; self.framesPerSecond = framesPerSecond
        try validateCadence()
        io.session.beginConfiguration()
        defer { io.session.commitConfiguration() }
        let input = try AVCaptureDeviceInput(device: camera)
        guard io.session.canAddInput(input), io.session.canAddOutput(output) else {
            throw CaptureFailure("SOURCE_UNAVAILABLE", "Selected camera cannot provide video callbacks.")
        }
        io.session.addInput(input)
        output.videoSettings = [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA]
        output.alwaysDiscardsLateVideoFrames = true
        io.session.addOutput(output)
    }
    private func validateCadence() throws {
        guard let framesPerSecond else { return }
        guard camera.activeFormat.videoSupportedFrameRateRanges.contains(where: {
            $0.minFrameRate <= Double(framesPerSecond) && Double(framesPerSecond) <= $0.maxFrameRate
        }) else { throw CaptureFailure("FORMAT_UNAVAILABLE", "Selected camera's active format does not support requested fps.") }
    }
    func start(ingress: CaptureClockIngress) async throws {
        output.setSampleBufferDelegate(ingress, queue: ingress.writer.queue)
        try validateCadence()
        if let framesPerSecond {
            try camera.lockForConfiguration()
            priorFrameDurations = (camera.activeVideoMinFrameDuration, camera.activeVideoMaxFrameDuration, camera.activeFormat)
            camera.activeVideoMinFrameDuration = CMTime(value: 1, timescale: Int32(framesPerSecond))
            camera.activeVideoMaxFrameDuration = CMTime(value: 1, timescale: Int32(framesPerSecond))
            camera.unlockForConfiguration()
        }
        await io.start()
        guard io.session.isRunning else { throw CaptureFailure("SOURCE_UNAVAILABLE", "Camera session did not start.") }
    }
    func observeDeviceLoss(onFailure: @escaping @Sendable (CaptureFailure) -> Void) {
        guard observers.isEmpty else { return }
        observers.append(NotificationCenter.default.addObserver(forName: AVCaptureDevice.wasDisconnectedNotification,
            object: camera, queue: nil) { _ in onFailure(CaptureFailure("SOURCE_LOST", "Selected camera disconnected.")) })
        for event in [AVCaptureSession.runtimeErrorNotification, AVCaptureSession.wasInterruptedNotification] {
            observers.append(NotificationCenter.default.addObserver(forName: event, object: io.session, queue: nil) { _ in
                onFailure(CaptureFailure("SOURCE_LOST", "Selected camera session interrupted."))
            })
        }
    }
    func stop() async -> CaptureFailure? {
        for observer in observers { NotificationCenter.default.removeObserver(observer) }; observers = []
        await io.stop()
        var failure: CaptureFailure?
        if let prior = priorFrameDurations, camera.activeFormat == prior.format {
            do {
                try camera.lockForConfiguration()
                camera.activeVideoMinFrameDuration = prior.minimum
                camera.activeVideoMaxFrameDuration = prior.maximum
                camera.unlockForConfiguration()
            } catch { failure = CaptureFailure("DEVICE_RESTORE_FAILED", error.localizedDescription) }
        }
        priorFrameDurations = nil
        output.setSampleBufferDelegate(nil, queue: nil)
        return failure
    }
}
