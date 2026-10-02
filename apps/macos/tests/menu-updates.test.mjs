import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

// Compile the real adapter against the real controls module. This exercises NSMenu identity,
// without launching the app, drawing a schematic menu, or invoking capture.
test(
  "storage observations preserve unrelated NSMenu identities and changed recording IDs replace them",
  { timeout: 60_000 },
  () => {
    const scratch = mkdtempSync(join(tmpdir(), "screenrec-menu-update-"));
    const sources = fileURLToPath(new URL("../Sources/", import.meta.url));
    try {
      const controls = join(sources, "ScreenRecorderControls");
      execFileSync(
        "swiftc",
        [
          "-emit-library",
          "-emit-module",
          "-module-name",
          "ScreenRecorderControls",
          "-emit-module-path",
          join(scratch, "ScreenRecorderControls.swiftmodule"),
          "-o",
          join(scratch, "libScreenRecorderControls.dylib"),
          ...readdirSync(controls)
            .filter((name) => name.endsWith(".swift"))
            .map((name) => join(controls, name)),
        ],
        { timeout: 30_000, stdio: "pipe" },
      );
      const main = join(scratch, "main.swift");
      writeFileSync(
        main,
        `
import AppKit
import ScreenRecorderControls
@MainActor final class Target: NSObject {
    @objc func choose(_ sender: NSMenuItem) {}
}
@main struct Probe {
@MainActor static func main() {
let target = Target()
let menu = NSMenu()
var state = ControlsState()
state.service = .ready
state.library.recent = [.init(recordingId: "first", createdAt: "2026-09-16T09:00:00Z",
    state: "complete", sourceDurationUs: 1, interruptionReason: nil)]
state.storageRefreshing = true
var entries = RecordingMenu.entries(for: state)
StatusMenu.apply(entries, to: menu, target: target, action: #selector(Target.choose(_:)))
let recent = menu.items.first { $0.title == "Recent Recordings" }!.submenu!
let first = recent.items[0].submenu!
let action = first.items.first { StatusMenu.action(of: $0) == .deleteRecording("first") }!
state.storageRefreshing = false
state.storage = .init(totalBytes: 12000, observedAt: "2026-09-16T09:01:00.000Z")
let observed = RecordingMenu.entries(for: state)
StatusMenu.apply(observed, to: menu, target: target, action: #selector(Target.choose(_:)), previous: entries)
precondition(menu.items.first { $0.title == "Recent Recordings" }!.submenu === recent,
    "Storage completion must preserve the tracked recent submenu")
precondition(recent.items[0].submenu === first && first.items.contains { $0 === action },
    "The selected recording and action objects remain unchanged")
precondition(StatusMenu.action(of: action) == .deleteRecording("first"))
entries = observed
state.library.recent = [.init(recordingId: "replacement", createdAt: "2026-09-16T09:02:00Z",
    state: "complete", sourceDurationUs: 1, interruptionReason: nil)]
StatusMenu.apply(RecordingMenu.entries(for: state), to: menu, target: target,
    action: #selector(Target.choose(_:)), previous: entries)
let replacement = menu.items.first { $0.title == "Recent Recordings" }!.submenu!.items[0].submenu!
precondition(replacement !== first, "An open submenu must never be repurposed to a different recording")
precondition(StatusMenu.action(of: action) == .deleteRecording("first"), "The old action never changes identity")
precondition(replacement.items.contains { StatusMenu.action(of: $0) == .deleteRecording("replacement") })
print("PASS native menu identity follows explicit recording actions")
}
}
`,
      );
      const executable = join(scratch, "menu-test");
      execFileSync(
        "swiftc",
        [
          "-parse-as-library",
          "-I",
          scratch,
          "-L",
          scratch,
          "-lScreenRecorderControls",
          "-Xlinker",
          "-rpath",
          "-Xlinker",
          scratch,
          join(sources, "ScreenRecorder", "StatusMenu.swift"),
          main,
          "-o",
          executable,
        ],
        { timeout: 30_000, stdio: "pipe" },
      );
      assert.match(
        execFileSync(executable, [], { encoding: "utf8", timeout: 5_000 }),
        /PASS native menu identity/,
      );
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  },
);
