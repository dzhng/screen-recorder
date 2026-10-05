import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir, userInfo } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const sources = fileURLToPath(new URL("../Sources/ScreenRecorder/", import.meta.url));
const defaultFramework = fileURLToPath(
  new URL("../../../dist/sparkle/Sparkle.framework", import.meta.url),
);

test(
  "production Sparkle setter persists opt-out and re-enable across fresh processes",
  { timeout: 60000 },
  (t) => {
    const scratch = mkdtempSync(join(tmpdir(), "screenrec-update-preference-"));
    const token = randomUUID();
    const identity = `dev.screenrec.preference-proof.${token}`;
    const lockRelative = `Library/Caches/screenrec-update-preference-${token}/launch.lock`;
    // Foundation and the installer use the account home, not an overridden HOME.
    const accountCache = join(userInfo().homedir, dirname(lockRelative));
    t.after(() => {
      spawnSync("/usr/bin/defaults", ["delete", identity], { encoding: "utf8" });
      rmSync(accountCache, { recursive: true, force: true });
      rmSync(scratch, { recursive: true, force: true });
    });
    const framework = realpathSync(process.env.SCREENREC_SPARKLE_FRAMEWORK || defaultFramework);
    const app = join(scratch, "PreferenceCheck.app");
    const contents = join(app, "Contents");
    const executable = join(contents, "MacOS", "PreferenceCheck");
    mkdirSync(dirname(executable), { recursive: true });
    const metadata = {
      CFBundleIdentifier: identity,
      CFBundleName: "PreferenceCheck",
      CFBundleExecutable: "PreferenceCheck",
      CFBundlePackageType: "APPL",
      CFBundleVersion: "0.1.0",
      CFBundleShortVersionString: "0.1.0",
      LSUIElement: true,
      LSMinimumSystemVersion: "26.0",
      SUFeedURL: "https://updates.example.invalid/appcast.xml",
      SUPublicEDKey: "EGUShmh3L5OimwAOcvpXHNo4JVindlgCtBbBzIjrhrg=",
      SURequireSignedFeed: true,
      SUVerifyUpdateBeforeExtraction: true,
      SUSignedFeedFailureExpirationInterval: 0,
      SUEnableAutomaticChecks: true,
      SUAllowsAutomaticUpdates: false,
      SUAutomaticallyUpdate: false,
      ScreenrecCatalogFormat: 23,
      ScreenrecLaunchLockRelativePath: lockRelative,
    };
    const plist = join(contents, "Info.plist");
    writeFileSync(plist, JSON.stringify(metadata));
    const conversion = spawnSync("/usr/bin/plutil", ["-convert", "xml1", plist], {
      encoding: "utf8",
    });
    assert.equal(conversion.status, 0, conversion.stdout + conversion.stderr);
    const main = join(scratch, "Main.swift");
    writeFileSync(
      main,
      `
import AppKit
import Foundation
import Sparkle
func diagnostic(_ message: String) {}
@main struct Check {
    @MainActor static func main() {
        NSApplication.shared.setActivationPolicy(.prohibited)
        let owner = UpdateCoordinator(blockers: { [] }, fence: { _ in }, changed: {})
        guard let driver = SparkleDriver(owner: owner, terminate: { exit(2) }), owner.available else {
            print(owner.status); exit(1)
        }
        let before = owner.enabled
        switch CommandLine.arguments.last {
        case "disable": owner.setEnabled(false)
        case "enable": owner.setEnabled(true)
        default: break
        }
        // Flush the real SDK's writes; never set a preference key from the fixture.
        UserDefaults(suiteName: Bundle.main.bundleIdentifier!)?.synchronize()
        let result: [String: Any] = ["before": before, "after": owner.enabled, "state": owner.status.state]
        let data = try! JSONSerialization.data(withJSONObject: result)
        print(String(decoding: data, as: UTF8.self))
        withExtendedLifetime(driver) {}
    }
}
`,
    );
    const compile = spawnSync(
      "swiftc",
      [
        "-swift-version",
        "6",
        "-parse-as-library",
        "-F",
        dirname(framework),
        "-framework",
        "Sparkle",
        "-Xlinker",
        "-rpath",
        "-Xlinker",
        dirname(framework),
        ...[
          "SparkleDriver",
          "UpdateCoordinator",
          "ServiceHost",
          "ServiceBundle",
          "NodeRuntime",
        ].map((name) => join(sources, `${name}.swift`)),
        main,
        "-o",
        executable,
      ],
      { encoding: "utf8", timeout: 60000 },
    );
    assert.equal(compile.status, 0, compile.stdout + compile.stderr);
    const observe = (mode) => {
      const child = spawnSync(executable, [mode], {
        encoding: "utf8",
        timeout: 10000,
        env: {
          ...process.env,
          HOME: join(scratch, "home"),
          SCREENREC_HOME: join(scratch, "library"),
          SCREENREC_DEFAULTS: join(scratch, "defaults"),
        },
      });
      assert.equal(child.status, 0, child.stdout + child.stderr);
      return JSON.parse(child.stdout);
    };
    assert.deepEqual(observe("disable"), { before: true, after: false, state: "disabled" });
    assert.deepEqual(observe("observe"), { before: false, after: false, state: "disabled" });
    assert.deepEqual(observe("enable"), { before: false, after: true, state: "idle" });
    assert.deepEqual(observe("observe"), { before: true, after: true, state: "idle" });
  },
);
