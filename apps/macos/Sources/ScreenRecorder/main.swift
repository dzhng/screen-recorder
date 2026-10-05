import AppKit
import Darwin
import ScreenRecorderControls
import ScreenRecorderCapture

/// One line of this app's diagnostics. Everything this app says about itself goes to stderr, in
/// this one form, so a launch's whole story reads in order whichever part of it wrote a line.
func diagnostic(_ message: String) {
    FileHandle.standardError.write(Data("screenrec: \(message)\n".utf8))
}

/// The part of the service's health answer this app reports on stderr.
private struct ServiceHealth: Decodable {
    let status: String
    let pid: Int
    let node: String
}

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    private var controls: RecordingControls?
    private var service: ServiceHost?
    private var controller: CaptureController?
    private var fixture: NSWindow?
    private var probe: ControlsProbe?
    private var selectedProbe: SelectedCaptureProbe?
    private var probeTask: Task<Void, Never>?
    private var startup: Operation?
    private var terminating = false
    private var quitting = false
    private var awaitingFinalization = false
    private var updaterTermination = false
    private var updates: UpdateCoordinator?
    private var sparkle: SparkleDriver?

    func applicationDidFinishLaunching(_ notification: Notification) {
        let environment = ProcessInfo.processInfo.environment
        let arguments = CommandLine.arguments.dropFirst()
        if arguments.first == "--probe" {
            let probe = SelectedCaptureProbe()
            let values = Array(arguments.dropFirst())
            if values.prefix(2).elementsEqual(["selected-devices", "capture"]) { selectedProbe = probe }
            probeTask = Task { await runCaptureProbe(values, selected: probe) }
            return
        }
        let preferences = Preferences(defaults: defaultsDomain())
        controls = RecordingControls(home: personalRoot(), preferences: preferences) { [weak self] in
            self?.quit()
        }
        // The capture fixture is an ordinary launch that additionally opens this app's own window
        // and refuses every other source, so the real service and controller path is what runs.
        if environment["SCREENREC_FIXTURE_WINDOW"] == "1" {
            let window = makeCaptureFixtureWindow()
            fixture = window
            diagnostic("capture fixture window=\(window.windowNumber)")
        }
        let controller = CaptureController(fixtureWindow: fixture)
        self.controller = controller
        let updates = UpdateCoordinator(blockers: { [weak self] in
            guard let self else { return ["native.startup"] }
            var blockers = self.controls?.updateBlockers ?? []
            if self.controller?.isCapturing == true { blockers.append("native.capture") }
            return blockers
        }, fence: { [weak self] fenced in self?.controls?.fenceForUpdate(fenced) },
        changed: { [weak self] in self?.refreshUpdateControls() })
        self.updates = updates
        controls?.updateProgress = { [weak updates] in updates?.progress() }
        controller.updateProgress = { [weak updates] in updates?.progress() }
        sparkle = SparkleDriver(owner: updates, changed: { [weak self] in self?.refreshUpdateControls() }) { [weak self] in
            guard let self, self.updates?.mayTerminateForUpdate == true else { return }
            self.updaterTermination = true
            NSApplication.shared.terminate(nil)
        }
        refreshUpdateControls()
        probe = ControlsProbe.requested(controls: controls)
        startService(capture: controller)
        // A launch that serves a client request starts the service and nothing else: nobody asked
        // to see this app, so no window of it comes forward.
        if preferences.showSettingsAtLaunch, environment["SCREENREC_SERVICE_LAUNCH"] == nil,
            !arguments.contains("--screenrec-update-relaunch") {
            controls?.perform(.openSettings)
        }
    }

    /// Opening the app again while it runs, from Finder or Spotlight, is how a person asks to see it.
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows: Bool) -> Bool {
        controls?.perform(.openSettings)
        return false
    }

    private func refreshUpdateControls() {
        guard let updates else { return }
        let message: String?
        if let error = updates.status.error { message = error.message }
        else {
            switch updates.status.state {
            case "checking": message = "Checking for updates…"
            case "downloading": message = "Downloading an update…"
            case "waiting":
                message = updates.status.blockers == ["launcher"]
                    ? "An update is waiting for command-line clients to finish."
                    : "An update is waiting for recording and background work to finish."
            case "installing": message = "Installing an update…"
            default: message = updates.checkMessage
            }
        }
        controls?.configureUpdates(.init(available: updates.available, enabled: updates.enabled, status: message,
                                        canCheck: sparkle?.canCheckForUpdates ?? false), operation: { [weak self] operation, params in
            self?.handleUpdate(operation, params) ?? .failure(ServiceFailure(code: "UPDATE_UNAVAILABLE", message: "No native updater is connected."))
        })
    }

    private func handleUpdate(_ operation: String, _ params: Data) -> Result<Data, ServiceFailure> {
        sparkle?.handle(operation, params)
            ?? .failure(ServiceFailure(code: "UPDATE_UNAVAILABLE", message: "Updates are installed manually in this build."))
    }

    /// Ordinary launch owns the service only. Nothing here starts capture or touches a
    /// permission-gated API, so launching the app prompts for nothing. Resolving the
    /// interpreter runs child processes, so it answers back on the main actor rather
    /// than holding it while a candidate is probed.
    private func startService(capture: CaptureController) {
        apply(.starting)
        startup = ServiceBundle.resolve { [weak self] result in
            Task { @MainActor in
                guard let self, !self.terminating else { return }
                switch result {
                case .failure(let failure):
                    self.apply(.unavailable(code: failure.code, message: failure.message))
                case .success(let bundle):
                    let host = ServiceHost(
                        bundle: bundle,
                        onNativeCall: { [weak self] operation, params, answer in
                            Task { @MainActor [weak self] in
                                if ["update.status", "update.check", "update.setEnabled"].contains(operation) {
                                    guard let self else {
                                        answer(.failure(ServiceFailure(code: "UPDATE_UNAVAILABLE", message: "No native updater is connected.")))
                                        return
                                    }
                                    answer(self.handleUpdate(operation, params))
                                } else {
                                    answer(await capture.handle(operation, params))
                                }
                            }
                        }, onState: { [weak self] state in
                            Task { @MainActor in self?.apply(state) }
                    }, onUpdateProgress: { [weak self] in
                        MainActor.assumeIsolated { self?.updates?.progress() }
                    })
                    self.service = host
                    capture.attach(to: host)
                    self.controls?.attach(to: host)
                    host.start()
                }
            }
        }
    }

    /// The service's lifetime, told to whoever needs it: the controls, which cannot carry a
    /// capture operation without it, and a running take, which has nothing left to report to.
    /// A failed service is stated in the menu and on stderr; the app stays usable and never
    /// retries in a hidden loop. Process identities and interpreter versions stay in the
    /// stderr diagnostics, out of the menu a person acts on.
    private func apply(_ state: ServiceHost.State) {
        controls?.serviceStateChanged(state)
        switch state {
        case .starting:
            break
        case .ready(let pid, let socketPath):
            if let service { updates?.attach(to: service) }
            diagnostic("service ready pid=\(pid) socket=\(socketPath)")
            // One real control round trip proves the inherited pipe, not just the spawn.
            Task { @MainActor in
                guard let health = try? await service?.call("service.health", as: ServiceHealth.self)
                else { return }
                diagnostic("service health status=\(health.status) pid=\(health.pid) node=v\(health.node)")
            }
        case .unavailable(let code, let message):
            diagnostic("service failed code=\(code) message=\(message)")
            // No library is listening any more, so the take is finished into its own journal and
            // left for the next service to reconcile rather than captured unindexed.
            if let controller, controller.isCapturing {
                Task { @MainActor in await controller.serviceLost() }
            }
        }
    }

    /// Where this person's recordings and settings live. The service owns the same root; this is
    /// only where the controls read a person's own key combinations from.
    private func personalRoot() -> String {
        ProcessInfo.processInfo.environment["SCREENREC_HOME"]
            ?? (NSHomeDirectory() as NSString).appendingPathComponent(".screen-recorder")
    }

    /// This app's own defaults. A check names an absolute scratch domain instead, so launching the
    /// bundle under test never reads or writes a person's real preferences. A named domain this
    /// process cannot use is reported rather than quietly replaced by the real one.
    private func defaultsDomain() -> UserDefaults {
        guard let named = ProcessInfo.processInfo.environment["SCREENREC_DEFAULTS"] else {
            return .standard
        }
        guard named.hasPrefix("/"), let scratch = UserDefaults(suiteName: named) else {
            diagnostic("SCREENREC_DEFAULTS must be an absolute path; using this app's own defaults")
            return .standard
        }
        return scratch
    }

    /// The Quit menu item and SIGTERM. A second request while the first is still finalizing asks
    /// for nothing new.
    func quit() {
        guard !quitting else { return }
        quitting = true
        NSApplication.shared.terminate(nil)
    }

    /// Every quit reaches this, including the one the system sends at logout. A running take is
    /// finalized and stored before termination proceeds; one that cannot finalize within the
    /// deadline must not hold the app open, and is reconciled from its own journal on the next
    /// launch. Forced termination keeps the ordinary interrupted path instead.
    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        if updaterTermination { return .terminateNow }
        updates?.ordinaryQuit()
        controls?.closePreview()
        if awaitingFinalization { return .terminateLater }
        if let selectedProbe, let probeTask {
            awaitingFinalization = true
            selectedProbe.requestStop()
            Task { @MainActor in
                await probeTask.value
                proceedWithTermination()
            }
            Task { @MainActor in
                try? await Task.sleep(for: .seconds(10))
                proceedWithTermination()
            }
            return .terminateLater
        }
        guard let controller, controller.isCapturing else { return .terminateNow }
        awaitingFinalization = true
        diagnostic("finalizing the running take before quitting")
        // Finalizing waits on two service reports, each bounded by the call timeout, around the
        // writer's own close.
        let deadline = 2 * (service?.callTimeout ?? 0) + 10
        Task { @MainActor in
            await controller.finalizeBeforeQuit()
            proceedWithTermination()
        }
        Task { @MainActor in
            try? await Task.sleep(for: .seconds(deadline))
            proceedWithTermination()
        }
        return .terminateLater
    }

    private func proceedWithTermination() {
        guard awaitingFinalization else { return }
        awaitingFinalization = false
        NSApplication.shared.reply(toApplicationShouldTerminate: true)
    }

    func applicationWillTerminate(_ notification: Notification) {
        terminating = true
        startup?.cancel()
        // Let the bounded in-flight probe reap its child before this process exits.
        // Cancellation prevents another candidate or a late service launch.
        startup?.waitUntilFinished()
        probe?.stop()
        if !updaterTermination { service?.shutdown() }
        fixture?.close()
    }
}

// Writing to a control pipe whose child just died must surface as an error, not as a
// signal that kills the app before it can report the failure.
signal(SIGPIPE, SIG_IGN)

let application = NSApplication.shared
let delegate = AppDelegate()
application.delegate = delegate
application.setActivationPolicy(.accessory)

// A menu-bar agent has no window to close, so an orderly quit arrives as a signal. Termination
// starts from the run loop rather than inside this main-queue handler: while a main-queue block is
// still running, the main actor cannot run the finalization a pending termination waits for.
let quit = DispatchSource.makeSignalSource(signal: SIGTERM, queue: .main)
quit.setEventHandler {
    RunLoop.main.perform(inModes: [.common]) { MainActor.assumeIsolated { delegate.quit() } }
}
quit.resume()
signal(SIGTERM, SIG_IGN)

application.run()
