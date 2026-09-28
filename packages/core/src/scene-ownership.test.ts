import { afterEach, expect, test } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { RevisionStore } from "./library.js";
import { AssetStore } from "./assets.js";
import { AcquisitionStore, AcquisitionImporter } from "./acquisitions.js";
import { writeSceneEvidencePages } from "./scene-pages.js";
import { SourceEvidenceStore } from "./evidence.js";
import { SourceSceneAnalysis, scenePolicy } from "./scenes.js";
import { selectSource } from "./source-selection.js";
import {
  SceneEvidenceStore,
  assetSceneOwner,
  recordingSceneOwner,
  recordingSceneMetadata,
  type SceneEvidenceIdentity,
  type SceneSource,
} from "./scene-evidence.js";

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});
function analysisFor(recordingId: string, source: string) {
  return new SourceSceneAnalysis(recordingId, source, 1000000, async (request) => ({
    sourceWidth: 32,
    sourceHeight: 16,
    samples: request.atSourceUs.map((requestedSourceUs) => ({
      requestedSourceUs,
      actualSourceUs: requestedSourceUs,
      distanceUs: 0,
      width: 1,
      height: 1,
      rgbBase64: Buffer.alloc(3, requestedSourceUs >= 400000 ? 255 : 0).toString("base64"),
    })),
  }));
}
async function fixture() {
  const home = await mkdtemp("/tmp/scene-ownership-");
  let id = "initial";
  const catalog = new RevisionStore(join(home, "catalog.sqlite"), {
    now: () => "fixture",
    newId: () => id,
  });
  cleanup.push(async () => {
    catalog.close();
    await rm(home, { recursive: true, force: true });
  });
  const assets = new AssetStore(catalog, home);
  await assets.recover();
  const acquisitions = new AcquisitionStore(catalog);
  const file = join(home, "media.mov");
  await writeFile(file, "scene source fixture");
  const probe = async () => ({
    originUs: -250000,
    streams: ["v1", "v2", "a1"].map((streamId) => ({
      id: streamId,
      kind: streamId === "a1" ? "audio" : "video",
      codec: "fixture",
      decodable: true,
      startUs: 0,
      endUs: 1000000,
      segments: [{ startUs: 0, endUs: 1000000, empty: false }],
      width: 32,
      height: 16,
    })),
  });
  const asset = await assets.import(file, { kind: "import" }, probe);
  id = asset.id;
  const recording = catalog.allocate().recording;
  catalog.registerSource(recording.recordingId, 1000000);
  const recordingCheck = recordingSceneOwner(catalog),
    assetCheck = assetSceneOwner(assets, acquisitions);
  const evidence = new SceneEvidenceStore(catalog, (identity, source) =>
    identity.owner.kind === "recording"
      ? recordingCheck(identity, source)
      : assetCheck(identity, source),
  );
  const identity: SceneEvidenceIdentity = {
    owner: { kind: "asset", assetId: asset.id },
    sourceId: asset.id,
    generation: "same-attempt",
    policy: scenePolicy.id,
  };
  const descriptor = (streamId = "v1"): SceneSource => {
    const selected = selectSource(assets, acquisitions, { assetId: asset.id, streamId });
    return {
      kind: "asset",
      streamId,
      supportDigest: selected.supportDigest,
      durationUs: selected.durationUs,
    };
  };
  const analysis = analysisFor(recording.recordingId, file);
  const chunk = await analysis.analyze(
    { startUs: 0, endUs: 1000000 },
    new AbortController().signal,
  );
  return {
    home,
    catalog,
    assets,
    acquisitions,
    evidence,
    asset,
    recording,
    identity,
    descriptor,
    chunk,
  };
}
test("real recording and asset owners with identical IDs and attempts retain separate canonical scene rows", async () => {
  const f = await fixture();
  expect(f.recording.recordingId).toBe(f.asset.id);
  expect(f.recording.sourceId).toBe(f.asset.id);
  const recording: SceneEvidenceIdentity = {
    ...f.identity,
    owner: { kind: "recording", recordingId: f.asset.id },
  };
  f.evidence.append(f.identity, f.descriptor(), f.chunk);
  f.evidence.append(recording, { kind: "recording", durationUs: 1000000 }, f.chunk);
  const asset = f.evidence.finish(f.identity),
    captured = f.evidence.finish(recording);
  expect(asset.source).toEqual(f.descriptor());
  expect(recordingSceneMetadata(captured)).toMatchObject({
    recordingId: f.asset.id,
    durationUs: 1000000,
    boundaryCount: 1,
  });
  await expect(
    writeSceneEvidencePages(f.evidence, f.identity, join(f.home, "asset-package")),
  ).rejects.toThrow("recording source");
  expect(f.evidence.page({ identity: f.identity }).chunks).toEqual(
    f.evidence.page({ identity: recording }).chunks,
  );
  await f.evidence.remove(f.identity);
  expect(() => f.evidence.page({ identity: f.identity })).toThrow("complete");
  expect(f.evidence.page({ identity: recording }).chunks).toEqual([f.chunk]);
});
test("stream, support, duration and source owner mismatches cannot append or rebind a generation", async () => {
  const f = await fixture();
  expect(() =>
    f.evidence.append({ ...f.identity, sourceId: "another" }, f.descriptor(), f.chunk),
  ).toThrow("asset source");
  expect(() =>
    f.evidence.append(f.identity, { ...f.descriptor(), durationUs: 999 }, f.chunk),
  ).toThrow("support changed");
  expect(() =>
    f.evidence.append(
      f.identity,
      { ...f.descriptor(), supportDigest: "wrong" } as SceneSource,
      f.chunk,
    ),
  ).toThrow("support changed");
  expect(() => f.evidence.append(f.identity, f.descriptor("a1"), f.chunk)).toThrow("video stream");
  const first = { ...f.chunk, range: { startUs: 0, endUs: 200000 } };
  // Use an actual canonical short chunk; the first generation descriptor must stay pinned.
  const analysis = analysisFor(f.recording.recordingId, "unused");
  const short = await analysis.analyze(first.range, new AbortController().signal);
  f.evidence.append(f.identity, f.descriptor(), short);
  const later = await analysis.analyze(
    { startUs: 200000, endUs: 1000000 },
    new AbortController().signal,
  );
  expect(() => f.evidence.append(f.identity, f.descriptor("v2"), later)).toThrow(
    "dimensions changed",
  );
  f.evidence.append(f.identity, f.descriptor(), later);
  f.evidence.finish(f.identity);
});
test("bounded reclamation preserves pinned asset generations and cancellation makes forward progress", async () => {
  const f = await fixture();
  for (let n = 0; n < 205; n++) {
    const identity = { ...f.identity, generation: `g${n}` };
    f.evidence.append(identity, f.descriptor(), f.chunk);
    f.evidence.finish(identity);
  }
  const controller = new AbortController();
  let seen = 0;
  await expect(
    f.evidence.reclaim(
      f.identity.owner,
      (generation) => {
        if (++seen === 102) controller.abort();
        return generation === "g0";
      },
      controller.signal,
    ),
  ).rejects.toThrow();
  expect(f.evidence.page({ identity: { ...f.identity, generation: "g0" } }).chunks).toEqual([
    f.chunk,
  ]);
  expect(() => f.evidence.page({ identity: { ...f.identity, generation: "g1" } })).toThrow(
    "complete",
  );
  await f.evidence.reclaim(f.identity.owner, (generation) => generation === "g0");
  expect(() => f.evidence.page({ identity: { ...f.identity, generation: "g204" } })).toThrow(
    "complete",
  );
  expect(f.evidence.page({ identity: { ...f.identity, generation: "g0" } }).chunks).toEqual([
    f.chunk,
  ]);
});
test("adopted acquisition contexts are authoritative and a generation cannot switch its context", async () => {
  const f = await fixture();
  const raw = new SourceEvidenceStore(f.catalog, ({ owner }) => {
    if (owner.kind !== "acquisition") throw new Error("unexpected owner");
    f.acquisitions.intent(owner.acquisitionId);
  });
  const importer = new AcquisitionImporter(f.catalog, f.acquisitions, f.assets, raw, f.home);
  const signal = new AbortController().signal;
  await importer.recover(signal);
  async function adopt(name: string) {
    const donor = join(f.home, name);
    await mkdir(donor);
    await writeFile(join(donor, "capture.journal.jsonl"), name);
    await writeFile(join(donor, "video.mov"), "single video for acquisition");
    const prepared = await importer.prepareImport(name, donor);
    const intent = f.catalog.transaction(() => f.acquisitions.admitImport(prepared));
    return importer.executeImport(
      intent.acquisitionId,
      name,
      {
        probe: async () => ({
          originUs: -250000,
          streams: [
            {
              id: "v1",
              kind: "video",
              codec: "fixture",
              decodable: true,
              startUs: 0,
              endUs: 1000000,
              segments: [{ startUs: 0, endUs: 1000000, empty: false }],
              width: 32,
              height: 16,
            },
          ],
        }),
        exportSource: async (_directory, output) => {
          await writeFile(output, "");
          return {
            file: output,
            journal: "capture.journal.jsonl",
            header: { sessionID: name },
            cursorSamples: 0,
            geometryRecords: 0,
            displaySpaces: 0,
            pauseEvents: 0,
            audioIntervals: 0,
            lastSequence: 0,
            incompleteTail: false,
            finished: true,
            bytes: 0,
          };
        },
      },
      signal,
    );
  }
  const a = await adopt("first"),
    b = await adopt("second");
  expect(a.bindings[0]!.assetId).toBe(b.bindings[0]!.assetId);
  const assetId = a.bindings[0]!.assetId;
  const identity: SceneEvidenceIdentity = {
    ...f.identity,
    owner: { kind: "asset", assetId },
    sourceId: assetId,
  };
  const selected = selectSource(f.assets, f.acquisitions, {
    assetId,
    streamId: "v1",
    acquisitionId: a.id,
  });
  const source: SceneSource = {
    kind: "asset",
    streamId: "v1",
    acquisitionId: a.id,
    durationUs: selected.durationUs,
    supportDigest: selected.supportDigest,
  };
  const analysis = analysisFor(f.recording.recordingId, "unused");
  f.evidence.append(
    identity,
    source,
    await analysis.analyze({ startUs: 0, endUs: 200000 }, signal),
  );
  const tail = await analysis.analyze({ startUs: 200000, endUs: 1000000 }, signal);
  expect(() => f.evidence.append(identity, { ...source, acquisitionId: b.id }, tail)).toThrow(
    "dimensions changed",
  );
  expect(() => f.evidence.append(f.identity, source, f.chunk)).toThrow("does not bind");
  f.evidence.append(identity, source, tail);
  expect(f.evidence.finish(identity).source).toEqual(source);
});
