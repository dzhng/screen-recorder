import AppKit
import Darwin

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate, NSMenuDelegate {
    private var statusItem: NSStatusItem?
    private var statusEntry: NSMenuItem?
    private var service: ServiceHost?

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
        menu.addItem(NSMenuItem(title: "Quit Screen Recorder", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"))
        menu.delegate = self
        item.menu = menu
        statusItem = item
        statusEntry = status
        startService()
    }

    /// Ordinary launch owns the service only. Nothing here starts capture or touches a
    /// permission-gated API, so launching the app prompts for nothing.
    private func startService() {
        switch ServiceBundle.resolve() {
        case .failure(let failure):
            report(code: failure.code, message: failure.message)
        case .success(let bundle):
            let host = ServiceHost(bundle: bundle) { [weak self] state in
                Task { @MainActor in self?.apply(state) }
            }
            service = host
            host.start()
        }
    }

    private func apply(_ state: ServiceHost.State) {
        switch state {
        case .starting:
            show("Service: starting…")
        case .ready(let pid, let socketPath):
            show("Service: ready (pid \(pid))")
            log("service ready pid=\(pid) socket=\(socketPath)")
            // One real control round trip proves the inherited pipe, not just the spawn.
            requestHealth { health in
                self.log("service health status=\(health.status) pid=\(health.pid) node=v\(health.node)")
            }
        case .unavailable(let code, let message):
            report(code: code, message: message)
        }
    }

    private func requestHealth(_ describe: @escaping @MainActor (ServiceHealth) -> Void) {
        service?.health { [weak self] result in
            Task { @MainActor in
                switch result {
                case .success(let health):
                    self?.show("Service: ready (pid \(health.pid))")
                    describe(health)
                case .failure(let failure):
                    self?.report(code: failure.code, message: failure.message)
                }
            }
        }
    }

    /// A failed service is stated in the menu and on stderr; the app stays usable and
    /// never retries in a hidden loop.
    private func report(code: String, message: String) {
        show("Service: unavailable — \(message)")
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

    func applicationWillTerminate(_ notification: Notification) {
        service?.shutdown()
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
// Routing it through the normal terminate path is what gives the service the same
// bounded shutdown the Quit menu item does.
let quit = DispatchSource.makeSignalSource(signal: SIGTERM, queue: .main)
quit.setEventHandler { NSApplication.shared.terminate(nil) }
quit.resume()
signal(SIGTERM, SIG_IGN)

application.run()
