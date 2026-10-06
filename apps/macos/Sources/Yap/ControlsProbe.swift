import AppKit
import YapControls

/// Native controls and window observations for a launch that explicitly asked for them. It reads the capture panel
/// controls and this app's windows, chooses an action through its native control, and writes a
/// window's own picture. Capture actions use the public service; actual UI interaction is
/// verified separately.
@MainActor
final class ControlsProbe {
    static let variable = "YAP_FIXTURE_CONTROLS"
    private static let poll: TimeInterval = 0.05

    /// Whether a check is driving this launch. Its windows are then ordered in without activating
    /// this app, so an automated run never takes the screen from whoever is at the Mac.
    static var observed: Bool {
        !(ProcessInfo.processInfo.environment[variable] ?? "").isEmpty
    }

    /// Access states a display fixture shows instead of the system's, so every permission state of
    /// the controls can be looked at without changing what macOS has recorded for this app.
    static var displayedPermissions: ControlsState.Permissions? {
        switch ProcessInfo.processInfo.environment["YAP_FIXTURE_PERMISSIONS"] {
        case "granted": .init(screen: .granted, microphone: .granted)
        case "undetermined": .init(screen: .undetermined, microphone: .undetermined)
        case "denied": .init(screen: .denied, microphone: .denied)
        default: nil
        }
    }

    private let directory: String
    private let controls: RecordingControls
    private var timer: Timer?

    /// Only ever built for a launch that asked for one.
    static func requested(controls: RecordingControls?) -> ControlsProbe? {
        guard let controls,
            let directory = ProcessInfo.processInfo.environment[variable], !directory.isEmpty
        else { return nil }
        let probe = ControlsProbe(directory: directory, controls: controls)
        probe.start()
        return probe
    }

    private init(directory: String, controls: RecordingControls) {
        self.directory = directory
        self.controls = controls
    }

    private func start() {
        diagnostic("controls probe listening in \(directory)")
        let timer = Timer(timeInterval: Self.poll, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated { self?.readCommand() }
        }
        RunLoop.main.add(timer, forMode: .common)
        self.timer = timer
    }

    func stop() {
        timer?.invalidate()
        timer = nil
    }

    private var commandPath: String { (directory as NSString).appendingPathComponent("command.json") }

    private func readCommand() {
        guard let data = FileManager.default.contents(atPath: commandPath),
            let command = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let id = command["id"] as? Int
        else { return }
        try? FileManager.default.removeItem(atPath: commandPath)
        answer(id: id, with: run(command))
    }

    private func run(_ command: [String: Any]) -> [String: Any] {
        switch command["do"] as? String {
        case "snapshot":
            return ["ok": true, "rows": controls.captureRows, "status": controls.captureView?.input.status ?? "Idle", "library": controls.libraryRows]
        case "windows":
            return ["ok": true, "windows": Self.windows(), "active": NSApplication.shared.isActive]
        case "open":
            // What a person does to look at the controls. Opening capture is what re-reads the
            // sources, so a window that appeared since the last look is listed from here on.
            controls.openCapture()
            return ["ok": true]
        case "choose":
            guard let named = command["item"] as? String, controls.chooseControl(named: named) else {
                return ["ok": false, "error": "No enabled visible control performs that action."]
            }
            return ["ok": true]
        case "close":
            controls.closeCapture()
            return ["ok": true]
        case "overlay":
            // A take reaching an hour takes an hour; the controls' layout at that clock does not.
            guard let elapsed = command["elapsed"] as? String else {
                return ["ok": false, "error": "An overlay command names the clock to show."]
            }
            controls.showOverlay(elapsed: elapsed)
            return ["ok": true]
        case "appearance":
            // Looking at this app the way a person with the other system appearance would.
            switch command["value"] as? String {
            case "dark": NSApplication.shared.appearance = NSAppearance(named: .darkAqua)
            case "light": NSApplication.shared.appearance = NSAppearance(named: .aqua)
            default: NSApplication.shared.appearance = nil
            }
            return ["ok": true]
        case "shot":
            // The window draws its own picture, so a review copy needs no screen capture, no
            // pointer and nothing brought to the front of somebody's work.
            guard let title = command["window"] as? String, let path = command["path"] as? String,
                let view = NSApplication.shared.windows.first(where: { $0.title == title })?.contentView,
                let image = view.bitmapImageRepForCachingDisplay(in: view.bounds)
            else { return ["ok": false, "error": "No window named that has a picture to write."] }
            view.cacheDisplay(in: view.bounds, to: image)
            guard let png = image.representation(using: .png, properties: [:]),
                (try? png.write(to: URL(fileURLWithPath: path))) != nil
            else { return ["ok": false, "error": "The window's picture could not be written."] }
            return ["ok": true, "width": image.pixelsWide, "height": image.pixelsHigh]
        case "escape":
            guard let title = command["window"] as? String,
                let window = NSApplication.shared.windows.first(where: { $0.title == title })
            else { return ["ok": false, "error": "This app has no window named that."] }
            window.cancelOperation(nil)
            return ["ok": true]
        default:
            return ["ok": false, "error": "Unknown probe command."]
        }
    }

    /// This app's own named windows, shown or hidden, by their AppKit identity. A floating panel
    /// carries no title bar but still says what it is, so the overlays are read the same way.
    private static func windows() -> [[String: Any]] {
        NSApplication.shared.windows.filter { !$0.title.isEmpty }.map { window in
            [
                "title": window.title,
                "number": window.windowNumber,
                "visible": window.isVisible,
                "key": window.isKeyWindow,
                "width": window.frame.width,
                "height": window.frame.height,
            ]
        }
    }

    /// Answers into a file only once it is whole, so a reader never sees half of one.
    private func answer(id: Int, with payload: [String: Any]) {
        let path = (directory as NSString).appendingPathComponent("answer-\(id).json")
        guard let data = try? JSONSerialization.data(withJSONObject: payload) else { return }
        let staging = path + ".part"
        guard (try? data.write(to: URL(fileURLWithPath: staging))) != nil else { return }
        try? FileManager.default.moveItem(atPath: staging, toPath: path)
    }

}
