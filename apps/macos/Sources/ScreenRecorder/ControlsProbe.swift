import AppKit
import ScreenRecorderControls

/// Menu and window observations for a launch that explicitly asked for them. It reads the menu
/// rows and this app's windows, and can choose Settings… through that item's own menu action.
/// Capture actions use the public service; actual UI interaction is verified separately.
@MainActor
final class ControlsProbe {
    static let variable = "SCREENREC_FIXTURE_CONTROLS"
    private static let poll: TimeInterval = 0.05

    /// Whether a check is driving this launch. Its windows are then ordered in without activating
    /// this app, so an automated run never takes the screen from whoever is at the Mac.
    static var observed: Bool {
        !(ProcessInfo.processInfo.environment[variable] ?? "").isEmpty
    }

    /// Access states a display fixture shows instead of the system's, so every permission state of
    /// the controls can be looked at without changing what macOS has recorded for this app.
    static var displayedPermissions: ControlsState.Permissions? {
        switch ProcessInfo.processInfo.environment["SCREENREC_FIXTURE_PERMISSIONS"] {
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
            return ["ok": true, "rows": Self.rows(of: controls.visibleMenu)]
        case "windows":
            return ["ok": true, "windows": Self.windows(), "active": NSApplication.shared.isActive]
        case "open":
            // What a person does to look at the controls. Opening the menu is what re-reads the
            // sources, so a window that appeared since the last look is listed from here on.
            controls.menuWillOpen(controls.visibleMenu)
            return ["ok": true]
        case "choose":
            guard let named = command["item"] as? String,
                let item = Self.item(named: named, in: controls.visibleMenu),
                let owner = item.menu
            else { return ["ok": false, "error": "The menu has no row that does that."] }
            owner.performActionForItem(at: owner.index(of: item))
            return ["ok": true]
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

    /// One row anywhere in the menu, by what it does, so a check chooses the row a person would
    /// choose rather than reaching past the menu into the controls.
    private static func item(named action: String, in menu: NSMenu) -> NSMenuItem? {
        for item in menu.items {
            if StatusMenu.action(of: item)?.id == action { return item }
            if let submenu = item.submenu, let found = self.item(named: action, in: submenu) {
                return found
            }
        }
        return nil
    }

    private static func rows(of menu: NSMenu) -> [[String: Any]] {
        menu.items.map { item in
            var row: [String: Any] = [
                "title": item.isSeparatorItem ? "—" : item.title,
                "enabled": item.isEnabled,
                "checked": item.state == .on,
                "separator": item.isSeparatorItem,
            ]
            if let action = StatusMenu.action(of: item) { row["item"] = action.id }
            if !item.keyEquivalent.isEmpty { row["shortcut"] = item.keyEquivalent.uppercased() }
            if let submenu = item.submenu { row["submenu"] = rows(of: submenu) }
            return row
        }
    }
}
