import Foundation
import ScreenRecorderControls

private func row(_ entries: [MenuEntry], _ id: String) -> MenuEntry {
    guard let found = find(entries, id) else {
        preconditionFailure("The menu has no row for \(id)")
    }
    return found
}

private func find(_ entries: [MenuEntry], _ id: String) -> MenuEntry? {
    for entry in entries {
        if entry.action?.id == id { return entry }
        if let nested = find(entry.submenu, id) { return nested }
    }
    return nil
}

private func statusLines(_ entries: [MenuEntry]) -> [String] {
    entries.filter { if case .status = $0.kind { return !$0.enabled } else { return false } }
        .map(\.title)
}

private func recording(elapsedUs: Int64, paused: Bool = false) -> ControlsState {
    var state = ready(source: .window(window))
    state.device = ControlsState.DeviceStatus(
        state: paused ? .paused : .recording, recordingId: "rec-1", elapsedUs: elapsedUs)
    state.take = ControlsState.TakeStatus(
        recordingId: "rec-1", state: paused ? "paused" : "recording", interruptionReason: nil,
        sourceDurationUs: nil)
    return state
}

func runMenuStateTests() {
    let idle = RecordingMenu.entries(for: ready())
    precondition(
        !statusLines(idle).contains { $0.hasPrefix("Idle") }
            && idle.first?.title.hasPrefix("Source:") == true,
        "An idle app opens on its selection, not on a line saying nothing happens")
    precondition(row(idle, "capture.startOrStop").title == "Start Recording", "Idle offers a start")
    precondition(row(idle, "capture.startOrStop").enabled, "A chosen source can be recorded")
    for control in ["capture.pauseOrResume", "capture.cancel", "capture.restart"] {
        precondition(!row(idle, control).enabled, "\(control) needs a take on the device")
    }

    var unchosen = ready(source: nil)
    unchosen.sources.displays = []
    let waiting = RecordingMenu.entries(for: unchosen)
    precondition(!row(waiting, "capture.startOrStop").enabled, "Nothing starts without a source")
    precondition(
        statusLines(waiting).contains("Choose a source to record."),
        "An app that cannot start says what is missing")
    precondition(
        !row(waiting, "source.region").enabled,
        "Region selection needs a display to select on")

    let live = RecordingMenu.entries(for: recording(elapsedUs: 12_000_000))
    precondition(statusLines(live).first == "Recording — 0:12", "A running take shows its own clock")

    // A take whose evidence is still being prepared says so, in both places a person looks.
    var preparing = ready()
    let take = ControlsState.RecentTake(
        recordingId: "rec-5", createdAt: "2026-09-18T01:02:03Z", state: "complete",
        sourceDurationUs: 9_000_000, interruptionReason: nil, currentRevisionId: "r-existing")
    preparing.library.recent = [take]
    preparing.library.processing = .init(
        recordingId: "rec-5",
        artifacts: [
            .init(artifact: "source", state: "ready", reason: nil),
            .init(artifact: "transcript", state: "processing", reason: nil),
            .init(artifact: "index", state: "queued", reason: nil),
        ])
    let working = RecordingMenu.entries(for: preparing)
    precondition(
        statusLines(working).first == "Preparing the last take — transcribing, choosing screenshots",
        "Processing is named for a person: \(statusLines(working))")
    guard let preparedRow = working.first(where: { $0.title == "Recent Recordings" })?.submenu.first
    else { preconditionFailure("The prepared take is listed") }
    precondition(
        preparedRow.title.hasSuffix("— transcribing, choosing screenshots"),
        "The take itself says what is still being prepared: \(preparedRow.title)")
    preparing.library.processing = .init(
        recordingId: "rec-5",
        artifacts: [.init(artifact: "transcript", state: "failed", reason: "model missing")])
    precondition(
        statusLines(RecordingMenu.entries(for: preparing)).first
            == "Preparing the last take — transcript failed",
        "A failed artifact stays visible")
    preparing.take = .init(recordingId: "new-take", state: "complete", interruptionReason: nil, sourceDurationUs: 1)
    let staleProcessing = RecordingMenu.entries(for: preparing)
    precondition(!statusLines(staleProcessing).contains { $0.contains("Preparing the last take") },
        "A last-good library row cannot label its older processing as the current take")
    precondition(
        row(live, "capture.startOrStop").title == "Finish Recording",
        "One control starts and finishes a take")
    precondition(row(live, "capture.pauseOrResume").title == "Pause Recording", "A running take can pause")
    precondition(
        row(live, "capture.cancel").enabled && row(live, "capture.restart").enabled,
        "A running take can be discarded or restarted")
    precondition(
        !row(live, "audio.system").enabled && find(live, "source.window.88")?.enabled == false,
        "What a take records is fixed once it is recording")

    var finalizing = recording(elapsedUs: 12_000_000)
    finalizing.device = .init(state: .finalizing, recordingId: "rec-1", elapsedUs: 12_000_000)
    finalizing.take = .init(recordingId: "rec-1", state: "finalizing", interruptionReason: nil, sourceDurationUs: nil)
    let finishing = RecordingMenu.entries(for: finalizing)
    precondition(finalizing.isLive && row(finishing, "capture.cancel").enabled,
        "Finalization still owns the take and admits cancellation")
    precondition(row(finishing, "capture.startOrStop").title == "Finish Recording")
    precondition(!row(finishing, "capture.pauseOrResume").enabled,
        "Closed input cannot be paused while publication continues")
    precondition(!row(finishing, "audio.system").enabled,
        "Publication cannot change what the take captured")

    let paused = RecordingMenu.entries(for: recording(elapsedUs: 12_000_000, paused: true))
    precondition(statusLines(paused).first == "Paused — 0:12", "A paused take shows the time it reached")
    precondition(row(paused, "capture.pauseOrResume").title == "Resume Recording", "A paused take resumes")

    var lost = recording(elapsedUs: 12_000_000)
    lost.service = .unavailable("Service exited with status 9")
    let orphaned = RecordingMenu.entries(for: lost)
    precondition(
        StatusItemAppearance.title(for: lost).isEmpty
            && StatusItemAppearance.symbolName(for: lost) == "exclamationmark.triangle",
        "A lost service leaves no recording clock in the menu bar")
    precondition(
        statusLines(orphaned).first == "Unavailable — Service exited with status 9"
            && row(orphaned, "capture.startOrStop").title == "Start Recording"
            && !row(orphaned, "capture.startOrStop").enabled,
        "A take the service can no longer report is not shown as still recording")

    var interrupted = ready()
    interrupted.take = ControlsState.TakeStatus(
        recordingId: "rec-2", state: "interrupted", interruptionReason: "SOURCE_LOST",
        sourceDurationUs: 4_000_000)
    precondition(
        statusLines(RecordingMenu.entries(for: interrupted))
            .contains("Last take interrupted — SOURCE_LOST"),
        "A take that ended badly says so instead of reading as idle")

    var recovering = ready()
    recovering.take = ControlsState.TakeStatus(
        recordingId: "rec-recovery", state: "finalizing", interruptionReason: nil,
        sourceDurationUs: nil, finalizationError: ControlsState.FinalizationError(
            code: "MEDIA_WORKER_TIMEOUT", message: "Recovery can be retried", retryable: true))
    let recoveryMenu = RecordingMenu.entries(for: recovering)
    precondition(recovering.isLive && statusLines(recoveryMenu).first == "Finalization needs attention")
    precondition(row(recoveryMenu, "capture.startOrStop").title == "Retry Finalization"
        && row(recoveryMenu, "capture.startOrStop").enabled)
    precondition(row(recoveryMenu, "capture.cancel").title == "Cancel Finalization"
        && !row(recoveryMenu, "capture.restart").enabled)
    precondition(statusLines(recoveryMenu).contains("Finalization failed — MEDIA_WORKER_TIMEOUT: Recovery can be retried"))

    var refused = ready()
    refused.failure = "PERMISSION_REQUIRED: Screen recording permission is not authorized."
    precondition(
        statusLines(RecordingMenu.entries(for: refused)).contains(refused.failure!),
        "A refused action states what the service refused")

    var denied = ready()
    denied.permissions = ControlsState.Permissions(screen: .denied, microphone: .denied)
    precondition(
        statusLines(RecordingMenu.entries(for: denied))
            .contains("Screen recording permission is required before recording."),
        "A missing screen permission is stated before a person tries to record")

    let label = row(idle, "audio.system").title
    precondition(
        label == "Include System Audio" && !label.lowercased().contains("tab")
            && !label.lowercased().contains("browser"),
        "The system audio label must not suggest one tab or application")

    var stored = ready()
    stored.library.recent = [
        ControlsState.RecentTake(
            recordingId: "rec-9", createdAt: "2026-09-15T18:04:05Z", state: "complete",
            sourceDurationUs: 65_000_000, interruptionReason: nil, currentRevisionId: "r-existing")
    ]
    let recent = RecordingMenu.entries(for: stored)
    guard let takes = recent.first(where: { $0.title == "Recent Recordings" })?.submenu.first
    else { preconditionFailure("A stored take is listed") }
    precondition(takes.title.hasSuffix("— 1:05"), "A listed take states the media it holds")
    let offered = takes.submenu.filter(\.enabled).compactMap(\.action)
    precondition(
        offered == [
            .previewRecording("rec-9"), .exportRecording("rec-9", .video),
            .exportRecording("rec-9", .package), .deleteRecording("rec-9"),
        ], "Preview, both export choices and deletion name the stored take")
    for (status, duration, available) in [("complete", Int64(1), true), ("interrupted", 1, true),
        ("interrupted", 0, false), ("recording", 1, false), ("canceled", 1, false)] {
        stored.library.recent = [.init(recordingId: "rec-9", createdAt: "2026-09-15T18:04:05Z",
            state: status, sourceDurationUs: duration, interruptionReason: nil, currentRevisionId: "r-existing")]
        precondition(row(RecordingMenu.entries(for: stored), "recording.preview.rec-9").enabled == available,
            "Only usable finalized media exposes Preview")
    }
    print("PASS the menu states what is recording, what was chosen and what cannot be done yet")
}


func runRecentStorageTests() {
    var state = ready()
    let first = ControlsState.RecentTake(recordingId: "first", createdAt: "2026-09-15T18:04:05Z",
        state: "complete", sourceDurationUs: 1_000_000, interruptionReason: nil, currentRevisionId: "r-existing")
    let sibling = ControlsState.RecentTake(recordingId: "sibling", createdAt: first.createdAt,
        state: "complete", sourceDurationUs: 2_000_000, interruptionReason: nil, currentRevisionId: "r-existing")
    state.library.recent = [first, sibling]
    precondition(!state.library.beginDelete(.recording("unknown")), "The menu cannot invent a delete target")
    precondition(state.library.beginDelete(.recording("first")), "The chosen explicit ID begins deletion")
    precondition(!state.library.beginDelete(.recording("first")), "Repeated pending clicks do not issue another request")
    var menu = RecordingMenu.entries(for: state)
    precondition(!row(menu, "recording.delete.first").enabled, "Pending deletion cannot be clicked twice")
    precondition(row(menu, "recording.delete.first").title == "Deleting…", "Pending is not success")
    precondition(row(menu, "recording.delete.sibling").enabled, "Another recording remains usable")
    // Intent hides the take from ordinary library discovery before physical cleanup completes.
    state.library.recent = [sibling]
    state.library.finishDelete(.recording("first"), failure: "DELETE_FAILED: disk is unavailable")
    menu = RecordingMenu.entries(for: state)
    precondition(row(menu, "recording.delete.first").title == "Retry Delete", "A hidden failed take keeps its retry")
    precondition(row(menu, "recording.delete.first").action == .deleteRecording("first"), "Retry keeps its original target")
    guard let recent = menu.first(where: { $0.title == "Recent Recordings" }) else {
        preconditionFailure("Recent recordings remain visible")
    }
    precondition(recent.submenu.flatMap(\.submenu).contains {
        $0.title.contains("DELETE_FAILED: disk is unavailable")
    }, "The failure is visible without claiming the files are gone")
    state.service = .unavailable("offline")
    precondition(!row(RecordingMenu.entries(for: state), "recording.delete.first").enabled,
        "Retry waits until the service can accept it")

    state.service = .ready
    precondition(state.library.beginDelete(.recording("first")), "Retry resolves the retained target without rediscovery")
    state.library.finishDelete(.recording("first"), failure: nil)
    menu = RecordingMenu.entries(for: state)
    precondition(find(menu, "recording.delete.first") == nil, "Only confirmed success removes the pending row")
    precondition(row(menu, "recording.delete.sibling").enabled, "Success preserves sibling actions")

    precondition(menu.contains { $0.title == "Library Storage: not measured" }, "No receipt is not zero bytes")
    let observedAt = "2026-09-16T09:10:11.000Z"
    precondition(ElapsedTime.shortTime(of: observedAt) == ElapsedTime.shortTime(of: "2026-09-16T09:10:11Z"),
        "Service ISO timestamps with milliseconds use the same readable local date")
    state.storage = .init(totalBytes: 12_345_678, observedAt: observedAt)
    let measured = RecordingMenu.entries(for: state)
    let expectedBytes = ByteCountFormatter.string(fromByteCount: 12_345_678, countStyle: .file)
    precondition(measured.contains { $0.title == "Library Storage: \(expectedBytes) (last scan)" },
        "The total comes from the service and is labeled as an observation")
    state.storageRefreshing = true
    let refreshing = RecordingMenu.entries(for: state)
    precondition(row(refreshing, "storage.refresh").title == "Measuring Storage…"
        && !row(refreshing, "storage.refresh").enabled, "One outstanding scan has visible progress")
    precondition(row(refreshing, "capture.startOrStop").enabled, "A storage scan does not disable capture")
    state.storageRefreshing = false
    state.storageFailure = "TIMEOUT: scan did not answer"
    let failed = RecordingMenu.entries(for: state)
    precondition(failed.contains { $0.title == "Library Storage: \(expectedBytes) (last scan)" },
        "Failure retains the explicitly dated old observation instead of inventing zero")
    precondition(failed.flatMap(\.submenu).contains { $0.title == "Storage unavailable — TIMEOUT: scan did not answer" }
        && row(failed, "storage.refresh").enabled, "A failed scan says why and offers refresh")
    print("PASS explicit deletion retries and live storage observations remain honest")
}
