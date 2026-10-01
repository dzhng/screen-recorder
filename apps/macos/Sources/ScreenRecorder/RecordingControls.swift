import AppKit
import ScreenRecorderCapture
import ScreenRecorderControls

/**
 The status-bar recording controls.

 Everything a person can do here is one service operation the service already owns: this holds what
 they have selected to record next, asks the service to act, and shows what the service answered.
 It keeps no device state machine, no catalog and no clock of its own — the elapsed time it shows
 is the running take's own playback time, read back through the same status call the CLI reads.
 Permissions are the one thing native owns outright, and they are only ever requested by a person
 choosing to request them. The Settings window is a second view of this same state: it sends the
 same actions the menu does, and the audio choices both edit are saved as the next launch's defaults.
 */
@MainActor
final class RecordingControls: NSObject, NSMenuDelegate {
    private let statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
    private let menu = NSMenu()
    private var renderedEntries: [MenuEntry] = []
    private let shortcuts = GlobalShortcuts()
    private let region = RegionSelection()
    private let quit: () -> Void
    private let preferences: Preferences
    private var state: ControlsState
    /// Screen access has no "not yet asked" state to read, so a request this launch that came back
    /// refused is what says asking again would prompt for nothing.
    private var screenRequestRefused = false
    private var bindings = ShortcutDefaults.suggested
    private var held: Set<String> = []
    private weak var host: ServiceHost?
    private lazy var preview = PreviewController(
        call: { [weak self] operation, params in
            guard let self else { throw Self.noService }
            return try await self.service().call(operation, params)
        },
        failure: { [weak self] message in
            self?.state.failure = message
            self?.render()
        })
    private lazy var exports = ExportController(
        call: { [weak self] operation, params throws(ServiceFailure) in
            guard let self else { throw Self.noService }
            return try await self.service().call(operation, params)
        },
        changed: { [weak self] in self?.render() },
        failure: { [weak self] message in
            self?.state.failure = message
            self?.render()
        })
    private lazy var library: LibraryController = LibraryController(
        call: { [weak self] operation, params throws(ServiceFailure) in
            guard let self else { throw Self.noService }
            return try await self.service().call(operation, params)
        }, changed: { [weak self] in
            guard let self else { return }
            state.library = library.state
            render()
        }, closePreview: { [weak self] in self?.preview.close(target: $0) },
        forgetExports: { [weak self] in self?.exports.forget(target: $0) },
        deleted: { [weak self] in self?.readStorage() },
        preview: { [weak self] in self?.preview.open($0) },
        export: { [weak self] in self?.exports.export($0, kind: $1) })
    private lazy var overlay = RecordingOverlayPanel(
        preferences: preferences, perform: { [weak self] action in self?.perform(action) })
    private lazy var countdown = StartCountdown(shortcuts: shortcuts)
    private lazy var settings = SettingsWindow(
        preferences: preferences,
        perform: { [weak self] action in self?.perform(action) },
        refreshPermissions: { [weak self] in
            self?.readPermissions()
            self?.render()
        })
    private var ticker: Timer?
    private var reading = false
    private var menuIsOpen = false
    private var pendingRefresh = false
    private var pendingStorageRefresh = false

    /// Bounded status cadence, including controls issued by another client.
    private static let tick: TimeInterval = 0.5

    init(home: String, preferences: Preferences, quit: @escaping () -> Void) {
        self.quit = quit
        self.preferences = preferences
        state = ControlsState(recording: preferences.recording)
        let overridePath = GlobalShortcuts.overridePath(home: home)
        super.init()
        state.shortcutOverridePath = overridePath
        bindings = ShortcutDefaults.overridden(by: FileManager.default.contents(atPath: overridePath))
        let outcome = shortcuts.claim(bindings) { [weak self] action in self?.perform(action) }
        held = outcome.held
        state.unavailableShortcuts = outcome.unavailable
        menu.delegate = self
        statusItem.menu = menu
        statusItem.button?.setAccessibilityLabel("Screen Recorder")
        readPermissions()
        render()
    }

    func attach(to host: ServiceHost) {
        self.host = host
        refresh()
    }

    /// The service's own lifetime, as the app already observes it. A service that is not ready
    /// cannot carry a capture operation, so the controls say so rather than offering one.
    func serviceStateChanged(_ serviceState: ServiceHost.State) {
        switch serviceState {
        case .starting: state.service = .starting
        case .ready: state.service = .ready
        case .unavailable(_, let message): state.service = .unavailable(message)
        }
        library.serviceChanged(ready: state.service == .ready)
        if state.service == .ready {
            refresh()
            exports.discover()
        } else {
            preview.close()
            render()
        }
    }

    /// Shows the floating controls at a clock a take would take hours to reach, so a check can
    /// see how they are laid out then. Only the fixture observer reaches this.
    func showOverlay(elapsed: String) {
        guard ControlsProbe.observed else { return }
        overlay.update(.init(elapsed: elapsed, paused: false, symbol: "record.circle.fill"))
    }

    /// The live menu, so a check can read exactly what a person would see.
    var visibleMenu: NSMenu { menu }

    func menuDidClose(_ menu: NSMenu) { menuIsOpen = false }

    func menuWillOpen(_ menu: NSMenu) {
        menuIsOpen = true
        refresh()
        if state.service == .ready { exports.discover() }
    }

    // MARK: acting

    @objc func choose(_ sender: NSMenuItem) {
        guard let action = StatusMenu.action(of: sender) else { return }
        perform(action)
    }

    func perform(_ action: ControlsAction) {
        state.failure = nil
        let chosen = state.selection.recordingDefaults
        if library.perform(action) { render(); return }
        switch action {
        case .selectDisplay(let id):
            if let display = state.sources.displays.first(where: { $0.id == id }) {
                state.selection.source = .display(display)
            }
        case .selectWindow(let id):
            if let window = state.sources.windows.first(where: { $0.id == id }) {
                state.selection.source = .window(window)
            }
        case .selectRegion:
            region.choose(displays: state.sources.displays) { [weak self] chosen in
                guard let self, let chosen else { return }
                state.selection.source = .region(chosen)
                render()
            }
        case .disableMicrophone:
            state.selection.microphone = .off
        case .selectMicrophone(nil):
            state.selection.microphone = .systemDefault
            state.selection.awaitedMicrophone = nil
        case .selectMicrophone(.some(let id)):
            if let microphone = state.sources.microphones.first(where: { $0.id == id }) {
                state.selection.microphone = .device(id: microphone.id, name: microphone.name)
                state.selection.awaitedMicrophone = nil
            } else if case .device(let awaited, _)? = state.selection.awaitedMicrophone,
                awaited == id {
                // Choosing the one that is unplugged again is asking to keep waiting for it, which
                // is already what is happening; anything else here would discard their choice.
                break
            }
        case .toggleSystemAudio:
            state.selection.systemAudio.toggle()
        case .startOrStop:
            state.isLive ? capture("capture.stop", live()) : countThenStart()
        case .pauseOrResume:
            capture(state.device?.state == .paused ? "capture.resume" : "capture.pause", live())
        case .cancel:
            capture("capture.cancel", live())
        case .restart:
            restart()
        case .previewRecording, .deleteRecording, .exportRecording,
            .previewProject, .exportProject, .deleteProject, .nextProjects, .previousProjects, .refreshLibrary:
            break // LibraryController handles these before capture selections.
        case .resendExport(let exportId):
            exports.resend(exportId)
        case .retryExport(let exportId):
            exports.retry(exportId)
        case .abandonExport(let exportId):
            exports.abandon(exportId)
        case .revealExport(let exportId):
            exports.reveal(exportId)
        case .dismissExport(let exportId):
            exports.dismiss(exportId)
        case .refreshStorage:
            readStorage()
        case .requestScreenPermission:
            request(.screen)
        case .requestMicrophonePermission:
            request(.microphone)
        case .openSettings:
            settings.show()
        case .quit:
            quit()
        }
        if state.selection.recordingDefaults != chosen {
            preferences.recording = state.selection.recordingDefaults
        }
        render()
    }

    /// The take the device is working on. Capture control names its recording, so an action with
    /// no live take is refused here rather than sent without one.
    private func live() -> [String: Any]? {
        guard let recordingId = state.device?.recordingId
            ?? (state.take?.state == "finalizing" ? state.take?.recordingId : nil) else { return nil }
        return ["recordingId": recordingId]
    }

    /// A start a person asked for, from the menu, the floating controls or a key combination: the
    /// count runs first and nothing is asked of the service until it has run out, so an abandoned
    /// count leaves no take behind. A start with nothing to record, no service to record through,
    /// or the count turned off goes straight to the service, which is what says why it could not:
    /// counting three seconds down before saying no is three seconds nobody asked for.
    private func countThenStart() {
        // Asking to start while the count runs is asking to stop it: the menu says so, and this is
        // the only way to abandon a count for somebody whose Escape key this app could not hold.
        if countdown.isCounting { return countdown.abandon() }
        guard state.selection.start() != nil, state.service == .ready,
            let counting = preferences.countdown
        else { return start() }
        state.counting = true
        render()
        countdown.run(counting, on: NSScreen.recording(state.selection.source)) { [weak self] began in
            guard let self else { return }
            state.counting = false
            render()
            if began { start() }
        }
    }

    private func start() {
        guard let request = state.beginStart(newRequestId: UUID().uuidString) else { return }
        capture("capture.start", parameters(of: request.start, requestId: request.requestId)) {
            [weak self] result in
            guard let self else { return }
            let answer: ControlsState.StartAnswer =
                switch result {
                case .success(let data):
                    .init(recordingState: (try? JSONDecoder().decode(StartedTake.self, from: data))?.state ?? "")
                case .failure(let failure): .init(failureCode: failure.code)
                }
            if state.finishStart(request, answer) { return start() }
            if case .failure(let failure) = result,
                let missing = PermissionKind.missing(fromStartFailure: failure.code) {
                // Pressing Start is the person asking to record, so this is when the app may ask
                // macOS for what recording needs, and start once they allow it.
                return requestForStart(missing)
            }
            if case .failure = result { showMenuIfClosed() }
        }
    }

    private func restart() {
        guard let recordingId = state.device?.recordingId else { return }
        guard let start = state.selection.start() else {
            state.failure = "Choose a source before recording."
            return
        }
        var params = parameters(of: start, requestId: UUID().uuidString)
        params["recordingId"] = recordingId
        capture("capture.restart", params)
    }

    private func parameters(
        of start: ControlsState.CaptureSelection.Start, requestId: String
    ) -> [String: Any] {
        var params =
            (try? JSONEncoder().encode(start)).flatMap {
                try? JSONSerialization.jsonObject(with: $0) as? [String: Any]
            } ?? [:]
        params["requestId"] = requestId
        return params
    }

    /// Sends one service operation and shows what came back. A refusal is stated in the menu with
    /// the service's own code, so a person sees what was refused rather than a silent no-op.
    private func capture(
        _ operation: String, _ params: [String: Any]?,
        then settle: (@MainActor (Result<Data, ServiceFailure>) -> Void)? = nil
    ) {
        guard let params else {
            state.failure = "No take is recording."
            return render()
        }
        Task { @MainActor in
            let result: Result<Data, ServiceFailure>
            do throws(ServiceFailure) {
                result = .success(try await service().call(operation, params))
            } catch {
                result = .failure(error)
                state.failure = error.localizedDescription
            }
            settle?(result)
            refresh()
        }
    }

    /// A library scan may be slow. It never occupies the status read, and overlapping explicit
    /// refreshes coalesce so a deletion finishing mid-scan gets a fresh observation afterward.
    private func readStorage() {
        guard host != nil, state.service == .ready else { return }
        guard !state.storageRefreshing else {
            pendingStorageRefresh = true
            return
        }
        state.storageRefreshing = true
        state.storageFailure = nil
        render()
        Task { @MainActor in
            do throws(ServiceFailure) {
                state.storage = try await service().call(
                    "storage.usage", as: ControlsState.StorageObservation.self)
            } catch {
                state.storageFailure = error.localizedDescription
            }
            state.storageRefreshing = false
            render()
            if pendingStorageRefresh {
                pendingStorageRefresh = false
                readStorage()
            }
        }
    }

    /// Asks for the access a start turned out to need, then starts the take once it is granted.
    private func requestForStart(_ kind: PermissionKind) {
        Task { @MainActor in
            let granted = (try? await NativeCapture.requestPermission(kind == .screen ? "screen" : "microphone")) ?? false
            if granted, kind == .microphone {
                state.failure = nil
                start()
            } else {
                // Screen recording is read once when a process starts, so a fresh grant reaches
                // this app only after it runs again.
                state.failure = granted
                    ? "Screen recording was allowed. Quit and open Screen Recorder again to record."
                    : "\(kind.name) access was not granted. Allow it in System Settings > Privacy & Security."
                showMenuIfClosed()
            }
            refresh()
        }
    }

    /// A start a person asked for through a shortcut fails with the menu closed, where its reason
    /// would go unseen. Opening the menu puts that reason in front of them.
    private func showMenuIfClosed() {
        guard !menuIsOpen, let button = statusItem.button else { return }
        render()
        button.performClick(nil)
    }

    /// Permission is requested only here, by a person choosing to request it. Nothing on the way
    /// to a launched, ready app reaches this. Once a prompt has been answered macOS never shows it
    /// again, so a denied access opens its privacy pane instead of asking for nothing.
    private func request(_ kind: PermissionKind) {
        readPermissions()
        switch state.permissions?.access(to: kind) {
        case .granted: return
        case .denied:
            NSWorkspace.shared.open(kind.settingsURL)
            return
        case .undetermined, nil: break
        }
        Task { @MainActor in
            do {
                let granted = try await NativeCapture.requestPermission(
                    kind == .screen ? "screen" : "microphone")
                if !granted {
                    if kind == .screen { screenRequestRefused = true }
                    state.failure =
                        "\(kind.missingLine) Allow it in System Settings > Privacy & Security."
                }
            } catch {
                state.failure = error.localizedDescription
            }
            refresh()
            render()
        }
    }

    /// What native capture in this process may do, read without asking for anything. A display
    /// fixture may state it instead, so each access state can be looked at without changing the
    /// system's own record.
    private func readPermissions() {
        state.permissions = ControlsProbe.displayedPermissions ?? ControlsState.Permissions(
            screen: NativeCapture.screenPermission ? .granted : screenRequestRefused ? .denied : .undetermined,
            microphone: .init(microphoneAuthorization: NativeCapture.microphonePermission))
    }

    // MARK: reading

    /// Reads everything the menu shows. Used when a person looks at the controls or acts on them.
    private func refresh() {
        readPermissions()
        read(everything: true)
        readStorage()
        library.refresh()
    }

    /// Status-only polling observes external controls without re-enumerating idle sources.
    private func tick() {
        preview.tick()
        exports.tick()
        library.tick()
        read(everything: false)
    }

    func closePreview() { preview.close() }

    private func read(everything: Bool) {
        guard host != nil, state.service == .ready else { return }
        guard !reading else {
            pendingRefresh = pendingRefresh || everything
            return
        }
        reading = true
        Task { @MainActor in
            let previous = state.device
            await readStatus()
            if everything || previous?.recordingId != state.device?.recordingId
                || previous?.state != state.device?.state {
                await readSources()
                library.refreshRecordings()
            }
            reading = false
            render()
            if pendingRefresh {
                pendingRefresh = false
                refresh()
            }
        }
    }

    private func readStatus() async {
        guard let answer = try? await service().call("capture.status", as: StatusAnswer.self)
        else { return }
        state.device = ControlsState.DeviceStatus(
            state: ControlsState.DeviceState(rawValue: answer.device.state) ?? .idle,
            recordingId: answer.device.recordingId, elapsedUs: answer.device.elapsedUs)
        if let selection = answer.device.selection {
            state.selection.apply(selection, catalog: state.sources)
        }
        state.take = answer.recording.map {
            ControlsState.TakeStatus(
                recordingId: $0.recordingId, state: $0.state,
                interruptionReason: $0.interruptionReason, sourceDurationUs: $0.sourceDurationUs,
                finalizationError: $0.finalizationError)
        }
    }

    private func readSources() async {
        // A take fixes what it records, so the catalog is only refreshed while nothing is running.
        guard !state.isLive else { return }
        do throws(ServiceFailure) {
            let answer = try await service().call("capture.sources", as: SourcesAnswer.self)
            state.observeSources(
                ControlsState.SourceCatalog(
                    displays: answer.displays.map {
                        ControlsState.Display(id: $0.id, name: $0.name, width: $0.width, height: $0.height)
                    },
                    windows: answer.windows.map {
                        ControlsState.Window(id: $0.id, title: $0.title, application: $0.application)
                    },
                    microphones: answer.microphones.map {
                        ControlsState.Microphone(id: $0.id, name: $0.name, isDefault: $0.isDefault)
                    }))
        } catch {
            state.sourcesUnavailable(code: error.code, description: error.localizedDescription)
        }
    }

    private static let noService = ServiceFailure(
        code: "SERVICE_UNAVAILABLE", message: "No service is running.")

    /// The service these controls act through.
    private func service() throws(ServiceFailure) -> ServiceHost {
        guard let host else { throw Self.noService }
        return host
    }

    // MARK: showing

    private func render() {
        let shortcuts = ShortcutDefaults(bindings: bindings, registered: held)
        let entries = RecordingMenu.entries(for: state, exports: exports.state, shortcuts: shortcuts)
        // Preserve the tracked menu and its open submenus when only the clock title changes. The
        // first row is a status line only while something is happening, so what it says is the one
        // thing this may take on trust: everything else about it, including a submenu it has when
        // it is the source row instead, still has to match.
        if Self.onlyTitleChanged(from: renderedEntries, to: entries) {
            menu.items.first?.title = entries[0].title
        } else {
            StatusMenu.apply(entries, to: menu, target: self, action: #selector(choose(_:)),
                previous: renderedEntries)
        }
        renderedEntries = entries
        overlay.update(RecordingOverlay.presentation(for: state))
        settings.update(state, shortcuts: shortcuts)
        showStatusItem()
        pace()
    }

    /// Whether these rows say the same thing as the last ones apart from the very first title.
    private static func onlyTitleChanged(from rendered: [MenuEntry], to entries: [MenuEntry]) -> Bool {
        guard let first = entries.first, let last = rendered.first,
            first.kind == last.kind, first.enabled == last.enabled, first.checked == last.checked,
            first.shortcut == last.shortcut, first.submenu == last.submenu
        else { return false }
        return entries.dropFirst().elementsEqual(rendered.dropFirst())
    }

    private func showStatusItem() {
        guard let button = statusItem.button else { return }
        let described = RecordingMenu.statusTitle(for: state)
        let elapsed = StatusItemAppearance.title(for: state)
        button.image = NSImage(
            systemSymbolName: StatusItemAppearance.symbolName(for: state),
            accessibilityDescription: described)
        button.image?.isTemplate = state.device?.state != .recording
        button.imagePosition = elapsed.isEmpty ? .imageOnly : .imageLeading
        button.title = elapsed.isEmpty ? "" : " \(elapsed)"
        button.contentTintColor = state.device?.state == .recording ? .systemRed : nil
        button.setAccessibilityLabel("Screen Recorder — \(described)")
    }

    /// Status remains observable while idle or paused: another client can start or resume a take.
    /// Only one read runs at a time; catalog reads are reserved for transitions and explicit refreshes.
    private func pace() {
        guard state.service == .ready else {
            ticker?.invalidate()
            ticker = nil
            return
        }
        guard ticker == nil else { return }
        let timer = Timer(timeInterval: Self.tick, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.tick() }
        }
        // An open menu runs its own event tracking, so the clock a person is watching keeps moving.
        RunLoop.main.add(timer, forMode: .common)
        ticker = timer
    }
}

private struct StatusAnswer: Decodable {
    struct Device: Decodable {
        let state: String
        let recordingId: String?
        let elapsedUs: Int64?
        let selection: ControlsState.CaptureSelection.Start?
    }
    struct Take: Decodable {
        let recordingId: String
        let state: String
        let interruptionReason: String?
        let sourceDurationUs: Int64?
        let finalizationError: ControlsState.FinalizationError?
    }
    let device: Device
    let recording: Take?
}

private struct SourcesAnswer: Decodable {
    struct Display: Decodable {
        let id: Int
        let name: String
        let width: Int
        let height: Int
    }
    struct Window: Decodable {
        let id: Int
        let title: String
        let application: String
    }
    struct Microphone: Decodable {
        let id: String
        let name: String
        let isDefault: Bool
    }
    let displays: [Display]
    let windows: [Window]
    let microphones: [Microphone]
}

private struct StartedTake: Decodable {
    let state: String
}
