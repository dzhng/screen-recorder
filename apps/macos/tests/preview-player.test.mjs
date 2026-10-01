import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { compileControlsCheck } from "./fixtures/swift-controls.mjs";

test(
  "native preview pins revision and stops on revocation, expiry, replacement and late replies",
  { timeout: 90_000 },
  () => {
    const scratch = mkdtempSync(join(tmpdir(), "screenrec-preview-player-"));
    try {
      const movie = join(scratch, "86ae8cb0-148c-4c4f-8e96-641494912911");
      execFileSync("ffmpeg", [
        "-v",
        "error",
        "-f",
        "lavfi",
        "-i",
        "testsrc2=size=320x180:rate=5",
        "-t",
        "2",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-f",
        "mp4",
        movie,
      ]);
      const sourceHash = createHash("sha256").update(readFileSync(movie)).digest("hex");
      const source = join(scratch, "Probe.swift");
      writeFileSync(
        source,
        `
import AppKit
import AVKit

struct Refused: LocalizedError { var errorDescription: String? { "NOT_FOUND: recording deleted" } }
@MainActor final class Service {
    var delayed = false
    var queued = true
    var deleted = false
    var expiresIn = 12.0
    var brokenFile = false
    var closed: [String] = []
    var serial = 0
    var lastToken = ""
    var renewals = 0
    var refuseRenewal = false
    let file: String
    init(_ file: String) { self.file = file }
    func call(_ operation: String, _ params: [String: Any]) async throws -> Data {
        if operation == "artifact.close" {
            closed.append(params["token"] as! String)
            return Data("{}".utf8)
        }
        if operation == "recording.get" {
            if deleted { throw Refused() }
            return Data("{}".utf8)
        }
        let bytes = (try FileManager.default.attributesOfItem(atPath: file)[.size] as! NSNumber).int64Value
        if operation == "artifact.renew" {
            renewals += 1
            if refuseRenewal { throw Refused() }
            return try JSONSerialization.data(withJSONObject: ["token": params["token"]!, "bytes": bytes,
                "expiresAt": (Date().timeIntervalSince1970 + 30) * 1000])
        }
        precondition(operation == "preview.get")
        if queued {
            queued = false
            return Data(#"{"recordingId":"take","revisionId":"r7","state":"processing"}"#.utf8)
        }
        precondition(params["revisionId"] as? String == "r7", "Follow-up must stay on pinned revision")
        serial += 1
        let token = "token-\\(serial)"
        lastToken = token
        if delayed { try await Task.sleep(for: .milliseconds(100)) }
        return try JSONSerialization.data(withJSONObject: ["recordingId": "take", "revisionId": "r7", "state": "ready",
            "delivery": ["token": token, "bytes": bytes, "expiresAt": (Date().timeIntervalSince1970 + expiresIn) * 1000],
            "published": ["preview": ["recordingId": "take", "revisionId": "r7", "mediaType": "video/mp4", "file": brokenFile ? file + "-missing" : file, "bytes": bytes]]])
    }
}
@main struct Probe {
    @MainActor static func settle() async { try? await Task.sleep(for: .milliseconds(180)) }
    @MainActor static func visible() -> NSWindow? { NSApp.windows.first { $0.isVisible && $0.title.hasPrefix("Preview —") } }
    @MainActor static func main() async throws {
        _ = NSApplication.shared
        NSApp.setActivationPolicy(.accessory)
        let service = Service(CommandLine.arguments[1])
        var failures: [String] = []
        let owner = PreviewController(call: service.call, failure: { failures.append($0) })
        owner.open(.recording("take"))
        await settle()
        owner.tick()
        await settle()
        guard let window = visible() else { preconditionFailure("Preview did not open: \\(failures)") }
        let view = window.contentView as! AVPlayerView
        let item = view.player!.currentItem!
        for _ in 0..<30 {
            if item.status != .unknown { break }
            await settle()
        }
        precondition(item.status == .readyToPlay, "Actual AVPlayer must decode extensionless cache MP4")
        precondition(window.title.contains("r7"))
        precondition(abs(CMTimeGetSeconds(item.duration) - 2) < 0.001)
        view.player!.pause()
        // Renewal extends the same lease, without replacing the pinned player/item.
        try await Task.sleep(for: .seconds(10))
        owner.tick(); await settle()
        precondition(service.renewals == 1 && view.player!.currentItem === item)
        try await Task.sleep(for: .seconds(3))
        owner.tick(); await settle()
        precondition(visible() === window && view.player!.currentItem === item,
            "Renewed lease must keep playback usable beyond the original expiry")
        service.deleted = true
        owner.tick(); await settle()
        precondition(visible() == nil && view.player == nil && service.closed.contains("token-1"))
        precondition(failures.last!.contains("NOT_FOUND"))
        service.deleted = false
        service.queued = true
        service.expiresIn = 0.05
        owner.open(.recording("take")); await settle(); owner.tick(); await settle(); owner.tick(); await settle()
        precondition(visible() == nil && failures.last!.contains("expired"))
        service.expiresIn = 30
        service.queued = true
        service.delayed = true
        owner.open(.recording("take")); await settle(); owner.tick()
        try await Task.sleep(for: .milliseconds(20))
        owner.close()
        await settle()
        precondition(visible() == nil && service.closed.contains(service.lastToken), "Late delivery must be released without reopening")
        service.delayed = false
        service.queued = true
        owner.open(.recording("take")); await settle(); owner.tick(); await settle()
        let replaced = visible()!
        let replacedView = replaced.contentView as! AVPlayerView
        let token = service.lastToken
        service.queued = true
        owner.open(.recording("take")); await settle()
        precondition(!replaced.isVisible && replacedView.player == nil && service.closed.contains(token))
        owner.tick(); await settle()
        let closing = visible()!
        let closingView = closing.contentView as! AVPlayerView
        closing.performClose(nil)
        await settle()
        precondition(!closing.isVisible && closingView.player == nil && service.closed.contains(service.lastToken))
        service.queued = true
        service.brokenFile = true
        let beforeFailure = failures.count
        owner.open(.recording("take")); await settle(); owner.tick()
        for _ in 0..<30 {
            if failures.count > beforeFailure { break }
            await settle()
        }
        precondition(failures.count > beforeFailure && visible() == nil
            && service.closed.contains(service.lastToken), "SDK playback failure must stop and release")
        service.queued = true
        service.brokenFile = false
        service.refuseRenewal = true
        owner.open(.recording("take")); await settle(); owner.tick(); await settle()
        precondition(visible() != nil)
        try await Task.sleep(for: .seconds(10))
        owner.tick(); await settle()
        precondition(visible() == nil && service.closed.contains(service.lastToken),
            "Renewal refusal must stop playback and release the old token")
        print("PASS extensionless native playback, pinned revision, renewal, revocation, expiry, late delivery, replacement, window close")
    }
}
`,
      );
      const binary = compileControlsCheck(
        scratch,
        ["PreviewController", "PreviewWindow"],
        readFileSync(source, "utf8"),
      );
      // Ordered in behind everything, like every other launch a check drives: this probe opens
      // real windows, and none of them may take the screen from whoever is at this Mac.
      const output = execFileSync(binary, [movie], {
        encoding: "utf8",
        timeout: 45_000,
        env: { ...process.env, SCREENREC_FIXTURE_CONTROLS: scratch },
      });
      assert.match(output, /PASS extensionless native playback/);
      assert.equal(createHash("sha256").update(readFileSync(movie)).digest("hex"), sourceHash);
      console.log(output.trim());
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  },
);
