import AppKit
import SwiftUI

/// A user-opened native panel; model updates never show it or change activation.
@MainActor
final class CapturePopover: NSObject, NSPopoverDelegate {
    private let popover = NSPopover()
    private let controller = NSHostingController(rootView: CaptureHost(view: nil, height: 200))
    private let perform: (CaptureViewIntent) -> Void
    private var outsideClickMonitor: Any?
    private var localCloseMonitor: Any?
    private var deactivationObserver: Any?
    private(set) var view: CaptureView?
    var isShown: Bool { popover.isShown }

    init(perform: @escaping (CaptureViewIntent) -> Void) {
        self.perform = perform
        super.init()
        // Runway uses explicit dismissal because transient popovers fight key-window focus.
        popover.behavior = .applicationDefined
        popover.animates = false
        popover.delegate = self
        // The transparent host leaves both backdrop and arrow to NSPopover.
        popover.contentViewController = controller
        popover.appearance = NSAppearance(named: .darkAqua)
        controller.view.appearance = popover.appearance
    }

    func update(_ input: CaptureViewInput) {
        if let view { view.update(input) }
        else { view = CaptureView(input: input, perform: perform) }
        resize()
    }

    func toggle(relativeTo anchor: NSView, activate: Bool = false) {
        guard view != nil else { return }
        if isShown { close(); return }
        // Region selection temporarily owns the key window and can cause AppKit to recompute the
        // popover's effective appearance. Reassert the capture surface's dark contract every time
        // it is reopened, including after that auxiliary panel closes.
        let dark = NSAppearance(named: .darkAqua)
        popover.appearance = dark
        controller.view.appearance = dark
        view?.appearance = dark
        if activate { NSApp.activate(ignoringOtherApps: true) }
        resize(screen: anchor.window?.screen)
        popover.show(relativeTo: anchor.bounds, of: anchor, preferredEdge: .minY)
        view?.window?.title = "Yap Capture"
        view?.window?.appearance = dark
        if activate {
            focusWindow()
            DispatchQueue.main.async { [weak self] in
                guard let self else { return }
                self.popover.appearance = NSAppearance(named: .darkAqua)
                self.controller.view.appearance = self.popover.appearance
                self.view?.appearance = self.popover.appearance
                self.view?.window?.appearance = self.popover.appearance
                self.focusWindow()
            }
        }
        if popover.isShown {
            deactivationObserver = NotificationCenter.default.addObserver(
                forName: NSApplication.didResignActiveNotification, object: NSApp, queue: .main
            ) { [weak self] _ in
                MainActor.assumeIsolated { self?.close() }
            }
            localCloseMonitor = NSEvent.addLocalMonitorForEvents(matching: [.leftMouseDown, .rightMouseDown, .keyDown]) { [weak self, weak anchor] event in
                let consume = MainActor.assumeIsolated {
                    guard let self else { return false }
                    if event.type == .keyDown {
                        if event.keyCode == 53 { self.close(); return true }
                        return false
                    }
                    if event.window === anchor?.window { return false }
                    var window = event.window
                    while let current = window {
                        if current === self.view?.window { return false }
                        window = current.parent
                    }
                    self.close()
                    return false
                }
                return consume ? nil : event
            }
            outsideClickMonitor = NSEvent.addGlobalMonitorForEvents(matching: [.leftMouseDown, .rightMouseDown]) { [weak self] _ in
                MainActor.assumeIsolated { self?.close() }
            }
        }
    }

    func close() { popover.close() }

    private func focusWindow() {
        guard popover.isShown, let window = view?.window else { return }
        if !NSApp.isActive { NSApp.activate(ignoringOtherApps: true) }
        // Match Runway: makeKey after show preserves the popover's anchored ordering.
        window.makeKey()
        window.orderFront(nil)
    }

    func popoverDidClose(_ notification: Notification) {
        if let deactivationObserver {
            NotificationCenter.default.removeObserver(deactivationObserver)
            self.deactivationObserver = nil
        }
        if let localCloseMonitor {
            NSEvent.removeMonitor(localCloseMonitor)
            self.localCloseMonitor = nil
        }
        if let outsideClickMonitor {
            NSEvent.removeMonitor(outsideClickMonitor)
            self.outsideClickMonitor = nil
        }
    }

    private func resize(screen: NSScreen? = nil) {
        guard let view else { return }
        let available = (screen ?? view.window?.screen ?? NSScreen.main)?.visibleFrame.height ?? view.contentHeight + 32
        let height = min(view.contentHeight, max(200, available - 32))
        let size = NSSize(width: CaptureView.preferredWidth, height: height)
        guard popover.contentSize != size || controller.rootView.view == nil else { return }
        controller.rootView = CaptureHost(view: view, height: height)
        controller.preferredContentSize = size
        popover.contentSize = size
    }
}

private struct CaptureHost: View {
    let view: CaptureView?
    let height: CGFloat

    var body: some View {
        Group {
            if let view { CaptureNativeView(view: view) }
        }
        .frame(width: CaptureView.preferredWidth, height: height)
        .background(Color.clear)
    }
}

private struct CaptureNativeView: NSViewRepresentable {
    let view: CaptureView
    func makeNSView(context: Context) -> CaptureView { view }
    func updateNSView(_ nsView: CaptureView, context: Context) {}
}
