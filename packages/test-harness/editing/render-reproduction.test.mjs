import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const frozen = fileURLToPath(
  new URL("../../../specs/agent-editing/assets/06-render/", import.meta.url),
);
const verifier = fileURLToPath(new URL("./render-reproduction-verify.mjs", import.meta.url));
test("frozen native evidence passes and refuses a corrupted output or a failed temporal verdict", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "screenrec-render-verification-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await cp(frozen, directory, { recursive: true });
  const verify = () =>
    spawnSync(process.execPath, [verifier, "--out", directory], { encoding: "utf8" });
  let result = verify();
  assert.equal(result.status, 0, result.stderr);
  const file = join(directory, "av-replacement/bounded.mov");
  const original = await readFile(file);
  const damaged = Buffer.from(original);
  damaged[damaged.length - 1] ^= 1;
  await writeFile(file, damaged);
  result = verify();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Hash mismatch: av-replacement\/bounded.mov/);
  await writeFile(file, original);
  const reportFile = join(directory, "report.json");
  const report = JSON.parse(await readFile(reportFile, "utf8"));
  report.results.find((entry) => entry.name === "nonzero-preview").methods.bounded.temporalPassed =
    false;
  await writeFile(reportFile, JSON.stringify(report));
  result = verify();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /nonzero-preview: temporal gate failed/);
});
