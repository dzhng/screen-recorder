import Foundation
import ScreenRecorderControls

private func action(_ entries: [PresentedControlsAction], _ id: String) -> PresentedControlsAction {
    guard let found = entries.first(where: { $0.action.id == id }) else {
        preconditionFailure("No presented action for \(id)")
    }
    return found
}

private func recording(elapsedUs: Int64, paused: Bool = false) -> ControlsState {
    var state = ready(source: .window(window))
    state.device = .init(state: paused ? .paused : .recording, recordingId: "rec-1", elapsedUs: elapsedUs)
    state.take = .init(recordingId: "rec-1", state: paused ? "paused" : "recording",
        interruptionReason: nil, sourceDurationUs: nil)
    return state
}

func runCapturePresentationTests() {
    let idle = CapturePresentation.transport(for: ready())
    precondition(action(idle, "capture.startOrStop").title == "Start Recording" && action(idle, "capture.startOrStop").enabled)
    for id in ["capture.pauseOrResume", "capture.cancel", "capture.restart"] {
        precondition(!action(idle, id).enabled, "\(id) needs a take")
    }
    precondition(!action(CapturePresentation.transport(for: ready(source: nil)), "capture.startOrStop").enabled,
        "Nothing starts without a selected source")

    let running = recording(elapsedUs: 12_000_000)
    let live = CapturePresentation.transport(for: running)
    precondition(CapturePresentation.statusTitle(for: running) == "Recording — 0:12")
    precondition(action(live, "capture.startOrStop").title == "Finish Recording")
    precondition(action(live, "capture.pauseOrResume").title == "Pause Recording")
    precondition(action(live, "capture.cancel").enabled && action(live, "capture.restart").enabled)

    var finalizing = running
    finalizing.device = .init(state: .finalizing, recordingId: "rec-1", elapsedUs: 12_000_000)
    finalizing.take = .init(recordingId: "rec-1", state: "finalizing", interruptionReason: nil, sourceDurationUs: nil)
    let finishing = CapturePresentation.transport(for: finalizing)
    precondition(finalizing.isLive && action(finishing, "capture.cancel").enabled)
    precondition(action(finishing, "capture.startOrStop").title == "Finish Recording")
    precondition(!action(finishing, "capture.pauseOrResume").enabled, "Closed input cannot be paused")

    let paused = recording(elapsedUs: 12_000_000, paused: true)
    precondition(CapturePresentation.statusTitle(for: paused) == "Paused — 0:12")
    precondition(action(CapturePresentation.transport(for: paused), "capture.pauseOrResume").title == "Resume Recording")

    var lost = running
    lost.service = .unavailable("Service exited with status 9")
    precondition(StatusItemAppearance.title(for: lost).isEmpty
        && StatusItemAppearance.symbolName(for: lost) == "exclamationmark.triangle")
    precondition(CapturePresentation.statusTitle(for: lost) == "Unavailable — Service exited with status 9")
    let orphaned = CapturePresentation.transport(for: lost)
    precondition(action(orphaned, "capture.startOrStop").title == "Start Recording"
        && !action(orphaned, "capture.startOrStop").enabled)

    var interrupted = ready()
    interrupted.take = .init(recordingId: "rec-2", state: "interrupted", interruptionReason: "SOURCE_LOST", sourceDurationUs: 4_000_000)
    precondition(CapturePresentation.noticeLines(for: interrupted).contains("Last take interrupted — SOURCE_LOST"))

    var recovering = ready()
    recovering.take = .init(recordingId: "rec-recovery", state: "finalizing", interruptionReason: nil,
        sourceDurationUs: nil, finalizationError: .init(code: "MEDIA_WORKER_TIMEOUT", message: "Recovery can be retried", retryable: true))
    let recovery = CapturePresentation.transport(for: recovering)
    precondition(recovering.isLive && CapturePresentation.statusTitle(for: recovering) == "Finalization needs attention")
    precondition(action(recovery, "capture.startOrStop").title == "Retry Finalization" && action(recovery, "capture.startOrStop").enabled)
    precondition(action(recovery, "capture.cancel").title == "Cancel Finalization" && !action(recovery, "capture.restart").enabled)
    precondition(CapturePresentation.noticeLines(for: recovering).contains("Finalization failed — MEDIA_WORKER_TIMEOUT: Recovery can be retried"))

    var refused = ready()
    refused.failure = "PERMISSION_REQUIRED: Screen recording permission is not authorized."
    precondition(CapturePresentation.noticeLines(for: refused).contains(refused.failure!))
    print("PASS shared capture lifecycle and transport applicability")
}

func runSavedRecordingTests() {
    var state = ready()
    let first = ControlsState.RecentTake(recordingId: "first", createdAt: "2026-09-15T18:04:05Z",
        state: "complete", sourceDurationUs: 65_000_000, interruptionReason: nil)
    let sibling = ControlsState.RecentTake(recordingId: "sibling", createdAt: first.createdAt,
        state: "complete", sourceDurationUs: 2_000_000, interruptionReason: nil)
    state.library.recent = [first, sibling]
    precondition(LibraryPresentation.recordings(for: state).items.first?.title.hasSuffix("— 1:05") == true)
    for (status, duration) in [("complete", Int64(1)), ("interrupted", 1), ("interrupted", 0), ("recording", 1), ("canceled", 1)] {
        var observed = state
        observed.library.recent = [.init(recordingId: "first", createdAt: first.createdAt,
            state: status, sourceDurationUs: duration, interruptionReason: nil)]
        let offered = LibraryPresentation.recordings(for: observed).items.flatMap(\.actions).filter(\.enabled).map(\.action)
        precondition(offered == [.deleteRecording("first")], "Source facts never authorize a composition action")
    }
    precondition(!state.library.beginDelete(.recording("unknown")))
    precondition(state.library.beginDelete(.recording("first")))
    precondition(!state.library.beginDelete(.recording("first")), "A pending request cannot be sent twice")
    var page = LibraryPresentation.recordings(for: state)
    precondition(!action(page.items.flatMap(\.actions), "recording.delete.first").enabled)
    precondition(action(page.items.flatMap(\.actions), "recording.delete.first").title == "Deleting…")
    precondition(action(page.items.flatMap(\.actions), "recording.delete.sibling").enabled)
    state.library.recent = [sibling]
    state.library.finishDelete(.recording("first"), failure: "DELETE_FAILED: disk is unavailable")
    page = LibraryPresentation.recordings(for: state)
    precondition(action(page.items.flatMap(\.actions), "recording.delete.first").title == "Retry Delete")
    precondition(page.items.flatMap(\.details).contains { $0.contains("DELETE_FAILED: disk is unavailable") })
    state.service = .unavailable("offline")
    precondition(!action(LibraryPresentation.recordings(for: state).items.flatMap(\.actions), "recording.delete.first").enabled)
    state.service = .ready
    precondition(state.library.beginDelete(.recording("first")), "Retry uses its retained target")
    state.library.finishDelete(.recording("first"), failure: nil)
    page = LibraryPresentation.recordings(for: state)
    precondition(!page.items.flatMap(\.actions).contains { $0.action == .deleteRecording("first") })
    precondition(action(page.items.flatMap(\.actions), "recording.delete.sibling").enabled)
    print("PASS saved recording actions preserve source and deletion identity")
}
