// Optional owned-window capture for the generated [1,3)s empty-edit fixture.
// No view background override: screenshots measure AVPlayerView itself.
@preconcurrency import AVFoundation
import AVKit
import AppKit

@main struct WindowProbe {
    @MainActor static func main() {
        let app = NSApplication.shared
        app.setActivationPolicy(.regular)
        let window = NSWindow(
            contentRect: NSRect(x: 120, y: 120, width: 640, height: 360),
            styleMask: [.titled, .closable], backing: .buffered, defer: false)
        window.title = "Generated empty-edit presentation"
        let view = AVPlayerView(frame: NSRect(x: 0, y: 0, width: 640, height: 360))
        view.controlsStyle = .none
        let player = AVPlayer(url: URL(fileURLWithPath: CommandLine.arguments[1]))
        player.isMuted = true
        view.player = player
        window.contentView = view
        window.makeKeyAndOrderFront(nil)
        app.activate(ignoringOtherApps: true)
        Task { @MainActor in
            var ledger: [[String: Any]] = []
            let start = Date()
            while player.currentItem?.status != .readyToPlay && Date().timeIntervalSince(start) < 5
            {
                try? await Task.sleep(for: .milliseconds(20))
            }
            guard player.currentItem?.status == .readyToPlay else { exit(1) }
            player.play()
            for (label, target) in [("before", 0.5), ("gap", 2.0), ("after", 3.5)] {
                while player.currentTime().seconds < target && Date().timeIntervalSince(start) < 12
                {
                    try? await Task.sleep(for: .milliseconds(10))
                }
                let before = player.currentTime().seconds
                guard before >= target, before < target + 0.2 else { exit(1) }
                let process = Process()
                process.executableURL = URL(fileURLWithPath: "/usr/sbin/screencapture")
                process.arguments = [
                    "-x", "-o", "-l", String(window.windowNumber),
                    CommandLine.arguments[2] + "/" + label + ".png",
                ]
                do {
                    try process.run()
                    process.waitUntilExit()
                } catch { print(error) }
                guard process.terminationStatus == 0 else { exit(1) }
                ledger.append([
                    "label": label, "beforeCapture": before,
                    "afterCapture": player.currentTime().seconds,
                    "captureStatus": process.terminationStatus,
                ])
            }
            if let data = try? JSONSerialization.data(
                withJSONObject: ledger, options: [.prettyPrinted])
            {
                try? data.write(to: URL(fileURLWithPath: CommandLine.arguments[2] + "/window.json"))
            }
            player.pause()
            window.orderOut(nil)
            app.terminate(nil)
        }
        app.run()
    }
}
