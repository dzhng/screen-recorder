import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { Catalog } from "@yap/core/catalog";
import { AssetStore } from "@yap/core/assets";
import { JourneyService, hash, poll } from "./source-evidence-fixture.mjs";

// One retained, already-qualified whole-stream operand; no quality cohort or demo edit.
const [source, distribution, output] = process.argv.slice(2).map((value) => resolve(value));
assert.ok(
  source && distribution && output && process.env.YAP_NATIVE,
  "Usage: YAP_NATIVE=... node hdr-managed.mjs SOURCE DISTRIBUTION NEW_OUTPUT",
);
await mkdir(output, { mode: 0o700 });
const home = await mkdtemp("/tmp/yap-hdr-managed-");
process.env.YAP_TEST_FFMPEG_INSTALLATION = JSON.stringify({
  directory: distribution,
  receiptSha256: hash(await readFile(join(distribution, "receipt.json"))),
});
const report = { passed: false, trace: [], exchanges: [] };
const service = new JourneyService(home, report);
const call = service.call.bind(service);
try {
  await service.start();
  const imported = await call("asset.import", { requestId: "hdr-source", path: source });
  await poll(
    () => call("job.get", { jobId: imported.jobId }),
    (value) => value.state === "ready",
    "import",
  );
  // Import publication is recovered through its original request.
  const importReplay = await call("asset.import", { requestId: "hdr-source", path: source });
  const originalId = importReplay.published?.result
    ? JSON.parse(importReplay.published.result).assetId
    : hash(await readFile(source));
  const original = await call("asset.get", { assetId: originalId });
  const streamIds = original.streams
    .filter((item) => item.kind === "video" || item.kind === "audio")
    .map((item) => item.id);
  assert.equal(streamIds.length, 2);
  const request = { assetId: originalId, streamIds, recipe: "hdr-to-sdr-hable-1000nit-v1" };
  const pending = await call("asset.convert", request);
  await poll(
    () => call("job.get", { jobId: pending.jobId }),
    (value) => value.state === "ready",
    "conversion",
  );
  const ready = await call(
    "asset.convert",
    { ...request, streamIds: [...streamIds].reverse() },
    { transport: "mcp" },
  );
  const result = JSON.parse(ready.published.result);
  const derivative = await call("asset.get", { assetId: result.assetId });
  const origins = await call("asset.origins", { assetId: result.assetId });
  Object.assign(report, { original, derivative, result, origins, replay: ready });
  await writeFile(join(output, "report.json"), JSON.stringify(report, null, 2));
  assert.equal(ready.jobId, pending.jobId);
  assert.equal(result.origin.source.assetId, originalId);
  assert.equal(result.origin.output.audio.frames, 6000);
  assert.equal(result.origin.output.audio.pcmSha256, result.origin.source.audio.pcmSha256);
  assert.deepEqual(result.origin.clock.sourceSupport, { startUs: 0, endUs: 175000 });
  assert.equal(result.origin.clock.movieTimescale, 48000);
  assert.deepEqual(result.origin.output.video.startUs, 50000);
  assert.deepEqual(result.origin.output.audio.startUs, 0);
  assert.ok(
    origins.origins.some((origin) => JSON.stringify(origin) === JSON.stringify(result.origin)),
  );
  await service.stop();
  const catalog = new Catalog(join(home, "library/catalog.sqlite"));
  try {
    const assets = new AssetStore(catalog, join(home, "library"));
    assert.equal(hash(await readFile(assets.path(originalId))), originalId);
    assert.equal(hash(await readFile(assets.path(result.assetId))), result.assetId);
    const references = assets.references(originalId);
    assert.ok(references.some((item) => item.kind === "asset" && item.id === result.assetId));
    report.references = references;
    report.portable = assets.portable(result.assetId);
    assert.deepEqual(JSON.parse(JSON.stringify(report.portable.dependencies)), [
      { kind: "asset", id: originalId },
    ]);
  } finally {
    catalog.close();
  }
  report.passed = true;
} finally {
  try {
    await service.stop();
  } finally {
    report.logs = service.logs;
    await writeFile(join(output, "report.json"), JSON.stringify(report, null, 2));
    await rm(home, { recursive: true, force: true });
  }
}
