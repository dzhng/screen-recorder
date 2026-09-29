import Foundation

/// Something a person can ask the recording controls to do. Every case here is either a selection
/// this app holds until the next start, a permission only a person can request, or one service
/// operation the service already owns. Nothing here performs capture itself.
public enum ControlsAction: Hashable, Sendable {
    case selectDisplay(Int)
    case selectWindow(Int)
    case selectRegion
    /// A named input, or the person's current system default when no ID is given.
    case selectMicrophone(String?)
    case disableMicrophone
    case toggleSystemAudio
    case startOrStop
    case pauseOrResume
    case cancel
    case restart
    case previewRecording(String)
    case deleteRecording(String)
    /// Choose a destination and export the take's current revision.
    case exportRecording(String, ExportsState.Kind)
    /// Send an unconfirmed export request again under its original export ID.
    case resendExport(String)
    case retryExport(String)
    case abandonExport(String)
    case revealExport(String)
    /// Remove a finished export from this menu; its file and service history remain.
    case dismissExport(String)
    case refreshStorage
    case requestScreenPermission
    case requestMicrophonePermission
    case openSettings
    case quit

    /// A stable name for this action, so a menu row can be addressed by what it does.
    public var id: String {
        switch self {
        case .selectDisplay(let display): "source.display.\(display)"
        case .selectWindow(let window): "source.window.\(window)"
        case .selectRegion: "source.region"
        case .selectMicrophone(let device): "microphone.\(device ?? "default")"
        case .disableMicrophone: "microphone.off"
        case .toggleSystemAudio: "audio.system"
        case .startOrStop: "capture.startOrStop"
        case .pauseOrResume: "capture.pauseOrResume"
        case .cancel: "capture.cancel"
        case .restart: "capture.restart"
        case .previewRecording(let id): "recording.preview.\(id)"
        case .deleteRecording(let id): "recording.delete.\(id)"
        case .exportRecording(let id, let kind): "recording.export.\(kind.rawValue).\(id)"
        case .resendExport(let id): "export.resend.\(id)"
        case .retryExport(let id): "export.retry.\(id)"
        case .abandonExport(let id): "export.abandon.\(id)"
        case .revealExport(let id): "export.reveal.\(id)"
        case .dismissExport(let id): "export.dismiss.\(id)"
        case .refreshStorage: "storage.refresh"
        case .requestScreenPermission: "permission.screen"
        case .requestMicrophonePermission: "permission.microphone"
        case .openSettings: "app.settings"
        case .quit: "app.quit"
        }
    }
}

/// One row of the status-bar menu, before AppKit draws it. Keeping the rows a value is what lets
/// the same menu be asserted against, rendered for review, and built into a real `NSMenu`.
public struct MenuEntry: Equatable, Sendable {
    public enum Kind: Equatable, Sendable {
        /// A row a person can choose.
        case command(ControlsAction)
        /// A row that states something and cannot be chosen.
        case status
        /// A label introducing the rows under it.
        case header
        case separator
    }

    public init(
        _ kind: Kind, _ title: String = "", enabled: Bool = true, checked: Bool = false,
        shortcut: String? = nil, submenu: [MenuEntry] = []
    ) {
        self.kind = kind
        self.title = title
        self.enabled = enabled
        self.checked = checked
        self.shortcut = shortcut
        self.submenu = submenu
    }

    public let kind: Kind
    public let title: String
    public let enabled: Bool
    public let checked: Bool
    public let shortcut: String?
    public let submenu: [MenuEntry]

    public var action: ControlsAction? {
        if case .command(let action) = kind { return action }
        return nil
    }

    public static func separator() -> MenuEntry { MenuEntry(.separator) }
}

/// Builds the rows of the recording controls from what the service reported. It is a pure function
/// of the state: there is no second copy of device, catalog or clock behind it.
public enum RecordingMenu {
    public static func entries(
        for state: ControlsState, exports: ExportsState = .init(), shortcuts: ShortcutDefaults = .init()
    ) -> [MenuEntry] {
        // An idle app already says so through its status item; the menu opens on what a person
        // can do instead of a line that reads "Idle".
        var rows: [MenuEntry] = []
        if let working = workingTitle(for: state) {
            rows.append(MenuEntry(.status, working, enabled: false))
        }
        for note in notes(for: state) { rows.append(MenuEntry(.status, note, enabled: false)) }
        if !rows.isEmpty { rows.append(.separator()) }
        rows.append(
            MenuEntry(
                .status, "Source: \(sourceTitle(for: state))", enabled: !state.isLive,
                submenu: sourceEntries(for: state)))
        rows.append(
            MenuEntry(
                .status, "Microphone: \(microphoneTitle(for: state))", enabled: !state.isLive,
                submenu: microphoneEntries(for: state)))
        rows.append(
            MenuEntry(
                .command(.toggleSystemAudio), "Include System Audio", enabled: !state.isLive,
                checked: state.selection.systemAudio))
        rows.append(.separator())
        rows.append(contentsOf: transportEntries(for: state, shortcuts: shortcuts))
        rows.append(.separator())
        rows.append(
            MenuEntry(.status, "Recent Recordings", submenu: recentEntries(for: state, exports: exports)))
        rows.append(contentsOf: ExportMenu.entries(for: state, exports: exports))
        rows.append(contentsOf: storageEntries(for: state))
        rows.append(.separator())
        rows.append(MenuEntry(.command(.openSettings), "Settings", shortcut: "⌘,"))
        rows.append(MenuEntry(.command(.quit), "Quit Screen Recorder", shortcut: "⌘Q"))
        return rows
    }

    /// What this app is doing, when it is doing something. Nil while it sits idle and ready.
    static func workingTitle(for state: ControlsState) -> String? {
        if case .unavailable = state.service { return statusTitle(for: state) }
        if state.service == .starting { return statusTitle(for: state) }
        if state.take?.state == "finalizing" { return statusTitle(for: state) }
        if let device = state.device, device.state != .idle { return statusTitle(for: state) }
        return state.processing?.summary.map { "Preparing the last take — \($0)" }
    }

    /// The one line that says what this app is doing right now. A running take's time comes from
    /// the device's own clock, so it stops while the take is paused.
    public static func statusTitle(for state: ControlsState) -> String {
        if case .unavailable(let message) = state.service { return "Unavailable — \(message)" }
        if state.take?.state == "finalizing" {
            return state.take?.finalizationError == nil ? "Finishing take…" : "Finalization needs attention"
        }
        guard let device = state.device else {
            return state.service == .starting ? "Starting…" : "Idle"
        }
        let elapsed = ElapsedTime.format(device.elapsedUs)
        switch device.state {
        case .recording: return "Recording — \(elapsed)"
        case .paused: return "Paused — \(elapsed)"
        case .finalizing: return "Finishing take…"
        case .selecting: return "Preparing take…"
        case .idle: return "Idle"
        }
    }

    /// Anything else a person needs to read before acting: a failed action, a take that ended
    /// badly, a missing permission, and any key combination this app refused to steal.
    static func notes(for state: ControlsState) -> [String] {
        var notes: [String] = []
        if let failure = state.failure { notes.append(failure) }
        if let failure = state.take?.finalizationError {
            notes.append("Finalization failed — \(failure.code): \(failure.message)")
        }
        if let take = state.take, take.state == "interrupted", !state.isLive {
            notes.append(
                "Last take interrupted — \(take.interruptionReason ?? "reason unavailable")")
        }
        if let screen = state.permissions?.screen, screen != .granted {
            notes.append("Screen recording permission is required before recording.")
        }
        if !state.unavailableShortcuts.isEmpty {
            let taken = state.unavailableShortcuts.joined(separator: " and ")
            notes.append("\(taken) is already in use elsewhere, so it is off.")
            if let override = state.shortcutOverridePath {
                notes.append("Set your own shortcuts in \(override)")
            }
        }
        return notes
    }

    public static func sourceTitle(for state: ControlsState) -> String {
        switch state.selection.source {
        case .display(let display):
            display.width > 0 ? "\(display.name) (\(display.width)×\(display.height))" : display.name
        case .window(let window):
            window.application.isEmpty ? window.title : "\(window.application) — \(window.title)"
        case .region(let region):
            "Region \(Int(region.width))×\(Int(region.height)) of \(region.displayName)"
        case nil: "none chosen"
        }
    }

    public static func microphoneTitle(for state: ControlsState) -> String {
        // A chosen device that is unplugged says so, rather than reading as though this take will
        // be narrated through it: the take uses the system default until it is back.
        if case .device(_, let name)? = state.selection.awaitedMicrophone {
            return "system default, waiting for \(name)"
        }
        switch state.selection.microphone {
        case .off: return "off"
        case .systemDefault:
            return state.sources.microphones.first(where: \.isDefault).map { "\($0.name) (default)" }
                ?? "system default"
        case .device(_, let name): return name
        }
    }

    /// Both audio and source submenus say the same thing when access is missing: that it is not
    /// granted, the one action that grants it, then the choices that remain without it.
    private static func permissionEntries(_ kind: PermissionKind, for state: ControlsState) -> [MenuEntry] {
        guard let access = state.permissions?.access(to: kind), access != .granted else { return [] }
        return [
            MenuEntry(.status, kind.missingLine, enabled: false),
            MenuEntry(.command(kind.action), kind.allowTitle(for: access)),
            .separator(),
        ]
    }

    /// What a take records is fixed once it is recording, so every selection row here is refused
    /// while a take is live rather than silently applying to the next one.
    private static func sourceEntries(for state: ControlsState) -> [MenuEntry] {
        let selectable = !state.isLive
        var rows = permissionEntries(.screen, for: state)
        if !rows.isEmpty {
            rows.append(
                MenuEntry(.status, "Displays and windows are listed once access is allowed.", enabled: false))
        }
        if !state.sources.displays.isEmpty {
            rows.append(MenuEntry(.header, "Displays"))
            for display in state.sources.displays {
                rows.append(
                    MenuEntry(
                        .command(.selectDisplay(display.id)),
                        "\(display.name) (\(display.width)×\(display.height))",
                        enabled: selectable,
                        checked: state.selection.source == .display(display)))
            }
        }
        if !state.sources.windows.isEmpty {
            rows.append(MenuEntry(.header, "Windows"))
            for window in state.sources.windows {
                rows.append(
                    MenuEntry(
                        .command(.selectWindow(window.id)),
                        "\(window.application) — \(window.title)",
                        enabled: selectable,
                        checked: state.selection.source == .window(window)))
            }
        }
        if rows.isEmpty {
            rows.append(MenuEntry(.status, "No display or window is available.", enabled: false))
        }
        rows.append(.separator())
        var regionChecked = false
        if case .region = state.selection.source { regionChecked = true }
        rows.append(
            MenuEntry(
                .command(.selectRegion), "Select Region…",
                enabled: selectable && !state.sources.displays.isEmpty, checked: regionChecked))
        return rows
    }

    private static func microphoneEntries(for state: ControlsState) -> [MenuEntry] {
        let selectable = !state.isLive
        var rows = permissionEntries(.microphone, for: state)
        rows += [
            MenuEntry(
                .command(.disableMicrophone), "Off (no narration)", enabled: selectable,
                checked: state.selection.microphone == .off),
            MenuEntry(
                .command(.selectMicrophone(nil)), "System Default Input", enabled: selectable,
                checked: state.selection.microphone == .systemDefault),
        ]
        if !state.sources.microphones.isEmpty {
            rows.append(MenuEntry(.header, "Inputs"))
            for microphone in state.sources.microphones {
                rows.append(
                    MenuEntry(
                        .command(.selectMicrophone(microphone.id)), microphone.name,
                        enabled: selectable,
                        checked: state.selection.microphone
                            == .device(id: microphone.id, name: microphone.name)))
            }
        }
        return rows
    }

    private static func transportEntries(for state: ControlsState, shortcuts: ShortcutDefaults)
        -> [MenuEntry]
    {
        let live = state.isLive
        let paused = state.device?.state == .paused
        let ready = state.service == .ready
        let canStart = ready && state.selection.source != nil
        let recovering = state.take?.state == "finalizing" && state.device?.state == .idle
        let finishTitle = state.take?.finalizationError == nil ? "Finish Recording" : "Retry Finalization"
        var rows = [
            MenuEntry(
                .command(.startOrStop),
                state.counting ? "Cancel Countdown" : (live ? finishTitle : "Start Recording"),
                enabled: state.counting || (live ? ready : canStart),
                shortcut: shortcuts.display(of: .startOrStop)),
            MenuEntry(
                .command(.pauseOrResume), paused ? "Resume Recording" : "Pause Recording",
                enabled: ready && (state.device?.state == .recording || state.device?.state == .paused),
                shortcut: shortcuts.display(of: .pauseOrResume)),
            MenuEntry(
                .command(.cancel), recovering ? "Cancel Finalization" : "Cancel Take", enabled: live && ready,
                shortcut: shortcuts.display(of: .cancel)),
            MenuEntry(
                .command(.restart), "Restart Take", enabled: live && ready && !recovering,
                shortcut: shortcuts.display(of: .restart)),
        ]
        if ready && !live && state.selection.source == nil {
            rows.append(MenuEntry(.status, "Choose a source to record.", enabled: false))
        }
        return rows
    }

    /// Recent library takes expose the shared preview operation and the two export choices.
    private static func recentEntries(for state: ControlsState, exports: ExportsState) -> [MenuEntry] {
        let takes = state.recent + state.deletions.values
            .map(\.take)
            .filter { pending in !state.recent.contains { $0.recordingId == pending.recordingId } }
            .sorted { $0.recordingId < $1.recordingId }
        guard !takes.isEmpty else {
            return [MenuEntry(.status, "No recordings yet.", enabled: false)]
        }
        return takes.map { take in
            let request = state.deletions[take.recordingId]
            let pending = request?.isPending == true
            var details = [MenuEntry(.status, take.recordingId, enabled: false)]
            if let failure = take.finalizationError {
                details.append(MenuEntry(.status, "Finalization failed — \(failure.code): \(failure.message)", enabled: false))
            }
            if let failure = request?.failure {
                details.append(MenuEntry(.status, "Delete not confirmed — \(failure)", enabled: false))
            }
            let playable = state.service == .ready && request == nil
                && (take.state == "complete" || take.state == "interrupted")
                && (take.sourceDurationUs ?? 0) > 0
            // One save panel at a time; a take can still be exported again once a choice is made.
            let exportable = playable && exports.choosing == nil
            details.append(contentsOf: [
                .separator(),
                MenuEntry(.command(.previewRecording(take.recordingId)), "Preview", enabled: playable),
                MenuEntry(
                    .command(.exportRecording(take.recordingId, .video)), "Export Video…",
                    enabled: exportable),
                MenuEntry(
                    .command(.exportRecording(take.recordingId, .package)), "Export AI Package…",
                    enabled: exportable),
                .separator(),
                MenuEntry(
                    .command(.deleteRecording(take.recordingId)),
                    pending ? "Deleting…" : request == nil ? "Delete Recording" : "Retry Delete",
                    enabled: state.service == .ready && !pending),
            ])
            var suffix = pending ? " — deleting…" : request == nil ? "" : " — delete not confirmed"
            if suffix.isEmpty, state.processing?.recordingId == take.recordingId,
                let working = state.processing?.summary {
                suffix = " — \(working)"
            }
            return MenuEntry(.status, recentTitle(of: take) + suffix, submenu: details)
        }
    }

    private static func storageEntries(for state: ControlsState) -> [MenuEntry] {
        var details: [MenuEntry] = []
        let title: String
        if let storage = state.storage {
            let bytes = ByteCountFormatter.string(fromByteCount: storage.totalBytes, countStyle: .file)
            title = "Recording Storage: \(bytes) (last scan)"
            details.append(MenuEntry(.status, "Scanned \(ElapsedTime.shortTime(of: storage.observedAt))", enabled: false))
        } else {
            title = state.storageRefreshing ? "Recording Storage: measuring…" : "Recording Storage: not measured"
        }
        if let failure = state.storageFailure {
            details.append(MenuEntry(.status, "Storage unavailable — \(failure)", enabled: false))
        }
        details.append(MenuEntry(
            .command(.refreshStorage), state.storageRefreshing ? "Measuring Storage…" : "Refresh Storage",
            enabled: state.service == .ready && !state.storageRefreshing))
        return [MenuEntry(.status, title, submenu: details)]
    }

    public static func recentTitle(of take: ControlsState.RecentTake) -> String {
        let when = ElapsedTime.shortTime(of: take.createdAt)
        switch take.state {
        case "complete": return "\(when) — \(ElapsedTime.format(take.sourceDurationUs))"
        case "interrupted":
            let duration = take.sourceDurationUs.map { " \(ElapsedTime.format($0))" } ?? ""
            return "\(when) — interrupted\(duration)"
        default: return "\(when) — \(take.state)"
        }
    }
}
