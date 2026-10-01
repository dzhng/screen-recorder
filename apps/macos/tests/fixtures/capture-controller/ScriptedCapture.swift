import AppKit
import ScreenRecorderCapture

@MainActor
final class Signal {
    private var released = false
    private var waiting: [CheckedContinuation<Void, Never>] = []
    func wait() async {
        if released { return }
        await withCheckedContinuation { waiting.append($0) }
    }
    func release() {
        released = true
        let continuations = waiting
        waiting.removeAll()
        for continuation in continuations { continuation.resume() }
    }
}

@MainActor
final class ScriptedCapture {
    static var latest: ScriptedCapture?
    static let screenPermission = true
    static let microphonePermission = "authorized"
    static var cameraPermission = "denied"
    static var cameras = [CaptureVideoDevice(id: "camera-b", name: "External camera"), CaptureVideoDevice(id: "camera-a", name: "Built-in camera")]
    static func cameraDevices() -> [CaptureVideoDevice] { cameras }
    static func microphoneDevices() -> [CaptureAudioDevice] { [] }

    var onInterruption: ((CaptureFailure) -> Void)?
    var deviceState = "idle"
    var elapsedSourceUs: Int64? = 10
    var lifecycleSequence: Int? = 1
    let entered = Signal()
    let release = Signal()
    let stopped = Signal()
    var failStart = false
    var emitsInterruption = true
    var stopCount = 0
    var discardCount = 0
    var holdStop = false
    var completes = false
    var cleanupPending = false
    var publicationCanceled = false
    let stopEntered = Signal()
    let stopRelease = Signal()
    let cancelObserved = Signal()
    init() { Self.latest = self }
    func start(_ request: CaptureRequest) async throws {
        deviceState = "recording"
        if emitsInterruption {
            onInterruption?(CaptureFailure("SOURCE_LOST", "controlled start handoff"))
        }
        entered.release()
        await release.wait()
        if failStart { deviceState = "idle"; throw CaptureFailure("START_FAILED", "controlled refusal") }
    }
    func stop() async throws -> CaptureResult {
        stopCount += 1
        deviceState = "finalizing"
        stopEntered.release()
        if holdStop { await stopRelease.wait() }
        if publicationCanceled { throw CancellationError() }
        deviceState = "idle"
        _ = note(completes ? "complete" : "interrupted", reason: nil)
        stopped.release()
        return CaptureResult(state: completes ? "complete" : "interrupted", source: CaptureSource(kind: "window", windowID: 1), width: 32, height: 32, durationUs: 10, hostOriginUs: 1, pauses: [], tracks: [], failure: completes ? nil : CaptureFailure("SOURCE_LOST", "controlled failure"), systemAudioScope: "none", cleanupFailure: cleanupPending ? CaptureFailure("CLEANUP_PENDING", "controlled cleanup failure") : nil)
    }
    func cancelPublication() {
        cancelObserved.release()
        if deviceState != "idle" {
            publicationCanceled = true
            stopRelease.release()
        }
    }
    func discard() async { discardCount += 1; deviceState = "idle" }
    func pause() throws { deviceState = "paused" }
    func resume() throws { deviceState = "recording" }
    @discardableResult func note(_ state: String, reason: String?) -> Int? { lifecycleSequence! += 1; return lifecycleSequence }
}

struct ServiceFailure: Error { let code: String; let message: String }
@MainActor
final class ServiceHost {
    var reports: [[String: Any]] = []
    var holdFinalizing = false
    let finalizingEntered = Signal()
    let finalizingRelease = Signal()
    var holdTerminal = false
    let terminalEntered = Signal()
    let terminalRelease = Signal()
    func call(_ operation: String, _ params: [String: Any] = [:]) async throws(ServiceFailure) -> Data {
        reports.append(params)
        if params["state"] as? String == "finalizing", holdFinalizing {
            finalizingEntered.release()
            await finalizingRelease.wait()
        }
        if ["complete", "interrupted"].contains(params["state"] as? String ?? "") {
            terminalEntered.release()
            if holdTerminal { await terminalRelease.wait() }
        }
        return try! JSONSerialization.data(withJSONObject: params)
    }
}
struct FixtureStartHold {
    static func inFixture(_ window: NSWindow?) -> Self? { nil }
    func hold(recordingId: String) async {}
}
func diagnostic(_ value: String) {}


struct ScriptedShareableContent {
    struct Display { let displayID: UInt32; let width: Int; let height: Int }
    struct Application { let applicationName: String }
    struct Window { let windowID: UInt32; let title: String?; let owningApplication: Application? }
    let displays: [Display] = []
    let windows: [Window] = []
    static func excludingDesktopWindows(_ exclude: Bool, onScreenWindowsOnly: Bool) async throws -> Self { Self() }
}
