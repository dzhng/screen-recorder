import AppKit
import ScreenRecorderControls

/// Read-only menu-state observations for an explicitly enabled own-window fixture.
/// Capture actions use the public service; actual UI interaction is verified separately.
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
        guard command["do"] as? String == "snapshot" else {
            return ["ok": false, "error": "The fixture observer only supports snapshots."]
        }
        return ["ok": true, "rows": Self.rows(of: controls.visibleMenu)]
    }

    /// Answers into a file only once it is whole, so a reader never sees half of one.
    private func answer(id: Int, with payload: [String: Any]) {
        let path = (directory as NSString).appendingPathComponent("answer-\(id).json")
        guard let data = try? JSONSerialization.data(withJSONObject: payload) else { return }
        let staging = path + ".part"
        guard (try? data.write(to: URL(fileURLWithPath: staging))) != nil else { return }
        try? FileManager.default.moveItem(atPath: staging, toPath: path)
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
