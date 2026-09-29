@preconcurrency import AVFoundation
import CoreGraphics
import Foundation
@preconcurrency import ScreenCaptureKit

/// Owns physical input and observations only; media closure and publication outlive this session.
@MainActor
package protocol CaptureInputSession: AnyObject {
    var width: Int { get }
    var height: Int { get }
    var requestedSourceRect: CGRect? { get }
    func start(writer: CaptureWriter, onFailure: @escaping @Sendable (CaptureFailure) -> Void,
        checkInterruption: () throws -> Void) async throws
    func startCursorSampling(writer: CaptureWriter)
    func observeDeviceLoss(onFailure: @escaping @Sendable (CaptureFailure) -> Void)
    func stop() async -> CaptureFailure?
}

@MainActor
package final class ScreenCaptureInput: CaptureInputSession {
    package let width: Int
    package let height: Int
    package let requestedSourceRect: CGRect?
    private let request: CaptureRequest
    private let content: SCShareableContent
    private let filter: SCContentFilter
    private let crop: CGRect?
    private let microphone: AVCaptureDevice?
    private var streams: [SCStream] = []
    private var delegate: CaptureStreamDelegate?
    private var microphoneObserver: NSObjectProtocol?

    private init(request: CaptureRequest, content: SCShareableContent, filter: SCContentFilter,
        crop: CGRect?, microphone: AVCaptureDevice?, width: Int, height: Int, requestedSourceRect: CGRect?) {
        self.request = request
        self.content = content
        self.filter = filter
        self.crop = crop
        self.microphone = microphone
        self.width = width
        self.height = height
        self.requestedSourceRect = requestedSourceRect
    }

    package static func prepare(_ request: CaptureRequest) async throws -> ScreenCaptureInput {
        guard NativeCapture.screenPermission else {
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
            let devices = microphoneCandidates()
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
            filter = Self.displayFilter(display, in: content)
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
        return ScreenCaptureInput(request: request, content: content, filter: filter,
            crop: crop, microphone: microphone, width: width, height: height,
            requestedSourceRect: requestedSourceRect)
    }

    package func start(writer: CaptureWriter, onFailure: @escaping @Sendable (CaptureFailure) -> Void,
        checkInterruption: () throws -> Void) async throws {
        let delegate = CaptureStreamDelegate(onFailure: onFailure)
        self.delegate = delegate
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
        do {
            for stream in prepared {
                try await stream.startCapture()
                streams.append(stream)
                try checkInterruption()
            }
        } catch {
            for stream in streams { try? await stream.stopCapture() }
            streams = []
            throw (error as? CaptureFailure)
                ?? CaptureFailure("NATIVE_CAPTURE_FAILED", error.localizedDescription)
        }
    }

    package func startCursorSampling(writer: CaptureWriter) { writer.startCursorSampling() }

    package func observeDeviceLoss(onFailure: @escaping @Sendable (CaptureFailure) -> Void) {
        if let microphone {
            let deviceID = microphone.uniqueID
            microphoneObserver = NotificationCenter.default.addObserver(
                forName: AVCaptureDevice.wasDisconnectedNotification, object: nil, queue: .main
            ) { notification in
                guard (notification.object as? AVCaptureDevice)?.uniqueID == deviceID else {
                    return
                }
                onFailure(CaptureFailure("SOURCE_LOST", "The selected microphone disconnected."))
            }
        }
    }

    package func stop() async -> CaptureFailure? {
        if let microphoneObserver { NotificationCenter.default.removeObserver(microphoneObserver) }
        microphoneObserver = nil
        let stopping = streams
        streams = []
        var failure: CaptureFailure?
        for stream in stopping {
            do { try await stream.stopCapture() }
            catch { failure = failure ?? CaptureFailure("NATIVE_CAPTURE_FAILED", error.localizedDescription) }
        }
        delegate = nil
        return failure
    }

    /// A whole display, minus this application's own windows, so nothing this app is showing ends
    /// up inside a take of the screen it is showing it on.
    ///
    /// Shareable content only names applications that have something on screen, so an app showing
    /// nothing has nothing here to exclude; the panels a take floats over the screen keep
    /// themselves out of every capture instead.
    private static func displayFilter(_ display: SCDisplay, in content: SCShareableContent)
        -> SCContentFilter
    {
        let own = CaptureExclusion.ownApplications(
            among: content.applications, bundleIdentifier: Bundle.main.bundleIdentifier,
            identity: \.bundleIdentifier)
        guard !own.isEmpty else { return SCContentFilter(display: display, excludingWindows: []) }
        return SCContentFilter(display: display, excludingApplications: own, exceptingWindows: [])
    }

    package static func microphoneCandidates() -> [AVCaptureDevice] {
        AVCaptureDevice.DiscoverySession(
            deviceTypes: [.microphone, .external], mediaType: .audio, position: .unspecified
        ).devices
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
