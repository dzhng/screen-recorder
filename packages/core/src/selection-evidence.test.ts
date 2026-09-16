import { afterEach, expect, test, vi } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { RevisionStore } from "./library.js";
import { SourceEvidenceStore } from "./evidence.js";
import { SceneEvidenceStore } from "./scene-evidence.js";
import { SourceSceneAnalysis, scenePolicy } from "./scenes.js";
import { selectIndex } from "./selection.js";
import { selectionEvidence } from "./selection-evidence.js";

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const close of cleanup.splice(0)) await close();
});
const point = (sourceUs: number, x = 10) => ({
  event: "cursorSample",
  data: {
    sourceUs,
    x,
    y: 20,
    globalX: x,
    globalY: 20,
    buttons: 0,
    eligibility: "inside",
    geometryEpoch: 1,
  },
});
const geometry = (sourceUs: number, epoch = 1) => ({
  event: "geometry",
  data: {
    sourceUs,
    hostUs: sourceUs,
    epoch,
    geometry: {
      outputWidth: 100,
      outputHeight: 80,
      contentRect: { x: 0, y: 0, width: 100, height: 80 },
      contentScale: 1,
      scaleFactor: 1,
    },
  },
});
const pause = (atSourceUs: number) => ({
  event: "pause",
  data: { atSourceUs, elapsedPauseUs: 500 },
});
async function fixture({
  durationUs = 20_000_000,
  records = [geometry(0)],
  actual = (at: number) => at,
  color = (_at: number, _channel: number) => 0,
  raster = { width: 1, height: 1 },
}: {
  durationUs?: number;
  records?: { event: string; data: Record<string, unknown> }[];
  actual?: (requestedUs: number) => number;
  color?: (actualUs: number, channel: number) => number;
  raster?: { width: number; height: number };
} = {}) {
  const root = await mkdtemp("/tmp/selection-evidence-");
  let id = 0;
  const store = new RevisionStore(join(root, "catalog.sqlite"), {
    now: () => "",
    newId: () => String(++id),
  });
  cleanup.push(async () => {
    store.close();
    await rm(root, { recursive: true, force: true });
  });
  const recording = store.allocate().recording;
  store.registerSource(recording.recordingId, durationUs);
  const sourceIdentity = {
    recordingId: recording.recordingId,
    sourceId: recording.sourceId,
    generation: "source-1",
  };
  const sceneIdentity = { ...sourceIdentity, generation: "scenes-1", policy: scenePolicy.id };
  const source = new SourceEvidenceStore(store);
  const scenes = new SceneEvidenceStore(store);
  const file = join(root, "normalized.jsonl");
  const body = records.map((row) => JSON.stringify(row) + "\n").join("");
  await writeFile(file, body);
  const cursors = records.filter((row) => row.event === "cursorSample");
  await source.ingest({
    ...sourceIdentity,
    file,
    receipt: {
      file,
      journal: "capture.journal.jsonl",
      header: { sessionID: recording.sourceId },
      cursorSamples: cursors.length,
      geometryRecords: records.filter((r) => r.event === "geometry").length,
      pauseEvents: records.filter((r) => r.event === "pause").length,
      displaySpaces: 0,
      audioIntervals: 0,
      firstCursorSourceUs: cursors.length
        ? Math.min(...cursors.map((r) => Number(r.data.sourceUs)))
        : null,
      lastCursorSourceUs: cursors.length
        ? Math.max(...cursors.map((r) => Number(r.data.sourceUs)))
        : null,
      bytes: Buffer.byteLength(body),
      lastSequence: records.length,
      incompleteTail: false,
      finished: true,
    },
  });
  const analysis = new SourceSceneAnalysis(
    "fixture-recording",
    "generated",
    durationUs,
    async (request) => ({
      sourceWidth: 100,
      sourceHeight: 80,
      samples: request.atSourceUs.map((requestedSourceUs) => ({
        requestedSourceUs,
        actualSourceUs: actual(requestedSourceUs),
        distanceUs: Math.abs(requestedSourceUs - actual(requestedSourceUs)),
        ...raster,
        rgbBase64: Buffer.from(
          Array.from({ length: raster.width * raster.height * 3 }, (_, channel) =>
            color(actual(requestedSourceUs), channel),
          ),
        ).toString("base64"),
      })),
    }),
  );
  for (let startUs = 0; startUs < durationUs; startUs += 10_000_000) {
    const report = await analysis.analyze(
      { startUs, endUs: Math.min(startUs + 10_000_000, durationUs) },
      new AbortController().signal,
    );
    scenes.append(sceneIdentity, report);
  }
  scenes.finish(sceneIdentity, durationUs);
  const input = { revision: store.revision(recording.recordingId), sourceIdentity, sceneIdentity };
  const stores = { source, scenes };
  return {
    input,
    stores,
    store,
    events: (signal = new AbortController().signal) => selectionEvidence(input, stores, signal),
  };
}
async function collect<T>(events: AsyncIterable<T>) {
  const result: T[] = [];
  for await (const event of events) result.push(event);
  return result;
}

test("catalog streams preserve duplicate cursor pages and place resets before equal-time visuals and cursors", async () => {
  const f = await fixture({
    records: [
      geometry(0),
      ...Array.from({ length: 1001 }, (_, i) => point(10_000_000, i / 20)),
      pause(10_000_000),
      geometry(10_000_000, 2),
      geometry(10_000_001, 2),
      pause(20_000_000),
    ],
  });
  const events = await collect(f.events());
  const equal = events.filter(
    (e) => (e.kind === "cursor" ? e.sample.sourceUs : e.atSourceUs) === 10_000_000,
  );
  expect(equal.slice(0, 3)).toEqual([
    { kind: "boundary", reason: "pause", atSourceUs: 10_000_000 },
    { kind: "boundary", reason: "geometry", atSourceUs: 10_000_000 },
    {
      kind: "visual",
      atSourceUs: 10_000_000,
      actualSourceUs: 10_000_000,
      stillnessRunStartUs: 0,
    },
  ]);
  expect(
    equal.filter((e) => e.kind === "cursor").map((e) => [e.sample.x, e.sample.sequence]),
  ).toEqual(Array.from({ length: 1001 }, (_, i) => [i / 20, i + 2]));
  expect(events.filter((e) => e.kind === "boundary")).toEqual([
    { kind: "boundary", reason: "pause", atSourceUs: 10_000_000 },
    { kind: "boundary", reason: "geometry", atSourceUs: 10_000_000 },
    { kind: "boundary", reason: "pause", atSourceUs: 20_000_000 },
  ]);
  const visualTimes = events.filter((e) => e.kind === "visual").map((e) => e.atSourceUs);
  expect(visualTimes.filter((t) => t >= 9_800_000 && t <= 10_200_000)).toEqual([
    9_800_000, 10_000_000, 10_200_000,
  ]);
});

test("sparse future scene events use actual time while visual requests remain ordered across chunks", async () => {
  const f = await fixture({
    durationUs: 120_000_000,
    actual: (at) => (at < 50_000_000 ? 0 : 100_000_000),
    color: (at) => (at === 0 ? 0 : 255),
  });
  const events = await collect(f.events());
  const times = events.map((e) => (e.kind === "cursor" ? e.sample.sourceUs : e.atSourceUs));
  expect(times).toEqual([...times].sort((a, b) => a - b));
  expect(events.filter((e) => e.kind === "boundary")).toEqual([
    { kind: "boundary", reason: "scene", atSourceUs: 100_000_000 },
  ]);
  expect(
    events.filter(
      (e) => e.kind === "visual" && [0, 200_000, 50_000_000, 50_200_000].includes(e.atSourceUs),
    ),
  ).toEqual([
    { kind: "visual", atSourceUs: 0, actualSourceUs: 0, stillnessRunStartUs: 0 },
    { kind: "visual", atSourceUs: 200_000, actualSourceUs: 0, stillnessRunStartUs: 0 },
    {
      kind: "visual",
      atSourceUs: 50_000_000,
      actualSourceUs: 100_000_000,
      stillnessRunStartUs: 100_000_000,
    },
    {
      kind: "visual",
      atSourceUs: 50_200_000,
      actualSourceUs: 100_000_000,
      stillnessRunStartUs: 100_000_000,
    },
  ]);
});

test("removed frames cannot prove stillness while retained observations keep their source run", async () => {
  const f = await fixture({ records: [geometry(0), point(0)] });
  f.input.revision = f.store.edit(f.input.sourceIdentity.recordingId, {
    operation: "cut",
    requestId: "cut",
    expectedRevisionId: "r0",
    ranges: [{ startUs: 0, endUs: 100_000 }],
  });
  const events = await collect(f.events());
  expect(events.filter((e) => e.kind === "visual").slice(0, 3)).toEqual([
    { kind: "visual", atSourceUs: 0, actualSourceUs: 0, stillnessRunStartUs: null },
    {
      kind: "visual",
      atSourceUs: 200_000,
      actualSourceUs: 200_000,
      stillnessRunStartUs: 0,
    },
    {
      kind: "visual",
      atSourceUs: 400_000,
      actualSourceUs: 400_000,
      stillnessRunStartUs: 0,
    },
  ]);
  expect(events.find((e) => e.kind === "cursor")?.sample.sourceUs).toBe(0);
  const sparse = await fixture({
    durationUs: 120_000_000,
    actual: (at) => (at < 50_000_000 ? 0 : 100_000_000),
  });
  sparse.input.revision = sparse.store.edit(sparse.input.sourceIdentity.recordingId, {
    operation: "cut",
    requestId: "cut",
    expectedRevisionId: "r0",
    ranges: [{ startUs: 80_000_000, endUs: 110_000_000 }],
  });
  const held = (await collect(sparse.events()))
    .filter((e) => e.kind === "visual")
    .filter((e) => e.atSourceUs >= 50_000_000);
  expect(held[0]?.atSourceUs).toBe(50_000_000);
  expect(held.at(-1)?.atSourceUs).toBe(119_999_999);
  expect(held.every((e) => e.stillnessRunStartUs === null)).toBe(true);
});

test("thirty-minute static evidence uses bounded pages before its first event without preloading cursor history", async () => {
  const f = await fixture({
    durationUs: 1_800_000_000,
    records: [geometry(0), ...Array.from({ length: 2001 }, (_, i) => point(i * 100_000))],
  });
  const scenePages = vi.spyOn(f.stores.scenes, "page");
  const cursorPages = vi.spyOn(f.stores.source, "page");
  const pauseWindows = vi.spyOn(f.stores.source, "pauseBoundaries");
  const geometryWindows = vi.spyOn(f.stores.source, "geometryChanges");
  const iterator = f.events();
  const began = performance.now();
  expect(await iterator.next()).toEqual({
    done: false,
    value: {
      kind: "visual",
      atSourceUs: 0,
      actualSourceUs: 0,
      stillnessRunStartUs: 0,
    },
  });
  console.info(
    `Thirty-minute static first event: ${Math.round(performance.now() - began)} ms; ${scenePages.mock.calls.length} scene pages, ${pauseWindows.mock.calls.length + geometryWindows.mock.calls.length} timing windows, ${cursorPages.mock.calls.length} cursor page`,
  );
  expect(scenePages.mock.calls.length).toBeLessThanOrEqual(181);
  expect(scenePages.mock.calls.every(([request]) => request.limit === 1)).toBe(true);
  expect(pauseWindows.mock.calls.length).toBeLessThanOrEqual(181);
  expect(geometryWindows.mock.calls.length).toBeLessThanOrEqual(181);
  expect(cursorPages.mock.calls.map(([request]) => request.limit)).toEqual([1000]);
  await iterator.return(undefined);
  expect(cursorPages.mock.calls.length).toBe(1);
});

test("abort is observed during empty-window scans and after an event without another catalog read", async () => {
  const f = await fixture({ durationUs: 120_000_000 });
  const abort = new AbortController();
  const pauseWindows = vi.spyOn(f.stores.source, "pauseBoundaries");
  const stopped = f.events(abort.signal).next();
  setImmediate(() => abort.abort(new Error("stop scan")));
  await expect(stopped).rejects.toThrow("stop scan");
  expect(pauseWindows.mock.calls.length).toBeLessThan(13);
  const later = new AbortController();
  const iterator = f.events(later.signal);
  await iterator.next();
  const scenePages = vi.spyOn(f.stores.scenes, "page");
  later.abort(new Error("stop stream"));
  await expect(iterator.next()).rejects.toThrow("stop stream");
  expect(scenePages.mock.calls).toHaveLength(0);
});

test("timing density over the catalog limit is explicit instead of truncating reset evidence", async () => {
  const f = await fixture({
    records: [geometry(0), ...Array.from({ length: 1001 }, () => pause(1_000_000))],
  });
  await expect(f.events().next()).rejects.toMatchObject({ code: "LIMIT_EXCEEDED" });
});

test("pinned evidence identity and source duration cannot be mixed", async () => {
  const f = await fixture();
  await expect(
    selectionEvidence(
      { ...f.input, sceneIdentity: { ...f.input.sceneIdentity, sourceId: "other" } },
      f.stores,
      new AbortController().signal,
    ).next(),
  ).rejects.toMatchObject({ code: "INVALID_EVIDENCE" });
  await expect(
    selectionEvidence(
      { ...f.input, revision: { ...f.input.revision, sourceDurationUs: 30_000_000 } },
      f.stores,
      new AbortController().signal,
    ).next(),
  ).rejects.toMatchObject({ code: "INVALID_EVIDENCE" });
});

test("first delayed geometry resets unknown pointing while confirmations and absent coordinates stay explicit", async () => {
  const unknown = point(0);
  const f = await fixture({
    records: [
      {
        ...unknown,
        data: {
          ...unknown.data,
          x: null,
          y: null,
          eligibility: "unknownGeometry",
          geometryEpoch: 0,
          buttons: 1,
        },
      },
      geometry(500_000, 2),
      geometry(700_000, 2),
    ],
  });
  const events = await collect(f.events());
  expect(events.filter((e) => e.kind === "boundary")).toEqual([
    { kind: "boundary", reason: "geometry", atSourceUs: 500_000 },
  ]);
  expect(events.find((e) => e.kind === "cursor")).toEqual({
    kind: "cursor",
    sample: {
      sourceUs: 0,
      x: null,
      y: null,
      eligibility: "unknownGeometry",
      geometryEpoch: 0,
      buttons: 1,
      sequence: 1,
    },
  });
});

test("bounded channel rounding across coverage windows and chunks collapses to mandatory endpoints", async () => {
  const durationUs = 16_000_000;
  const f = await fixture({
    durationUs,
    records: [geometry(0), ...Array.from({ length: 160 }, (_, i) => point(i * 100_000))],
    color: (at) => 100 + (Math.floor(at / 200_000) % 3),
  });
  const rows = await collect(
    selectIndex({ ...f.input, sourceWidth: 100, sourceHeight: 80 }, f.events()),
  );
  expect(
    rows.filter((row) => row.kind === "candidate").map((row) => row.requestedSourceUs),
  ).toEqual([0, 15_999_999]);
  expect(rows.filter((row) => row.kind === "coverage").map((row) => row.equality)).toEqual([
    "sampled",
    "sampled",
    "sampled",
    "sampled",
  ]);
});

test("tiny monotonic drift accumulates across coverage and chunk edges until it needs a new image", async () => {
  const f = await fixture({
    durationUs: 16_000_000,
    records: [geometry(0), ...Array.from({ length: 160 }, (_, i) => point(i * 100_000))],
    color: (at) => 100 + (at >= 10_200_000 ? 3 : at >= 9_800_000 ? 2 : at >= 4_800_000 ? 1 : 0),
  });
  const rows = await collect(
    selectIndex({ ...f.input, sourceWidth: 100, sourceHeight: 80 }, f.events()),
  );
  expect(
    rows.filter((row) => row.kind === "candidate").map((row) => row.requestedSourceUs),
  ).toEqual([0, 15_000_000, 15_999_999]);
  expect(rows.filter((row) => row.kind === "coverage").map((row) => row.equality)).toEqual([
    "sampled",
    "sampled",
    "unproven",
    "sampled",
  ]);
});

test("a three-level change in one small feature stays visible even when it returns within the window", async () => {
  const f = await fixture({
    durationUs: 12_000_000,
    records: [geometry(0), ...Array.from({ length: 120 }, (_, i) => point(i * 100_000))],
    raster: { width: 64, height: 40 },
    color: (at, channel) => (channel === 100 && at === 4_600_000 ? 103 : 100),
  });
  const events = await collect(f.events());
  expect(events.filter((event) => event.kind === "boundary")).toEqual([]);
  const rows = await collect(
    selectIndex({ ...f.input, sourceWidth: 100, sourceHeight: 80 }, events),
  );
  expect(
    rows.filter((row) => row.kind === "candidate").map((row) => row.requestedSourceUs),
  ).toEqual([0, 5_000_000, 11_999_999]);
  expect(rows.filter((row) => row.kind === "coverage").map((row) => row.equality)).toEqual([
    "unproven",
    "sampled",
    "sampled",
  ]);
});
