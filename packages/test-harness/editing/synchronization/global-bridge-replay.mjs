import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = fileURLToPath(new URL("../../../../", import.meta.url));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const precisionFrames = 32;

function sourceName(name) {
  const match = /^(.*)-\d+$/.exec(name);
  assert(match, `bridge window has no source prefix: ${name}`);
  return match[1];
}

function measurements(local) {
  const groups = new Map();
  for (const window of local.windows) {
    if (window.acoustic?.state !== "local-acoustic-candidate") continue;
    assert(Number.isInteger(window.referenceMinusSourceSamples16k));
    const source = sourceName(window.name);
    const rows = groups.get(source) ?? [];
    rows.push({
      name: window.name,
      referenceMinusSourceSamples16k: window.referenceMinusSourceSamples16k,
      offsetFrames: window.acoustic.offsetFrames,
      spreadFrames: window.acoustic.spreadFrames,
    });
    groups.set(source, rows);
  }
  return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([source, windows]) => {
    windows.sort((left, right) => left.name.localeCompare(right.name));
    const values = windows.map((window) => window.referenceMinusSourceSamples16k);
    const differences = values.flatMap((value, index) =>
      values.slice(index + 1).map((other) => Math.abs(value - other)),
    );
    return {
      source,
      windows,
      minimumDifferenceFrames: differences.length ? Math.min(...differences) : 0,
    };
  });
}

export async function runGlobalBridgeReplay(reportPath) {
  const reportFile = resolve(reportPath);
  const reportBytes = await readFile(reportFile);
  const report = JSON.parse(reportBytes);
  assert.equal(report.kind, "global-bridge-synchronization-refusal");
  assert.equal(report.status, "refused");
  assert.equal(report.gate.passed, false);
  assert.equal(report.nextAction, "piecewise-local-only");
  assert.equal(report.gate.rule, "one global offset per raw source requires every admitted bridge delta to differ by at most 32 frames");
  const localPath = resolve(root, report.localPath);
  const localBytes = await readFile(localPath);
  assert.equal(hash(localBytes), report.localSha256, "retained local bridge evidence changed");
  const local = JSON.parse(localBytes);
  const actual = measurements(local);
  assert.deepEqual(actual, report.sourceGroups, "global bridge measurements changed");
  const multiWindow = actual.filter((group) => group.windows.length > 1);
  assert(multiWindow.length > 0, "refusal requires a repeated raw source");
  assert(multiWindow.every((group) => group.minimumDifferenceFrames > precisionFrames), "a global bridge offset was admitted");
  return {
    kind: report.kind,
    status: report.status,
    sourceGroups: report.sourceGroups,
    gate: report.gate,
    nextAction: report.nextAction,
    reportSha256: hash(reportBytes),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const reportPath = process.argv[2];
  assert(reportPath, "Usage: node global-bridge-replay.mjs REPORT_PATH");
  console.log(JSON.stringify(await runGlobalBridgeReplay(reportPath), null, 2));
}
