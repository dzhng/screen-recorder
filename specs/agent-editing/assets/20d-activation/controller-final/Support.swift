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
        if params["state"] as? String == "complete", holdTerminal {
            terminalEntered.release()
            await terminalRelease.wait()
        }
        return try! JSONSerialization.data(withJSONObject: params)
    }
}
struct FixtureStartHold {
    static func inFixture(_ window: NSWindow?) -> Self? { nil }
    func hold(recordingId: String) async {}
}
func diagnostic(_ value: String) {}
