import Foundation
import ScreenRecorderControls

/// A submenu read the way a person scans it: what each row says or does, in order.
private func shape(_ entries: [MenuEntry]) -> [String] {
    entries.map { entry in
        switch entry.kind {
        case .separator: "—"
        case .header: "[\(entry.title)]"
        case .status: entry.enabled ? entry.title : "(\(entry.title))"
        case .command(let action): "\(action.id): \(entry.title)\(entry.enabled ? "" : " (disabled)")"
        }
    }
}

private func submenu(_ entries: [MenuEntry], startingWith prefix: String) -> [MenuEntry] {
    guard let row = entries.first(where: { $0.title.hasPrefix(prefix) }) else {
        preconditionFailure("The menu has no \(prefix) row")
    }
    return row.submenu
}

func runStartPermissionTests() {
    precondition(
        PermissionKind.missing(fromStartFailure: "MICROPHONE_PERMISSION_REQUIRED") == .microphone,
        "A start refused for the microphone asks for the microphone")
    precondition(
        PermissionKind.missing(fromStartFailure: "PERMISSION_REQUIRED") == .screen,
        "A start refused for the screen asks for screen recording")
    for code in ["SOURCE_UNAVAILABLE", "TIMEOUT", "CAPTURE_BUSY", ""] {
        precondition(
            PermissionKind.missing(fromStartFailure: code) == nil,
            "\(code) names no missing access and must not ask for one")
    }
    print("PASS a refused start asks for the access it was missing")
}

func runPermissionRowTests() {
    let granted = RecordingMenu.entries(for: ready())
    precondition(
        shape(submenu(granted, startingWith: "Source:")) == [
            "[Displays]", "source.display.3: Studio Display (2560×1440)",
            "[Windows]", "source.window.88: Safari — Pricing",
            "—", "source.region: Select Region…",
        ], "With access granted, Source lists only the choices")
    precondition(
        shape(submenu(granted, startingWith: "Microphone:")) == [
            "microphone.off: Off (no narration)", "microphone.default: System Default Input",
            "[Inputs]", "microphone.mic-built-in: MacBook Pro Microphone",
            "microphone.mic-headset: Studio Headset",
        ], "With access granted, Microphone lists only the choices")

    for (access, allow) in [(ControlsState.Access.undetermined, "Allow Screen Recording…"),
        (.denied, "Allow in System Settings…")] {
        var state = ready()
        state.permissions = ControlsState.Permissions(screen: access, microphone: .granted)
        // A catalog read without screen access lists nothing.
        state.sourcesUnavailable(code: "PERMISSION_REQUIRED", description: "")
        precondition(
            shape(submenu(RecordingMenu.entries(for: state), startingWith: "Source:")) == [
                "(Screen recording access is not granted.)", "permission.screen: \(allow)", "—",
                "(Displays and windows are listed once access is allowed.)",
                "—", "source.region: Select Region… (disabled)",
            ], "Missing screen access says so, offers the grant, and names why no source is listed")
    }

    for (access, allow) in [(ControlsState.Access.undetermined, "Allow Microphone Access…"),
        (.denied, "Allow in System Settings…")] {
        var state = ready()
        state.permissions = ControlsState.Permissions(screen: .granted, microphone: access)
        precondition(
            shape(submenu(RecordingMenu.entries(for: state), startingWith: "Microphone:")) == [
                "(Microphone access is not granted.)", "permission.microphone: \(allow)", "—",
                "microphone.off: Off (no narration)", "microphone.default: System Default Input",
                "[Inputs]", "microphone.mic-built-in: MacBook Pro Microphone",
                "microphone.mic-headset: Studio Headset",
            ], "Missing microphone access has the same shape as missing screen access")
    }

    precondition(
        ControlsState.Access(microphoneAuthorization: "authorized") == .granted
            && ControlsState.Access(microphoneAuthorization: "not_determined") == .undetermined
            && ControlsState.Access(microphoneAuthorization: "denied") == .denied
            && ControlsState.Access(microphoneAuthorization: "restricted") == .denied,
        "Only an unanswered prompt can still be asked; restricted access is as final as a denial")
    print("PASS both permission submenus state missing access the same way")
}

func runSettingsActionTests() {
    var unavailable = ControlsState()
    unavailable.service = .unavailable("Node 24 was not found")
    for state in [ready(), unavailable] {
        let entries = RecordingMenu.entries(for: state)
        guard let settings = entries.first(where: { $0.action == .openSettings }) else {
            preconditionFailure("The menu opens Settings")
        }
        precondition(
            settings.title == "Settings" && settings.shortcut == "⌘," && settings.enabled,
            "Settings… is always reachable with the standard shortcut, even without a service")
        precondition(
            Shortcut(display: "⌘,") == Shortcut(command: true, key: ","),
            "The Settings shortcut is one the menu can bind")
        precondition(
            entries.firstIndex(where: { $0.action == .openSettings })! + 1
                == entries.firstIndex(where: { $0.action == .quit })!,
            "Settings… sits with Quit at the end of the menu")
    }
    print("PASS Settings… opens from the menu with ⌘,")
}

func runPreferenceTests() {
    let directory = FileManager.default.temporaryDirectory
        .appendingPathComponent("screenrec-preferences-\(UUID().uuidString)")
    try! FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: directory) }
    // An absolute suite name keeps this domain in the scratch directory, away from real defaults.
    let suite = directory.appendingPathComponent("preferences").path
    let launch = { Preferences(defaults: UserDefaults(suiteName: suite)!) }

    let first = launch()
    precondition(first.showSettingsAtLaunch, "Settings opens at launch until a person turns it off")
    precondition(
        first.countdown?.remaining == Countdown.defaultSeconds,
        "A start counts down until a person turns that off")
    let fresh = ControlsState(recording: first.recording)
    precondition(
        fresh.selection.microphone == .systemDefault && !fresh.selection.systemAudio
            && fresh.selection.source == nil,
        "With nothing saved, a take is narrated through the default input and no system audio")

    var edited = fresh
    edited.selection.microphone = .device(id: headset.id, name: headset.name)
    edited.selection.systemAudio = true
    first.recording = edited.selection.recordingDefaults
    first.showSettingsAtLaunch = false
    first.countdownBeforeRecording = false

    let relaunched = launch()
    precondition(!relaunched.showSettingsAtLaunch, "Turning the window off survives a relaunch")
    precondition(
        relaunched.countdown == nil,
        "Turning the countdown off survives a relaunch, and then a start records immediately")
    let restored = ControlsState(recording: relaunched.recording)
    precondition(
        restored.selection.microphone == .device(id: "mic-headset", name: "Studio Headset")
            && restored.selection.systemAudio && restored.selection.source == nil,
        "A fresh launch starts from the saved audio choices and still asks for a source")
    precondition(
        RecordingMenu.microphoneTitle(for: restored) == "Studio Headset",
        "The saved input is named before the catalog has been read")

    relaunched.recording = RecordingDefaults(microphone: .off, systemAudio: false)
    let silent = ControlsState(recording: launch().recording)
    precondition(
        silent.selection.microphone == .off && !silent.selection.systemAudio,
        "Turning narration off is saved as off, not as the default input")
    print("PASS recording defaults and the launch window preference survive a relaunch")
}
