import AppKit

/// One transient native container; updates never show it or change app activation.
@MainActor
final class CapturePopover {
    private let popover = NSPopover()
    private let controller = NSViewController()
    private let perform: (CaptureViewIntent) -> Void
    private(set) var view: CaptureView?
    var isShown: Bool { popover.isShown }

    init(perform: @escaping (CaptureViewIntent) -> Void) {
        self.perform = perform
        popover.behavior = .transient
        popover.animates = false
        popover.contentViewController = controller
    }

    func update(_ input: CaptureViewInput) {
        if let view { view.update(input) }
        else {
            let view = CaptureView(input: input, perform: perform)
            self.view = view
            controller.view = view
        }
        resize()
    }

    func toggle(relativeTo anchor: NSView) {
        guard view != nil else { return }
        if isShown { close(); return }
        resize(screen: anchor.window?.screen)
        popover.show(relativeTo: anchor.bounds, of: anchor, preferredEdge: .minY)
    }

    func close() { popover.performClose(nil) }

    private func resize(screen: NSScreen? = nil) {
        guard let view else { return }
        let available = (screen ?? view.window?.screen ?? NSScreen.main)?.visibleFrame.height ?? view.contentHeight + 32
        let height = min(view.contentHeight, max(200, available - 32))
        let size = NSSize(width: 352, height: height)
        guard popover.contentSize != size else { return }
        popover.contentSize = size
        view.frame.size = size
    }
}
