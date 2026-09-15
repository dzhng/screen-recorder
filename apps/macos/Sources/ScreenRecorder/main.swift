import AppKit
import Darwin

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate, NSMenuDelegate {
    private var statusItem: NSStatusItem?
    private var statusEntry: NSMenuItem?
    private var service: ServiceHost?
    private var controller: CaptureController?
    private var fixture: NSWindow?
    private var startup: Operation?
    private var terminating = false
    private var quitting = false

    func applicationDidFinishLaunching(_ notification: Notification) {
        if CommandLine.arguments.count > 1 {
            Task { await runCaptureProbe() }
            return
        }
        let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        item.button?.title = "ScreenRec"
        item.button?.setAccessibilityLabel("Screen Recorder")
        let menu = NSMenu()
        let status = NSMenuItem(title: "Screen Recorder — Idle", action: nil, keyEquivalent: "")
        status.isEnabled = false
        menu.addItem(status)
        menu.addItem(.separator())
        let quit = NSMenuItem(title: "Quit Screen Recorder", action: #selector(quitRecorder), keyEquivalent: "q")
        quit.target = self
        menu.addItem(quit)
        menu.delegate = self
        item.menu = menu
        statusItem = item
        statusEntry = status
        // The capture fixture is an ordinary launch that additionally opens this app's own window
        // and refuses every other source, so the real service and controller path is what runs.
        if ProcessInfo.processInfo.environment["SCREENREC_FIXTURE_WINDOW"] == "1" {
            let window = makeCaptureFixtureWindow()
            fixture = window
            log("capture fixture window=\(window.windowNumber)")
        }
        controller = CaptureController(fixtureWindow: fixture)
        startService()
    }

    /// Ordinary launch owns the service only. Nothing here starts capture or touches a
    /// permission-gated API, so launching the app prompts for nothing. Resolving the
    /// interpreter runs child processes, so it answers back on the main actor rather
    /// than holding it while a candidate is probed.
    private func startService() {
        apply(.starting)
        startup = ServiceBundle.resolve { [weak self] result in
            Task { @MainActor in
                guard let self, !self.terminating else { return }
                switch result {
                case .failure(let failure):
                    self.report(code: failure.code, message: failure.message)
                case .success(let bundle):
                    let capture = self.controller
                    let host = ServiceHost(
                        bundle: bundle,
                        onNativeCall: { operation, params, answer in
                            Task { @MainActor in
                                guard let capture else {
                                    answer(
                                        .failure(
                                            ServiceFailure(
                                                code: "UNKNOWN_OPERATION",
                                                message: "This app owns no capture session")))
                                    return
                                }
                                answer(await capture.handle(operation, params))
                            }
                        }
                    ) { [weak self] state in
                        Task { @MainActor in self?.apply(state) }
                    }
                    self.service = host
                    capture?.attach(to: host)
                    host.start()
                }
            }
        }
    }

    private func apply(_ state: ServiceHost.State) {
        switch state {
        case .starting:
            show("Screen Recorder — Starting…")
        case .ready(let pid, let socketPath):
            show("Screen Recorder — Ready")
            log("service ready pid=\(pid) socket=\(socketPath)")
            // One real control round trip proves the inherited pipe, not just the spawn.
            requestHealth { health in
                self.log("service health status=\(health.status) pid=\(health.pid) node=v\(health.node)")
            }
        case .unavailable(let code, let message):
            report(code: code, message: message)
            // No library is listening any more, so the take is finished into its own journal and
            // left for the next service to reconcile rather than captured unindexed.
            if let controller, controller.isCapturing {
                Task { @MainActor in await controller.serviceLost() }
            }
        }
    }

    private func requestHealth(_ describe: @escaping @MainActor (ServiceHealth) -> Void) {
        service?.health { [weak self] result in
            Task { @MainActor in
                switch result {
                case .success(let health):
                    self?.show("Screen Recorder — Ready")
                    describe(health)
                case .failure(let failure) where failure.code == ServiceHost.startingCode:
                    // Opening the menu inside the startup budget is not a failure yet.
                    self?.show("Screen Recorder — Starting…")
                case .failure(let failure):
                    self?.report(code: failure.code, message: failure.message)
                }
            }
        }
    }

    /// A failed service is stated in the menu and on stderr; the app stays usable and
    /// never retries in a hidden loop. The menu carries what the person can act on;
    /// process identities and interpreter versions stay in the stderr diagnostics.
    private func report(code: String, message: String) {
        show("Screen Recorder — Unavailable: \(message)")
        log("service failed code=\(code) message=\(message)")
    }

    private func show(_ title: String) {
        statusEntry?.title = title
    }

    private func log(_ message: String) {
        FileHandle.standardError.write(Data("screenrec: \(message)\n".utf8))
    }

    func menuWillOpen(_ menu: NSMenu) {
        requestHealth { _ in }
    }

    /// The one orderly quit this app has, for the menu item and for SIGTERM alike. A running take
    /// is finalized and stored first, and only then does termination begin: `terminate` spins its
    /// own nested event loop, which no capture work could complete inside. Forced termination
    /// keeps the ordinary interrupted path instead.
    @objc func quitRecorder() {
        guard !quitting else { return }
        quitting = true
        guard let controller, controller.isCapturing else {
            NSApplication.shared.terminate(nil)
            return
        }
        log("finalizing the running take before quitting")
        Task { @MainActor in
            await controller.finalizeBeforeQuit()
            NSApplication.shared.terminate(nil)
        }
        // A take that cannot finalize must not hold the app open; it is reconciled from its own
        // journal on the next launch.
        DispatchQueue.main.asyncAfter(deadline: .now() + Self.finalizeDeadline) {
            NSApplication.shared.terminate(nil)
        }
    }

    /// How long a quit waits for a running take to finalize before terminating anyway.
    private static let finalizeDeadline: TimeInterval = 10

    func applicationWillTerminate(_ notification: Notification) {
        terminating = true
        startup?.cancel()
        // Let the bounded in-flight probe reap its child before this process exits.
        // Cancellation prevents another candidate or a late service launch.
        startup?.waitUntilFinished()
        service?.shutdown()
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

// A menu-bar agent has no window to close, so an orderly quit arrives as a signal.
// Routing it through the same entry point the Quit menu item uses is what gives a running
// take its finalization and the service its bounded shutdown.
let quit = DispatchSource.makeSignalSource(signal: SIGTERM, queue: .main)
quit.setEventHandler { MainActor.assumeIsolated { delegate.quitRecorder() } }
quit.resume()
signal(SIGTERM, SIG_IGN)

application.run()
