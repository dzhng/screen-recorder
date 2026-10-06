import AppKit

/// Key equivalents shared by the app's ordinary independent windows.
@MainActor
enum WindowMenu {
    /// A menu-bar app shows no menu bar, but its key equivalents still route through the main
    /// menu. A window a person can see should close with ⌘W and, since the status menu tells them
    /// ⌘Q quits, ⌘Q has to quit while that window is the one they are looking at.
    static func install() {
        guard NSApplication.shared.mainMenu == nil else { return }
        let application = NSMenu(title: "Yap")
        application.addItem(
            NSMenuItem(
                title: "Quit Yap", action: #selector(NSApplication.terminate(_:)),
                keyEquivalent: "q"))
        let applicationItem = NSMenuItem()
        applicationItem.submenu = application
        let window = NSMenu(title: "Window")
        window.addItem(NSMenuItem(title: "Close", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w"))
        let item = NSMenuItem()
        item.submenu = window
        let main = NSMenu()
        main.addItem(applicationItem)
        main.addItem(item)
        NSApplication.shared.mainMenu = main
    }
}
