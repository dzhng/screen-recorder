import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { frameworkIdentity } from "./sparkle/framework.mjs";
export const releaseFeedURL =
  "https://github.com/dzhng/screen-recorder/releases/latest/download/appcast.xml";
export const launchLockRelativePath = "Library/Caches/com.david.screenrec/launch.lock";
export async function bundleFacts(root) {
  const { version } = JSON.parse(readFileSync(join(root, "apps/macos/package.json")));
  const { catalogFormat } = await import(
    pathToFileURL(join(root, "packages/core/dist/catalog.js"))
  );
  if (!Number.isSafeInteger(catalogFormat) || catalogFormat < 1)
    throw new Error("Core does not export its catalog format");
  const revision = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  return { version, revision, catalogFormat };
}
export function verifiedFramework(root, env = process.env) {
  const framework = env.SCREENREC_SPARKLE_FRAMEWORK ?? join(root, "dist/sparkle/Sparkle.framework");
  const receipt = JSON.parse(readFileSync(join(framework, "../build-receipt.json")));
  const pin = JSON.parse(readFileSync(join(root, "scripts/sparkle/upstream.json")));
  if (
    receipt.inputs.commit !== pin.commit ||
    receipt.inputs.patchSha256 !== pin.patchSha256 ||
    frameworkIdentity(framework).sha256 !== receipt.framework.sha256
  )
    throw new Error("Sparkle framework does not match its pinned build receipt");
  return { framework, receipt };
}
export function configureReleasePlist(plist, facts, publicKey) {
  const fields = {
    CFBundleVersion: ["string", facts.version],
    CFBundleShortVersionString: ["string", facts.version],
    ScreenrecCatalogFormat: ["integer", facts.catalogFormat],
    ScreenrecLaunchLockRelativePath: ["string", launchLockRelativePath],
    SUFeedURL: ["string", releaseFeedURL],
    SUPublicEDKey: ["string", publicKey],
    SURequireSignedFeed: ["bool", true],
    SUVerifyUpdateBeforeExtraction: ["bool", true],
    SUSignedFeedFailureExpirationInterval: ["real", 0],
    SUEnableAutomaticChecks: ["bool", true],
    SUAllowsAutomaticUpdates: ["bool", false],
    SUAutomaticallyUpdate: ["bool", false],
  };
  for (const [name, [type, value]] of Object.entries(fields)) {
    try {
      execFileSync("/usr/libexec/PlistBuddy", ["-c", `Delete :${name}`, plist], {
        stdio: "ignore",
      });
    } catch {}
    execFileSync("/usr/libexec/PlistBuddy", ["-c", `Add :${name} ${type} ${value}`, plist]);
  }
}
