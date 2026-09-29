import Foundation
import ScreenRecorderCapture

@MainActor
private final class Gate {
    private var open = false
    private var waiters: [CheckedContinuation<Void, Never>] = []
    func wait() async {
        if open { return }
        await withCheckedContinuation { waiters.append($0) }
    }
    func release() {
        open = true
        let pending = waiters
        waiters.removeAll()
        for waiter in pending { waiter.resume() }
    }
}

@MainActor
func runCaptureTerminationTests() async throws {
    let ending = CaptureTermination<String>()
    let entered = Gate()
    let release = Gate()
    var current = "old"
    var events: [String] = []
    let first = Task { @MainActor in
        try await ending.run {
            events.append("old ending")
            entered.release()
            await release.wait()
            events.append("old finalized and reported")
            current = "idle"
            return "old receipt"
        }
    }
    await entered.wait()
    precondition(ending.isRunning && current == "old")
    // This actor cannot release the hold until the joining request has yielded on the owner.
    let releasing = Task { @MainActor in release.release() }
    let joined = try await ending.run {
        preconditionFailure("Concurrent discard must join the existing finalization")
    }
    await releasing.value
    precondition(joined == "old receipt" && current == "idle" && !ending.isRunning)
    current = "new"
    let original = try await first.value
    precondition(original == "old receipt" && current == "new")
    precondition(events == ["old ending", "old finalized and reported"])
    let next = try await ending.run { "new receipt" }
    precondition(next == "new receipt")

    enum Refusal: Error { case failed }
    do { _ = try await ending.run { throw Refusal.failed } }
    catch Refusal.failed { }
    precondition(!ending.isRunning, "A failed terminal action releases its own slot")
    let retried = try await ending.run { "retry receipt" }
    precondition(retried == "retry receipt")
    let cancelEntered = Gate()
    let cancelRelease = Gate()
    var closedWriterResult: String?
    var published = false
    let cancelable = ending.start {
        cancelEntered.release()
        await cancelRelease.wait()
        closedWriterResult = "closed exactly once"
        try Task.checkCancellation()
        published = true
        return "must not settle"
    }
    await cancelEntered.wait()
    precondition(closedWriterResult == nil)
    ending.requestCancellation()
    precondition(ending.isRunning, "Cancellation request does not prove the operation unwound")
    cancelRelease.release()
    do { _ = try await cancelable.value; preconditionFailure("Cancellation must be observed") }
    catch is CancellationError {}
    precondition(!ending.isRunning && closedWriterResult == "closed exactly once" && !published,
        "Cancellation before encoder closure must be observed before publication starts")
    let afterCancellation = try await ending.run { "explicit retry" }
    precondition(afterCancellation == "explicit retry")

    let settled = Gate()
    let releaseCleanup = Gate()
    let completed = ending.start {
        settled.release()
        await releaseCleanup.wait()
        // Cleanup is optional after the owned operation has established availability.
        do { try Task.checkCancellation() } catch is CancellationError {}
        return "completed with cleanup pending"
    }
    await settled.wait()
    ending.requestCancellation()
    releaseCleanup.release()
    let preserved = try await completed.value
    precondition(preserved == "completed with cleanup pending")
    print("PASS terminal requests join one owner; old waiters cannot clean up a replacement take")
}
