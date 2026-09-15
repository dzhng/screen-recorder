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
        state: paused ? .paused : .recording, recordingId: "rec-1", elapsedUs: elapsedUs,
        permissions: ControlsState.Permissions(screen: true, microphone: "authorized"))
    state.take = ControlsState.TakeStatus(
        recordingId: "rec-1", state: paused ? "paused" : "recording", interruptionReason: nil,
        sourceDurationUs: nil)
    return state
}

func runMenuStateTests() {
    let idle = RecordingMenu.entries(for: ready())
    precondition(statusLines(idle).first == "Idle", "An idle app says so first")
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
    precondition(row(live, "capture.startOrStop").title == "Stop Recording", "One control starts and stops")
    precondition(row(live, "capture.pauseOrResume").title == "Pause Recording", "A running take can pause")
    precondition(
        row(live, "capture.cancel").enabled && row(live, "capture.restart").enabled,
        "A running take can be discarded or restarted")
    precondition(
        !row(live, "audio.system").enabled && find(live, "source.window.88")?.enabled == false,
        "What a take records is fixed once it is recording")

    let paused = RecordingMenu.entries(for: recording(elapsedUs: 12_000_000, paused: true))
    precondition(statusLines(paused).first == "Paused — 0:12", "A paused take shows the time it reached")
    precondition(row(paused, "capture.pauseOrResume").title == "Resume Recording", "A paused take resumes")

    var interrupted = ready()
    interrupted.take = ControlsState.TakeStatus(
        recordingId: "rec-2", state: "interrupted", interruptionReason: "SOURCE_LOST",
        sourceDurationUs: 4_000_000)
    precondition(
        statusLines(RecordingMenu.entries(for: interrupted))
            .contains("Last take interrupted — SOURCE_LOST"),
        "A take that ended badly says so instead of reading as idle")

    var refused = ready()
    refused.failure = "PERMISSION_REQUIRED: Screen recording permission is not authorized."
    precondition(
        statusLines(RecordingMenu.entries(for: refused)).contains(refused.failure!),
        "A refused action states what the service refused")

    var denied = ready()
    denied.device = ControlsState.DeviceStatus(
        state: .idle, recordingId: nil, elapsedUs: nil,
        permissions: ControlsState.Permissions(screen: false, microphone: "denied"))
    let blocked = RecordingMenu.entries(for: denied)
    precondition(
        statusLines(blocked).contains("Screen recording permission is required before recording."),
        "A missing screen permission is stated before a person tries to record")
    precondition(
        find(blocked, "permission.screen") != nil && find(blocked, "permission.microphone") != nil,
        "Permission is asked for by an explicit choice, never on the app's own initiative")

    let label = row(idle, "audio.system").title
    precondition(
        label == "Include All System Audio",
        "System audio is all of it: the label must not suggest one tab or application")

    var stored = ready()
    stored.recent = [
        ControlsState.RecentTake(
            recordingId: "rec-9", createdAt: "2026-09-15T18:04:05Z", state: "complete",
            sourceDurationUs: 65_000_000, interruptionReason: nil)
    ]
    let recent = RecordingMenu.entries(for: stored)
    guard let takes = recent.first(where: { $0.title == "Recent Recordings" })?.submenu.first
    else { preconditionFailure("A stored take is listed") }
    precondition(takes.title.hasSuffix("— 1:05"), "A listed take states the media it holds")
    let offered = takes.submenu.filter(\.enabled).compactMap(\.action)
    precondition(offered.isEmpty, "Preview and export have no working action to offer yet")
    precondition(
        takes.submenu.contains { $0.title == "Preview — not available yet" }
            && takes.submenu.contains { $0.title == "Export Video — not available yet" }
            && takes.submenu.contains { $0.title == "Export AI Package — not available yet" },
        "The two exports and preview are named and visibly unavailable, never faked")
    print("PASS the menu states what is recording, what was chosen and what cannot be done yet")
}
