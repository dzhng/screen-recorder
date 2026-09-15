import AppKit
import ScreenCaptureKit
import ScreenRecorderCapture

/**
 The app's half of capture control. The service allocates a take's identity and directory and asks
 for a transition; this owns the device, the permissions and the media, and reports back what the
 session actually did. It keeps no catalog of its own: the only state here is which allocated take
 the one capture session is working on.
 */
@MainActor
final class CaptureController {
    private struct Take {
        let recordingId: String
        let sourceId: String
    }

    private let capture = NativeCapture()
    private var take: Take?
    /// Set only in fixture mode: the one window of this app's own that capture may see or record.
    private let fixtureWindow: NSWindow?
    private weak var host: ServiceHost?

    init(fixtureWindow: NSWindow?) {
        self.fixtureWindow = fixtureWindow
        capture.onInterruption = { [weak self] reason in
            Task { @MainActor in await self?.interrupted(reason) }
        }
    }

    func attach(to host: ServiceHost) {
        self.host = host
    }

    var isCapturing: Bool { take != nil }

    func handle(_ operation: String, _ params: Data) async -> Result<Data, ServiceFailure> {
        do {
            guard let fields = try JSONSerialization.jsonObject(with: params) as? [String: Any]
            else {
                throw CaptureFailure("INVALID_REQUEST", "Capture parameters must be an object.")
            }
            return .success(
                try JSONSerialization.data(withJSONObject: try await perform(operation, fields)))
        } catch let failure as CaptureFailure {
            return .failure(ServiceFailure(code: failure.code, message: failure.message))
        } catch {
            return .failure(
                ServiceFailure(
                    code: "NATIVE_CAPTURE_FAILED", message: error.localizedDescription))
        }
    }

    /// Normal quit finalizes the running take and waits for the library to store its outcome, so
    /// an ordinary quit leaves a finished recording rather than one more take to reconcile.
    func finalizeBeforeQuit() async {
        guard take != nil else { return }
        guard let outcome = try? await finish(reason: "APP_QUIT") else { return }
        await send(report: outcome)
    }

    /// The service this take reports to is gone. Native still owns the media, so the take is
    /// finalized into its own durable journal and left for the next service to reconcile.
    func serviceLost() async {
        guard take != nil else { return }
        capture.note("finalizing", reason: "SERVICE_LOST")
        _ = try? await capture.stop()
        take = nil
    }

    private func perform(_ operation: String, _ params: [String: Any]) async throws -> Any {
        switch operation {
        case "capture.sources": return try await sources()
        case "capture.status": return status()
        case "capture.start": return try await start(params)
        case "capture.pause":
            try expect(params)
            try capture.pause()
            return try transition("paused")
        case "capture.resume":
            try expect(params)
            try capture.resume()
            return try transition("recording")
        case "capture.stop":
            try expect(params)
            return try await finish(reason: nil)
        case "capture.cancel":
            try expect(params)
            let discarded = try transition("finalizing")
            await capture.discard()
            take = nil
            return discarded
        default:
            throw CaptureFailure(
                "UNKNOWN_OPERATION", "Unknown native capture operation: \(operation)")
        }
    }

    private func sources() async throws -> [String: Any] {
        guard NativeCapture.screenPermission else {
            throw CaptureFailure(
                "PERMISSION_REQUIRED",
                "Screen recording permission is not authorized. Allow Screen Recorder in System Settings > Privacy & Security > Screen & System Audio Recording. No permission was requested automatically."
            )
        }
        let content = try await SCShareableContent.excludingDesktopWindows(
            false, onScreenWindowsOnly: true)
        let windows = content.windows.filter { window in
            fixtureWindow.map { UInt32($0.windowNumber) == window.windowID } ?? true
        }
        return [
            "displays": fixtureWindow != nil
                ? []
                : content.displays.map {
                    ["id": Int($0.displayID), "width": $0.width, "height": $0.height]
                },
            "windows": windows.map {
                [
                    "id": Int($0.windowID), "title": $0.title ?? "",
                    "application": $0.owningApplication?.applicationName ?? "",
                ]
            },
        ]
    }

    private func status() -> [String: Any] {
        [
            "state": capture.deviceState,
            "recordingId": take?.recordingId as Any? ?? NSNull(),
            "sourceId": take?.sourceId as Any? ?? NSNull(),
        ]
    }

    private func start(_ params: [String: Any]) async throws -> [String: Any] {
        guard let recordingId = params["recordingId"] as? String, !recordingId.isEmpty,
            let sourceId = params["sourceId"] as? String, !sourceId.isEmpty,
            let directory = params["outputDirectory"] as? String, directory.hasPrefix("/"),
            let selected = params["source"] as? [String: Any]
        else {
            throw CaptureFailure(
                "INVALID_REQUEST", "capture.start needs an allocated take, directory and source.")
        }
        guard take == nil else {
            throw CaptureFailure("INVALID_STATE", "Another take is already capturing.")
        }
        let request = CaptureRequest(
            source: try source(from: selected), outputDirectory: directory, sourceId: sourceId,
            microphone: params["microphone"] as? Bool ?? false,
            microphoneDeviceID: params["microphoneDeviceId"] as? String,
            systemAudio: params["systemAudio"] as? Bool ?? false)
        try await capture.start(request)
        take = Take(recordingId: recordingId, sourceId: sourceId)
        do {
            return try report(state: "recording")
        } catch {
            // The take is running but cannot number its own transitions, so it is not reportable.
            await capture.discard()
            take = nil
            throw error
        }
    }

    /// Fixture mode exposes exactly one source: this app's own window. Nothing else on the
    /// display can be selected, and the ordinary service and controller path is unchanged.
    private func source(from selected: [String: Any]) throws -> CaptureSource {
        let kind = selected["kind"] as? String ?? ""
        let windowID = (selected["windowId"] as? NSNumber)?.uint32Value
        if let fixtureWindow {
            guard kind == "window", windowID == UInt32(fixtureWindow.windowNumber) else {
                throw CaptureFailure(
                    "SOURCE_UNAVAILABLE",
                    "This app is running its capture fixture and records only its own window.")
            }
            return CaptureSource(kind: "window", windowID: windowID)
        }
        let displayID = (selected["displayId"] as? NSNumber)?.uint32Value
        switch kind {
        case "window":
            guard let windowID else { throw invalidSource }
            return CaptureSource(kind: "window", windowID: windowID)
        case "display":
            guard let displayID else { throw invalidSource }
            return CaptureSource(kind: "display", displayID: displayID)
        case "region":
            guard let displayID, let x = selected["x"] as? Double, let y = selected["y"] as? Double,
                let width = selected["width"] as? Double, let height = selected["height"] as? Double
            else { throw invalidSource }
            return CaptureSource(
                kind: "region", displayID: displayID,
                region: CaptureRegion(x: x, y: y, width: width, height: height))
        default:
            throw invalidSource
        }
    }

    private var invalidSource: CaptureFailure {
        CaptureFailure("INVALID_REQUEST", "Source must name a display, window or region.")
    }

    /// Finalizes the running take: the library hears that it is finalizing before the encoder is
    /// asked to close, and hears the outcome once the media is actually on disk.
    private func finish(reason: String?) async throws -> [String: Any] {
        guard let active = take else {
            throw CaptureFailure("INVALID_STATE", "No take is capturing.")
        }
        await send(report: try transition("finalizing", reason: reason))
        let result = try await capture.stop()
        take = nil
        let interrupted = result.failure != nil
        return try report(
            state: interrupted ? "interrupted" : "complete",
            reason: interrupted ? result.failure?.code ?? reason : nil,
            // A take with no decoded video reports no duration at all: that is a settled claim
            // that nothing survived, not a zero-length recording.
            durationUs: interrupted && result.durationUs == 0 ? nil : result.durationUs,
            take: active)
    }

    private func interrupted(_ reason: CaptureFailure) async {
        guard take != nil else { return }
        guard let outcome = try? await finish(reason: reason.code) else {
            take = nil
            return
        }
        await send(report: outcome)
    }

    private func transition(_ state: String, reason: String? = nil) throws -> [String: Any] {
        capture.note(state, reason: reason)
        return try report(state: state, reason: reason)
    }

    private func report(
        state: String, reason: String? = nil, durationUs: Int64? = nil, take existing: Take? = nil
    ) throws -> [String: Any] {
        guard let take = existing ?? self.take else {
            throw CaptureFailure("INVALID_STATE", "No take is capturing.")
        }
        guard let sequence = capture.lifecycleSequence else {
            throw CaptureFailure(
                "JOURNAL_FAILED", "The take could not record its own transition.")
        }
        var report: [String: Any] = [
            "recordingId": take.recordingId, "sourceId": take.sourceId, "sequence": sequence,
            "state": state,
        ]
        if let reason { report["reason"] = reason }
        if state == "complete" || state == "interrupted" {
            report["sourceDurationUs"] = durationUs as Any? ?? NSNull()
        }
        return report
    }

    private func expect(_ params: [String: Any]) throws {
        guard let recordingId = params["recordingId"] as? String else {
            throw CaptureFailure("INVALID_REQUEST", "Capture control names its recording.")
        }
        guard let take, take.recordingId == recordingId else {
            throw CaptureFailure(
                "INVALID_STATE", "This app's capture session is not holding that take.")
        }
    }

    /// Tells the library about a transition it did not ask for. The answer is awaited so a take
    /// that is being finalized is stored before the app stops reporting.
    private func send(report: [String: Any]) async {
        guard let host, let params = try? JSONSerialization.data(withJSONObject: report) else {
            return
        }
        await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
            host.call(operation: "capture.report", params: params) { _ in
                continuation.resume()
            }
        }
    }
}
