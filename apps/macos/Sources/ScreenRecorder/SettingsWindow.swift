import AppKit
import ScreenRecorderControls
import ServiceManagement
import SwiftUI

/**
 The Settings window: permissions, recording defaults, shortcuts and launch behaviour in one
 ordinary window, so none of it is only reachable through nested submenus.

 It owns no selection and no permission state. The recording controls push the one state they
 hold, and every recording or permission change goes back to them as the same action the menu
 sends. Only the launch preference and login-item registration are edited here directly: the first
 lives in preferences, the second is read from and written to the system, never cached.
 */
@MainActor
final class SettingsWindow: NSObject, NSWindowDelegate {
    static let title = "Screen Recorder Settings"

    private let model: SettingsModel
    private let preferences: Preferences
    private let refreshPermissions: () -> Void
    private var window: NSWindow?

    init(
        preferences: Preferences, perform: @escaping (ControlsAction) -> Void,
        refreshPermissions: @escaping () -> Void
    ) {
        self.preferences = preferences
        self.refreshPermissions = refreshPermissions
        model = SettingsModel(preferences: preferences, perform: perform)
        super.init()
        // Returning from System Settings activates this app again; that is when access changes.
        NotificationCenter.default.addObserver(
            forName: NSApplication.didBecomeActiveNotification, object: nil, queue: .main
        ) { [weak self] _ in
            MainActor.assumeIsolated {
                guard let self, self.isVisible else { return }
                self.refreshSystemState()
            }
        }
    }

    var isVisible: Bool { window?.isVisible == true }

    /// An accessory app is never frontmost on its own, so a person opening the window activates it.
    /// A launch a check drives orders the same window in behind everything instead: taking the
    /// screen from whoever is at the Mac is no part of what such a run verifies.
    func show() {
        let window = self.window ?? makeWindow()
        refreshSystemState()
        if ControlsProbe.observed {
            window.orderBack(nil)
            return
        }
        NSApplication.shared.activate()
        window.makeKeyAndOrderFront(nil)
    }

    func update(_ state: ControlsState, shortcuts: ShortcutDefaults) {
        if model.state != state { model.state = state }
        if model.shortcuts != shortcuts { model.shortcuts = shortcuts }
    }

    func windowDidBecomeKey(_ notification: Notification) {
        refreshSystemState()
    }

    func windowWillClose(_ notification: Notification) {
        if let window { preferences.settingsFrame = window.frameDescriptor }
    }

    private func refreshSystemState() {
        refreshPermissions()
        model.readLoginItem()
    }

    private func makeWindow() -> NSWindow {
        let content = NSHostingView(rootView: SettingsView(model: model))
        // The form scrolls, so the window decides its height: all of it where the screen has room.
        content.sizingOptions = []
        let available = (NSScreen.main?.visibleFrame.height ?? 900) - 60
        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 560, height: min(780, available)),
            styleMask: [.titled, .closable, .miniaturizable], backing: .buffered, defer: false)
        window.title = Self.title
        window.isReleasedWhenClosed = false
        window.contentView = content
        window.delegate = self
        if let frame = preferences.settingsFrame {
            window.setFrame(from: frame)
        } else {
            window.center()
        }
        installWindowMenu()
        self.window = window
        return window
    }

    /// A menu-bar app shows no menu bar, but its key equivalents still route through the main
    /// menu, and a window a person can see should close with ⌘W.
    private func installWindowMenu() {
        guard NSApplication.shared.mainMenu == nil else { return }
        let window = NSMenu(title: "Window")
        window.addItem(NSMenuItem(title: "Close", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w"))
        let item = NSMenuItem()
        item.submenu = window
        let main = NSMenu()
        main.addItem(item)
        NSApplication.shared.mainMenu = main
    }
}

@MainActor
final class SettingsModel: ObservableObject {
    @Published var state = ControlsState()
    @Published var shortcuts = ShortcutDefaults()
    /// Read from the system each time the window is shown or comes forward.
    @Published private(set) var loginItem = SMAppService.Status.notRegistered
    @Published private(set) var loginFailure: String?
    @Published var showAtLaunch: Bool {
        didSet { preferences.showSettingsAtLaunch = showAtLaunch }
    }
    let perform: (ControlsAction) -> Void
    private let preferences: Preferences

    /// Where a person states combinations of their own, as the controls state names it.
    var shortcutFile: String { state.shortcutOverridePath ?? "" }

    init(preferences: Preferences, perform: @escaping (ControlsAction) -> Void) {
        self.preferences = preferences
        self.perform = perform
        showAtLaunch = preferences.showSettingsAtLaunch
    }

    func readLoginItem() {
        loginItem = SMAppService.mainApp.status
    }

    /// Registration is the system's state; this only asks for a change and reads back the answer.
    func openAtLogin(_ enabled: Bool) {
        loginFailure = nil
        do {
            if enabled {
                try SMAppService.mainApp.register()
            } else {
                try SMAppService.mainApp.unregister()
            }
        } catch {
            loginFailure = error.localizedDescription
        }
        readLoginItem()
    }

    func revealShortcutFile() {
        if FileManager.default.fileExists(atPath: shortcutFile) {
            NSWorkspace.shared.activateFileViewerSelecting([URL(fileURLWithPath: shortcutFile)])
        } else {
            NSWorkspace.shared.selectFile(nil, inFileViewerRootedAtPath: (shortcutFile as NSString).deletingLastPathComponent)
        }
    }
}

struct SettingsView: View {
    @ObservedObject var model: SettingsModel

    var body: some View {
        Form {
            Section("Permissions") {
                ForEach(PermissionKind.allCases, id: \.self) { kind in
                    permissionRow(kind)
                }
            }
            recordingSection
            shortcutsSection
            generalSection
        }
        .formStyle(.grouped)
    }

    @ViewBuilder
    private func permissionRow(_ kind: PermissionKind) -> some View {
        let access = model.state.permissions?.access(to: kind)
        detailRow(kind.name, kind.purpose) {
            switch access {
            case .granted?:
                Label(kind.statusTitle(for: .granted), systemImage: "checkmark.circle.fill")
                    .labelStyle(StatusLabelStyle(tint: .green))
            case let missing?:
                HStack(spacing: 10) {
                    Label(kind.statusTitle(for: missing), systemImage: "exclamationmark.circle.fill")
                        .labelStyle(StatusLabelStyle(tint: .orange))
                    // The same action as the menu's: it prompts, or opens the privacy pane once a
                    // prompt was already answered.
                    Button(missing == .denied ? "Open System Settings…" : "Allow…") {
                        model.perform(kind.action)
                    }
                }
            case nil:
                Text("Checking…").foregroundStyle(.secondary)
            }
        }
    }

    /// A row whose label runs to a second explanatory line. `LabeledContent` aligns its value with
    /// the first line, which leaves a status and its button riding high against two lines of text,
    /// so this centers the value against the whole label the way System Settings does.
    private func detailRow(
        _ title: String, _ detail: String, @ViewBuilder content: () -> some View
    ) -> some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                Text(detail).font(.callout).foregroundStyle(.secondary)
            }
            Spacer(minLength: 12)
            content()
        }
    }

    private var recordingSection: some View {
        let live = model.state.isLive
        return Section {
            Picker(selection: microphone) {
                Text("Off (no narration)").tag(MicrophoneTag.off)
                Text(defaultInputTitle).tag(MicrophoneTag.systemDefault)
                if !inputs.isEmpty {
                    Divider()
                    ForEach(inputs, id: \.id) { input in
                        Text(input.name).tag(MicrophoneTag.device(input.id))
                    }
                }
            } label: {
                Text("Microphone")
            }
            Toggle(isOn: systemAudio) {
                Text("Include All System Audio")
                Text("Records everything the Mac plays, not a single app or tab.")
            }
        } header: {
            Text("Recording")
        } footer: {
            if live {
                Text("The recording in progress keeps the choices it started with.")
                    .foregroundStyle(.secondary)
            }
        }
        .disabled(live)
    }

    private var shortcutsSection: some View {
        Section {
            ForEach(Self.shortcutActions, id: \.0.id) { action, name in
                LabeledContent(name) { shortcutValue(action) }
            }
            detailRow("Custom Shortcuts", (model.shortcutFile as NSString).abbreviatingWithTildeInPath) {
                Button("Show in Finder") { model.revealShortcutFile() }
            }
        } header: {
            Text("Shortcuts")
        } footer: {
            Text("Edits to the shortcuts file apply the next time Screen Recorder starts.")
                .foregroundStyle(.secondary)
        }
    }

    @ViewBuilder
    private func shortcutValue(_ action: ControlsAction) -> some View {
        if let held = model.shortcuts.display(of: action) {
            // Modifier glyphs set solid read as one mark; a thin space keeps each one legible.
            Text(held.map(String.init).joined(separator: "\u{2009}")).monospaced()
        } else if let bound = model.shortcuts.bindings[action] {
            Label("\(bound.display) is in use elsewhere", systemImage: "exclamationmark.triangle.fill")
                .labelStyle(StatusLabelStyle(tint: .orange))
        } else {
            Text("Off").foregroundStyle(.secondary)
        }
    }

    private var generalSection: some View {
        Section("General") {
            Toggle("Show this window when Screen Recorder starts", isOn: $model.showAtLaunch)
            Toggle(isOn: openAtLogin) {
                Text("Open at login")
                Text(loginItemDescription)
            }
            if let failure = model.loginFailure {
                Text(failure).foregroundStyle(.red)
            }
            // The toggle registers the login item by itself. Only when macOS keeps that decision
            // for a person to confirm, or does not recognise this copy, does anyone need the pane.
            if [.requiresApproval, .notFound].contains(model.loginItem) {
                HStack {
                    Spacer(minLength: 12)
                    Button("Open Login Items Settings…") { SMAppService.openSystemSettingsLoginItems() }
                }
            }
        }
    }

    private static let shortcutActions: [(ControlsAction, String)] = [
        (.startOrStop, "Start or Stop Recording"), (.pauseOrResume, "Pause or Resume Recording"),
        (.cancel, "Cancel Take"), (.restart, "Restart Take"),
    ]

    private var loginItemDescription: String {
        switch model.loginItem {
        case .enabled: "Screen Recorder opens when you log in."
        case .requiresApproval: "Waiting for your approval in Login Items settings."
        case .notRegistered: "Screen Recorder does not open when you log in."
        case .notFound: "macOS does not recognise this copy of Screen Recorder as a login item."
        @unknown default: "macOS reports an unknown login item status."
        }
    }

    private var openAtLogin: Binding<Bool> {
        Binding(
            get: { [.enabled, .requiresApproval].contains(model.loginItem) },
            set: { model.openAtLogin($0) })
    }

    private enum MicrophoneTag: Hashable {
        case off, systemDefault
        case device(String)
    }

    /// The catalog's inputs, plus a saved input the catalog does not list right now, so the picker
    /// always shows what is actually selected.
    private var inputs: [(id: String, name: String)] {
        var listed = model.state.sources.microphones.map { (id: $0.id, name: $0.name) }
        if case .device(let id, let name) = model.state.selection.microphone,
            !listed.contains(where: { $0.id == id }) {
            listed.append((id: id, name: name))
        }
        return listed
    }

    private var defaultInputTitle: String {
        model.state.sources.microphones.first(where: \.isDefault)
            .map { "System Default (\($0.name))" } ?? "System Default"
    }

    private var microphone: Binding<MicrophoneTag> {
        Binding(
            get: {
                switch model.state.selection.microphone {
                case .off: .off
                case .systemDefault: .systemDefault
                case .device(let id, _): .device(id)
                }
            },
            set: { tag in
                switch tag {
                case .off: model.perform(.disableMicrophone)
                case .systemDefault: model.perform(.selectMicrophone(nil))
                case .device(let id): model.perform(.selectMicrophone(id))
                }
            })
    }

    private var systemAudio: Binding<Bool> {
        Binding(
            get: { model.state.selection.systemAudio },
            set: { if $0 != model.state.selection.systemAudio { model.perform(.toggleSystemAudio) } })
    }
}

/// A status word with a tinted symbol, the way System Settings states an access.
private struct StatusLabelStyle: LabelStyle {
    let tint: Color
    func makeBody(configuration: Configuration) -> some View {
        HStack(spacing: 4) {
            configuration.icon.foregroundStyle(tint)
            configuration.title.foregroundStyle(.secondary)
        }
    }
}
