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
        deviceState = "idle"
        stopped.release()
        return CaptureResult(state: "interrupted", source: CaptureSource(kind: "window", windowID: 1), width: 32, height: 32, durationUs: 10, hostOriginUs: 1, pauses: [], tracks: [], failure: CaptureFailure("SOURCE_LOST", "controlled failure"), systemAudioScope: "none")
    }
    func discard() async { deviceState = "idle" }
    func pause() throws { deviceState = "paused" }
    func resume() throws { deviceState = "recording" }
    @discardableResult func note(_ state: String, reason: String?) -> Int? { lifecycleSequence! += 1; return lifecycleSequence }
}

struct ServiceFailure: Error { let code: String; let message: String }
final class ServiceHost {
    func call(operation: String, params: Data, _ completion: @escaping @Sendable (Result<Data, ServiceFailure>) -> Void) { completion(.success(params)) }
}
struct FixtureStartHold {
    static func inFixture(_ window: NSWindow?) -> Self? { nil }
    func hold(recordingId: String) async {}
}
func diagnostic(_ value: String) {}
