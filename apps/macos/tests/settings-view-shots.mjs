import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { compileControlsCheck } from "./fixtures/swift-controls.mjs";

// Render the production SettingsView without a service, permission reads or desktop capture.
const output = resolve(process.env.SHOTS ?? "specs/done/auto-update/assets/update-settings/candidate");
mkdirSync(output, { recursive: true });
const scratch = mkdtempSync(join(tmpdir(), "screenrec-settings-view-"));
try {
  const executable = compileControlsCheck(
    scratch,
    ["SettingsWindow"],
    String.raw`
import AppKit
import SwiftUI
import ScreenRecorderControls

enum ControlsProbe { static let observed = true }
@main struct Shots {
    @MainActor static func main() {
        NSApplication.shared.setActivationPolicy(.prohibited)
        let output = CommandLine.arguments[1]
        let scratch = CommandLine.arguments[2]
        let states: [(String, UpdateControls)] = [
            ("enabled", .init(available: true, enabled: true)),
            ("disabled", .init(available: true, enabled: false)),
            ("waiting", .init(available: true, enabled: true, status: "An update is waiting for recording and background work to finish.")),
            ("failure", .init(available: true, enabled: true, status: "Update failed: the download could not be verified. Your current version is unchanged.")),
            ("manual", .init()),
        ]
        for (theme, appearance) in [("light", NSAppearance.Name.aqua), ("dark", .darkAqua)] {
            for (name, updates) in states {
                let preferences = Preferences(defaults: UserDefaults(suiteName: "\(scratch)/\(theme)-\(name)")!)
                let model = SettingsModel(preferences: preferences, perform: { _ in })
                model.state.permissions = ControlsState.Permissions(screen: .granted, microphone: .granted)
                model.state.shortcutOverridePath = "/Users/example/.screenrec/shortcuts.json"
                model.state.updates = updates
                let content = NSHostingView(rootView: SettingsView(model: model))
                content.sizingOptions = []
                content.appearance = NSAppearance(named: appearance)
                let window = NSWindow(contentRect: NSRect(x: -10000, y: -10000, width: 560, height: 780),
                    styleMask: .borderless, backing: .buffered, defer: false)
                window.isReleasedWhenClosed = false
                window.contentView = content
                window.appearance = content.appearance
                window.orderBack(nil)
                RunLoop.current.run(until: Date().addingTimeInterval(0.6))
                content.layoutSubtreeIfNeeded()
                let bitmap = content.bitmapImageRepForCachingDisplay(in: content.bounds)!
                content.cacheDisplay(in: content.bounds, to: bitmap)
                try! bitmap.representation(using: .png, properties: [:])!.write(to:
                    URL(fileURLWithPath: "\(output)/\(theme)-\(name).png"))
                if (theme == "light" && name == "disabled") || (theme == "dark" && name == "failure") {
                    func scrollView(_ view: NSView) -> NSScrollView? {
                        if let scroll = view as? NSScrollView { return scroll }
                        return view.subviews.lazy.compactMap { scrollView($0) }.first
                    }
                    guard let scroll = scrollView(content), let document = scroll.documentView else {
                        preconditionFailure("The settings form must remain scrollable")
                    }
                    scroll.contentView.scroll(to: NSPoint(x: 0, y: document.bounds.height - scroll.contentView.bounds.height))
                    scroll.reflectScrolledClipView(scroll.contentView)
                    RunLoop.current.run(until: Date().addingTimeInterval(0.2))
                    let bottom = content.bitmapImageRepForCachingDisplay(in: content.bounds)!
                    content.cacheDisplay(in: content.bounds, to: bottom)
                    try! bottom.representation(using: .png, properties: [:])!.write(to:
                        URL(fileURLWithPath: "\(output)/\(theme)-\(name)-bottom.png"))
                    precondition(scroll.contentView.bounds.minY > 0, "Scrolling reaches lower settings")
                }
                window.orderOut(nil)
                window.close()
            }
        }
    }
}
`,
  );
  execFileSync(executable, [output, scratch], { timeout: 20_000 });
  console.log(output);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
