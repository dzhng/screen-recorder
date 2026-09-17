import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { RevisionStore } from "@screenrec/core/library";
import { page, journalRows } from "./fixtures/generated-capture.mjs";

const root = fileURLToPath(new URL("../../../", import.meta.url));
test(
  "native player consumes the bundled service's pinned preview and renewable lease",
  { timeout: 100000 },
  async () => {
    const home = await mkdtemp("/tmp/screenrec-player-service-");
    let safeToRemove = true;
    try {
      const store = new RevisionStore(join(home, "library.sqlite"), {
        now: () => new Date().toISOString(),
        newId: randomUUID,
      });
      const take = store.allocate().recording;
      store.ingestLifecycle(take.recordingId, {
        sourceId: take.sourceId,
        sequence: 1,
        state: "interrupted",
        reason: "Generated silent playback fixture",
        sourceDurationUs: 8000000,
      });
      store.close();
      const source = join(home, "recordings", take.recordingId, "source");
      await mkdir(source, { recursive: true });
      const movie = join(source, "video.mov");
      execFileSync(
        "ffmpeg",
        [
          "-nostdin",
          "-v",
          "error",
          "-f",
          "rawvideo",
          "-pix_fmt",
          "rgb24",
          "-s",
          "1280x800",
          "-r",
          "1",
          "-i",
          "pipe:0",
          "-vf",
          "tpad=stop_mode=clone:stop_duration=7",
          "-an",
          "-c:v",
          "libx264",
          "-pix_fmt",
          "yuv420p",
          movie,
        ],
        { input: page(false), timeout: 20000 },
      );
      const samples = [
        [500000, 800, 470],
        [1500000, 950, 460],
        [3100000, 360, 320],
      ].map(([sourceUs, x, y]) => ({
        sourceUs,
        x,
        y,
        globalX: x,
        globalY: y,
        buttons: 0,
        eligibility: "inside",
        geometryEpoch: 1,
      }));
      const rows = journalRows({ sourceId: take.sourceId, width: 1280, height: 800, samples });
      await writeFile(
        join(source, "capture.journal.jsonl"),
        rows.map((row, i) => JSON.stringify({ sequence: i + 1, ...row }) + "\n").join(""),
      );
      const original = createHash("sha256")
        .update(await readFile(movie))
        .digest("hex");
      const swift = join(home, "Integration.swift");
      await writeFile(
        swift,
        `
import AppKit
import AVKit
import Foundation
import CryptoKit

@MainActor final class Bridge {
    var state: ServiceHost.State = .starting
}
@main struct Integration {
    @MainActor static func main() {
        let app = NSApplication.shared
        Task { @MainActor in
            do { try await runIntegration(); app.terminate(nil) }
            catch {
                FileHandle.standardError.write(Data("Integration failed: \\(error)\\n".utf8))
                exit(1)
            }
        }
        app.run()
    }
    @MainActor static func pause() async { try? await Task.sleep(for: .milliseconds(100)) }
    @MainActor static func visible() -> NSWindow? { NSApp.windows.first { $0.isVisible && $0.title.hasPrefix("Preview —") } }
    @MainActor static func runIntegration() async throws {
        _ = NSApplication.shared
        NSApp.setActivationPolicy(.accessory)
        let bundle = Bundle(path: CommandLine.arguments[1])!
        let resolved: ServiceBundle = try await withCheckedThrowingContinuation { continuation in
            ServiceBundle.resolve(in: bundle) { continuation.resume(with: $0) }
        }
        let bridge = Bridge()
        let host = ServiceHost(
            bundle: resolved,
            onNativeCall: { _, _, answer in
                answer(.failure(ServiceFailure(code: "UNKNOWN_OPERATION", message: "This check owns no capture session")))
            }
        ) { state in Task { @MainActor in bridge.state = state } }
        host.start()
        defer { host.shutdown() }
        var ready = false
        for _ in 0..<100 {
            if case .ready = bridge.state { ready = true; break }
            if case .unavailable(let code, let message) = bridge.state { fatalError("\\(code): \\(message)") }
            await pause()
        }
        precondition(ready, "Bundled service did not become ready")
        if case .ready(let pid, _) = bridge.state {
            FileHandle.standardOutput.write(Data("SERVICE_PID=\\(pid)\\n".utf8))
        }
        var failures: [String] = []
        let owner = PreviewController(call: { try await host.call($0, $1) }, failure: { failures.append($0) })
        defer { owner.close() }
        let id = CommandLine.arguments[2]
        owner.open(id)
        var item: AVPlayerItem?
        for _ in 0..<150 {
            owner.tick(); await pause()
            precondition(failures.isEmpty, "Preview failed: \\(failures)")
            if let candidate = (visible()?.contentView as? AVPlayerView)?.player?.currentItem,
                candidate.status == .readyToPlay { item = candidate; break }
        }
        guard let item, let window = visible(), let view = window.contentView as? AVPlayerView else {
            fatalError("Actual service preview never became playable")
        }
        precondition(window.title.hasSuffix("r0"))
        precondition(abs(CMTimeGetSeconds(item.duration)-8) < 0.001)
        precondition(!view.allowsVideoFrameAnalysis)
        view.player!.pause()
        _ = try await host.call("edit.cut", ["recordingId":id,"requestId":UUID().uuidString,
            "expectedRevisionId":"r0","ranges":[["startUs":2000000,"endUs":4000000]]])
        // The real service lease initially lasts 30s. Paused playback must retain its
        // original item past that deadline while the current library edit advances.
        let until = Date().addingTimeInterval(31)
        while Date() < until {
            owner.tick(); await pause()
            precondition(failures.isEmpty && visible() === window && view.player?.currentItem === item,
                "Pinned player changed or lost its renewed lease")
        }
        precondition(window.title.hasSuffix("r0") && abs(CMTimeGetSeconds(item.duration)-8) < 0.001)
        let current = try JSONSerialization.jsonObject(with: await host.call("revision.get", ["recordingId":id])) as! [String:Any]
        precondition((current["revision"] as! [String:Any])["durationUs"] as! Int == 6000000)
        let asset = item.asset as! AVURLAsset
        precondition(FileManager.default.fileExists(atPath: asset.url.path))
        let hash = SHA256.hash(data: try Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[3])))
            .map { String(format: "%02x", $0) }.joined()
        precondition(hash == CommandLine.arguments[4], "Source changed during native playback")
        print("PASS pinned native player past original lease deadline; current edit is 6s")
        _ = try await host.call("recording.delete", ["recordingId":id])
        for _ in 0..<30 { owner.tick(); await pause(); if visible() == nil { break } }
        precondition(visible() == nil && view.player == nil)
        precondition(!FileManager.default.fileExists(atPath: asset.url.path))
        precondition(failures.last?.contains("NOT_FOUND") == true)
        print("PASS real deletion stops player and removes cached media")
    }
}
`,
      );
      const binary = join(home, "player-integration");
      execFileSync(
        "swiftc",
        [
          "-swift-version",
          "6",
          "-parse-as-library",
          ...["PreviewController", "ServiceHost", "ServiceBundle", "NodeRuntime"].map((name) =>
            join(root, "apps/macos/Sources/ScreenRecorder", name + ".swift"),
          ),
          swift,
          "-o",
          binary,
        ],
        { timeout: 40000 },
      );
      safeToRemove = false;
      const result = await new Promise((resolve, reject) => {
        const child = spawn(
          binary,
          [join(root, "dist/ScreenRecorder.app"), take.recordingId, movie, original],
          { env: { ...process.env, SCREENREC_HOME: home }, stdio: ["ignore", "pipe", "pipe"] },
        );
        let stdout = "",
          stderr = "";
        child.stdout.on("data", (chunk) => {
          stdout += chunk;
        });
        child.stderr.on("data", (chunk) => {
          stderr += chunk;
        });
        child.once("error", reject);
        const timeout = setTimeout(() => child.kill("SIGKILL"), 55000);
        child.once("close", (code, signal) => {
          clearTimeout(timeout);
          resolve({ code, signal, stdout, stderr });
        });
      });
      const pid = Number(result.stdout.match(/SERVICE_PID=(\d+)/)?.[1]);
      assert.ok(Number.isInteger(pid) && pid > 0, result.stderr + result.stdout);
      const alive = () => {
        if (!pid) return false;
        try {
          process.kill(pid, 0);
          return true;
        } catch (error) {
          if (error.code === "ESRCH") return false;
          throw error;
        }
      };
      for (let attempts = 0; alive() && attempts < 100; attempts++)
        await new Promise((resolve) => setTimeout(resolve, 100));
      assert.equal(alive(), false, "Owned service must exit before removing its home");
      safeToRemove = true;
      assert.equal(result.code, 0, result.stderr + result.stdout);
      assert.match(result.stdout, /PASS real deletion stops player/);
      console.log(result.stdout.trim());
    } finally {
      if (safeToRemove) await rm(home, { recursive: true, force: true });
    }
  },
);
