import Foundation

/// The exports section of the menu: requests awaiting an answer and each export the service
/// described, with only the actions the service can still take on it.
enum ExportMenu {
    static func entries(for state: ControlsState, exports: ExportsState) -> [MenuEntry] {
        guard !exports.requests.isEmpty || !exports.records.isEmpty || exports.discoveryFailure != nil
        else { return [] }
        let ready = state.service == .ready
        var rows: [MenuEntry] = []
        if let failure = exports.discoveryFailure {
            rows.append(MenuEntry(.status, "Unfinished exports could not be read — \(failure)", enabled: false))
        }
        for request in exports.requests {
            rows.append(requestEntry(request, exports: exports, ready: ready))
        }
        for record in exports.records {
            rows.append(recordEntry(record, exports: exports, ready: ready))
        }
        return [MenuEntry(.status, title(for: exports), submenu: rows)]
    }

    static func title(for exports: ExportsState) -> String {
        let attention = !exports.failures.isEmpty || !exports.readFailures.isEmpty || exports.discoveryFailure != nil
            || exports.requests.contains { $0.unconfirmed != nil }
            || exports.records.contains { $0.abandoning || $0.cleanupPending || $0.stopped }
        if attention { return "Exports — needs attention" }
        let working = exports.requests.count + exports.records.filter { !$0.settled }.count
        return working > 0 ? "Exports — \(working) in progress" : "Exports"
    }

    static func kindTitle(_ kind: ExportsState.Kind) -> String {
        switch kind {
        case .video: "Video"
        case .audio: "Audio"
        case .package: "AI Package"
        }
    }

    private static func requestEntry(
        _ request: ExportsState.Request, exports: ExportsState, ready: Bool
    ) -> MenuEntry {
        let acting = exports.acting[request.exportId]
        var details = [
            MenuEntry(.status, path(request.directory, request.leaf), enabled: false),
            MenuEntry(.status, "Revision \(request.revisionId) of \(targetTitle(request.target))", enabled: false),
        ]
        if let reason = request.unconfirmed {
            details.append(MenuEntry(.status, "Request not confirmed — \(reason)", enabled: false))
        }
        if let failure = exports.failures[request.exportId] {
            details.append(MenuEntry(.status, failure, enabled: false))
        }
        if let failure = exports.readFailures[request.exportId] {
            details.append(MenuEntry(.status, failure, enabled: false))
        }
        let actionable = ready && request.unconfirmed != nil && acting == nil
        details.append(contentsOf: [
            .separator(),
            MenuEntry(.command(.resendExport(request.exportId)), "Send Export Again", enabled: actionable),
            MenuEntry(
                .command(.abandonExport(request.exportId)),
                acting == .abandon ? "Abandoning…" : "Abandon Export", enabled: actionable),
        ])
        let state = request.unconfirmed == nil ? "sending…" : "not confirmed"
        return MenuEntry(
            .status, "\(kindTitle(request.kind)) — \(request.leaf) — \(state)", submenu: details)
    }

    private static func recordEntry(
        _ record: ExportsState.Record, exports: ExportsState, ready: Bool
    ) -> MenuEntry {
        let acting = exports.acting[record.exportId]
        var details = [
            MenuEntry(.status, record.output ?? path(record.directory, record.leaf), enabled: false),
            MenuEntry(.status, "Revision \(record.revisionId) of \(targetTitle(record.target))", enabled: false),
        ]
        if let reason = record.reason {
            details.append(MenuEntry(.status, reason, enabled: false))
        }
        if let failure = exports.failures[record.exportId] {
            details.append(MenuEntry(.status, failure, enabled: false))
        }
        if let failure = exports.readFailures[record.exportId] {
            details.append(MenuEntry(.status, failure, enabled: false))
        }
        details.append(.separator())
        if record.committed {
            details.append(
                MenuEntry(.command(.revealExport(record.exportId)), "Show in Finder", enabled: record.output != nil))
        }
        // A committed export is never published again: its retry only finishes private cleanup.
        if !record.abandoning && (record.committed ? record.cleanupPending : record.stopped) {
            details.append(
                MenuEntry(
                    .command(.retryExport(record.exportId)),
                    acting == .retry ? "Retrying…" : record.committed ? "Retry Cleanup" : "Retry Export",
                    enabled: ready && acting == nil
                        && (record.committed || record.retryable || record.state != "failed")))
        }
        if !record.committed || record.abandoning {
            details.append(
                MenuEntry(
                    .command(.abandonExport(record.exportId)),
                    acting == .abandon ? "Abandoning…" : record.abandoning ? "Retry Abandon" : "Abandon Export",
                    enabled: ready && acting == nil))
        }
        if record.committed && record.settled {
            details.append(
                MenuEntry(.command(.dismissExport(record.exportId)), "Remove from List", enabled: acting == nil))
        }
        return MenuEntry(
            .status, "\(kindTitle(record.kind)) — \(record.leaf) — \(stateTitle(record))", submenu: details)
    }

    private static func targetTitle(_ target: MediaTarget) -> String {
        switch target {
        case .recording(let id): "recording \(id)"
        case .project(let id): "project \(id)"
        }
    }

    static func stateTitle(_ record: ExportsState.Record) -> String {
        if record.abandoning { return "abandoning" }
        switch record.state {
        case "committed": return record.cleanupPending ? "exported, cleanup pending" : "exported"
        case "queued": return "waiting"
        case "running": return "exporting…"
        case "not_requested": return "not started"
        default: return record.state
        }
    }

    private static func path(_ directory: String, _ leaf: String) -> String {
        (directory as NSString).appendingPathComponent(leaf)
    }
}
