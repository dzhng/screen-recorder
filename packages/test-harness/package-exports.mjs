import { spawn } from "node:child_process";
import { globSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));
const bundle = join(root, "dist/Yap.app");
const files = globSync("apps/service/tests/*.mjs", { cwd: root }).sort();
const child = spawn(process.execPath, ["--test", "--test-concurrency=2", ...files], {
  cwd: root,
  env: {
    ...process.env,
    YAP_NATIVE: join(bundle, "Contents/MacOS/yap-native"),
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
