import assert from "node:assert/strict";
import { test } from "node:test";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = dirname(fileURLToPath(import.meta.url));
const repo = resolve(root, "../../../..");
const parent = process.env.YAP_SPEAKER_PARENT_OPERANDS ?? join(root, "alternative-evidence");

function withBundle(change, check) {
  const scratch = mkdtempSync(join(tmpdir(), "yap-speaker-replay-test-"));
  try {
    const bundle = join(scratch, "context-evidence");
    cpSync(join(root, "context-evidence"), bundle, { recursive: true });
    mkdirSync(join(scratch, "hysteresis-evidence"));
    cpSync(join(root, "hysteresis-evidence/interpret.mjs"), join(scratch, "hysteresis-evidence/interpret.mjs"));
    const replay = () => spawnSync(process.execPath, [join(root, "native-cache-replay.mjs"), repo, parent, bundle], { encoding: "utf8" });
    const baseline = replay();
    assert.equal(baseline.status, 0, `Hydrated unmodified evidence must replay before corruption: ${baseline.stderr}`);
    assert.equal(JSON.parse(baseline.stdout).verified, true);
    change(bundle);
    check(replay());
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

test("replay refuses a result bank that omits its required failed confirmation", () => {
  withBundle((bundle) => {
    const path = join(bundle, "results.json");
    const results = JSON.parse(readFileSync(path));
    results.cases = results.cases.filter((c) => c.id !== "aiqwk30");
    writeFileSync(path, JSON.stringify(results));
  }, (result) => {
    assert.notEqual(result.status, 0, "Incomplete evidence must not become a verified passing bundle");
    assert.match(result.stderr, /Required protocol case coverage/);
  });
});

test("replay refuses an altered execution receipt even when scores are intact", () => {
  withBundle((bundle) => {
    writeFileSync(join(bundle, "observations/bspxd30.transport.json"), "{\"wallSeconds\":0}\n");
  }, (result) => {
    assert.notEqual(result.status, 0, "Altered receipts must not be accepted as verified evidence");
    assert.match(result.stderr, /Retained operand integrity/);
  });
});

test("replay refuses resource summaries that disagree with captured inference", () => {
  withBundle((bundle) => {
    const path = join(bundle, "results.json");
    const results = JSON.parse(readFileSync(path));
    results.resources[0].candidate.inferenceSeconds = 0;
    results.resources[0].candidate.inferencePeakProcessRSSBytes = 0;
    writeFileSync(path, JSON.stringify(results));
  }, (result) => {
    assert.notEqual(result.status, 0, "Captured inference resource measurements must be verified");
    assert.match(result.stderr, /Retained deterministic resource measurements/);
  });
});
