import { spawnSync } from "node:child_process";
import { appendFileSync } from "node:fs";
const args = process.argv.slice(2);
const result = spawnSync(process.execPath, ["/sandbox/cli/main.mjs", ...args], {
  encoding: "utf8",
  stdio: ["inherit", "pipe", "pipe"],
  timeout: 30000,
  maxBuffer: 8 * 1024 * 1024,
});
appendFileSync(
  "/sandbox/cli-calls.jsonl",
  JSON.stringify({ args, exit: result.status, stdout: result.stdout, stderr: result.stderr }) +
    "\n",
);
process.stdout.write(result.stdout ?? "");
process.stderr.write(result.stderr ?? "");
process.exitCode = result.status ?? 1;
