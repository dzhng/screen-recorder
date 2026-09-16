import AppKit
import ScreenRecorderCapture
import ScreenRecorderControls

/**
 Renders the recording controls in each state a reviewer needs to judge, and writes them as images.

 The menu is built by the same code the running app builds it with, so what a reviewer reads is the
 product's own rows, ticks, shortcuts and disabled states. What is stated here is only the answers
 the service would have given — a catalog of sources and a take's clock — so the pictures show a
 populated machine without listing a real person's open windows or recording anything at all.
 */
@MainActor
enum ControlsShots {
    static func render(into directory: String) throws {
        try FileManager.default.createDirectory(
            atPath: directory, withIntermediateDirectories: true)
        var written: [String] = []
        for (name, shot) in shots {
            let menu = NSMenu()
            StatusMenu.apply(
                RecordingMenu.entries(for: shot.state, shortcuts: shot.shortcuts), to: menu,
                target: NSApplication.shared, action: #selector(NSApplication.hide(_:)))
            guard
                let png = MenuImage.png(
                    of: menu, statusSymbol: StatusItemAppearance.symbolName(for: shot.state),
                    statusTitle: StatusItemAppearance.title(for: shot.state),
                    recording: shot.state.device?.state == .recording, opening: shot.opening)
            else { throw CaptureFailure("RENDER_FAILED", "Could not draw the \(name) controls.") }
            let path = (directory as NSString).appendingPathComponent("\(name).png")
            try png.write(to: URL(fileURLWithPath: path))
            written.append(path)
        }
        try emit(["shots": written.sorted()])
    }

    private struct Shot {
        let state: ControlsState
        /// The chain of submenu titles this shot shows open, so a reviewer sees the rows inside.
        var opening: [String] = []
        var shortcuts = ShortcutDefaults(registered: Set(ShortcutDefaults.suggested.keys.map(\.id)))
    }

    private static var shots: [(String, Shot)] {
        [
            ("idle", Shot(state: idle)),
            (
                "choosing-source",
                Shot(state: idle, opening: ["Source: \(RecordingMenu.sourceTitle(for: idle))"])
            ),
            (
                "choosing-microphone",
                Shot(
                    state: idle,
                    opening: ["Microphone: \(RecordingMenu.microphoneTitle(for: idle))"])
            ),
            ("recording", Shot(state: running(.recording, elapsedUs: 67_000_000))),
            ("paused", Shot(state: running(.paused, elapsedUs: 67_000_000))),
            ("interrupted", Shot(state: interrupted)),
            (
                "recent-takes",
                Shot(
                    state: idle,
                    opening: [
                        "Recent Recordings",
                        RecordingMenu.recentTitle(of: idle.recent[0]),
                    ])
            ),
            (
                "permission-and-shortcut-refused",
                Shot(state: refused, shortcuts: ShortcutDefaults(registered: ["capture.cancel", "capture.restart"]))
            ),
        ]
    }

    /// A machine with two displays, a few windows and two inputs, and a take already chosen.
    private static var idle: ControlsState {
        var state = ControlsState()
        state.service = .ready
        state.sources = ControlsState.SourceCatalog(
            displays: [
                ControlsState.Display(id: 1, name: "Built-in Retina Display", width: 1728, height: 1117),
                ControlsState.Display(id: 2, name: "Studio Display", width: 2560, height: 1440),
            ],
            windows: [
                ControlsState.Window(id: 41, title: "Pricing — localhost:5173", application: "Safari"),
                ControlsState.Window(id: 42, title: "recording-controls", application: "Terminal"),
                ControlsState.Window(id: 43, title: "Notes", application: "Notes"),
            ],
            microphones: [
                ControlsState.Microphone(id: "mic-built-in", name: "MacBook Pro Microphone", isDefault: true),
                ControlsState.Microphone(id: "mic-headset", name: "Studio Headset", isDefault: false),
            ])
        state.selection.source = .display(state.sources.displays[0])
        state.device = ControlsState.DeviceStatus(
            state: .idle, recordingId: nil, elapsedUs: nil,
            permissions: ControlsState.Permissions(screen: true, microphone: "authorized"))
        state.recent = [
            ControlsState.RecentTake(
                recordingId: "rec-0193", createdAt: "2026-09-15T11:02:41Z", state: "complete",
                sourceDurationUs: 152_000_000, interruptionReason: nil),
            ControlsState.RecentTake(
                recordingId: "rec-0192", createdAt: "2026-09-14T16:40:09Z", state: "interrupted",
                sourceDurationUs: 31_000_000, interruptionReason: "SOURCE_LOST"),
        ]
        return state
    }

    private static func running(_ device: ControlsState.DeviceState, elapsedUs: Int64) -> ControlsState {
        var state = idle
        state.selection.source = .window(state.sources.windows[0])
        state.device = ControlsState.DeviceStatus(
            state: device, recordingId: "rec-0194", elapsedUs: elapsedUs,
            permissions: ControlsState.Permissions(screen: true, microphone: "authorized"))
        state.take = ControlsState.TakeStatus(
            recordingId: "rec-0194", state: device == .paused ? "paused" : "recording",
            interruptionReason: nil, sourceDurationUs: nil)
        return state
    }

    private static var interrupted: ControlsState {
        var state = idle
        state.take = ControlsState.TakeStatus(
            recordingId: "rec-0194", state: "interrupted", interruptionReason: "SOURCE_LOST",
            sourceDurationUs: 48_000_000)
        return state
    }

    private static var refused: ControlsState {
        var state = idle
        state.selection.source = nil
        state.device = ControlsState.DeviceStatus(
            state: .idle, recordingId: nil, elapsedUs: nil,
            permissions: ControlsState.Permissions(screen: false, microphone: "denied"))
        state.sources = ControlsState.SourceCatalog()
        state.unavailableShortcuts = ["⌃⌥⌘P", "⌃⌥⌘R"]
        state.shortcutOverridePath = "~/.screen-recorder/shortcuts.json"
        return state
    }
}
