import Foundation
import ScreenRecorderControls

private func exportsMenu(_ state: ControlsState, _ exports: ExportsState) -> MenuEntry? {
    RecordingMenu.entries(for: state, exports: exports).first { $0.title.hasPrefix("Exports") }
}

private func entry(_ entries: [MenuEntry], _ id: String) -> MenuEntry? {
    for row in entries {
        if row.action?.id == id { return row }
        if let nested = entry(row.submenu, id) { return nested }
    }
    return nil
}

private func record(
    _ exportId: String, state: String, recordingId: String = "rec-1", output: String? = nil,
    retryable: Bool = false, abandoning: Bool = false, cleanupPending: Bool = false
) -> ExportsState.Record {
    .init(
        exportId: exportId, recordingId: recordingId, kind: .video, revisionId: "r2", state: state,
        directory: "/Users/me/Exports", leaf: "demo.mp4", output: output, reason: nil,
        retryable: retryable, abandoning: abandoning, cleanupPending: cleanupPending)
}

func runExportTests() {
    var state = ready()
    state.recent = [.init(recordingId: "rec-1", createdAt: "2026-09-15T18:04:05Z", state: "complete",
        sourceDurationUs: 4_000_000, interruptionReason: nil)]
    var exports = ExportsState()
    precondition(exportsMenu(state, exports) == nil, "No exports section until there is an export to show")

    // One save panel at a time; the take is exportable again once the destination is chosen.
    precondition(exports.beginChoice(recordingId: "rec-1", kind: .video), "A take can start an export")
    precondition(!exports.beginChoice(recordingId: "rec-1", kind: .package), "A second panel is not opened")
    let menu = RecordingMenu.entries(for: state, exports: exports)
    precondition(entry(menu, "recording.export.video.rec-1")?.enabled == false
        && entry(menu, "recording.export.processed-package.rec-1")?.enabled == false,
        "Export choices wait while a destination is being chosen")
    let request = ExportsState.Request(
        exportId: "e1", recordingId: "rec-1", kind: .video, revisionId: "r2",
        directory: "/Users/me/Exports", leaf: "demo.mp4")
    exports.send(request)
    precondition(entry(RecordingMenu.entries(for: state, exports: exports), "recording.export.video.rec-1")?.enabled == true,
        "A sent request does not block exporting again")
    precondition(exports.resend("e1") == nil, "An outstanding send is not sent twice")

    // A lost reply keeps the original identity for the person's explicit retry.
    exports.unanswered("e1", reason: "TIMEOUT: export.create did not answer in time")
    guard let pending = exportsMenu(state, exports) else { preconditionFailure("The request is listed") }
    precondition(pending.title == "Exports — needs attention", "An unconfirmed request needs attention")
    precondition(pending.submenu.first?.title == "Video — demo.mp4 — not confirmed", "The request says it is unconfirmed")
    precondition(entry(pending.submenu, "export.resend.e1")?.enabled == true
        && entry(pending.submenu, "export.abandon.e1")?.enabled == true,
        "An unconfirmed request can be sent again or abandoned")
    precondition(exports.observed == ["e1"], "Status is read for an unconfirmed request in case it was admitted")
    precondition(exports.resend("e1") == request, "Sending again names the same export and destination")
    exports.unanswered("e1", reason: "SERVICE_STOPPED")

    var unavailable = state
    unavailable.service = .unavailable("offline")
    precondition(entry(exportsMenu(unavailable, exports)!.submenu, "export.resend.e1")?.enabled == false,
        "Nothing is sent while the service is unavailable")

    // Admission replaces the request with the service's description.
    exports.admit(record("e1", state: "queued"))
    precondition(exports.requests.isEmpty && exports.records.map(\.exportId) == ["e1"], "Admitted exports are records")
    precondition(exportsMenu(state, exports)?.title == "Exports — 1 in progress", "Queued work is in progress")
    precondition(exportsMenu(state, exports)?.submenu.first?.title == "Video — demo.mp4 — waiting",
        "A queued export waits")
    precondition(entry(exportsMenu(state, exports)!.submenu, "export.abandon.e1")?.enabled == true,
        "An unfinished export can be abandoned")
    precondition(entry(exportsMenu(state, exports)!.submenu, "export.retry.e1") == nil,
        "Work still running offers no retry")

    // Rediscovered exports keep their order behind this session's own.
    exports.update(record("e0", state: "failed", recordingId: "rec-0"))
    exports.admit(record("e2", state: "running"))
    precondition(exports.records.map(\.exportId) == ["e2", "e1", "e0"], "Newest requests first, discovered after")

    // A non-retryable failure is abandoned, not retried; an action is sent once.
    var failed = exportsMenu(state, exports)!.submenu
    precondition(entry(failed, "export.retry.e0")?.enabled == false, "A permanent failure is not retried")
    precondition(exports.begin(.abandon, "e0") && !exports.begin(.abandon, "e0"), "Abandon is sent once")
    failed = exportsMenu(state, exports)!.submenu
    precondition(entry(failed, "export.abandon.e0")?.title == "Abandoning…"
        && entry(failed, "export.abandon.e0")?.enabled == false, "A pending abandonment says so")
    exports.finish("e0", failure: "EXPORT_CLEANUP_FAILED: staging changed")
    precondition(exportsMenu(state, exports)!.submenu.last!.submenu.contains {
        $0.title == "EXPORT_CLEANUP_FAILED: staging changed"
    }, "A refused abandonment stays visible with its reason")
    exports.update(record("e0", state: "failed", recordingId: "rec-0", abandoning: true))
    precondition(entry(exportsMenu(state, exports)!.submenu, "export.abandon.e0")?.title == "Retry Abandon",
        "Unfinished abandonment is retried under the same export")
    exports.forget("e0")

    // A committed export keeps its receipt while private cleanup is retried.
    exports.update(record("e1", state: "committed", output: "/Users/me/Exports/demo.mp4", cleanupPending: true))
    let committed = exportsMenu(state, exports)!.submenu
    precondition(entry(committed, "export.reveal.e1")?.enabled == true, "A committed file can be shown")
    precondition(entry(committed, "export.retry.e1")?.title == "Retry Cleanup", "Retrying a commit only cleans up")
    precondition(entry(committed, "export.abandon.e1") == nil, "A committed export is not offered for abandonment")
    precondition(entry(committed, "export.dismiss.e1") == nil, "Pending cleanup cannot be dismissed")
    precondition(committed.contains { $0.title == "Video — demo.mp4 — exported, cleanup pending" },
        "Cleanup does not hide that the export committed")
    precondition(exports.observed.contains("e1"), "Pending cleanup is still observed")
    exports.update(record("e1", state: "committed", output: "/Users/me/Exports/demo.mp4"))
    precondition(!exports.observed.contains("e1"), "A clean commit is no longer polled")
    precondition(entry(exportsMenu(state, exports)!.submenu, "export.dismiss.e1")?.enabled == true,
        "A clean commit can leave the list")
    exports.dismiss("e1")
    exports.dismiss("e2")
    precondition(exports.records.map(\.exportId) == ["e2"], "Only settled commits are dismissed")

    exports.forgetRecording("rec-1")
    precondition(exports.records.isEmpty && exportsMenu(state, exports) == nil,
        "A deleted recording's exports leave the menu")

    let status = Data(#"""
        {"exportId":"e9","kind":"processed-package","abandoning":false,"recovery":null,"recordingId":"rec-9",
         "snapshot":{"revisionId":"r4","historyOrdinal":3},"state":"failed",
         "destination":{"directory":"/Volumes/Work","leaf":"take.zip"},"cleanupPending":true,
         "receipt":null,"output":null,"jobId":"j","reason":"Required evidence is unavailable","retryable":true}
        """#.utf8)
    guard let decoded = try? JSONDecoder().decode(ExportsState.Record.self, from: status) else {
        preconditionFailure("A service status decodes")
    }
    precondition(decoded.kind == .package && decoded.revisionId == "r4" && decoded.leaf == "take.zip"
        && decoded.output == nil && decoded.cleanupPending && decoded.retryable,
        "Status fields keep their meaning")
    print("PASS exports keep one identity through lost replies, retry, abandonment and cleanup")
}
