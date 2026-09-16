import Foundation
import ScreenRecorderCapture

let controller = CaptureController(fixtureWindow: nil)
let native = ScriptedCapture.latest!
let fails = CommandLine.arguments.contains("failed-start")
native.failStart = fails
func request(_ identity: String) throws -> Data {
    try JSONSerialization.data(withJSONObject: [
        "recordingId": "recording-\(identity)", "sourceId": "source-\(identity)",
        "outputDirectory": "/tmp/unused", "source": ["kind": "window", "windowId": 1],
        "microphone": false, "systemAudio": false,
    ])
}
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
    deadline.cancel()
    precondition(native.stopCount == 1)
    print("PASS pending-start interruption waits then finalizes the successful take")
}
