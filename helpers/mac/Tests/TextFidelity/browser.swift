import AppKit
import Foundation
import WebKit

@MainActor final class Browser: NSObject, WKNavigationDelegate {
    let view = WKWebView()
    let window: NSWindow
    init(html: URL, width: Int, height: Int) {
        window = NSWindow(contentRect: NSRect(x: 30, y: 50, width: width, height: height),
            styleMask: [.titled, .closable], backing: .buffered, defer: false)
        super.init()
        window.title = "Owned local browser fixture"
        window.contentView = view
        view.navigationDelegate = self
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        view.loadFileURL(html, allowingReadAccessTo: html.deletingLastPathComponent())
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        print("READY \(window.windowNumber) \(window.backingScaleFactor)")
        fflush(stdout)
        Task {
            for try await command in FileHandle.standardInput.bytes.lines {
                if command == "quit" { NSApp.terminate(nil); return }
                let state = command == "dark" ? "dark" : command == "scroll" ? "scroll" : "top"
                let data = try await view.callAsyncJavaScript("return await window.fixtureState(state)",
                    arguments: ["state": state], in: nil, contentWorld: .page)
                print("STATE \(String(describing: data))")
                fflush(stdout)
            }
            NSApp.terminate(nil)
        }
    }
}

@main struct Fixture {
    @MainActor static func main() {
        NSApplication.shared.setActivationPolicy(.regular)
        let app = Browser(html: URL(fileURLWithPath: CommandLine.arguments[1]),
            width: Int(CommandLine.arguments[2])!, height: Int(CommandLine.arguments[3])!)
        withExtendedLifetime(app) { NSApp.run() }
    }
}
