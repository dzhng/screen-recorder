import Foundation

/**
 The key combinations macOS itself has switched on.

 Asking the system for a combination is not enough to know it is free: `RegisterEventHotKey`
 answers with success for one another application already holds, so this app would report a
 shortcut as held while its keystrokes went somewhere else. What can be known is what macOS has
 taken for itself — Spotlight, Mission Control, screenshots and the rest live in one preference
 domain, each with the key and modifiers it is set to and whether it is on. A combination in that
 set is refused here instead, so nothing is taken from what a person already uses.

 Another application's own registration remains undetectable, which is why the shortcut file is
 the way out rather than an error.
 */
public enum SystemShortcuts {
    /// One combination, as both this app and the system's own table describe it.
    public struct Combination: Hashable, Sendable {
        public init(keyCode: UInt32, control: Bool, option: Bool, command: Bool, shift: Bool) {
            self.keyCode = keyCode
            self.control = control
            self.option = option
            self.command = command
            self.shift = shift
        }
        public let keyCode: UInt32
        public let control: Bool
        public let option: Bool
        public let command: Bool
        public let shift: Bool
    }

    /// The modifier bits the system's table stores, which are `NSEvent.ModifierFlags` raw values.
    private enum Flag {
        static let shift: UInt = 1 << 17
        static let control: UInt = 1 << 18
        static let option: UInt = 1 << 19
        static let command: UInt = 1 << 20
    }

    /**
     Reads `AppleSymbolicHotKeys` as macOS writes it: each entry is a numbered shortcut carrying
     `enabled` and a `value` whose `parameters` are the character, the key code and the modifier
     mask. Anything switched off, or recorded with no key, holds nothing. A malformed entry is
     skipped rather than guessed at — this decides whether to refuse a person's own preference, so
     it may only refuse on evidence.
     */
    public static func taken(from table: [String: Any]) -> Set<Combination> {
        var combinations: Set<Combination> = []
        for entry in table.values {
            guard let entry = entry as? [String: Any],
                entry["enabled"] as? Bool == true,
                let value = entry["value"] as? [String: Any],
                let parameters = value["parameters"] as? [Any], parameters.count >= 3,
                let key = (parameters[1] as? NSNumber)?.intValue, key >= 0,
                let modifiers = (parameters[2] as? NSNumber)?.uintValue
            else { continue }
            combinations.insert(
                Combination(
                    keyCode: UInt32(key),
                    control: modifiers & Flag.control != 0,
                    option: modifiers & Flag.option != 0,
                    command: modifiers & Flag.command != 0,
                    shift: modifiers & Flag.shift != 0))
        }
        return combinations
    }

    /// What this Mac has switched on right now.
    public static func taken() -> Set<Combination> {
        guard let defaults = UserDefaults(suiteName: "com.apple.symbolichotkeys"),
            let table = defaults.dictionary(forKey: "AppleSymbolicHotKeys")
        else { return [] }
        return taken(from: table)
    }
}
