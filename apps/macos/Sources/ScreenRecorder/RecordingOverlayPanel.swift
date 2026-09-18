import AppKit
import ScreenRecorderControls
import SwiftUI

/**
 The floating controls a take carries while it runs.

 They are the menu's transport row in a window a person can reach without opening the menu: pause
 or resume, finish, cancel, and the take's own elapsed playback time. Every button sends the same
 action the menu sends, so there is no second device state machine here and no clock of its own —
 what to show, and whether to show anything at all, is decided from the one controls state.
 */
@MainActor
final class RecordingOverlayPanel {
    static let title = "Screen Recorder Controls"
    /// How far above the bottom of the screen a take's controls first appear.
    private static let margin: CGFloat = 72

    private let preferences: Preferences
    private let perform: (ControlsAction) -> Void
    private let model = RecordingOverlayModel()
    private var panel: OverlayPanel?
    private var moved: NSObjectProtocol?

    init(preferences: Preferences, perform: @escaping (ControlsAction) -> Void) {
        self.preferences = preferences
        self.perform = perform
    }

    /// What the controls state says these controls are: on screen saying this, or not on screen.
    func update(_ presentation: RecordingOverlay.Presentation?) {
        guard let presentation else { return hide() }
        model.presentation = presentation
        show()
    }

    private func show() {
        guard panel == nil else { return }
        let content = NSHostingView(
            rootView: RecordingOverlayView(model: model, perform: { [weak self] in self?.perform($0) }))
        // The row decides how wide the controls are, so the space around it is the padding it
        // asked for rather than whatever is left over inside a fixed panel, and a take that runs
        // past an hour widens the panel instead of crowding its own clock.
        content.sizingOptions = [.intrinsicContentSize]
        let size = content.fittingSize
        let panel = OverlayPanel(
            contentRect: NSRect(origin: startingOrigin(size), size: size), level: .floating,
            title: Self.title)
        panel.isMovableByWindowBackground = true
        panel.contentView = content
        // Where a person leaves the controls is where the next take finds them.
        moved = NotificationCenter.default.addObserver(
            forName: NSWindow.didMoveNotification, object: panel, queue: .main
        ) { [weak self, weak panel] _ in
            MainActor.assumeIsolated {
                guard let self, let panel else { return }
                self.preferences.overlayOrigin = panel.frame.origin
            }
        }
        self.panel = panel
        panel.present()
        describe(panel)
    }

    private func hide() {
        guard let panel else { return }
        if let moved { NotificationCenter.default.removeObserver(moved) }
        moved = nil
        self.panel = nil
        panel.close()
    }

    /// Where the controls were last left, if that is still somewhere a person can see, and the
    /// bottom of the screen they are working on otherwise.
    private func startingOrigin(_ size: NSSize) -> NSPoint {
        if let saved = preferences.overlayOrigin,
            NSScreen.screens.contains(where: {
                $0.visibleFrame.intersects(NSRect(origin: saved, size: size))
            }) {
            return saved
        }
        let visible = (NSScreen.main ?? NSScreen.screens.first)?.visibleFrame
            ?? NSRect(x: 0, y: 0, width: size.width, height: size.height)
        return NSPoint(x: visible.midX - size.width / 2, y: visible.minY + Self.margin)
    }

    /// Where these controls are on the display a take of that display would record them, so a
    /// check can look at exactly that part of a recorded frame.
    private func describe(_ panel: OverlayPanel) {
        guard let screen = panel.screen ?? NSScreen.main, let id = screen.captureDisplayID,
            let rect = screen.displayLocal(panel.frame)
        else { return }
        diagnostic(
            "recording overlay display=\(id) rect=\(Int(rect.minX)),\(Int(rect.minY)),"
                + "\(Int(rect.width)),\(Int(rect.height))")
    }
}

@MainActor
private final class RecordingOverlayModel: ObservableObject {
    @Published var presentation = RecordingOverlay.Presentation(elapsed: "0:00", paused: false)
}

/// The controls themselves: a state dot, the take's playback time, and the three transport
/// actions, each sending the action the menu sends.
private struct RecordingOverlayView: View {
    @ObservedObject var model: RecordingOverlayModel
    let perform: (ControlsAction) -> Void

    private var paused: Bool { model.presentation.paused }

    var body: some View {
        HStack(spacing: 10) {
            // Recording is red and paused is amber: a state a glance reads, not a dimmed dot that
            // could just as well mean the controls are unavailable.
            Circle()
                .fill(paused ? Color.orange : Color.red)
                .frame(width: 10, height: 10)
                .accessibilityLabel(paused ? "Paused" : "Recording")
            // A clock that has stopped says so, rather than leaving the colour of one dot to
            // carry the whole difference between recording and paused.
            Text(model.presentation.elapsed)
                .font(.system(size: 15, weight: .medium))
                .monospacedDigit()
                .foregroundStyle(paused ? AnyShapeStyle(.secondary) : AnyShapeStyle(.primary))
                .frame(minWidth: 56, alignment: .leading)
            Divider().frame(height: 22)
            // Finishing keeps the take and canceling throws it away, so the two never sit together
            // as a pair of grey squares: the stop is the recorder's red, the bin is a bin, and the
            // gap between them says they are not the same kind of ending.
            HStack(spacing: 2) {
                button(paused ? "play.fill" : "pause.fill",
                    paused ? "Resume Recording" : "Pause Recording", .pauseOrResume)
                button("stop.fill", "Finish Recording", .startOrStop, tint: .red)
            }
            button("trash.fill", "Cancel Take", .cancel)
        }
        // A button's tappable box reaches past the mark it draws, so the trailing edge needs less
        // room than the leading one for the two to look the same.
        .padding(.leading, 16)
        .padding(.trailing, 8)
        .padding(.vertical, 13)
        .background(.regularMaterial, in: Capsule())
        .overlay(Capsule().strokeBorder(.separator, lineWidth: 0.5))
    }

    private func button(
        _ symbol: String, _ name: String, _ action: ControlsAction, tint: Color? = nil
    ) -> some View {
        Button { perform(action) } label: {
            Image(systemName: symbol)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(tint ?? .primary)
                .frame(width: 30, height: 30)
                .contentShape(Circle())
        }
        .buttonStyle(.accessoryBar)
        .clipShape(Circle())
        .help(name)
        .accessibilityLabel(name)
    }
}
