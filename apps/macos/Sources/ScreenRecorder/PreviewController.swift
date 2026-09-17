import AppKit
import AVKit

/// One native view of a pinned service derivative. The delivery lease owns the cache file;
/// this owner holds no copied movie, edit plan, or rendering job.
@MainActor
final class PreviewController: NSObject, NSWindowDelegate {
    typealias Call = @MainActor (String, [String: Any]) async throws -> Data
    private let call: Call
    private let failure: (String) -> Void
    private var generation = UUID()
    private var recordingId: String?
    private var revisionId: String?
    private var lease: Lease?
    private var renewAt = Date.distantPast
    private var reading = false
    private var window: NSWindow?
    private var playerView: AVPlayerView?
    private var playerObservation: NSKeyValueObservation?
    private var message: NSTextField?
    private var retry: NSButton?
    private var requestOperation = "preview.get"
    private var polling = false

    init(call: @escaping Call, failure: @escaping (String) -> Void) {
        self.call = call
        self.failure = failure
    }

    func open(_ id: String) {
        close()
        recordingId = id
        polling = true
        requestOperation = "preview.get"
        let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 800, height: 500),
            styleMask: [.titled, .closable, .resizable, .miniaturizable], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false
        window.delegate = self
        window.title = "Preparing Preview — \(id)"
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
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        tick()
    }

    func close(recording id: String? = nil) {
        if let id, id != recordingId { return }
        generation = UUID()
        recordingId = nil
        revisionId = nil
        polling = false
        reading = false
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
        if let token = lease?.token { release(token) }
        lease = nil
    }

    func windowWillClose(_ notification: Notification) { close() }

    /// Driven by the controls' status cadence. Expiry is checked even with a request in flight;
    /// no renewal response may revive a session that was closed while awaiting the service.
    func tick() {
        guard let id = recordingId else { return }
        if let lease, lease.expiresAt <= Date().timeIntervalSince1970 * 1000 {
            stop("Preview lease expired. Open Preview again to continue.")
            return
        }
        guard !reading else { return }
        reading = true
        let current = generation
        let pinnedRevision = revisionId
        let currentLease = lease
        Task { @MainActor in
            do {
                if !polling || currentLease != nil {
                    _ = try await call("recording.get", ["recordingId": id])
                    guard generation == current else { return }
                    guard let currentLease, Date() >= renewAt else { reading = false; return }
                    let data = try await call("artifact.renew", ["token": currentLease.token])
                    let renewed = try JSONDecoder().decode(Lease.self, from: data)
                    guard generation == current else { return }
                    guard currentLease.expiresAt > Date().timeIntervalSince1970 * 1000,
                        renewed.token == currentLease.token, renewed.bytes == currentLease.bytes,
                        renewed.expiresAt > Date().timeIntervalSince1970 * 1000 else {
                        throw InvalidAnswer()
                    }
                    lease = renewed
                    renewAt = Date().addingTimeInterval(10)
                } else {
                    var params: [String: Any] = ["recordingId": id]
                    if let pinnedRevision { params["revisionId"] = pinnedRevision }
                    let data = try await call(requestOperation, params)
                    // Decode the lease separately so a late or otherwise invalid ready answer
                    // releases the service pin rather than leaving it until expiration.
                    let delivered = try? JSONDecoder().decode(Delivery.self, from: data).delivery
                    guard generation == current else {
                        if let delivered { release(delivered.token) }
                        return
                    }
                    do {
                        let answer = try JSONDecoder().decode(Answer.self, from: data)
                        guard answer.recordingId == id, !answer.revisionId.isEmpty,
                            pinnedRevision == nil || pinnedRevision == answer.revisionId else {
                            throw InvalidAnswer()
                        }
                        revisionId = answer.revisionId
                        requestOperation = "preview.get"
                        window?.title = "Preview — \(id) — \(answer.revisionId)"
                        if answer.state == "ready" {
                            guard let movie = answer.published?.preview, let delivered,
                                movie.recordingId == id, movie.revisionId == answer.revisionId,
                                movie.mediaType == "video/mp4", movie.bytes > 0,
                                !delivered.token.isEmpty, delivered.bytes == movie.bytes,
                                delivered.expiresAt > Date().timeIntervalSince1970 * 1000,
                                movie.file.hasPrefix("/") else { throw InvalidAnswer() }
                            lease = delivered
                            renewAt = Date().addingTimeInterval(10)
                            polling = false
                            message?.isHidden = true
                            // Cache filenames describe ownership, not container type. Tell AVFoundation
                            // the validated receipt's MIME type instead of relying on an extension.
                            let asset = AVURLAsset(url: URL(fileURLWithPath: movie.file),
                                options: [AVURLAssetOverrideMIMETypeKey: movie.mediaType])
                            let item = AVPlayerItem(asset: asset)
                            playerObservation = item.observe(\.status, options: [.new]) { [weak self] item, _ in
                                guard item.status == .failed else { return }
                                let reason = item.error?.localizedDescription ?? "Preview playback failed."
                                Task { @MainActor in
                                    guard let self, self.generation == current else { return }
                                    self.stop(reason)
                                }
                            }
                            playerView?.player = AVPlayer(playerItem: item)
                            playerView?.player?.play()
                        } else if delivered != nil {
                            throw InvalidAnswer()
                        } else if answer.state == "failed" || answer.state == "not_requested" || answer.state == "unavailable" {
                            polling = false
                            message?.stringValue = answer.reason ?? "Preview could not be prepared."
                            retry?.isHidden = answer.dependency != nil || answer.retryable != true
                        } else if answer.state == "queued" || answer.state == "processing" {
                            message?.stringValue = "Preparing preview — \(answer.state)…"
                        } else {
                            throw InvalidAnswer()
                        }
                    } catch {
                        if let delivered { release(delivered.token) }
                        throw error
                    }
                }
            } catch {
                if generation == current { stop(error.localizedDescription) }
            }
            if generation == current { reading = false }
        }
    }

    @objc private func retryPreview() {
        guard recordingId != nil, revisionId != nil, !reading else { return }
        retry?.isHidden = true
        message?.stringValue = "Retrying preview…"
        requestOperation = "preview.retry"
        polling = true
        tick()
    }

    private func stop(_ reason: String) {
        close()
        failure(reason)
    }

    private func release(_ token: String) {
        Task { @MainActor [call] in _ = try? await call("artifact.close", ["token": token]) }
    }

    private struct InvalidAnswer: LocalizedError {
        var errorDescription: String? { "The service returned an invalid preview receipt." }
    }
    private struct Lease: Decodable {
        let token: String
        let bytes: Int64
        let expiresAt: Double
    }
    private struct Delivery: Decodable { let delivery: Lease? }
    private struct Answer: Decodable {
        let recordingId: String
        let revisionId: String
        let state: String
        let reason: String?
        let retryable: Bool?
        let dependency: Dependency?
        let published: Published?
        struct Dependency: Decodable { let artifact: String }
        struct Published: Decodable { let preview: Movie }
        struct Movie: Decodable {
            let recordingId: String
            let revisionId: String
            let file: String
            let mediaType: String
            let bytes: Int64
        }
    }
}
