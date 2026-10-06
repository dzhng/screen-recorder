// Installs the built app outside the checkout for this person's own Mac and puts a `yap`
// launcher on disk for the CLI and MCP. Run `bun run install:personal`; see the CLI README.
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
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
    app: { type: "string", default: join(homedir(), "Applications", "Yap.app") },
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
if (basename(app) !== "Yap.app") fail('--app must name a "Yap.app" bundle');

const built = join(root, "dist/Yap.app");
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

// Replacing a running app's bundle would pull its service code out from under it.
const commands = execFileSync("ps", ["-axo", "command="], { encoding: "utf8" }).split("\n");
const executable = join(app, "Contents/MacOS/Yap");
if (commands.some((command) => command === executable || command.startsWith(`${executable} `)))
  fail(`Quit Yap (${app}) before installing over it.`);

// What an install that did not finish left here. A copy set aside mid-swap is the app itself, so
// it goes back rather than being thrown away; a half-built one is worth nothing and goes.
const leftovers = (kind) =>
  readdirSync(dirname(app))
    .filter((name) => name.startsWith(`.Yap.app.${kind}-`))
    .map((name) => join(dirname(app), name));
for (const abandoned of leftovers("previous")) {
  if (existsSync(app)) rmSync(abandoned, { recursive: true, force: true });
  else {
    renameSync(abandoned, app);
    console.log(`Restored ${app} from an install that did not finish.`);
  }
}
for (const abandoned of leftovers("installing"))
  rmSync(abandoned, { recursive: true, force: true });

// Stage beside the destination so the swap is a rename on one volume; the previous copy is
// removed only after the new one is in place.
const staging = join(dirname(app), `.Yap.app.installing-${process.pid}`);
const previous = join(dirname(app), `.Yap.app.previous-${process.pid}`);
try {
  execFileSync("ditto", [built, staging]);
  execFileSync("codesign", ["--verify", "--strict", staging]);
} catch (error) {
  // Nothing was replaced yet, so the installed app is untouched and only this attempt goes.
  rmSync(staging, { recursive: true, force: true });
  throw error;
}
const replacing = existsSync(app);
if (replacing) renameSync(app, previous);
try {
  renameSync(staging, app);
} catch (error) {
  if (replacing) renameSync(previous, app);
  throw error;
}
if (replacing) rmSync(previous, { recursive: true, force: true });

const quote = (text) => `'${text.replaceAll("'", `'\\''`)}'`;
const launcher = join(bin, "yap");
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
${onPath ? "" : `Add ${bin} to PATH to run \`yap\` by name.\n`}MCP client configuration: {"command": ${JSON.stringify(launcher)}, "args": ["mcp"]}`);

function fail(message) {
  console.error(message);
  process.exit(1);
}
