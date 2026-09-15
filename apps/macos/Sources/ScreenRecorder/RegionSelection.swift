import AppKit
import ScreenRecorderControls

/**
 Choosing a rectangle of one display to record.

 This is a selection surface and nothing more: one drag chooses one rectangle, the Escape key
 chooses nothing, and the panels close the moment either happens. It draws no stroke a recording
 would keep and leaves nothing on screen for a take to capture.
 */
@MainActor
final class RegionSelection {
    private var panels: [RegionPanel] = []
    private var answer: ((ControlsState.Region?) -> Void)?

    var isChoosing: Bool { !panels.isEmpty }

    /// Covers every display and answers once, with the chosen rectangle or with nothing.
    func choose(
        displays: [ControlsState.Display], completion: @escaping (ControlsState.Region?) -> Void
    ) {
        guard !isChoosing else { return completion(nil) }
        let known = Dictionary(displays.map { ($0.id, $0.name) }, uniquingKeysWith: { first, _ in first })
        let screens = NSScreen.screens.compactMap { screen -> (NSScreen, ControlsState.Display)? in
            guard let number = screen.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber,
                let name = known[Int(number.uint32Value)]
            else { return nil }
            return (
                screen,
                ControlsState.Display(
                    id: Int(number.uint32Value), name: name,
                    width: Int(screen.frame.width), height: Int(screen.frame.height))
            )
        }
        guard !screens.isEmpty else { return completion(nil) }
        answer = completion
        panels = screens.map { screen, display in
            RegionPanel(screen: screen, display: display) { [weak self] region in
                self?.finish(with: region)
            }
        }
        NSApplication.shared.activate(ignoringOtherApps: true)
        for panel in panels { panel.orderFrontRegardless() }
        panels.first?.makeKey()
    }

    /// Ends the selection exactly once, however it ended, so a cancel on one display cannot leave
    /// the others covering the screen.
    private func finish(with region: ControlsState.Region?) {
        guard let completion = answer else { return }
        answer = nil
        for panel in panels { panel.close() }
        panels = []
        completion(region)
    }
}

/// One display's share of the selection. It becomes key so the Escape key reaches it, and it is
/// never an ordinary window: no title bar, no shadow, and nothing left behind when it closes.
@MainActor
private final class RegionPanel: NSPanel {
    private let display: ControlsState.Display
    private let answer: (ControlsState.Region?) -> Void

    init(
        screen: NSScreen, display: ControlsState.Display,
        answer: @escaping (ControlsState.Region?) -> Void
    ) {
        self.display = display
        self.answer = answer
        super.init(
            contentRect: screen.frame, styleMask: [.borderless, .nonactivatingPanel],
            backing: .buffered, defer: false)
        setFrame(screen.frame, display: false)
        isReleasedWhenClosed = false
        isOpaque = false
        hasShadow = false
        backgroundColor = .clear
        level = .screenSaver
        collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .ignoresCycle]
        contentView = RegionSelectionView(frame: NSRect(origin: .zero, size: screen.frame.size)) {
            [weak self] rect in
            guard let self else { return }
            answer(
                rect.map {
                    ControlsState.Region(
                        displayId: display.id, displayName: display.name, x: $0.minX, y: $0.minY,
                        width: $0.width, height: $0.height)
                })
        }
    }

    override var canBecomeKey: Bool { true }

    override func cancelOperation(_ sender: Any?) { answer(nil) }
}

/// Dims its display, follows the drag, and reports the rectangle the drag selected.
@MainActor
private final class RegionSelectionView: NSView {
    private let answer: (CGRect?) -> Void
    private var origin: CGPoint?
    private var current: CGPoint?

    init(frame: NSRect, answer: @escaping (CGRect?) -> Void) {
        self.answer = answer
        super.init(frame: frame)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("RegionSelectionView is not loaded from a nib") }

    override func resetCursorRects() { addCursorRect(bounds, cursor: .crosshair) }

    override func mouseDown(with event: NSEvent) {
        origin = convert(event.locationInWindow, from: nil)
        current = origin
        needsDisplay = true
    }

    override func mouseDragged(with event: NSEvent) {
        current = convert(event.locationInWindow, from: nil)
        needsDisplay = true
    }

    override func mouseUp(with event: NSEvent) {
        guard let origin else { return answer(nil) }
        let end = convert(event.locationInWindow, from: nil)
        answer(RegionGeometry.region(from: origin, to: end, inDisplayOfSize: bounds.size))
    }

    override func draw(_ dirtyRect: NSRect) {
        NSColor.black.withAlphaComponent(0.35).setFill()
        bounds.fill()
        guard let origin, let current else { return drawHint() }
        let selected = RegionGeometry.highlight(from: origin, to: current)
        NSColor.clear.setFill()
        selected.fill(using: .copy)
        NSColor.controlAccentColor.setStroke()
        let outline = NSBezierPath(rect: selected)
        outline.lineWidth = 2
        outline.stroke()
        draw(
            "\(Int(selected.width)) × \(Int(selected.height))",
            at: CGPoint(x: selected.minX, y: selected.maxY + 8))
    }

    private func drawHint() {
        draw(
            "Drag to choose the area to record. Press Escape to cancel.",
            at: CGPoint(x: bounds.midX - 210, y: bounds.midY))
    }

    private func draw(_ text: String, at point: CGPoint) {
        (text as NSString).draw(
            at: point,
            withAttributes: [
                .font: NSFont.systemFont(ofSize: 15, weight: .medium),
                .foregroundColor: NSColor.white,
            ])
    }
}
