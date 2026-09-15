import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const app = join(root, "dist/ScreenRecorder.app/Contents/MacOS/ScreenRecorder");
const args = process.argv.slice(2);
let nativeArgs;
if (args.length === 0 || args[0] === "--preflight") {
  nativeArgs = ["--capture-preflight"];
} else if (args[0] === "--permission" && args.length === 2) {
  nativeArgs = ["--capture-permission", args[1]];
} else if (args[0] === "--sources") {
  nativeArgs = ["--capture-sources"];
} else if (args[0] === "--fixture") {
  const output = args[1] ? resolve(args[1]) : mkdtempSync(join(tmpdir(), "screenrec-capture-"));
  mkdirSync(output, { recursive: true });
  const config = join(output, "probe.json");
  writeFileSync(
    config,
    JSON.stringify({
      capture: {
        source: { kind: "fixture" },
        outputDirectory: output,
        microphone: false,
        systemAudio: false,
      },
      durationSeconds: 6,
      pauseAtSeconds: 2,
      pauseSeconds: 2,
    }),
  );
  nativeArgs = ["--capture-probe", config];
} else if (args[0] === "--request" && args[1]) {
  nativeArgs = ["--capture-probe", resolve(args[1])];
} else {
  throw new Error(
    "Usage: native-capture-probe.mjs [--preflight | --permission screen|microphone | --sources | --fixture [output-directory] | --request probe.json]",
  );
}
const result = spawnSync(app, nativeArgs, { stdio: "inherit", timeout: 3_660_000 });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
