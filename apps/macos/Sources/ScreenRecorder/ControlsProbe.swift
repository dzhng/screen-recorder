import AppKit
import ScreenRecorderControls

/**
 A fixture-only way to read and use the recording controls the way a person does.

 It exists only for a launch that already opened this app's own capture-fixture window and was
 given a directory to answer in, so an ordinary launch has no such mechanism. A chosen row is sent
 through the menu item's own target and action — the same call AppKit makes when a person clicks
 it — and a disabled row is refused here exactly as AppKit would refuse it. Nothing here performs a
 capture operation directly, so a check that passes through it proves the menu's own wiring.
 */
@MainActor
final class ControlsProbe {
    static let variable = "SCREENREC_FIXTURE_CONTROLS"
    private static let poll: TimeInterval = 0.05

    private let directory: String
    private let controls: RecordingControls
    private var timer: Timer?

    /// Only ever built for a fixture launch that asked for one.
    static func inFixture(_ fixtureWindow: NSWindow?, controls: RecordingControls?) -> ControlsProbe? {
        guard fixtureWindow != nil, let controls,
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
        // Reading the controls begins the way a person begins: by opening the menu, which is what
        // asks the service for everything the menu shows.
        if command["do"] as? String != "snapshot" { controls.menuWillOpen(controls.visibleMenu) }
        switch command["do"] as? String {
        case "menu", "snapshot":
            return ["ok": true, "rows": Self.rows(of: controls.visibleMenu)]
        case "choose":
            guard let wanted = command["item"] as? String else {
                return ["ok": false, "error": "A chosen row names the action it stands for."]
            }
            guard let item = Self.find(wanted, in: controls.visibleMenu) else {
                return ["ok": false, "error": "No row stands for \(wanted)."]
            }
            guard item.isEnabled, let action = item.action, let target = item.target else {
                return ["ok": false, "error": "\(wanted) is not available right now."]
            }
            NSApplication.shared.sendAction(action, to: target, from: item)
            return ["ok": true, "chose": item.title]
        case "shot":
            guard let path = command["path"] as? String else {
                return ["ok": false, "error": "A picture names where to write itself."]
            }
            guard
                let png = MenuImage.png(
                    of: controls.visibleMenu, statusSymbol: controls.statusSymbolName,
                    statusTitle: controls.statusElapsed, recording: controls.isRecording,
                    opening: command["open"] as? [String] ?? [])
            else { return ["ok": false, "error": "The controls could not be drawn."] }
            do {
                try png.write(to: URL(fileURLWithPath: path))
                return ["ok": true, "path": path]
            } catch {
                return ["ok": false, "error": error.localizedDescription]
            }
        default:
            return ["ok": false, "error": "Unknown controls command."]
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

    private static func find(_ id: String, in menu: NSMenu) -> NSMenuItem? {
        for item in menu.items {
            if StatusMenu.action(of: item)?.id == id { return item }
            if let submenu = item.submenu, let found = find(id, in: submenu) { return found }
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
