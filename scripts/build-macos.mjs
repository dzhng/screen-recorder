import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { bundleFacts, verifiedFramework } from "./release-info.mjs";
import { releaseSigningInputs, signReleaseTree } from "./release-signing.mjs";
import { findIdentity } from "./signing-identity.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
if (process.env.SCREENREC_RELEASE_BUILD === "1") releaseSigningInputs();
const { framework } = verifiedFramework(root);
process.env.SCREENREC_SPARKLE_FRAMEWORK = framework;
const facts = await bundleFacts(root);
const signingIdentity = () => findIdentity() ?? "-";
// The app runs its service under the interpreter recorded below and accepts only Node 24, so a
// build under any other interpreter would ship a bundle that cannot start its service.
if (process.versions.node.split(".")[0] !== "24") {
  throw new Error(`Build the app under Node 24; this is Node ${process.version}.`);
}
// Swift builds this app's native half. Without a toolchain the first `swift build` fails with a
// spawn error that says nothing about what to install, so this says it instead.
try {
  execFileSync("xcrun", ["--find", "swift"], { stdio: ["ignore", "ignore", "ignore"] });
} catch {
  throw new Error(
    "No Swift toolchain: `xcrun --find swift` found nothing. Install the Command Line Tools " +
      "(`xcode-select --install`), or point `xcode-select -p` at a developer directory that has them.",
  );
}
execFileSync(process.execPath, [join(root, "helpers/denoise/prepare.mjs"), "--verify"], {
  stdio: "inherit",
});
const app = join(root, "dist/ScreenRecorder.app");
const macOS = join(app, "Contents/MacOS");
mkdirSync(macOS, { recursive: true });
for (const [directory, executable] of [
  ["helpers/mac", "screenrec-native"],
  ["apps/macos", "ScreenRecorder"],
]) {
  const args = [
    "build",
    "--package-path",
    join(root, directory),
    "--configuration",
    "release",
    "--product",
    executable,
  ];
  // Hosted macOS runners have limited memory; avoid simultaneous compiler pressure.
  if (process.env.CI) args.push("--jobs", "2");
  execFileSync("swift", args, { stdio: "inherit" });
  const bin = execFileSync("swift", [...args, "--show-bin-path"], { encoding: "utf8" }).trim();
  copyFileSync(join(bin, executable), join(macOS, executable));
}

mkdirSync(join(app, "Contents/Frameworks"), { recursive: true });
execFileSync("ditto", [framework, join(app, "Contents/Frameworks/Sparkle.framework")]);
const rnnoiseNotices = join(app, "Contents/Resources/ThirdParty/RNNoise");
mkdirSync(rnnoiseNotices, { recursive: true });
for (const file of ["COPYING", "provenance.json"])
  copyFileSync(join(root, "helpers/denoise", file), join(rnnoiseNotices, file));

// The bundled service and CLI run outside the checkout with no node_modules in reach, so
// each ships as one file with Node builtins left external.
const service = join(app, "Contents/Resources/service");
for (const [entry, outfile] of [
  ["apps/service/dist/main.js", join(service, "main.mjs")],
  ["apps/cli/dist/main.js", join(app, "Contents/Resources/cli/main.mjs")],
]) {
  mkdirSync(dirname(outfile), { recursive: true });
  execFileSync("bun", ["build", join(root, entry), "--target=node", "--outfile", outfile], {
    stdio: "inherit",
  });
}

// The app reads its control-channel limits from here rather than restating them in
// Swift, so protocol stays their one owner. The interpreter is a personal-host
// prerequisite rather than a bundled runtime, so record the one this build ran under:
// a Finder launch inherits no developer shell PATH to rediscover it with.
const protocol = await import(pathToFileURL(join(root, "packages/protocol/dist/index.js")));
writeFileSync(
  join(service, "runtime.json"),
  JSON.stringify(
    {
      ...facts,
      nodePath: process.execPath,
      controlFrameBytes: protocol.CONTROL_FRAME_BYTES,
      maxPendingCalls: protocol.MAX_PENDING_CONTROL_CALLS,
      callTimeoutMs: protocol.DEFAULT_CALL_TIMEOUT_MS,
    },
    null,
    2,
  ) + "\n",
);

copyFileSync(join(root, "apps/macos/Info.plist"), join(app, "Contents/Info.plist"));
const { version } = facts;
execFileSync("/usr/libexec/PlistBuddy", [
  "-c",
  `Add :CFBundleShortVersionString string ${version}`,
  join(app, "Contents/Info.plist"),
]);
execFileSync("/usr/libexec/PlistBuddy", [
  "-c",
  `Set :CFBundleVersion ${version}`,
  join(app, "Contents/Info.plist"),
]);
// Rendered by scripts/render-app-icon.swift and checked in, so a build needs no drawing step.
copyFileSync(join(root, "apps/macos/AppIcon.icns"), join(app, "Contents/Resources/AppIcon.icns"));
// macOS keys screen and microphone access to the signature it saw. Ad-hoc signatures change with
// every build, so a local identity, when this Mac has one, keeps those grants across builds.
signReleaseTree(app, signingIdentity());
console.error(`Built ${app}`);
