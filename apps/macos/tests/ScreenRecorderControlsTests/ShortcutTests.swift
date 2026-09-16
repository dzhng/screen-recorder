import Foundation
import ScreenRecorderControls

private func find(_ entries: [MenuEntry], _ id: String) -> MenuEntry? {
    for entry in entries {
        if entry.action?.id == id { return entry }
        if let nested = find(entry.submenu, id) { return nested }
    }
    return nil
}

func runShortcutTests() {
    let suggested = ShortcutDefaults.suggested
    precondition(
        suggested[.startOrStop]?.display == "⌃⌥⌘R" && suggested[.pauseOrResume]?.display == "⌃⌥⌘P"
            && suggested[.cancel]?.display == "⌃⌥⌘X" && suggested[.restart]?.display == "⌃⌥⌘N",
        "The suggested combinations are the ones the product asked for")

    let none = ShortcutDefaults(registered: [])
    precondition(
        none.display(of: .startOrStop) == nil,
        "A combination this app does not hold is not advertised as if pressing it would work")
    let held = ShortcutDefaults(registered: ["capture.startOrStop"])
    precondition(held.display(of: .startOrStop) == "⌃⌥⌘R", "A held combination is shown where it acts")
    precondition(held.display(of: .cancel) == nil, "Holding one combination says nothing about another")

    var contested = ready()
    contested.unavailableShortcuts = ["⌃⌥⌘R"]
    contested.shortcutOverridePath = "/Users/someone/.screen-recorder/shortcuts.json"
    let entries = RecordingMenu.entries(for: contested, shortcuts: none)
    let notes = entries.filter { !$0.enabled }.map(\.title)
    precondition(
        notes.contains { $0.contains("⌃⌥⌘R") && $0.contains("in use") },
        "A combination another application owns is named rather than silently dropped")
    precondition(
        notes.contains { $0.contains("/Users/someone/.screen-recorder/shortcuts.json") },
        "A person is told where to state a different combination")
    precondition(
        find(entries, "capture.startOrStop")?.shortcut == nil,
        "An unheld combination leaves the menu row without a shortcut rather than a dead one")

    let overridden = ShortcutDefaults.overridden(
        by: Data(#"{"capture.startOrStop":"⇧⌘8","capture.cancel":""}"#.utf8))
    precondition(overridden[.startOrStop]?.display == "⇧⌘8", "A stated combination replaces the default")
    precondition(overridden[.cancel] == nil, "An empty combination asks for no binding at all")
    precondition(overridden[.restart]?.display == "⌃⌥⌘N", "Unstated actions keep their default")
    precondition(
        ShortcutDefaults.overridden(by: Data("not json".utf8))[.startOrStop]?.display == "⌃⌥⌘R",
        "An unreadable override leaves every suggested combination in place")
    precondition(
        ShortcutDefaults.overridden(by: Data(#"{"capture.restart":"F"}"#.utf8))[.restart]?.display
            == "⌃⌥⌘N",
        "A combination with no modifier is refused rather than claiming a bare key")
    print("PASS shortcuts are advertised only where this app actually holds them")
}
