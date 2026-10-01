import AppKit
import AVKit

/// Native presentation only. The preview controller owns readiness, identity and the delivery lease.
@MainActor
final class PreviewWindow: NSObject, PreviewPresenting, NSWindowDelegate {
    private var window: NSWindow?
    private var playerView: AVPlayerView?
    private var playerObservation: NSKeyValueObservation?
    private var message: NSTextField?
    private var retry: NSButton?
    private var onRetry: (@MainActor () -> Void)?
    private var onClose: (@MainActor () -> Void)?

    /// Checks that intentionally exercise real windows keep them behind the person's work.
    private static let observed = !(ProcessInfo.processInfo.environment["SCREENREC_FIXTURE_CONTROLS"] ?? "")
        .isEmpty

    func open(title: String, retry onRetry: @escaping @MainActor () -> Void,
        closed onClose: @escaping @MainActor () -> Void)
    {
        self.onRetry = onRetry
        self.onClose = onClose
        let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 800, height: 500),
            styleMask: [.titled, .closable, .resizable, .miniaturizable], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false
        window.delegate = self
        window.title = title
        // Watching an earlier take must stay out of every capture, including one already running.
        window.sharingType = .none
        let view = AVPlayerView(frame: window.contentView!.bounds)
        view.autoresizingMask = [.width, .height]
        view.controlsStyle = .floating
        view.showsSharingServiceButton = false
        view.allowsVideoFrameAnalysis = false
        window.contentView = view
        let label = NSTextField(wrappingLabelWithString: "Preparing preview…")
        label.frame = NSRect(x: 24, y: 220, width: 752, height: 60)
        label.autoresizingMask = [.width, .minYMargin, .maxYMargin]
        label.alignment = .center
        label.textColor = .white
        view.addSubview(label)
        let button = NSButton(title: "Retry Preview", target: self, action: #selector(retryPreview))
        button.frame = NSRect(x: 330, y: 180, width: 140, height: 32)
        button.autoresizingMask = [.minXMargin, .maxXMargin, .minYMargin, .maxYMargin]
        button.isHidden = true
        view.addSubview(button)
        self.window = window
        playerView = view
        message = label
        retry = button
        window.center()
        // An ordinary user preview comes forward; an explicit window check never takes focus.
        if Self.observed {
            window.orderBack(nil)
        } else {
            window.makeKeyAndOrderFront(nil)
            NSApp.activate(ignoringOtherApps: true)
        }
    }

    func show(title: String, message: String, canRetry: Bool) {
        window?.title = title
        self.message?.stringValue = message
        self.message?.isHidden = false
        retry?.isHidden = !canRetry
    }

    func play(title: String, file: String, mediaType: String,
        failed: @escaping @MainActor (String) -> Void)
    {
        window?.title = title
        message?.isHidden = true
        retry?.isHidden = true
        // Cache names describe ownership, not containers; use the validated receipt's MIME type.
        let asset = AVURLAsset(url: URL(fileURLWithPath: file),
            options: [AVURLAssetOverrideMIMETypeKey: mediaType])
        let item = AVPlayerItem(asset: asset)
        playerObservation = item.observe(\.status, options: [.new]) { item, _ in
            guard item.status == .failed else { return }
            let reason = item.error?.localizedDescription ?? "Preview playback failed."
            Task { @MainActor in failed(reason) }
        }
        playerView?.player = AVPlayer(playerItem: item)
        playerView?.player?.play()
    }

    func close() {
        playerObservation = nil
        playerView?.player?.pause()
        playerView?.player?.replaceCurrentItem(with: nil)
        playerView?.player = nil
        window?.delegate = nil
        window?.close()
        window = nil
        playerView = nil
        message = nil
        retry = nil
        onRetry = nil
        onClose = nil
    }

    func windowWillClose(_ notification: Notification) {
        guard notification.object as? NSWindow === window else { return }
        onClose?()
    }

    @objc private func retryPreview() { onRetry?() }
}
