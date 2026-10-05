import AppKit
import ScreenRecorderControls

/// Which screen a capture selection names, and where a panel sits on the display it shares with a
/// take. Capture sources and AppKit describe the same displays in different coordinates, so the
/// translation between them lives here rather than in each window that needs it.
extension NSScreen {
    /// The display ID the capture sources name this screen by.
    var captureDisplayID: Int? {
        (deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber)
            .map { Int($0.uint32Value) }
    }

    /// The screen a take of this selection records. A window take is recorded wherever that window
    /// is; nil when the selection names nothing this Mac is showing right now.
    static func recording(_ source: ControlsState.SelectedSource?) -> NSScreen? {
        switch source {
        case .display(let display): screens.first { $0.captureDisplayID == display.id }
        case .region(let region): screens.first { $0.captureDisplayID == region.displayId }
        case .window(let window): holding(window: window.id)
        case .camera: nil
        case nil: nil
        }
    }

    /// The screen holding a window, by the window server's own record of where that window is.
    private static func holding(window: Int) -> NSScreen? {
        guard
            let listed = CGWindowListCopyWindowInfo(
                [.optionIncludingWindow], CGWindowID(window)) as? [[String: Any]],
            let bounds = listed.first?[kCGWindowBounds as String] as? [String: CGFloat],
            let rect = CGRect(dictionaryRepresentation: bounds as CFDictionary)
        else { return nil }
        return screens.first {
            guard let id = $0.captureDisplayID else { return false }
            return CGDisplayBounds(CGDirectDisplayID(id)).contains(CGPoint(x: rect.midX, y: rect.midY))
        }
    }

    /// A rectangle of this screen as the display's own capture would frame it: display-local
    /// points with a top-left origin, which is how a recorded frame is laid out.
    func displayLocal(_ rect: NSRect) -> NSRect? {
        guard let id = captureDisplayID else { return nil }
        let display = CGDisplayBounds(CGDirectDisplayID(id))
        // AppKit measures y up from the primary screen's bottom left; displays measure it down
        // from the primary screen's top left.
        let primary = NSScreen.screens.first?.frame.height ?? frame.height
        return NSRect(
            x: rect.minX - display.minX, y: primary - rect.maxY - display.minY,
            width: rect.width, height: rect.height)
    }
}
