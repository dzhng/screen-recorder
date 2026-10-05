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
  "production Sparkle boundary persists preferences and completes no-update checks",
  { timeout: 60000 },
  (t) => {
    const scratch = mkdtempSync(join(tmpdir(), "screenrec-sparkle-check-"));
    const token = randomUUID();
    const identity = `dev.screenrec.sparkle-proof.${token}`;
    const lockRelative = `Library/Caches/screenrec-sparkle-check-${token}/launch.lock`;
    // Foundation and the installer use the account home, not an overridden HOME.
    const accountCache = join(userInfo().homedir, dirname(lockRelative));
    t.after(() => {
      spawnSync("/usr/bin/defaults", ["delete", identity], { encoding: "utf8" });
      rmSync(accountCache, { recursive: true, force: true });
      rmSync(scratch, { recursive: true, force: true });
    });
    const framework = realpathSync(process.env.SCREENREC_SPARKLE_FRAMEWORK || defaultFramework);
    const app = join(scratch, "SparkleCheck.app");
    const contents = join(app, "Contents");
    const executable = join(contents, "MacOS", "SparkleCheck");
    mkdirSync(dirname(executable), { recursive: true });
    const metadata = {
      CFBundleIdentifier: identity,
      CFBundleName: "SparkleCheck",
      CFBundleExecutable: "SparkleCheck",
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
    @MainActor static func main() async {
        NSApplication.shared.setActivationPolicy(.prohibited)
        // Keep scheduled networking out of this SDK callback/preference fixture.
        let preferences = UserDefaults.standard
        preferences.set(Date(), forKey: "SULastCheckTime")
        preferences.set(true, forKey: "SUHasLaunchedBefore")
        preferences.synchronize()
        let owner = UpdateCoordinator(blockers: { [] }, fence: { _ in }, changed: {})
        guard let driver = SparkleDriver(owner: owner, terminate: { exit(2) }), owner.available else {
            print(owner.status); exit(1)
        }
        let before = owner.enabled
        switch CommandLine.arguments.last {
        case "disable": owner.setEnabled(false)
        case "enable": owner.setEnabled(true)
        case "no-update", "wrong-domain", "download-error", "recovered-no-update":
            let updater = SPUUpdater(hostBundle: .main, applicationBundle: .main,
                userDriver: driver, delegate: driver)
            if CommandLine.arguments.last == "recovered-no-update" {
                owner.candidate(version: "0.1.1")
                driver.updater(updater, didFinishUpdateCycleFor: .updatesInBackground,
                    error: NSError(domain: SUSparkleErrorDomain, code: Int(SUError.downloadError.rawValue)))
                for _ in 0..<200 {
                    if owner.status.state == "failed" { break }
                    try? await Task.sleep(for: .milliseconds(10))
                }
            }
            try! driver.updater(updater, mayPerform: .updatesInBackground)
            let error = NSError(
                domain: CommandLine.arguments.last == "wrong-domain" ? "test.other-domain" : SUSparkleErrorDomain,
                code: Int(CommandLine.arguments.last == "download-error"
                    ? SUError.downloadError.rawValue : SUError.noUpdateError.rawValue),
                userInfo: [NSLocalizedDescriptionKey: "Localized result"])
            if CommandLine.arguments.last == "no-update" || CommandLine.arguments.last == "recovered-no-update" {
                driver.showUpdateNotFoundWithError(error, acknowledgement: {})
            }
            driver.updater(updater, didFinishUpdateCycleFor: .updatesInBackground, error: error)
            for _ in 0..<200 {
                if owner.status.state != "checking" { break }
                try? await Task.sleep(for: .milliseconds(10))
            }
            let data = try! JSONSerialization.data(withJSONObject: owner.status.parameters)
            print(String(decoding: data, as: UTF8.self))
            withExtendedLifetime(driver) {}
            return
        default: break
        }
        // Flush SDK preference writes; only the SDK changes the enabled toggle.
        UserDefaults.standard.synchronize()
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
    assert.deepEqual(observe("no-update"), {
      update: { state: "idle", availableVersion: null, blockers: [], error: null },
    });
    for (const mode of ["wrong-domain", "download-error"]) {
      assert.deepEqual(observe(mode), {
        update: {
          state: "failed",
          availableVersion: null,
          blockers: [],
          error: { code: "UPDATE_FAILED", message: "Localized result", retryable: false },
        },
      });
    }
    assert.deepEqual(observe("recovered-no-update"), {
      update: { state: "idle", availableVersion: null, blockers: [], error: null },
    });
  },
);
