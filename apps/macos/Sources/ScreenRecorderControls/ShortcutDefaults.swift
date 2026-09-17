import Foundation

/// One key combination, named by the modifiers and key a person presses.
public struct Shortcut: Equatable, Sendable {
    public init(control: Bool = false, option: Bool = false, command: Bool = false, shift: Bool = false, key: String) {
        self.control = control
        self.option = option
        self.command = command
        self.shift = shift
        self.key = key.uppercased()
    }

    public let control: Bool
    public let option: Bool
    public let command: Bool
    public let shift: Bool
    public let key: String

    /// How the combination is written in a menu, in the order macOS writes modifiers.
    public var display: String {
        (control ? "⌃" : "") + (option ? "⌥" : "") + (shift ? "⇧" : "") + (command ? "⌘" : "") + key
    }

    /// Reads a combination written the way it is displayed, so an override file states exactly
    /// what a person would read back in the menu.
    public init?(display: String) {
        var rest = Substring(display)
        var control = false, option = false, command = false, shift = false
        while let first = rest.first, "⌃⌥⇧⌘".contains(first) {
            switch first {
            case "⌃": control = true
            case "⌥": option = true
            case "⇧": shift = true
            default: command = true
            }
            rest = rest.dropFirst()
        }
        guard rest.count == 1, control || option || command else { return nil }
        self.init(control: control, option: option, command: command, shift: shift, key: String(rest))
    }
}

/**
 The key combinations the recording controls ask for, and the person's own replacements when they
 ask for different ones. Nothing here claims a combination: registration decides that, and a
 combination another application already owns is left alone rather than taken from it.
 */
public struct ShortcutDefaults: Equatable, Sendable {
    /// The suggested defaults. They share one modifier group so the set reads as one product.
    public static let suggested: [ControlsAction: Shortcut] = [
        .startOrStop: Shortcut(control: true, option: true, command: true, key: "R"),
        .pauseOrResume: Shortcut(control: true, option: true, command: true, key: "P"),
        .cancel: Shortcut(control: true, option: true, command: true, key: "X"),
        .restart: Shortcut(control: true, option: true, command: true, key: "N"),
    ]

    public init(bindings: [ControlsAction: Shortcut] = ShortcutDefaults.suggested, registered: Set<String> = []) {
        self.bindings = bindings
        self.registered = registered
    }

    /// What each action asks for, after any override.
    public let bindings: [ControlsAction: Shortcut]
    /// The action IDs whose combination this app actually holds. A binding that is not here is
    /// shown without a shortcut, because pressing it would do nothing.
    public let registered: Set<String>

    public func display(of action: ControlsAction) -> String? {
        guard registered.contains(action.id), let shortcut = bindings[action] else { return nil }
        return shortcut.display
    }

    /**
     Replaces suggested combinations with a person's own, read from a small JSON object of action
     ID to written combination. An unreadable file, an unknown action or an unreadable combination
     leaves the suggested default in place rather than silently unbinding an action.
     */
    public static func overridden(by json: Data?) -> [ControlsAction: Shortcut] {
        var bindings = suggested
        guard let json,
            let stated = try? JSONSerialization.jsonObject(with: json) as? [String: String]
        else { return bindings }
        for action in suggested.keys {
            guard let written = stated[action.id] else { continue }
            if written.isEmpty {
                bindings[action] = nil
            } else if let shortcut = Shortcut(display: written) {
                bindings[action] = shortcut
            }
        }
        return bindings
    }
}
