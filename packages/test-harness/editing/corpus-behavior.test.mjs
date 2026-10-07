import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { certifyCorpusBehavior } from "./corpus-behavior.mjs";

const root = new URL("../../../", import.meta.url).pathname;
const manifestPath = join(root, "fixtures/video-editing-feedback/manifest.json");
const receiptPath = join(
  root,
  "specs/done/video-editing-feedback/assets/01-corpus-behavior/receipt.json",
);

test("certifies every retained real case against its scoped behavior evidence", async () => {
  const report = await certifyCorpusBehavior(manifestPath);
  assert.equal(report.status, "passed");
  assert.deepEqual(report.cases.map((entry) => entry.id), [
    "false-start",
    "overlap-region",
    "overlap-neighbor",
    "phrase-final-trend",
    "madison-context",
    "graham-picture",
    "madison-picture",
    "lily-picture",
  ]);
  assert.ok(report.cases.every((entry) => entry.evidenceSha256.length === 64));
});

test("replays the retained scoped behavior receipt", async () => {
  const report = await certifyCorpusBehavior(manifestPath);
  const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
  assert.deepEqual(report, receipt);
});

test("refuses a retained case whose behavior evidence is missing", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "yap-corpus-behavior-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.cases.find((entry) => entry.id === "graham-picture").baseline.evidence =
    "specs/done/video-editing-feedback/assets/missing.json";
  const copy = join(directory, "manifest.json");
  await writeFile(copy, JSON.stringify(manifest));
  await assert.rejects(() => certifyCorpusBehavior(copy), /evidence file is missing/);
});

test("refuses a retained case whose evidence bytes drift", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "yap-corpus-behavior-drift-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const picture = manifest.cases.find((entry) => entry.id === "graham-picture");
  manifest.cases = [picture];
  picture.baseline.evidence = join(
    root,
    "specs/done/video-editing-feedback/assets/01-corpus-audio/speech-parity/comparison.json",
  );
  const copy = join(directory, "manifest.json");
  await writeFile(copy, JSON.stringify(manifest));
  await assert.rejects(() => certifyCorpusBehavior(copy), /behavior evidence changed/);
});
