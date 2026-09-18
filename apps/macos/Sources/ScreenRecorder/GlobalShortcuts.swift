import AppKit
import Carbon.HIToolbox
import ScreenRecorderControls

/**
 The key combinations this app holds while it is not the active application.

 A combination is only ever *asked for*. When the system refuses one — because something else
 already holds it — that binding is left off and named in the menu, so nothing is taken away from
 whatever the person already uses it for. A combination macOS itself has switched on is refused
 here before it is asked for, because `RegisterEventHotKey` answers with success for one that is
 already spoken for: see [system shortcuts](../ScreenRecorderControls/SystemShortcuts.swift).
 Another application's own registration still cannot be detected, so the menu states what this app
 holds rather than promising the key is free.
 */
@MainActor
final class GlobalShortcuts {
    /// Where a person states combinations of their own when a suggested one is unavailable.
    static func overridePath(home: String) -> String { (home as NSString).appendingPathComponent("shortcuts.json") }

    private var handlers: [UInt32: () -> Void] = [:]
    private var claimed: [UInt32: EventHotKeyRef] = [:]
    private var handler: EventHandlerRef?
    private var nextIdentifier: UInt32 = 1

    /// Claims what it can of the given bindings for this app's lifetime, and reports both sides of
    /// the outcome: the action IDs this app now holds, and the combinations it refused to take from
    /// something else.
    func claim(
        _ bindings: [ControlsAction: Shortcut], perform: @escaping (ControlsAction) -> Void
    ) -> (held: Set<String>, unavailable: [String]) {
        var held: Set<String> = []
        var unavailable: [String] = []
        // One stable order, so a launch that cannot claim two combinations names them the same way
        // every time rather than in whatever order a dictionary happened to hold.
        for action in bindings.keys.sorted(by: { $0.id < $1.id }) {
            guard let shortcut = bindings[action], Self.keyCode(of: shortcut.key) != nil else {
                continue
            }
            guard register(shortcut, { perform(action) }) != nil else {
                unavailable.append(shortcut.display)
                continue
            }
            held.insert(action.id)
        }
        return (held, unavailable)
    }

    /**
     Holds one combination for exactly as long as a piece of work needs it, and answers with the
     way to give it back. Nothing may keep a key a person uses elsewhere for longer than the thing
     that asked for it is on screen. Nil when the system would not give the combination up, so the
     caller can say so rather than wait for a key that will never arrive.
     */
    func hold(_ shortcut: Shortcut, perform: @escaping () -> Void) -> (() -> Void)? {
        guard let identifier = register(shortcut, perform) else { return nil }
        return { [weak self] in self?.release(identifier) }
    }

    /// What macOS holds, read once: this list changes when a person changes a system shortcut,
    /// which is a moment they are in System Settings rather than recording.
    private lazy var systemHeld = SystemShortcuts.taken()

    /// Asks the system for one combination. Refusal is the answer here; nothing is taken.
    private func register(_ shortcut: Shortcut, _ perform: @escaping () -> Void) -> UInt32? {
        installHandler()
        guard let key = Self.keyCode(of: shortcut.key) else { return nil }
        // Asking for one the system already has would be answered with success and then never
        // deliver a keystroke, so it is refused here where the refusal can be said out loud.
        if systemHeld.contains(
            SystemShortcuts.Combination(
                keyCode: key, control: shortcut.control, option: shortcut.option,
                command: shortcut.command, shift: shortcut.shift))
        {
            diagnostic("shortcut \(shortcut.display) is held by macOS itself")
            return nil
        }
        let identifier = nextIdentifier
        nextIdentifier += 1
        var reference: EventHotKeyRef?
        let status = RegisterEventHotKey(
            key, Self.carbonModifiers(of: shortcut),
            EventHotKeyID(signature: Self.signature, id: identifier),
            GetApplicationEventTarget(), 0, &reference)
        guard status == noErr, let reference else { return nil }
        claimed[identifier] = reference
        handlers[identifier] = perform
        return identifier
    }

    private func release(_ identifier: UInt32) {
        if let reference = claimed.removeValue(forKey: identifier) {
            UnregisterEventHotKey(reference)
        }
        handlers[identifier] = nil
    }

    private func installHandler() {
        guard handler == nil else { return }
        var pressed = EventTypeSpec(
            eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventHotKeyPressed))
        InstallEventHandler(
            GetApplicationEventTarget(),
            { _, event, context in
                guard let event, let context else { return OSStatus(eventNotHandledErr) }
                var identifier = EventHotKeyID()
                let read = GetEventParameter(
                    event, EventParamName(kEventParamDirectObject), EventParamType(typeEventHotKeyID),
                    nil, MemoryLayout<EventHotKeyID>.size, nil, &identifier)
                guard read == noErr, identifier.signature == GlobalShortcuts.signature else {
                    return OSStatus(eventNotHandledErr)
                }
                // Carbon delivers hot keys on the main thread, which is where this app's controls
                // and its capture session already live.
                return MainActor.assumeIsolated {
                    let shortcuts = Unmanaged<GlobalShortcuts>.fromOpaque(context)
                        .takeUnretainedValue()
                    guard let perform = shortcuts.handlers[identifier.id] else {
                        return OSStatus(eventNotHandledErr)
                    }
                    perform()
                    return noErr
                }
            }, 1, &pressed, Unmanaged.passUnretained(self).toOpaque(), &handler)
    }

    private static let signature = OSType(0x53_52_45_43)  // 'SREC'

    private static func carbonModifiers(of shortcut: Shortcut) -> UInt32 {
        var flags: UInt32 = 0
        if shortcut.control { flags |= UInt32(controlKey) }
        if shortcut.option { flags |= UInt32(optionKey) }
        if shortcut.command { flags |= UInt32(cmdKey) }
        if shortcut.shift { flags |= UInt32(shiftKey) }
        return flags
    }

    /// Virtual key codes for the keys a binding may name. A key that is not here cannot be
    /// claimed, and the binding is skipped rather than claimed as some other key.
    private static let keyCodes: [String: Int] = [
        "A": kVK_ANSI_A, "B": kVK_ANSI_B, "C": kVK_ANSI_C, "D": kVK_ANSI_D, "E": kVK_ANSI_E,
        "F": kVK_ANSI_F, "G": kVK_ANSI_G, "H": kVK_ANSI_H, "I": kVK_ANSI_I, "J": kVK_ANSI_J,
        "K": kVK_ANSI_K, "L": kVK_ANSI_L, "M": kVK_ANSI_M, "N": kVK_ANSI_N, "O": kVK_ANSI_O,
        "P": kVK_ANSI_P, "Q": kVK_ANSI_Q, "R": kVK_ANSI_R, "S": kVK_ANSI_S, "T": kVK_ANSI_T,
        "U": kVK_ANSI_U, "V": kVK_ANSI_V, "W": kVK_ANSI_W, "X": kVK_ANSI_X, "Y": kVK_ANSI_Y,
        "Z": kVK_ANSI_Z, "0": kVK_ANSI_0, "1": kVK_ANSI_1, "2": kVK_ANSI_2, "3": kVK_ANSI_3,
        "4": kVK_ANSI_4, "5": kVK_ANSI_5, "6": kVK_ANSI_6, "7": kVK_ANSI_7, "8": kVK_ANSI_8,
        "9": kVK_ANSI_9,
        // The one key a countdown holds while it is on screen, so Escape abandons a start from
        // wherever the person is working.
        "ESCAPE": kVK_Escape,
    ]

    private static func keyCode(of key: String) -> UInt32? {
        keyCodes[key.uppercased()].map(UInt32.init)
    }
}
