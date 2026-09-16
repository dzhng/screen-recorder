import AppKit
import ScreenRecorderControls

/**
 Draws the recording controls' rows as a real `NSMenu` and routes a chosen row back as the action
 it stands for. It decides nothing about what the menu says: the rows arrive already built, and
 this only gives them AppKit's own appearance and behavior.
 */
@MainActor
enum StatusMenu {
    /// Reuse compatible rows so an unrelated observation cannot tear down a tracked submenu.
    /// The caller's last rendered entries are the comparison; NSMenu carries no second model.
    static func apply(
        _ entries: [MenuEntry], to menu: NSMenu, target: AnyObject, action selector: Selector,
        previous: [MenuEntry] = []
    ) {
        if entries.count == previous.count, menu.items.count == entries.count,
            zip(entries, previous).allSatisfy({ pair in
                pair.0.kind == pair.1.kind && pair.0.shortcut == pair.1.shortcut
            }),
            actions(in: entries) == actions(in: previous) {
            for (index, entry) in entries.enumerated() where entry != previous[index] {
                let item = menu.items[index]
                item.title = entry.title
                item.isEnabled = entry.enabled
                item.state = entry.checked ? .on : .off
                if let submenu = item.submenu, !entry.submenu.isEmpty {
                    apply(entry.submenu, to: submenu, target: target, action: selector,
                        previous: previous[index].submenu)
                } else if entry.submenu != previous[index].submenu {
                    // A row becoming a submenu (or losing one) changes only that row.
                    menu.removeItem(at: index)
                    menu.insertItem(Self.item(for: entry, target: target, selector: selector), at: index)
                }
            }
            return
        }
        menu.removeAllItems()
        menu.autoenablesItems = false
        for entry in entries { menu.addItem(item(for: entry, target: target, selector: selector)) }
    }

    private static func actions(in entries: [MenuEntry]) -> [ControlsAction] {
        entries.flatMap { entry in
            (entry.action.map { [$0] } ?? []) + actions(in: entry.submenu)
        }
    }

    private static func item(for entry: MenuEntry, target: AnyObject, selector: Selector)
        -> NSMenuItem
    {
        if case .separator = entry.kind { return .separator() }
        if case .header = entry.kind { return .sectionHeader(title: entry.title) }
        let item = NSMenuItem(title: entry.title, action: nil, keyEquivalent: "")
        item.state = entry.checked ? .on : .off
        if !entry.submenu.isEmpty {
            let submenu = NSMenu(title: entry.title)
            apply(entry.submenu, to: submenu, target: target, action: selector)
            item.submenu = submenu
        }
        if let chosen = entry.action {
            item.representedObject = MenuAction(chosen)
            item.action = selector
            item.target = target
            if let shortcut = entry.shortcut.flatMap(Shortcut.init(display:)) {
                item.keyEquivalent = shortcut.key.lowercased()
                item.keyEquivalentModifierMask = modifiers(of: shortcut)
            }
        }
        item.isEnabled = entry.enabled
        return item
    }

    private static func modifiers(of shortcut: Shortcut) -> NSEvent.ModifierFlags {
        var flags: NSEvent.ModifierFlags = []
        if shortcut.control { flags.insert(.control) }
        if shortcut.option { flags.insert(.option) }
        if shortcut.command { flags.insert(.command) }
        if shortcut.shift { flags.insert(.shift) }
        return flags
    }

    /// Reads back the action a chosen menu item stands for.
    static func action(of item: NSMenuItem) -> ControlsAction? {
        (item.representedObject as? MenuAction)?.action
    }
}

/// An action carried by a menu item. `representedObject` holds objects, so the value travels in
/// one rather than being taken apart into a tag this file would have to interpret again.
final class MenuAction: NSObject {
    let action: ControlsAction
    init(_ action: ControlsAction) { self.action = action }
}
