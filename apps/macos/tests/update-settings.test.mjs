import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { compileControlsCheck } from "./fixtures/swift-controls.mjs";

test("settings delegates opt-out to the updater and reflects only its effective state", () => {
  const scratch = mkdtempSync(join(tmpdir(), "screenrec-update-settings-"));
  try {
    const executable = compileControlsCheck(
      scratch,
      ["SettingsWindow"],
      String.raw`
import AppKit
import ScreenRecorderControls

enum ControlsProbe { static let observed = true }
@main struct Check {
    @MainActor static func main() {
        let suite = CommandLine.arguments[1]
        let defaults = UserDefaults(suiteName: suite)!
        let preferences = Preferences(defaults: defaults)
        var actions: [ControlsAction] = []
        let model = SettingsModel(preferences: preferences, perform: { actions.append($0) })
        let before = defaults.persistentDomain(forName: suite)
        model.state.updates = UpdateControls(available: true, enabled: true, status: "An update is waiting for recording and background work to finish.")
        model.setAutomaticUpdates(false)
        precondition(actions == [.setAutomaticUpdates(false)])
        precondition(model.state.updates.enabled, "The checkbox waits for its owner's effective state")
        precondition(NSDictionary(dictionary: defaults.persistentDomain(forName: suite) ?? [:]).isEqual(to: before ?? [:]), "Settings does not write another preference")
        model.state.updates = UpdateControls(available: true, enabled: false)
        model.setAutomaticUpdates(true)
        precondition(actions == [.setAutomaticUpdates(false), .setAutomaticUpdates(true)])
        model.state.updates = UpdateControls()
        model.setAutomaticUpdates(true)
        precondition(actions.count == 2, "Personal/source builds cannot request an updater action")
        print("PASS settings delegates update changes and displays effective owner state")
    }
}
`,
    );
    const output = execFileSync(executable, [join(scratch, "defaults")], { encoding: "utf8" });
    assert.match(output, /PASS settings delegates update changes/);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});
