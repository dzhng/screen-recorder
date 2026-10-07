import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const root = new URL("../../../../", import.meta.url).pathname;
const assets = join(root, "specs/video-editing-feedback/assets/20-synchronization");
const fixtures = join(root, "fixtures/video-editing-feedback/synchronization");

test("replays all retained real synchronization comparisons without promoting a clock", async () => {
  const { verifyRealSynchronizationReplay } = await import("./real-replay.mjs");
  const report = await verifyRealSynchronizationReplay(assets, fixtures);
  assert.equal(report.ok, true);
  assert.deepEqual(report.coverage, {
    comparisons: 9,
    sourcePairs: ["grahamRaw:madisonRaw", "grahamRaw:lilyRawP1", "madisonRaw:lilyRawP1"],
    accepted: 0,
    refused: 9,
  });
  assert.equal(report.verdict, "no-synchronization-promotion");
});

test("real synchronization replay refuses a changed retained result", async (t) => {
  const scratch = await mkdtemp(join(tmpdir(), "yap-sync-real-replay-"));
  t.after(() => rm(scratch, { recursive: true, force: true }));
  await cp(assets, scratch, { recursive: true });
  const path = join(scratch, "retained-comparisons.json");
  const comparisons = JSON.parse(await readFile(path, "utf8"));
  comparisons[0].result.reason = "constant-offset";
  await writeFile(path, JSON.stringify(comparisons));
  const { verifyRealSynchronizationReplay } = await import("./real-replay.mjs");
  await assert.rejects(verifyRealSynchronizationReplay(scratch, fixtures), { code: "RESULT_CHANGED" });
});

test("real synchronization replay refuses an admitted real offset even when both frozen sides agree", async (t) => {
  const scratch = await mkdtemp(join(tmpdir(), "yap-sync-real-promotion-"));
  t.after(() => rm(scratch, { recursive: true, force: true }));
  await cp(assets, scratch, { recursive: true });
  for (const name of ["original-comparisons.json", "retained-comparisons.json"]) {
    const path = join(scratch, name);
    const comparisons = JSON.parse(await readFile(path, "utf8"));
    comparisons[0].result.state = "constant-offset";
    comparisons[0].result.offsetFrames = 12;
    comparisons[0].result.anchors = comparisons[0].result.anchors.map((anchor) => ({
      ...anchor,
      selectedFrames: 12,
    }));
    await writeFile(path, JSON.stringify(comparisons));
  }
  const originalBytes = await readFile(join(scratch, "original-comparisons.json"));
  const exactPath = join(scratch, "exact-replay.json");
  const exact = JSON.parse(await readFile(exactPath, "utf8"));
  exact.referenceSha256 = createHash("sha256").update(originalBytes).digest("hex");
  await writeFile(exactPath, JSON.stringify(exact));
  const { verifyRealSynchronizationReplay } = await import("./real-replay.mjs");
  await assert.rejects(verifyRealSynchronizationReplay(scratch, fixtures), { code: "PROMOTION" });
});
