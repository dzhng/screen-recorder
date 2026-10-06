import AppKit

/// How the always-visible status-bar item reads. Recording details live in the on-screen overlay;
/// the menu bar stays a compact state icon.
public enum StatusItemAppearance {
    public static func symbolName(for state: ControlsState) -> String {
        if case .unavailable = state.service { return "exclamationmark.triangle" }
        if state.take?.finalizationError != nil { return "exclamationmark.triangle" }
        if state.take?.state == "finalizing" { return "circle.dotted" }
        switch state.device?.state {
        case .recording: return "record.circle.fill"
        case .paused: return "pause.circle"
        case .finalizing, .selecting: return "circle.dotted"
        default: return "message.fill"
        }
    }

    /// The idle mark keeps the artwork's speech-bubble silhouette and two eyes at menu-bar size.
    @MainActor public static func image(for state: ControlsState) -> NSImage? {
        let symbol = symbolName(for: state)
        if symbol != "message.fill" {
            return NSImage(systemSymbolName: symbol, accessibilityDescription: CapturePresentation.statusTitle(for: state))
        }
        let image = NSImage(size: NSSize(width: 18, height: 18), flipped: false) { _ in
            let bubble = NSBezierPath()
            bubble.move(to: NSPoint(x: 5, y: 3))
            bubble.line(to: NSPoint(x: 2, y: 0.5))
            bubble.line(to: NSPoint(x: 2, y: 4.5))
            bubble.curve(to: NSPoint(x: 1, y: 7), controlPoint1: NSPoint(x: 1.3, y: 5), controlPoint2: NSPoint(x: 1, y: 6))
            bubble.line(to: NSPoint(x: 1, y: 12))
            bubble.curve(to: NSPoint(x: 6, y: 17), controlPoint1: NSPoint(x: 1, y: 15), controlPoint2: NSPoint(x: 3, y: 17))
            bubble.line(to: NSPoint(x: 12, y: 17))
            bubble.curve(to: NSPoint(x: 17, y: 12), controlPoint1: NSPoint(x: 15, y: 17), controlPoint2: NSPoint(x: 17, y: 15))
            bubble.line(to: NSPoint(x: 17, y: 8))
            bubble.curve(to: NSPoint(x: 12, y: 3), controlPoint1: NSPoint(x: 17, y: 5), controlPoint2: NSPoint(x: 15, y: 3))
            bubble.close()
            bubble.appendOval(in: NSRect(x: 5, y: 8, width: 2, height: 3))
            bubble.appendOval(in: NSRect(x: 11, y: 8, width: 2, height: 3))
            bubble.windingRule = .evenOdd
            NSColor.black.setFill()
            bubble.fill()
            return true
        }
        image.isTemplate = true
        image.accessibilityDescription = "Yap"
        return image
    }

}
