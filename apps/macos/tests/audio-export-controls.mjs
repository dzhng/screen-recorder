import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const reportPath = process.argv[2] ?? process.env.YAP_AUDIO_EXPORT_REPORT;
assert.ok(reportPath, "Provide a real audio export report");
const report = JSON.parse(readFileSync(reportPath, "utf8"));
const records = report.exchanges
  .map(({ response }) => (response.structuredContent ?? response).data)
  .filter((value) => value?.kind === "audio" && value.snapshot && value.destination);
assert.ok(records.length > 0);
const scratch = mkdtempSync(join(tmpdir(), "sr-audio-controls-"));
const packagePath = fileURLToPath(new URL("../", import.meta.url));
try {
  const file = join(scratch, "actual-audio-receipts.json");
  writeFileSync(file, JSON.stringify(records));
  execFileSync(
    "swift",
    [
      "run",
      "--build-system",
      "native",
      "--jobs",
      "2",
      "--package-path",
      packagePath,
      "YapControlsTests",
    ],
    {
      env: { ...process.env, YAP_AUDIO_EXPORT_RECORDS: file },
      stdio: "inherit",
      timeout: 60000,
    },
  );
  const evidence = process.env.YAP_AUDIO_EXPORT_CONTROL_EVIDENCE;
  if (evidence) {
    mkdirSync(evidence, { recursive: true });
    copyFileSync(file, join(evidence, "actual-audio-receipts.json"));
    copyFileSync(
      join(packagePath, ".build/debug/YapControlsTests"),
      join(evidence, "pure-controls"),
    );
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
