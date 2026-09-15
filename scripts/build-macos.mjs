import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const app = join(root, "dist/ScreenRecorder.app");
const macOS = join(app, "Contents/MacOS");
mkdirSync(macOS, { recursive: true });
for (const [directory, executable] of [
  ["helpers/mac", "screenrec-native"],
  ["apps/macos", "ScreenRecorder"],
]) {
  const args = ["build", "--package-path", join(root, directory), "--configuration", "release"];
  execFileSync("swift", args, { stdio: "inherit" });
  const bin = execFileSync("swift", [...args, "--show-bin-path"], { encoding: "utf8" }).trim();
  copyFileSync(join(bin, executable), join(macOS, executable));
}

// The bundled service runs from `/` with no node_modules in reach, so it ships as one
// file with Node builtins left external.
const service = join(app, "Contents/Resources/service");
mkdirSync(service, { recursive: true });
execFileSync(
  "bun",
  [
    "build",
    join(root, "apps/service/dist/main.js"),
    "--target=node",
    "--outfile",
    join(service, "main.mjs"),
  ],
  { stdio: "inherit" },
);

// The app reads its control-channel limits from here rather than restating them in
// Swift, so protocol stays their one owner. The interpreter is a personal-host
// prerequisite rather than a bundled runtime, so record the one this build validated
// against: a Finder launch inherits no developer shell PATH to rediscover it with.
const protocol = await import(pathToFileURL(join(root, "packages/protocol/dist/index.js")));
writeFileSync(
  join(service, "runtime.json"),
  JSON.stringify(
    {
      nodePath: process.execPath,
      nodeVersion: process.version,
      controlFrameBytes: protocol.CONTROL_FRAME_BYTES,
      maxPendingCalls: protocol.MAX_PENDING_CONTROL_CALLS,
      callTimeoutMs: protocol.DEFAULT_CALL_TIMEOUT_MS,
    },
    null,
    2,
  ) + "\n",
);

copyFileSync(join(root, "apps/macos/Info.plist"), join(app, "Contents/Info.plist"));
execFileSync("codesign", ["--force", "--sign", "-", app], { stdio: "inherit" });
console.error(`Built ${app}`);
