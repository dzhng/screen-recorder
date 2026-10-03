import { recordingSceneOwner, recordingSceneIdentity } from "./scene-evidence.js";
import { test, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID, createHash } from "node:crypto";
import { CaptureStore } from "./capture-store.js";
import { SceneEvidenceStore } from "./scene-evidence.js";
import { SourceSceneAnalysis, scenePolicy } from "./scenes.js";
import { FileSceneEvidence, writeSceneEvidencePages } from "./scene-pages.js";
const roots: string[] = [],
  stores = new Set<CaptureStore>();
afterEach(() => {
  for (const store of stores) store.close();
  stores.clear();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
async function fixture(count = 260) {
  const root = mkdtempSync(join(tmpdir(), "portable-scenes-"));
  roots.push(root);
  const original = join(root, "original");
  mkdirSync(original);
  const store = new CaptureStore(join(original, "catalog.sqlite"), {
    now: () => "",
    newId: randomUUID,
  });
  stores.add(store);
  const take = store.allocate().recording,
    duration = count * 2_000_000;
  store.ingestLifecycle(take.recordingId, {
    sourceId: take.sourceId,
    sequence: 1,
    state: "interrupted",
    reason: "generated source scene fixture",
    sourceDurationUs: duration,
  });
  const sceneIdentity = {
    recordingId: take.recordingId,
    sourceId: take.sourceId,
    generation: "scene1",
    policy: scenePolicy.id,
  };
  const scenes = new SceneEvidenceStore(store, recordingSceneOwner(store)),
    analysis = new SourceSceneAnalysis(take.recordingId, "/unused", duration, async (request) => ({
      sourceWidth: 1,
      sourceHeight: 1,
      samples: request.atSourceUs.map((at) => ({
        requestedSourceUs: at,
        actualSourceUs: at,
        distanceUs: 0,
        width: 1,
        height: 1,
        rgbBase64: Buffer.alloc(3, (Math.floor(at / 10_000_000) % 2) * 255).toString("base64"),
      })),
    }));
  for (let at = 0; at < duration; at += 10_000_000)
    scenes.append(
      recordingSceneIdentity(sceneIdentity),
      { kind: "recording", durationUs: duration },
      await analysis.analyze(
        { startUs: at, endUs: Math.min(duration, at + 10_000_000) },
        new AbortController().signal,
      ),
    );
  scenes.finish(recordingSceneIdentity(sceneIdentity));
  return { root, original, store, scenes, sceneIdentity };
}
test("source scene chunks survive library removal and relocation", async () => {
  const f = await fixture();
  const identity = recordingSceneIdentity(f.sceneIdentity);
  const first = f.scenes.page({ identity, limit: 1 });
  const next = f.scenes.page({ identity, afterStartUs: 0, limit: 100 });
  await writeSceneEvidencePages(f.scenes, identity, join(f.root, "scenes"));
  f.store.close();
  stores.delete(f.store);
  rmSync(f.original, { recursive: true });
  renameSync(join(f.root, "scenes"), join(f.root, "moved-scenes"));
  const scenes = new FileSceneEvidence(join(f.root, "moved-scenes"), identity);
  expect(scenes.page({ identity, limit: 1 })).toEqual(first);
  expect(scenes.page({ identity, afterStartUs: 0, limit: 100 })).toEqual(next);
});
test("portable scene policies, pinned contexts and required members fail explicitly", async () => {
  const f = await fixture(2),
    sceneDirectory = join(f.root, "scenes");
  await writeSceneEvidencePages(f.scenes, recordingSceneIdentity(f.sceneIdentity), sceneDirectory);
  const scenePath = join(sceneDirectory, "pages.json"),
    sceneBody = readFileSync(scenePath),
    sceneManifest = JSON.parse(sceneBody.toString());
  sceneManifest.metadata.policy = "future-scene";
  writeFileSync(scenePath, JSON.stringify(sceneManifest));
  expect(
    () => new FileSceneEvidence(sceneDirectory, recordingSceneIdentity(f.sceneIdentity)),
  ).toThrow("Unsupported");
  writeFileSync(scenePath, sceneBody);
  const scenes = new FileSceneEvidence(sceneDirectory, recordingSceneIdentity(f.sceneIdentity));
  expect(() =>
    scenes.page({ identity: { ...recordingSceneIdentity(f.sceneIdentity), sourceId: "other" } }),
  ).toThrow("identity");
  rmSync(join(sceneDirectory, sceneManifest.indexes.chunks[0].file));
  expect(() => scenes.page({ identity: recordingSceneIdentity(f.sceneIdentity) })).toThrow();
});
test("portable chunks apply the append owner's semantic validation even with matching hashes", async () => {
  const f = await fixture(2),
    directory = join(f.root, "scenes");
  await writeSceneEvidencePages(f.scenes, recordingSceneIdentity(f.sceneIdentity), directory);
  const manifestPath = join(directory, "pages.json"),
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const descriptor = manifest.indexes.chunks[0],
    path = join(directory, descriptor.file),
    original = JSON.parse(readFileSync(path, "utf8"));
  for (const mutate of [
    (chunk: (typeof original)[number]) => {
      chunk.coverage[1].requestedSourceUs++;
    },
    (chunk: (typeof original)[number]) => {
      chunk.coverage[1].distanceUs++;
    },
    (chunk: (typeof original)[number]) => {
      chunk.coverage[2].actualSourceUs = 0;
      chunk.coverage[2].distanceUs = chunk.coverage[2].requestedSourceUs;
    },
    (chunk: (typeof original)[number]) => {
      chunk.comparisons[0].actualSourceUs = chunk.comparisons[0].previousActualSourceUs;
    },
  ]) {
    const rows = structuredClone(original);
    mutate(rows[0]);
    const bytes = Buffer.from(JSON.stringify(rows));
    writeFileSync(path, bytes);
    descriptor.bytes = bytes.length;
    descriptor.sha256 = createHash("sha256").update(bytes).digest("hex");
    writeFileSync(manifestPath, JSON.stringify(manifest));
    const reader = new FileSceneEvidence(directory, recordingSceneIdentity(f.sceneIdentity));
    expect(() => reader.page({ identity: recordingSceneIdentity(f.sceneIdentity) })).toThrow(
      expect.objectContaining({ code: "INVALID_EVIDENCE" }),
    );
  }
});

test("portable chunks must continue their predecessor and cover the whole source", async () => {
  const f = await fixture(12),
    directory = join(f.root, "scenes");
  await writeSceneEvidencePages(f.scenes, recordingSceneIdentity(f.sceneIdentity), directory);
  const manifestPath = join(directory, "pages.json"),
    manifestBody = readFileSync(manifestPath, "utf8");
  const pagePath = join(directory, JSON.parse(manifestBody).indexes.chunks[0].file),
    original = JSON.parse(readFileSync(pagePath, "utf8"));
  expect(original.map((chunk: { range: object }) => chunk.range)).toEqual([
    { startUs: 0, endUs: 10_000_000 },
    { startUs: 10_000_000, endUs: 20_000_000 },
    { startUs: 20_000_000, endUs: 24_000_000 },
  ]);
  const boundary = original[0].comparisons.at(-1);
  expect(boundary).toMatchObject({ actualSourceUs: 10_000_000, boundary: true });
  const write = (rows: typeof original) => {
    const manifest = JSON.parse(manifestBody),
      descriptor = manifest.indexes.chunks[0],
      bytes = Buffer.from(JSON.stringify(rows));
    writeFileSync(pagePath, bytes);
    Object.assign(descriptor, {
      rows: rows.length,
      last: [rows.at(-1).range.startUs],
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
    manifest.metadata.chunkCount = rows.length;
    writeFileSync(manifestPath, JSON.stringify(manifest));
  };
  const repeated = structuredClone(original);
  repeated[1].comparisons.unshift(boundary);
  for (const rows of [repeated, [original[0], original[2]], original.slice(0, 2)]) {
    write(rows);
    const reader = new FileSceneEvidence(directory, recordingSceneIdentity(f.sceneIdentity));
    expect(() => reader.page({ identity: recordingSceneIdentity(f.sceneIdentity) })).toThrow(
      expect.objectContaining({ code: "INVALID_EVIDENCE" }),
    );
  }
  write(original);
  expect(
    new FileSceneEvidence(directory, recordingSceneIdentity(f.sceneIdentity)).page({
      identity: recordingSceneIdentity(f.sceneIdentity),
    }).chunks,
  ).toEqual(original);
});
