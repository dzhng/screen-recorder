import AppKit
import SwiftUI

/// One transient native container; updates never show it or change app activation.
@MainActor
final class CapturePopover: NSObject, NSPopoverDelegate {
    private let popover = NSPopover()
    private let controller = NSHostingController(rootView: CaptureHost(view: nil, height: 200))
    private let perform: (CaptureViewIntent) -> Void
    private var outsideClickMonitor: Any?
    private(set) var view: CaptureView?
    var isShown: Bool { popover.isShown }

    init(perform: @escaping (CaptureViewIntent) -> Void) {
        self.perform = perform
        super.init()
        popover.behavior = .transient
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

    func toggle(relativeTo anchor: NSView) {
        guard view != nil else { return }
        if isShown { close(); return }
        resize(screen: anchor.window?.screen)
        popover.show(relativeTo: anchor.bounds, of: anchor, preferredEdge: .minY)
        view?.window?.title = "Yap Capture"
        view?.window?.appearance = NSAppearance(named: .darkAqua)
        configureBackdrop()
        if popover.isShown {
            outsideClickMonitor = NSEvent.addGlobalMonitorForEvents(matching: [.leftMouseDown, .rightMouseDown]) { [weak self] _ in
                MainActor.assumeIsolated { self?.close() }
            }
        }
    }

    func close() { popover.close() }

    func popoverDidShow(_ notification: Notification) { configureBackdrop() }

    /// The menu-bar app remains inactive while the user records another app. Its backdrop must
    /// not follow key-window state or change tone when a control receives a click.
    private func configureBackdrop() {
        var ancestor: NSView? = view
        while let current = ancestor {
            if let effect = current as? NSVisualEffectView {
                effect.state = .active
                effect.isEmphasized = true
            }
            ancestor = current.superview
        }
    }

    func popoverDidClose(_ notification: Notification) {
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
