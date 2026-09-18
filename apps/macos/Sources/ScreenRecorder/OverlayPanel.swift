import AppKit

/**
 A panel this app floats over other windows without ever taking the screen from whoever is using
 the Mac.

 It never activates this app, so clicking it leaves the frontmost application frontmost and the
 keystrokes a person is recording keep going where they were going. It stays on screen while this
 app is inactive, and it follows the person between spaces instead of living on the one it opened
 in. A launch a check drives orders the same panels in behind everything at an ordinary window
 level: an automated run must not put anything over someone's work.
 */
@MainActor
class OverlayPanel: NSPanel {
    init(contentRect: NSRect, level floating: NSWindow.Level, title: String) {
        super.init(
            contentRect: contentRect, styleMask: [.borderless, .nonactivatingPanel],
            backing: .buffered, defer: false)
        self.title = title
        isReleasedWhenClosed = false
        hidesOnDeactivate = false
        isOpaque = false
        backgroundColor = .clear
        hasShadow = true
        level = ControlsProbe.observed ? .normal : floating
        collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .ignoresCycle]
    }

    /// Puts the panel on screen without activating this app, or in behind everything for a check.
    func present() {
        if ControlsProbe.observed {
            orderBack(nil)
        } else {
            orderFrontRegardless()
        }
    }
}
