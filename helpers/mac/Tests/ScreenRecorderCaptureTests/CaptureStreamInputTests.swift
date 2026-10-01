import Foundation
import ScreenRecorderCapture

@MainActor
func runCaptureStreamInputTests(root: URL) async throws {
    for mode in ["held-sdk-start", "caller-canceled-sdk-start", "caller-canceled-before-start", "failed-sdk-start", "second-sdk-failure", "stopped-before-start"] {
        let inputs = CaptureStreamInputs()
        let entered = InputGate(), release = InputGate()
        var starts: [String] = [], stops: [String] = []
        var settled = Set<String>()
        func operation(_ name: String) -> CaptureStreamOperation {
            CaptureStreamOperation(start: {
                starts.append(name)
                defer { settled.insert(name) }
                if ["held-sdk-start", "caller-canceled-sdk-start"].contains(mode), name == "video" { entered.release(); await release.wait() }
                if mode == "failed-sdk-start" || mode == "second-sdk-failure" && name == "audio" {
                    throw CaptureFailure("SDK_START_FAILED", "Controlled partial SDK acquisition")
                }
            }, stop: { precondition(settled.contains(name), "SDK drain must await startup resolution"); stops.append(name) })
        }
        let startup = Task { try await inputs.start([operation("video"), operation("audio")], checkInterruption: {}) }
        if mode == "held-sdk-start" {
            await entered.wait()
            let first = inputs.stop()
            let second = inputs.stop()
            await Task.yield()
            precondition(stops.isEmpty, "Physical drain cannot precede pending SDK start completion")
            release.release()
            do { try await startup.value; preconditionFailure("Stopped input must not start another SDK resource") }
            catch is CancellationError {}
            let firstResult = await first.value, secondResult = await second.value
            precondition(firstResult == nil && secondResult == nil)
            precondition(starts == ["video"] && stops == ["video"], "Pending start must be owned before SDK await and drain once")
        } else if mode == "caller-canceled-sdk-start" || mode == "caller-canceled-before-start" {
            if mode == "caller-canceled-sdk-start" { await entered.wait() }
            startup.cancel()
            release.release()
            do { try await startup.value; preconditionFailure("Caller cancellation must prevent further SDK acquisition") }
            catch is CancellationError {}
            let failure = await inputs.stop().value
            precondition(failure == nil)
            let expected = mode == "caller-canceled-sdk-start" ? ["video"] : []
            precondition(starts == expected && stops == expected)
        } else if mode == "stopped-before-start" {
            // Invoke stop synchronously on the actor before scheduling any SDK work.
            let stopped = await inputs.stop().value
            precondition(stopped == nil)
            do { try await startup.value; preconditionFailure("Closed resource owner must refuse start") }
            catch is CancellationError {}
            precondition(starts.isEmpty && stops.isEmpty)
        } else {
            do { try await startup.value; preconditionFailure("Controlled SDK failure must propagate") }
            catch let error as CaptureFailure { precondition(error.code == "SDK_START_FAILED") }
            let first = await inputs.stop().value, second = await inputs.stop().value
            precondition(first == nil && second == nil)
            let expected = mode == "failed-sdk-start" ? ["video"] : ["video", "audio"]
            precondition(starts == expected && stops == expected, "Every partially acquired SDK resource drains exactly once")
        }
        try JSONSerialization.data(withJSONObject: ["starts": starts, "stops": stops], options: [.sortedKeys])
            .write(to: root.appendingPathComponent("\(mode).json"))
        print("PASS \(mode): actual stream resource owner joins SDK startup and drains attempted resources once")
    }
}
