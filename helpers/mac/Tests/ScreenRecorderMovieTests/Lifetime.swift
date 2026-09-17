import Foundation
import ScreenRecorderAudio
import ScreenRecorderWire
import ScreenRecorderMedia

/// Calls the production mux directly to observe the actual SDK finalization boundary.
@main struct Lifetime {
    static func main() async throws { try await run() }
    nonisolated static func run() async throws {
        let root = URL(fileURLWithPath: CommandLine.arguments[1])
        let attempt = root.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: attempt, withIntermediateDirectories: false)
        defer { try? FileManager.default.removeItem(at: attempt) }
        let duration: Int64 = 60_000_000
        func stream() async throws -> AudioPCMStream {
            try await AudioPCMStream.open(
                tracks: [
                    AudioTrackPlan(
                        role: .system, source: root.appendingPathComponent("audio.mov").path,
                        sourceOffsetUs: 0, available: [SourceSpan(startUs: 0, endUs: duration)])
                ],
                spans: [SourceSpan(startUs: 0, endUs: duration)])
        }
        let state = Finalization()
        let audio = try await stream()
        let task = Task {
            while !state.started { await Task.yield() }
            try await MovieMux.write(
                video: root.appendingPathComponent("video.mp4"), audio: audio,
                durationUs: duration, output: attempt.appendingPathComponent("cancel.mp4"),
                didStartFinishing: { writing in state.cancelDuringFinish(writing: writing) })
        }
        state.start(task)
        do {
            try await task.value
            fatalError("Canceled finalization returned success")
        } catch is CancellationError {}
        guard state.observedWriting else {
            fatalError("Did not cancel during actual writer finalization")
        }
        let started = ContinuousClock.now
        do {
            try await MovieMux.write(
                video: root.appendingPathComponent("video.mp4"),
                audio: try await stream(), durationUs: duration,
                output: attempt.appendingPathComponent("failed.mp4"),
                didCopyVideoSample: {
                    throw NativeFailure.decodeFailed("Injected compressed-video read failure")
                })
            fatalError("Injected video-pump failure completed")
        } catch let error as NativeFailure {
            guard error.message == "Injected compressed-video read failure",
                started.duration(to: .now) < .seconds(3)
            else { throw error }
            print(
                "{\"canceledWhileFinishing\":true,\"siblingFailure\":\"injected compressed-video read failure\",\"failedWithinSeconds\":3}"
            )
        }
    }
}

private final class Finalization: @unchecked Sendable {
    private let lock = NSLock()
    private var task: Task<Void, Error>?
    private var writing = false
    var started: Bool { lock.withLock { task != nil } }
    var observedWriting: Bool { lock.withLock { writing } }
    func start(_ task: Task<Void, Error>) { lock.withLock { self.task = task } }
    func cancelDuringFinish(writing: Bool) {
        let task = lock.withLock {
            self.writing = writing
            return self.task
        }
        task?.cancel()
    }
}
