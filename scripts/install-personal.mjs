// Installs the built app outside the checkout for this person's own Mac and puts a `screenrec`
// launcher on disk for the CLI and MCP. Run `bun run install:personal`; see the CLI README.
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { values } = parseArgs({
  options: {
    app: { type: "string", default: join(homedir(), "Applications", "Screen Recorder.app") },
    bin: { type: "string", default: join(homedir(), ".local", "bin") },
  },
});
let app = values.app;
const bin = values.bin;
for (const [flag, path] of [
  ["--app", app],
  ["--bin", bin],
]) {
  if (!isAbsolute(path)) fail(`${flag} must be an absolute path; received ${JSON.stringify(path)}`);
}
// Finder, Spotlight and Login Items show the bundle's file name.
if (basename(app) !== "Screen Recorder.app") fail('--app must name a "Screen Recorder.app" bundle');

const built = join(root, "dist/ScreenRecorder.app");
const personalIdentifier = "com.david.screenrec.personal";
const cli = "Contents/Resources/cli/main.mjs";
if (!existsSync(join(built, cli))) fail(`No built app at ${built}; run \`bun run build\` first.`);
const { nodePath } = JSON.parse(
  readFileSync(join(built, "Contents/Resources/service/runtime.json"), "utf8"),
);
// The service and CLI run under the interpreter the build recorded, not a bundled runtime.
const node = execFileSync(nodePath, ["--version"], { encoding: "utf8" }).trim();
if (!node.startsWith("v24.")) fail(`${nodePath} is ${node}; this personal release needs Node 24.`);

// macOS reports a running app by its real path, and LaunchServices opens it there.
mkdirSync(dirname(app), { recursive: true });
app = join(realpathSync(dirname(app)), basename(app));

// Earlier installs were named ScreenRecorder.app under the same identity. Left beside the new copy,
// Spotlight and Login Items would offer two apps that are one.
const superseded = join(dirname(app), "ScreenRecorder.app");
const supersededIdentity = existsSync(superseded)
  ? execFileSync(
      "/usr/libexec/PlistBuddy",
      ["-c", "Print :CFBundleIdentifier", join(superseded, "Contents/Info.plist")],
      { encoding: "utf8" },
    ).trim()
  : undefined;
const replaced = [app, ...(supersededIdentity === personalIdentifier ? [superseded] : [])];

// Replacing a running app's bundle would pull its service code out from under it.
const commands = execFileSync("ps", ["-axo", "command="], { encoding: "utf8" }).split("\n");
for (const bundle of replaced) {
  const executable = join(bundle, "Contents/MacOS/ScreenRecorder");
  if (commands.some((command) => command === executable || command.startsWith(`${executable} `)))
    fail(`Quit Screen Recorder (${bundle}) before installing over it.`);
}

// Stage beside the destination so the swap is a rename on one volume; the previous copy is
// removed only after the new one is in place.
const staging = join(dirname(app), `.Screen Recorder.app.installing-${process.pid}`);
const previous = join(dirname(app), `.Screen Recorder.app.previous-${process.pid}`);
rmSync(staging, { recursive: true, force: true });
execFileSync("ditto", [built, staging]);
// Development builds and their tests launch many short-lived copies under the build identity;
// macOS can stop showing that identity's menu-bar item. The personal copy keeps its own.
execFileSync("/usr/libexec/PlistBuddy", [
  "-c",
  `Set :CFBundleIdentifier ${personalIdentifier}`,
  join(staging, "Contents/Info.plist"),
]);
execFileSync("codesign", ["--force", "--sign", "-", staging]);
execFileSync("codesign", ["--verify", "--strict", staging]);
const replacing = existsSync(app);
if (replacing) renameSync(app, previous);
try {
  renameSync(staging, app);
} catch (error) {
  if (replacing) renameSync(previous, app);
  throw error;
}
if (replacing) rmSync(previous, { recursive: true, force: true });
if (replaced.includes(superseded)) rmSync(superseded, { recursive: true, force: true });

const quote = (text) => `'${text.replaceAll("'", `'\\''`)}'`;
const launcher = join(bin, "screenrec");
mkdirSync(bin, { recursive: true });
writeFileSync(
  `${launcher}.installing`,
  `#!/bin/sh\nexec ${quote(nodePath)} ${quote(join(app, cli))} "$@"\n`,
  { mode: 0o755 },
);
renameSync(`${launcher}.installing`, launcher);

const onPath = (process.env.PATH ?? "").split(":").includes(bin);
console.log(`Installed ${app}
Installed ${launcher} (Node ${node} at ${nodePath})
${onPath ? "" : `Add ${bin} to PATH to run \`screenrec\` by name.\n`}MCP client configuration: {"command": ${JSON.stringify(launcher)}, "args": ["mcp"]}`);

function fail(message) {
  console.error(message);
  process.exit(1);
}
