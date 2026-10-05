import Foundation
import ScreenRecorderControls

func runShortcutTests() {
    precondition(Shortcut(display: "⌘,") == Shortcut(command: true, key: ","),
        "The standard Settings shortcut retains its binding")
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
    let notes = CapturePresentation.noticeLines(for: contested)
    precondition(
        notes.contains { $0.contains("⌃⌥⌘R") && $0.contains("in use") },
        "A combination another application owns is named rather than silently dropped")

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

/// What macOS itself holds, read the way it stores it.
func runSystemShortcutTests() {
    // Spotlight as this Mac writes it: command-space, switched on.
    let spotlight: [String: Any] = [
        "64": [
            "enabled": true,
            "value": ["parameters": [32, 49, 1_048_576], "type": "standard"],
        ]
    ]
    let held = SystemShortcuts.taken(from: spotlight)
    precondition(
        held.contains(
            SystemShortcuts.Combination(
                keyCode: 49, control: false, option: false, command: true, shift: false)),
        "A switched-on system shortcut is held, got \(held)")
    precondition(
        !held.contains(
            SystemShortcuts.Combination(
                keyCode: 49, control: true, option: true, command: true, shift: false)),
        "A different combination on the same key is not held")

    // Switched off, recorded with no key, and malformed: none of these may refuse anybody.
    let ignorable: [String: Any] = [
        "10": ["enabled": false, "value": ["parameters": [32, 49, 1_048_576]]],
        "11": ["enabled": true, "value": ["parameters": [65535, -1, 1_048_576]]],
        "12": ["enabled": true, "value": ["parameters": [32]]],
        "13": ["enabled": true],
        "14": "not a shortcut at all",
    ]
    precondition(
        SystemShortcuts.taken(from: ignorable).isEmpty,
        "Only a switched-on shortcut with a key holds anything, got \(SystemShortcuts.taken(from: ignorable))")

    // Every modifier, so a mask read one bit wrong cannot pass.
    let everything: [String: Any] = [
        "7": [
            "enabled": true,
            "value": ["parameters": [97, 0, 1_048_576 + 524_288 + 262_144 + 131_072]],
        ]
    ]
    precondition(
        SystemShortcuts.taken(from: everything) == [
            SystemShortcuts.Combination(
                keyCode: 0, control: true, option: true, command: true, shift: true)
        ],
        "All four modifiers read individually")
    print("PASS the shortcuts macOS holds are read from its own table")
}
