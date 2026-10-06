import Foundation
import YapCapture

@MainActor
func runSelectedCaptureStopTests(output: String) async throws {
    let root = URL(fileURLWithPath: output)
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: false)
    let source = root.appendingPathComponent("input.mov")
    try await RecoveryFixture.writeVariableDurationVideo(to: source,
        timesUs: [0, 100000], endUs: 200000)
    for paused in [false, true] {
        let folder = root.appendingPathComponent(paused ? "paused" : "recording")
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: false)
        var description: [String: Any] = [
            "source": ["kind": "display", "displayID": 7], "cameraID": "unused-offline",
            "microphone": ["enabled": false], "outputDirectory": folder.path,
            "framesPerSecond": 30, "durationSeconds": 3600, "cameraDelaySeconds": 0,
        ]
        if paused { description["pause"] = ["atSeconds": 0.01, "durationSeconds": 1800] }
        let request = try JSONDecoder().decode(SelectedCaptureRequest.self,
            from: JSONSerialization.data(withJSONObject: description))
        let input = PrerecordedCaptureInput(source: source)
        input.holdStop = true
        let capture = NativeCapture(prepareInput: { _, _ in input })
        let probe = SelectedCaptureProbe()
        let task = Task { try await probe.record(capture, request: request,
            screenRequest: CaptureRequest(source: CaptureSource(kind: "offline-prerecorded"),
                outputDirectory: folder.appendingPathComponent("screen").path)) }
        let deadline = ContinuousClock.now.advanced(by: .seconds(5))
        while capture.deviceState != (paused ? "paused" : "recording") {
            precondition(ContinuousClock.now < deadline, "Offline capture did not reach requested state")
            try await Task.sleep(for: .milliseconds(5))
        }
        let stopAt = ContinuousClock.now
        probe.requestStop(); probe.requestStop()
        while capture.deviceState != "finalizing" {
            precondition(stopAt.duration(to: .now) < .seconds(5), "Stop did not wake the scheduled wait")
            try await Task.sleep(for: .milliseconds(5))
        }
        await input.stopEntered.wait()
        let saved = folder.appendingPathComponent("screen-result.json")
        precondition(!FileManager.default.fileExists(atPath: saved.path), "Result published before physical drain")
        probe.requestStop()
        input.releaseStop.release()
        let result = try await task.value
        precondition(stopAt.duration(to: .now) < .seconds(5), "Stop waited for scheduled duration")
        let persisted = try Data(contentsOf: saved)
        precondition(persisted == result, "Run returned before durable result")
        let receipt = try JSONDecoder().decode(CaptureResult.self, from: result)
        precondition(receipt.failure == nil && receipt.tracks.contains { $0.role == "video" })
        precondition(input.stops == 1 && input.finalizations == 1 && capture.deviceState == "idle")
        precondition(input.finalClock?.isPaused == false)
    }
    for before in [false, true] {
        let delay = ProbeStartDelay()
        if before { delay.finish() }
        let task = Task { try await delay.wait(seconds: 3600) }
        await Task.yield()
        delay.finish(); delay.finish()
        try await task.value
        // A completed startup delay stays stopped; no later camera wait restarts it.
        try await delay.wait(seconds: 3600)
    }
    print("PASS selected probe graceful stop: recording/paused, repeated stop, drain before durable result, delayed startup wake")
}
