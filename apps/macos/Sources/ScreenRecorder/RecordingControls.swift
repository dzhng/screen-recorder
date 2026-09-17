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
 choosing to request them.
 */
@MainActor
final class RecordingControls: NSObject, NSMenuDelegate {
    private let statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
    private let menu = NSMenu()
    private var renderedEntries: [MenuEntry] = []
    private let shortcuts = GlobalShortcuts()
    private let region = RegionSelection()
    private let quit: () -> Void
    private var state = ControlsState()
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
    private var ticker: Timer?
    private var reading = false
    private var pendingRefresh = false
    private var pendingStorageRefresh = false

    /// Bounded status cadence, including controls issued by another client.
    private static let tick: TimeInterval = 0.5
    /// How many recent takes the menu lists.
    private static let recentTakes = 5

    init(home: String, quit: @escaping () -> Void) {
        self.quit = quit
        super.init()
        let overridePath = GlobalShortcuts.overridePath(home: home)
        state.shortcutOverridePath = overridePath
        bindings = ShortcutDefaults.overridden(by: FileManager.default.contents(atPath: overridePath))
        let outcome = shortcuts.claim(bindings) { [weak self] action in self?.perform(action) }
        held = outcome.held
        state.unavailableShortcuts = outcome.unavailable
        menu.delegate = self
        statusItem.menu = menu
        statusItem.button?.setAccessibilityLabel("Screen Recorder")
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
        if state.service == .ready { refresh() } else { preview.close(); render() }
    }

    /// The live menu, so a check can read exactly what a person would see.
    var visibleMenu: NSMenu { menu }

    func menuWillOpen(_ menu: NSMenu) { refresh() }

    // MARK: acting

    @objc func choose(_ sender: NSMenuItem) {
        guard let action = StatusMenu.action(of: sender) else { return }
        perform(action)
    }

    func perform(_ action: ControlsAction) {
        state.failure = nil
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
        case .selectMicrophone(.some(let id)):
            if let microphone = state.sources.microphones.first(where: { $0.id == id }) {
                state.selection.microphone = .device(id: microphone.id, name: microphone.name)
            }
        case .toggleSystemAudio:
            state.selection.systemAudio.toggle()
        case .startOrStop:
            state.isLive ? capture("capture.stop", live()) : start()
        case .pauseOrResume:
            capture(state.device?.state == .paused ? "capture.resume" : "capture.pause", live())
        case .cancel:
            capture("capture.cancel", live())
        case .restart:
            restart()
        case .previewRecording(let recordingId):
            guard state.service == .ready else { return }
            preview.open(recordingId)
        case .deleteRecording(let recordingId):
            deleteRecording(recordingId)
        case .refreshStorage:
            readStorage()
        case .requestScreenPermission:
            request("screen")
        case .requestMicrophonePermission:
            request("microphone")
        case .quit:
            quit()
        }
        render()
    }

    /// The take the device is working on. Capture control names its recording, so an action with
    /// no live take is refused here rather than sent without one.
    private func live() -> [String: Any]? {
        guard let recordingId = state.device?.recordingId else { return nil }
        return ["recordingId": recordingId]
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
            if state.finishStart(request, answer) { start() }
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

    private func deleteRecording(_ recordingId: String) {
        guard state.beginDelete(recordingId) else { return }
        preview.close(recording: recordingId)
        Task { @MainActor in
            do throws(ServiceFailure) {
                let receipt = try await service().call(
                    "recording.delete", ["recordingId": recordingId], as: DeleteAnswer.self)
                let confirmed = receipt.recordingId == recordingId && receipt.deleted
                state.finishDelete(
                    recordingId, failure: confirmed ? nil : "The service did not confirm deletion.")
            } catch {
                state.finishDelete(recordingId, failure: error.localizedDescription)
            }
            render()
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

    /// Permission is requested only here, by a person choosing to request it. Nothing on the way
    /// to a launched, ready app reaches this.
    private func request(_ kind: String) {
        Task { @MainActor in
            do {
                let granted = try await NativeCapture.requestPermission(kind)
                if !granted {
                    state.failure =
                        "\(kind == "screen" ? "Screen recording" : "Microphone") access was not granted. Allow it in System Settings > Privacy & Security."
                }
            } catch {
                state.failure = error.localizedDescription
            }
            refresh()
        }
    }

    // MARK: reading

    /// Reads everything the menu shows. Used when a person looks at the controls or acts on them.
    private func refresh() {
        read(everything: true)
        readStorage()
    }

    /// Status-only polling observes external controls without re-enumerating idle sources.
    private func tick() { preview.tick(); read(everything: false) }

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
                await readRecent()
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
            recordingId: answer.device.recordingId, elapsedUs: answer.device.elapsedUs,
            permissions: ControlsState.Permissions(
                screen: answer.device.permissions.screen,
                microphone: answer.device.permissions.microphone))
        if let selection = answer.device.selection {
            state.selection.apply(selection, catalog: state.sources)
        }
        state.take = answer.recording.map {
            ControlsState.TakeStatus(
                recordingId: $0.recordingId, state: $0.state,
                interruptionReason: $0.interruptionReason, sourceDurationUs: $0.sourceDurationUs)
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

    private func readRecent() async {
        guard
            let answer = try? await service().call(
                "recording.list", ["limit": Self.recentTakes], as: RecentAnswer.self)
        else { return }
        state.recent = answer.recordings.map {
            ControlsState.RecentTake(
                recordingId: $0.recordingId, createdAt: $0.createdAt, state: $0.state,
                sourceDurationUs: $0.sourceDurationUs, interruptionReason: $0.interruptionReason)
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
        let entries = RecordingMenu.entries(
            for: state, shortcuts: ShortcutDefaults(bindings: bindings, registered: held))
        // Preserve the tracked menu and its open submenus when only the clock title changes.
        if !renderedEntries.isEmpty && entries.dropFirst().elementsEqual(renderedEntries.dropFirst()) {
            menu.items.first?.title = entries[0].title
        } else {
            StatusMenu.apply(entries, to: menu, target: self, action: #selector(choose(_:)),
                previous: renderedEntries)
        }
        renderedEntries = entries
        showStatusItem()
        pace()
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
    struct Permissions: Decodable {
        let screen: Bool
        let microphone: String
    }
    struct Device: Decodable {
        let state: String
        let recordingId: String?
        let elapsedUs: Int64?
        let selection: ControlsState.CaptureSelection.Start?
        let permissions: Permissions
    }
    struct Take: Decodable {
        let recordingId: String
        let state: String
        let interruptionReason: String?
        let sourceDurationUs: Int64?
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

private struct RecentAnswer: Decodable {
    struct Take: Decodable {
        let recordingId: String
        let createdAt: String
        let state: String
        let sourceDurationUs: Int64?
        let interruptionReason: String?
    }
    let recordings: [Take]
}

private struct StartedTake: Decodable {
    let state: String
}

private struct DeleteAnswer: Decodable {
    let recordingId: String
    let deleted: Bool
}
