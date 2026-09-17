import { spawn } from "node:child_process";
import { globSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));
const bundle = join(root, "dist/ScreenRecorder.app");
const files = globSync(
  [
    "apps/service/tests/*.mjs",
    "apps/macos/tests/package*.mjs",
    "apps/macos/tests/export-inspection.test.mjs",
  ],
  { cwd: root },
).sort();
const child = spawn(process.execPath, ["--test", "--test-concurrency=2", ...files], {
  cwd: root,
  env: {
    ...process.env,
    SCREENREC_NATIVE: join(bundle, "Contents/MacOS/screenrec-native"),
    SCREENREC_RELOCATION_BUNDLE: bundle,
  },
  stdio: "inherit",
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.once("error", (error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
child.once("exit", (code) => {
  process.exitCode = code ?? 1;
});
