import AppKit
import ScreenRecorderCapture

/// The window every capture probe records: this process's own window, never another application's.
@MainActor
func makeCaptureFixtureWindow(frame: NSRect? = nil, activate: Bool = true) -> NSWindow {
    let window = NSWindow(
        contentRect: frame ?? NSRect(x: 100, y: 100, width: 800, height: 500),
        styleMask: [.titled, .closable, .miniaturizable], backing: .buffered, defer: false)
    window.isReleasedWhenClosed = false
    window.title = "Screen Recorder Capture Fixture"
    window.contentView = CaptureFixtureView(frame: NSRect(origin: .zero, size: window.contentRect(forFrameRect: window.frame).size))
    if activate {
        window.makeKeyAndOrderFront(nil)
        NSApplication.shared.activate(ignoringOtherApps: true)
    } else {
        window.orderFrontRegardless()
    }
    return window
}

/// An asymmetric labeled grid with isolated black fiducial squares. The grid is for human review;
/// the fiducials are what a measurement locates, because their content-local centers are known
/// exactly and their surrounding white halo keeps neighbouring fill colors out of the blob.
@MainActor
final class CaptureFixtureView: NSView {
    static let fiducialSide: CGFloat = 12
    private static let columns: [CGFloat] = [0, 0.22, 0.55, 1]
    private static let rows: [CGFloat] = [0, 0.3, 0.68, 1]

    /// Fiducial centers in view coordinates, y measured up from the content view's bottom left.
    /// No two share a row or column, so a measurement can order them without consulting a
    /// prediction, and a transposed or mirrored transform cannot pass by symmetry.
    static func fiducialCenters(in bounds: NSRect) -> [CGPoint] {
        [
            CGPoint(x: 24, y: bounds.height - 24),
            CGPoint(x: bounds.width - 36, y: bounds.height - 52),
            CGPoint(x: 28, y: 22),
            CGPoint(x: bounds.width - 20, y: 60),
            CGPoint(x: bounds.width * 0.38, y: bounds.height * 0.44),
        ]
    }

    override func draw(_ dirtyRect: NSRect) {
        NSColor.white.setFill()
        bounds.fill()
        let fills: [NSColor] = [
            .systemRed, .systemGreen, .systemBlue, .systemYellow, .systemPurple, .systemTeal,
            .systemOrange, .systemPink, .systemBrown,
        ]
        for row in 0..<3 {
            for column in 0..<3 {
                let cell = NSRect(
                    x: Self.columns[column] * bounds.width,
                    y: Self.rows[2 - row] * bounds.height,
                    width: (Self.columns[column + 1] - Self.columns[column]) * bounds.width,
                    height: (Self.rows[3 - row] - Self.rows[2 - row]) * bounds.height)
                fills[row * 3 + column].withAlphaComponent(0.35).setFill()
                cell.insetBy(dx: 3, dy: 3).fill()
                ("\(["A", "B", "C"][row])\(column + 1)" as NSString).draw(
                    at: NSPoint(x: cell.minX + 10, y: cell.midY),
                    withAttributes: [
                        .font: NSFont.boldSystemFont(ofSize: 20), .foregroundColor: NSColor.black,
                    ])
            }
        }
        for center in Self.fiducialCenters(in: bounds) {
            let side = Self.fiducialSide
            NSColor.white.setFill()
            NSRect(
                x: center.x - side, y: center.y - side, width: side * 2, height: side * 2
            ).fill()
            NSColor.black.setFill()
            NSRect(
                x: center.x - side / 2, y: center.y - side / 2, width: side, height: side
            ).fill()
        }
    }
}

/// Where each fiducial sits in global display points with a top-left origin: the same space the
/// pointer is sampled in, so a measured fiducial pixel and a sampled pointer pixel are comparable.
@MainActor
func fiducialGlobalPoints(of window: NSWindow) -> [CGPoint] {
    guard let view = window.contentView else { return [] }
    let height = GlobalPointSpace.zeroOriginHeight()
    return CaptureFixtureView.fiducialCenters(in: view.bounds).map { local in
        let onScreen = window.convertPoint(toScreen: view.convert(local, to: nil))
        return GlobalPointSpace.flip(appKit: onScreen, zeroOriginHeight: height)
    }
}
