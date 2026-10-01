import Foundation
import ScreenRecorderCapture

let controller = CaptureController(fixtureWindow: nil)
let native = ScriptedCapture.latest!
if CommandLine.arguments.contains("camera-discovery") {
    func response(_ operation: String) async throws -> [String: Any] {
        guard case .success(let bytes) = await controller.handle(operation, Data("{}".utf8)) else { fatalError("Discovery refused") }
        return try JSONSerialization.jsonObject(with: bytes) as! [String: Any]
    }
    for permission in ["denied", "authorized", "restricted", "not_determined", "unknown"] {
        ScriptedCapture.cameraPermission = permission
        let sources = try await response("capture.sources")
        let cameras = sources["cameras"] as! [[String: String]]
        precondition(cameras == [["id": "camera-b", "name": "External camera"], ["id": "camera-a", "name": "Built-in camera"]])
        let status = try await response("capture.status")
        precondition((status["permissions"] as! [String: Any])["camera"] as? String == permission)
        precondition(status["state"] as? String == "idle" && status["selection"] is NSNull)
    }
    ScriptedCapture.cameras = []
    let empty = try await response("capture.sources")
    precondition(empty["cameras"] as! [[String: String]] == [])
    precondition(native.stopCount == 0 && native.discardCount == 0 && native.deviceState == "idle")
    print("PASS actual controller preserves camera order, names, empty discovery and all authorization states without device actions")
    exit(0)
}
let fails = CommandLine.arguments.contains("failed-start")
native.failStart = fails
func request(_ identity: String) throws -> Data {
    try JSONSerialization.data(withJSONObject: [
        "recordingId": "recording-\(identity)", "sourceId": "source-\(identity)",
        "outputDirectory": "/tmp/unused", "source": ["kind": "window", "windowId": 1],
        "microphone": false, "systemAudio": false,
    ])
}
if CommandLine.arguments.contains("stop-ack") || CommandLine.arguments.contains("cancel-publication") || CommandLine.arguments.contains("cancel-before-stop") {
    native.emitsInterruption = false
    native.holdStop = true
    native.completes = true
    native.cleanupPending = true
    native.release.release()
    let host = ServiceHost()
    host.holdTerminal = true
    host.holdFinalizing = CommandLine.arguments.contains("cancel-before-stop")
    controller.attach(to: host)
    guard case .success = await controller.handle("capture.start", try request("stop")) else { fatalError("Start refused") }
    let control = try JSONSerialization.data(withJSONObject: ["recordingId": "recording-stop"])
    func response(_ value: Result<Data, ServiceFailure>) throws -> [String: Any] {
        guard case .success(let bytes) = value else { fatalError("Control refused: \(value)") }
        return try JSONSerialization.jsonObject(with: bytes) as! [String: Any]
    }
    let first = try response(await controller.handle("capture.stop", control))
    if host.holdFinalizing {
        await host.finalizingEntered.wait()
        precondition(native.stopCount == 0)
        let cancel = Task { await controller.handle("capture.cancel", control) }
        await native.cancelObserved.wait()
        host.finalizingRelease.release()
        _ = try response(await cancel.value)
        precondition(native.stopCount == 1 && native.discardCount == 1)
        print("PASS cancellation before native stop survives held initial finalizing report")
        exit(0)
    }
    await native.stopEntered.wait()
    precondition(first["state"] as? String == "finalizing" && native.stopCount == 1)
    let again = try response(await controller.handle("capture.stop", control))
    precondition(again["sequence"] as? Int == first["sequence"] as? Int && native.stopCount == 1)
    if CommandLine.arguments.contains("cancel-publication") {
        let canceled = try response(await controller.handle("capture.cancel", control))
        precondition(canceled["state"] as? String == "finalizing" && native.discardCount == 1)
        precondition(native.deviceState == "idle")
        print("PASS controller cancellation waits for in-progress publication unwind before discard")
    } else {
        native.stopRelease.release()
        await host.terminalEntered.wait()
        let duringReport = try response(await controller.handle("capture.stop", control))
        precondition(duringReport["state"] as? String == "finalizing")
        precondition(duringReport["sequence"] as? Int == first["sequence"] as? Int,
            "Finalizing acknowledgment cannot borrow a newer terminal sequence")
        let cancel = Task { await controller.handle("capture.cancel", control) }
        await native.cancelObserved.wait()
        precondition(native.discardCount == 0)
        host.terminalRelease.release()
        let terminal = try response(await cancel.value)
        precondition(terminal["state"] as? String == "complete" && terminal["reason"] as? String == "CLEANUP_PENDING")
        precondition(native.discardCount == 0 && native.stopCount == 1)
        print("PASS controller acknowledges stable finalizing sequence; completed cleanup-pending take wins cancellation")
    }
    exit(0)
}
let diagnosticHost = ServiceHost()
controller.attach(to: diagnosticHost)
let initialRequest = try request("first")
let start = Task { await controller.handle("capture.start", initialRequest) }
await native.entered.wait()
precondition(native.stopCount == 0, "Interruption must wait while start owns its continuation")
native.release.release()
let result = await start.value
if fails {
    guard case .failure(let error) = result else { fatalError("The scripted start must refuse") }
    precondition(error.code == "START_FAILED")
    native.failStart = false
    native.emitsInterruption = false
    let replacement = await controller.handle("capture.start", try request("replacement"))
    guard case .success = replacement else { fatalError("A refused start cannot hold admission") }
    // The delayed old callback has no further await after its start barrier. Let it run before
    // observing the replacement; it must neither stop it nor publish an old finalization.
    try await Task.sleep(for: .milliseconds(50))
    precondition(native.stopCount == 0 && native.deviceState == "recording")
    print("PASS refused start releases its waiter without ending the replacement take")
} else {
    if case .failure(let error) = result { fatalError("Start failed: \(error)") }
    let deadline = Task {
        try await Task.sleep(for: .seconds(2))
        fatalError("Pending-start interruption was dropped: writer never stopped")
    }
    await native.stopped.wait()
    await diagnosticHost.terminalEntered.wait()
    deadline.cancel()
    precondition(native.stopCount == 1)
    precondition(diagnosticHost.reports.last?["message"] as? String == "controlled failure")
    print("PASS pending-start interruption waits then finalizes the successful take")
}
