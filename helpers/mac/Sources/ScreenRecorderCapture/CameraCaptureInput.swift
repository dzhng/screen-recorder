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
    func makeSession(framesPerSecond: Int?, microphone: AVCaptureDevice?) throws -> any CaptureCameraSession
}

@MainActor
package protocol CaptureCameraSession: AnyObject, Sendable {
    var width: Int { get }
    var height: Int { get }
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
        if request.source.kind == "camera" {
            guard camera == nil, request.camera == nil, let id = request.source.deviceID, !id.isEmpty,
                measurement.framesPerSecond.map({ $0 > 0 && $0 <= Int(Int32.max) }) ?? true else {
                throw CaptureFailure("INVALID_REQUEST", "Primary camera requires one explicit device and no companion camera.")
            }
            guard cameraAuthorized() else {
                throw CaptureFailure("CAMERA_PERMISSION_REQUIRED", "Camera access must already be authorized. No permission was requested automatically.")
            }
            let microphone: AVCaptureDevice?
            if request.microphone {
                guard NativeCapture.microphonePermission == "authorized" else {
                    throw CaptureFailure("MICROPHONE_PERMISSION_REQUIRED", "Microphone access must already be authorized.")
                }
                microphone = request.microphoneDeviceID.flatMap { id in NativeCapture.microphoneCandidates().first { $0.uniqueID == id } }
                    ?? (request.microphoneDeviceID == nil ? AVCaptureDevice.default(for: .audio) : nil)
                guard microphone != nil else { throw CaptureFailure("SOURCE_UNAVAILABLE", "The selected microphone is unavailable.") }
            } else { microphone = nil }
            if request.systemAudio { try requireScreenAuthorization(request) }
            guard let selected = cameras().first(where: { $0.id == id }) else {
                throw CaptureFailure("SOURCE_UNAVAILABLE", "The selected camera is unavailable.")
            }
            let session = try selected.makeSession(framesPerSecond: measurement.framesPerSecond, microphone: microphone)
            return PrimaryCameraCaptureInput(camera: session, systemAudio: request.systemAudio)
        }
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
                camera: try selected.makeSession(framesPerSecond: measurement.framesPerSecond, microphone: nil),
                selection: camera, measurement: measurement)
        } catch {
            _ = await screen.stop()
            await screen.discardMedia()
            throw error
        }
    }
}

/// Camera pictures and optional narration share the AV session clock and ordinary primary writer.
@MainActor
private final class PrimaryCameraCaptureInput: CaptureInputSession {
    private let camera: any CaptureCameraSession
    private let systemAudio: Bool
    private let acquisition = CaptureStreamInputs()
    private var ingress: CaptureClockIngress?
    private var audioDelegate: CaptureStreamDelegate?
    private var observing = false
    var width: Int { camera.width }
    var height: Int { camera.height }
    let requestedSourceRect: CGRect? = nil
    init(camera: any CaptureCameraSession, systemAudio: Bool) { self.camera = camera; self.systemAudio = systemAudio }
    func start(writer: CaptureWriter, output: any SCStreamOutput, framesPerSecond: Int?,
        onFailure: @escaping @Sendable (CaptureFailure) -> Void, checkInterruption: @escaping @MainActor () throws -> Void) async throws {
        let ingress = try CaptureClockIngress(writer: writer, destination: .primary(width: width, height: height), failure: onFailure)
        self.ingress = ingress
        ingress.captureSessionClock = { [camera] in camera.synchronizationClock }
        var operations = [CaptureStreamOperation(start: { [self] in
            observeDeviceLoss(onFailure: onFailure)
            try await camera.start(ingress: ingress)
        },
            stop: { [camera] in if let failure = await camera.stop() { throw failure } })]
        if systemAudio {
            let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)
            try Task.checkCancellation(); try checkInterruption()
            let delegate = CaptureStreamDelegate(onFailure: onFailure)
            audioDelegate = delegate
            let stream = try WholeSystemAudioCapture.stream(content: content, output: ingress, queue: writer.queue, delegate: delegate)
            operations.append(CaptureStreamOperation(start: { try await stream.startCapture() }, stop: { try await stream.stopCapture() }))
        }
        try await acquisition.start(operations, checkInterruption: checkInterruption)
    }
    func startCursorSampling(writer: CaptureWriter) {}
    func observeDeviceLoss(onFailure: @escaping @Sendable (CaptureFailure) -> Void) {
        guard !observing else { return }; observing = true
        camera.observeDeviceLoss(onFailure: onFailure)
    }
    func stop() async -> CaptureFailure? {
        let failure = await acquisition.stop().value
        if let ingress { ingress.writer.queue.sync {} }
        audioDelegate = nil
        return failure
    }
    func closeMedia(clock: CaptureClock, failure: CaptureFailure?) async -> CaptureInputClosure {
        do { try ingress?.close(); return CaptureInputClosure() }
        catch { return CaptureInputClosure(failure: CaptureFailure("WRITE_FAILED", error.localizedDescription)) }
    }
    func discardMedia() async { try? ingress?.close() }
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
        let ingress = try CaptureClockIngress(writer: writer, destination: .companion(cameraWriter),
            observations: selection.binding == nil ? selection.observations : selection.directory.appendingPathComponent(CameraMedia.mappingFile),
            failure: onFailure)
        self.ingress = ingress
        ingress.captureSessionClock = { [camera] in camera.synchronizationClock }
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
        return CaptureInputClosure(camera: await ingress.companion!.close(clock: clock, failure: reason,
            observations: ingress.observationURL!))
    }
    package func discardMedia() async {
        guard let ingress else { return }
        await ingress.companion!.discard()
        try? ingress.close()
    }
}

@MainActor
private struct NativeCameraDevice: CaptureCameraDevice {
    let device: AVCaptureDevice
    var id: String { device.uniqueID }
    init(_ device: AVCaptureDevice) { self.device = device }
    func makeSession(framesPerSecond: Int?, microphone: AVCaptureDevice?) throws -> any CaptureCameraSession {
        try NativeCameraSession(camera: device, framesPerSecond: framesPerSecond, microphone: microphone)
    }
}

/// SDK start/stop blocks the dedicated queue, never the control actor.
private final class CameraSessionIO: @unchecked Sendable {
    let session = AVCaptureSession()
    private let queue = DispatchQueue(label: "com.dzhng.screenrec.camera-session")
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
    private let audioOutput: AVCaptureAudioDataOutput?
    private let microphone: AVCaptureDevice?
    private(set) var width = 0
    private(set) var height = 0
    private var observers: [NSObjectProtocol] = []
    private var priorFrameDurations: (minimum: CMTime, maximum: CMTime, format: AVCaptureDevice.Format)?

    init(camera: AVCaptureDevice, framesPerSecond: Int?, microphone: AVCaptureDevice?) throws {
        self.camera = camera; self.framesPerSecond = framesPerSecond
        self.microphone = microphone
        audioOutput = microphone.map { _ in AVCaptureAudioDataOutput() }
        try validateCadence()
        io.session.beginConfiguration()
        var configured = false
        defer { if !configured { io.session.commitConfiguration() } }
        let input = try AVCaptureDeviceInput(device: camera)
        guard io.session.canAddInput(input), io.session.canAddOutput(output) else {
            throw CaptureFailure("SOURCE_UNAVAILABLE", "Selected camera cannot provide video callbacks.")
        }
        io.session.addInput(input)
        output.videoSettings = [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA]
        output.alwaysDiscardsLateVideoFrames = true
        io.session.addOutput(output)
        if let microphone, let audioOutput {
            let audioInput = microphone.uniqueID == camera.uniqueID ? input : try AVCaptureDeviceInput(device: microphone)
            if audioInput !== input {
                guard io.session.canAddInput(audioInput) else {
                    throw CaptureFailure("SOURCE_UNAVAILABLE", "Selected microphone cannot provide audio alongside the camera.")
                }
                io.session.addInput(audioInput)
            }
            guard io.session.canAddOutput(audioOutput) else {
                throw CaptureFailure("SOURCE_UNAVAILABLE", "Selected microphone cannot provide audio callbacks.")
            }
            // Automatic connections can choose a camera's audio ports instead of the selected mic.
            io.session.addOutputWithNoConnections(audioOutput)
            let ports = audioInput.ports.filter { $0.mediaType == .audio }
            guard !ports.isEmpty else { throw CaptureFailure("SOURCE_UNAVAILABLE", "Selected microphone has no audio ports.") }
            let connection = AVCaptureConnection(inputPorts: ports, output: audioOutput)
            guard io.session.canAddConnection(connection) else {
                throw CaptureFailure("SOURCE_UNAVAILABLE", "Selected microphone cannot connect its audio output.")
            }
            io.session.addConnection(connection)
            // Device-native LPCM; CapturePCM owns representation normalization without resampling.
            audioOutput.audioSettings = nil
        }
        io.session.commitConfiguration(); configured = true
        let dimensions = CMVideoFormatDescriptionGetDimensions(camera.activeFormat.formatDescription)
        width = Int(dimensions.width); height = Int(dimensions.height)
        guard width > 0, height > 0 else { throw CaptureFailure("FORMAT_UNAVAILABLE", "Selected camera has no usable picture dimensions.") }
    }
    private func validateCadence() throws {
        guard let framesPerSecond else { return }
        guard camera.activeFormat.videoSupportedFrameRateRanges.contains(where: {
            $0.minFrameRate <= Double(framesPerSecond) && Double(framesPerSecond) <= $0.maxFrameRate
        }) else { throw CaptureFailure("FORMAT_UNAVAILABLE", "Selected camera's active format does not support requested fps.") }
    }
    func start(ingress: CaptureClockIngress) async throws {
        output.setSampleBufferDelegate(ingress, queue: ingress.writer.queue)
        audioOutput?.setSampleBufferDelegate(ingress, queue: ingress.writer.queue)
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
        if let microphone {
            observers.append(NotificationCenter.default.addObserver(forName: AVCaptureDevice.wasDisconnectedNotification,
                object: microphone, queue: nil) { _ in onFailure(CaptureFailure("SOURCE_LOST", "Selected microphone disconnected.")) })
        }
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
        audioOutput?.setSampleBufferDelegate(nil, queue: nil)
        return failure
    }
}
