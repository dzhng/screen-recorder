@preconcurrency import AVFoundation
import CoreGraphics
import Foundation
@preconcurrency import ScreenCaptureKit

@MainActor
public final class NativeCapture {
    private var streams: [SCStream] = []
    private var streamDelegate: CaptureStreamDelegate?
    private var generations = CaptureGeneration()
    private var sink: CaptureWriter?
    private var microphoneObserver: NSObjectProtocol?
    public var onInterruption: ((CaptureFailure) -> Void)?
    private var failure: CaptureFailure?
    private enum State { case idle, selecting, recording, paused, finalizing }
    private var state = State.idle
    /// Output pixel dimensions of the running take, fixed when streaming began. A moved or resized
    /// source never changes them.
    public private(set) var outputSize: (width: Int, height: Int)?

    public static var screenPermission: Bool { CGPreflightScreenCaptureAccess() }
    public static var microphonePermission: String {
        switch AVCaptureDevice.authorizationStatus(for: .audio) {
        case .authorized: "authorized"
        case .denied: "denied"
        case .restricted: "restricted"
        case .notDetermined: "not_determined"
        @unknown default: "unknown"
        }
    }

    public static func requestPermission(_ kind: String) async throws -> Bool {
        switch kind {
        case "screen": return CGRequestScreenCaptureAccess()
        case "microphone": return await AVCaptureDevice.requestAccess(for: .audio)
        default: throw CaptureFailure("INVALID_REQUEST", "Permission must be screen or microphone.")
        }
    }

    public init() {}

    public func start(_ request: CaptureRequest) async throws {
        guard state == .idle else {
            throw CaptureFailure("INVALID_STATE", "Capture is already active.")
        }
        let generation = generations.begin()
        state = .selecting
        defer {
            if state == .selecting {
                state = .idle
                generations.end(generation)
            }
        }
        guard Self.screenPermission else {
            throw CaptureFailure(
                "PERMISSION_REQUIRED",
                "Allow Screen Recorder in System Settings > Privacy & Security > Screen & System Audio Recording, then relaunch. No permission was requested automatically."
            )
        }
        let microphone: AVCaptureDevice?
        if request.microphone {
            guard AVCaptureDevice.authorizationStatus(for: .audio) == .authorized else {
                throw CaptureFailure(
                    "MICROPHONE_PERMISSION_REQUIRED",
                    "Microphone access is not authorized. Enable it explicitly before recording narration."
                )
            }
            let devices = AVCaptureDevice.DiscoverySession(
                deviceTypes: [.microphone, .external], mediaType: .audio, position: .unspecified
            ).devices
            microphone =
                request.microphoneDeviceID.flatMap { id in devices.first { $0.uniqueID == id } }
                ?? (request.microphoneDeviceID == nil ? AVCaptureDevice.default(for: .audio) : nil)
            guard microphone != nil else {
                throw CaptureFailure(
                    "SOURCE_UNAVAILABLE", "The selected microphone is unavailable.")
            }
        } else {
            microphone = nil
        }
        let content = try await SCShareableContent.excludingDesktopWindows(
            false, onScreenWindowsOnly: true)
        let filter: SCContentFilter
        var crop: CGRect?
        // Where the request fixed its content onscreen, in global display points. A window has no
        // such rect: only the stream reports where the window is while it is being captured.
        var requestedSourceRect: CGRect?
        switch request.source.kind {
        case "window":
            guard
                let window = content.windows.first(where: { $0.windowID == request.source.windowID }
                )
            else {
                throw CaptureFailure("SOURCE_UNAVAILABLE", "The selected window is unavailable.")
            }
            filter = SCContentFilter(desktopIndependentWindow: window)
        case "display", "region":
            guard
                let display = content.displays.first(where: {
                    $0.displayID == request.source.displayID
                })
            else {
                throw CaptureFailure("SOURCE_UNAVAILABLE", "The selected display is unavailable.")
            }
            filter = SCContentFilter(display: display, excludingWindows: [])
            requestedSourceRect = CGDisplayBounds(display.displayID)
            if request.source.kind == "region" {
                guard let region = request.source.region else {
                    throw CaptureFailure(
                        "INVALID_REQUEST",
                        "Region capture requires display-local point coordinates.")
                }
                let rect = CGRect(
                    x: region.x, y: region.y, width: region.width, height: region.height)
                let bounds = CGRect(origin: .zero, size: filter.contentRect.size)
                guard [region.x, region.y, region.width, region.height].allSatisfy(\.isFinite),
                    region.width > 0, region.height > 0, bounds.contains(rect)
                else {
                    throw CaptureFailure(
                        "INVALID_REQUEST",
                        "Region must be a nonempty rectangle inside the selected display.")
                }
                crop = rect
                requestedSourceRect = CGRect(
                    x: CGDisplayBounds(display.displayID).minX + rect.minX,
                    y: CGDisplayBounds(display.displayID).minY + rect.minY, width: rect.width,
                    height: rect.height)
            }
        default:
            throw CaptureFailure(
                "INVALID_REQUEST", "Source kind must be display, window, or region.")
        }
        let size = (crop ?? filter.contentRect).size
        let pixels = CGSize(
            width: size.width * CGFloat(filter.pointPixelScale),
            height: size.height * CGFloat(filter.pointPixelScale))
        let scale = min(1, 4096 / max(pixels.width, pixels.height))
        let width = max(2, Int(pixels.width * scale) / 2 * 2)
        let height = max(2, Int(pixels.height * scale) / 2 * 2)
        outputSize = (width, height)
        let onFailure: @Sendable (CaptureFailure) -> Void = { [weak self] reason in
            Task { @MainActor in await self?.interrupt(reason, generation: generation) }
        }
        let writer = try CaptureWriter(
            request: request, width: width, height: height, sessionID: generation.uuidString,
            requestedSourceRect: requestedSourceRect, onFailure: onFailure)
        var started = false
        defer {
            if !started {
                writer.cancel()
                streamDelegate = nil
            }
        }
        let delegate = CaptureStreamDelegate(onFailure: onFailure)
        streamDelegate = delegate
        let config = SCStreamConfiguration()
        config.width = width
        config.height = height
        config.minimumFrameInterval = CMTime(value: 1, timescale: 30)
        config.queueDepth = 3
        config.showsCursor = false
        config.showMouseClicks = false
        config.captureDynamicRange = .SDR
        config.pixelFormat = kCVPixelFormatType_32BGRA
        config.colorSpaceName = CGColorSpace.sRGB
        config.preservesAspectRatio = true
        config.ignoreShadowsSingleWindow = true
        config.shouldBeOpaque = true
        if let crop { config.sourceRect = crop }
        config.captureMicrophone = request.microphone
        config.microphoneCaptureDeviceID = microphone?.uniqueID
        let video = SCStream(filter: filter, configuration: config, delegate: delegate)
        try video.addStreamOutput(writer, type: .screen, sampleHandlerQueue: writer.queue)
        if request.microphone {
            try video.addStreamOutput(writer, type: .microphone, sampleHandlerQueue: writer.queue)
        }
        var prepared = [video]
        if request.systemAudio {
            guard let display = content.displays.first else {
                throw CaptureFailure(
                    "SOURCE_UNAVAILABLE", "No display is available for whole-system audio capture.")
            }
            // An independent whole-display filter keeps window selection from narrowing system audio.
            let audioConfig = SCStreamConfiguration()
            audioConfig.width = 2
            audioConfig.height = 2
            audioConfig.capturesAudio = true
            audioConfig.excludesCurrentProcessAudio = true
            audioConfig.sampleRate = 48_000
            audioConfig.channelCount = 2
            let audio = SCStream(
                filter: SCContentFilter(display: display, excludingWindows: []),
                configuration: audioConfig, delegate: delegate)
            try audio.addStreamOutput(writer, type: .audio, sampleHandlerQueue: writer.queue)
            prepared.append(audio)
        }
        sink = writer
        failure = nil
        do {
            for stream in prepared {
                try await stream.startCapture()
                streams.append(stream)
                if let failure { throw failure }
            }
        } catch {
            for stream in streams { try? await stream.stopCapture() }
            streams = []
            sink = nil
            throw (error as? CaptureFailure)
                ?? CaptureFailure("NATIVE_CAPTURE_FAILED", error.localizedDescription)
        }
        state = .recording
        started = true
        writer.startCursorSampling()
        if let microphone {
            let deviceID = microphone.uniqueID
            microphoneObserver = NotificationCenter.default.addObserver(
                forName: AVCaptureDevice.wasDisconnectedNotification, object: nil, queue: .main
            ) { [weak self] notification in
                guard (notification.object as? AVCaptureDevice)?.uniqueID == deviceID else {
                    return
                }
                Task { @MainActor in
                    await self?.interrupt(
                        CaptureFailure("SOURCE_LOST", "The selected microphone disconnected."),
                        generation: generation)
                }
            }
        }
    }

    public func pause() throws {
        guard let sink, failure == nil, state == .recording || state == .paused else {
            throw CaptureFailure("INVALID_STATE", "No healthy capture is active.")
        }
        if state == .recording {
            sink.pause()
            state = .paused
        }
    }

    public func resume() throws {
        guard let sink, failure == nil, state == .recording || state == .paused else {
            throw CaptureFailure("INVALID_STATE", "No healthy capture is active.")
        }
        if state == .paused {
            sink.resume()
            state = .recording
        }
    }

    public func stop() async throws -> CaptureResult {
        guard let sink, let generation = generations.current,
            state == .recording || state == .paused
        else {
            throw CaptureFailure("INVALID_STATE", "No capture is ready to stop.")
        }
        state = .finalizing
        sink.seal()
        if let microphoneObserver { NotificationCenter.default.removeObserver(microphoneObserver) }
        microphoneObserver = nil
        let stopping = streams
        streams = []
        for stream in stopping {
            do { try await stream.stopCapture() } catch {
                failure =
                    failure ?? CaptureFailure("NATIVE_CAPTURE_FAILED", error.localizedDescription)
            }
        }
        let result = await sink.finish(failure: failure)
        outputSize = nil
        self.sink = nil
        streamDelegate = nil
        generations.end(generation)
        state = .idle
        return result
    }

    private func interrupt(_ reason: CaptureFailure, generation: UUID) async {
        guard generations.accepts(generation), sink != nil, failure == nil else { return }
        failure = reason
        sink?.seal()
        let stopping = streams
        streams = []
        for stream in stopping { try? await stream.stopCapture() }
        onInterruption?(reason)
    }
}

private final class CaptureStreamDelegate: NSObject, SCStreamDelegate, @unchecked Sendable {
    private let onFailure: @Sendable (CaptureFailure) -> Void

    init(onFailure: @escaping @Sendable (CaptureFailure) -> Void) {
        self.onFailure = onFailure
    }

    func stream(_ stream: SCStream, didStopWithError error: Error) {
        onFailure(CaptureFailure("SOURCE_LOST", error.localizedDescription))
    }
}
