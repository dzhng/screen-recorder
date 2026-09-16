import { afterEach, expect, test } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RevisionStore } from "./library.js";
import { SourceEvidenceStore } from "./evidence.js";
import type { VisualSampler } from "./scenes.js";
import { planFrameTrail } from "./trails.js";

const cleanup: (() => void)[] = [];
afterEach(() => cleanup.splice(0).forEach((close) => close()));
const geometry = (sourceUs = 0, epoch = 1) => ({
  event: "geometry",
  data: {
    sourceUs,
    epoch,
    hostUs: sourceUs + 1000,
    geometry: {
      outputWidth: 100,
      outputHeight: 80,
      contentScale: 1,
      scaleFactor: 1,
      contentRect: { x: 0, y: 0, width: 100, height: 80 },
    },
  },
});
const point = (sourceUs: number, x: number, y = 20, eligibility = "inside", geometryEpoch = 1) => ({
  event: "cursorSample",
  data: { sourceUs, x, y, globalX: x, globalY: y, buttons: 0, eligibility, geometryEpoch },
});
async function fixture(records: { event: string; data: Record<string, unknown> }[]) {
  const root = mkdtempSync(join(tmpdir(), "trail-plan-"));
  let next = 0;
  const store = new RevisionStore(join(root, "catalog.sqlite"), {
    now: () => "",
    newId: () => String(++next),
  });
  cleanup.push(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  const recording = store.allocate().recording;
  const identity = {
    recordingId: recording.recordingId,
    sourceId: recording.sourceId,
    generation: "fixture",
  };
  const file = join(root, "normalized.jsonl");
  const body = records.map((row) => JSON.stringify(row) + "\n").join("");
  writeFileSync(file, body);
  const cursors = records.filter((r) => r.event === "cursorSample");
  const evidence = new SourceEvidenceStore(store);
  await evidence.ingest({
    ...identity,
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
      firstCursorSourceUs: (cursors[0]?.data.sourceUs as number) ?? null,
      lastCursorSourceUs: (cursors.at(-1)?.data.sourceUs as number) ?? null,
      bytes: Buffer.byteLength(body),
      lastSequence: records.length,
      incompleteTail: false,
      finished: true,
    },
  });
  const sample =
    (frames: [number, number][]): VisualSampler =>
    async (request) => ({
      sourceWidth: 100,
      sourceHeight: 80,
      samples: request.atSourceUs.map((at) => {
        const selected = frames
          .filter(([t]) => t >= request.kept.startUs && t < request.kept.endUs)
          .sort(([a], [b]) => Math.abs(a - at) - Math.abs(b - at) || a - b)[0];
        if (!selected) throw new Error("No reference sample");
        return {
          requestedSourceUs: at,
          actualSourceUs: selected[0],
          distanceUs: Math.abs(selected[0] - at),
          width: 8,
          height: 8,
          rgbBase64: Buffer.alloc(8 * 8 * 3, selected[1]).toString("base64"),
        };
      }),
    });
  return { evidence, identity, sample };
}
const request = {
  source: "/generated/video.mov",
  kept: { startUs: 0, endUs: 4000000 },
  requestedSourceUs: 1500000,
};
const signal = () => new AbortController().signal;

test("held image retains requested-time circle and future identical image never imports a later wave", async () => {
  const f = await fixture([
    geometry(),
    point(200000, 20, 20),
    point(400000, 30, 10),
    point(600000, 40, 20),
    point(800000, 30, 30),
    point(1000000, 20, 20),
    point(1600000, 80, 40),
    point(1700000, 90, 40),
  ]);
  for (const frames of [
    [[0, 0]],
    [
      [0, 0],
      [2000000, 0],
    ],
  ] as [number, number][][]) {
    const plan = await planFrameTrail(request, { ...f, sample: f.sample(frames) }, signal());
    expect(plan.overlay.trailUs).toBe(2000000);
    expect(plan.overlay.trail).toEqual([
      [
        { atSourceUs: 200000, x: 20, y: 20 },
        { atSourceUs: 400000, x: 30, y: 10 },
        { atSourceUs: 600000, x: 40, y: 20 },
        { atSourceUs: 800000, x: 30, y: 30 },
        { atSourceUs: 1000000, x: 20, y: 20 },
      ],
    ]);
    expect(plan.overlay.pointer).toEqual({ atSourceUs: 1000000, x: 20, y: 20 });
    expect(plan.agedFromUs).toBe(1500000);
  }
});

test("future changed frames veto past trails without borrowing future cursor samples", async () => {
  const f = await fixture([geometry(), point(1000000, 20), point(1600000, 80)]);
  const plan = await planFrameTrail(
    request,
    {
      ...f,
      sample: f.sample([
        [0, 0],
        [2000000, 255],
      ]),
    },
    signal(),
  );
  expect(plan.overlay).toEqual({ trail: [], trailUs: 2000000, pointer: null });
  expect(plan.cutoffs).toContainEqual({ reason: "future_scene", atSourceUs: 2000000 });
  expect(plan.pointerObservation?.sourceUs).toBe(1000000);
});

test("held window moves reset old pointing while compatible new pixel coordinates remain usable", async () => {
  const movedBase = geometry(500000, 2);
  const moved = {
    ...movedBase,
    data: {
      ...movedBase.data,
      geometry: {
        ...movedBase.data.geometry,
        screenRect: { x: 500, y: 300, width: 100, height: 80 },
      },
    },
  };
  const f = await fixture([
    geometry(),
    point(400000, 10),
    moved,
    point(600000, 30, 20, "inside", 2),
  ]);
  const plan = await planFrameTrail(request, { ...f, sample: f.sample([[0, 0]]) }, signal());
  expect(plan.overlay.trail).toEqual([[{ atSourceUs: 600000, x: 30, y: 20 }]]);
  expect(plan.overlay.pointer).toEqual({ atSourceUs: 600000, x: 30, y: 20 });
  expect(plan.cutoffs).toContainEqual({ reason: "geometry", atSourceUs: 500000 });
  moved.data.geometry.contentRect.width = 80;
  const resized = await fixture([geometry(), moved, point(600000, 30, 20, "inside", 2)]);
  const incompatible = await planFrameTrail(
    request,
    { ...resized, sample: resized.sample([[0, 0]]) },
    signal(),
  );
  expect(incompatible.overlay.pointer).toBeNull();
  expect(incompatible.overlay.trail).toEqual([]);
  expect(incompatible.cutoffs).toContainEqual({ reason: "geometry", atSourceUs: 500000 });
});

test("cut, scene and pause resets clip history, and equal-time pause points are omitted", async () => {
  const f = await fixture([
    geometry(),
    point(200000, 10),
    point(600000, 20),
    { event: "pause", data: { atSourceUs: 700000, elapsedPauseUs: 1000000 } },
    point(700000, 30),
    point(800000, 40),
    point(1000000, 50),
  ]);
  const plan = await planFrameTrail(
    { ...request, kept: { startUs: 500000, endUs: 4000000 } },
    {
      ...f,
      sample: f.sample([
        [500000, 0],
        [900000, 255],
        [1500000, 255],
      ]),
    },
    signal(),
  );
  expect(plan.overlay.trail).toEqual([[{ atSourceUs: 1000000, x: 50, y: 20 }]]);
  expect(plan.cutoffs).toContainEqual({ reason: "kept_start", atSourceUs: 500000 });
  expect(plan.cutoffs).toContainEqual({ reason: "pause", atSourceUs: 700000 });
  expect(plan.cutoffs).toContainEqual({ reason: "scene", atSourceUs: 900000 });
  const equal = await planFrameTrail(
    { ...request, requestedSourceUs: 700000 },
    { ...f, sample: f.sample([[0, 0]]) },
    signal(),
  );
  expect(equal.overlay.pointer).toBeNull();
  expect(equal.overlay.trail).toEqual([]);
});

test("ineligible observations split paths and the latest unknown pointer never revives an older point", async () => {
  const f = await fixture([
    geometry(),
    point(200000, 10),
    point(300000, -1, 20, "outside"),
    point(400000, 20),
    point(500000, 30),
    point(500000, 40, 20, "unknownGeometry", 0),
  ]);
  const plan = await planFrameTrail(request, { ...f, sample: f.sample([[0, 0]]) }, signal());
  expect(plan.overlay.trail).toEqual([
    [{ atSourceUs: 200000, x: 10, y: 20 }],
    [{ atSourceUs: 400000, x: 20, y: 20 }],
  ]);
  expect(plan.overlay.pointer).toBeNull();
  expect(plan.cutoffs).toContainEqual({ reason: "unknown_geometry", atSourceUs: 500000 });
});

test("pointer-only preserves an old observation with explicit bounded scene compatibility", async () => {
  const f = await fixture([geometry(), point(1000000, 30)]);
  const far = {
    ...request,
    requestedSourceUs: 119000000,
    kept: { startUs: 0, endUs: 121000000 },
    trailUs: 0,
  };
  for (const changed of [false, true]) {
    const plan = await planFrameTrail(
      far,
      {
        ...f,
        sample: f.sample([
          [0, 0],
          [120000000, changed ? 255 : 0],
        ]),
      },
      signal(),
    );
    expect(plan.overlay.trail).toEqual([]);
    expect(plan.overlay.pointer).toEqual(changed ? null : { atSourceUs: 1000000, x: 30, y: 20 });
    expect(plan.scene.coverage).toHaveLength(1);
    if (!changed) expect(plan.stalePointerScene?.coverage).toHaveLength(1);
  }
});

test("stale-pointer endpoint comparison rejects a known changed held image without a time-to-live", async () => {
  const f = await fixture([geometry(), point(1000000, 30)]);
  const far = {
    ...request,
    requestedSourceUs: 119000000,
    kept: { startUs: 0, endUs: 121000000 },
    trailUs: 0,
  };
  const plan = await planFrameTrail(
    far,
    {
      ...f,
      sample: f.sample([
        [0, 0],
        [118000000, 255],
      ]),
    },
    signal(),
  );
  expect(plan.scene.futureComparison).toBeNull();
  expect(plan.stalePointerComparison?.boundary).toBe(true);
  expect(plan.overlay.pointer).toBeNull();
});

test("repeated geometry confirmations do not reset a run and unresolved null placement fails explicitly", async () => {
  const f = await fixture([geometry(), point(200000, 10), geometry(300000), point(400000, 20)]);
  const plan = await planFrameTrail(request, { ...f, sample: f.sample([[0, 0]]) }, signal());
  expect(plan.overlay.trail[0]).toEqual([
    { atSourceUs: 200000, x: 10, y: 20 },
    { atSourceUs: 400000, x: 20, y: 20 },
  ]);
  expect(plan.cutoffs.some((cutoff) => cutoff.reason === "geometry")).toBe(false);
  const unplaced = { event: "geometry", data: { ...geometry(1000000, 2).data, sourceUs: null } };
  const unknown = await fixture([geometry(), unplaced, point(1200000, 20, 20, "inside", 2)]);
  await expect(
    planFrameTrail(request, { ...unknown, sample: unknown.sample([[0, 0]]) }, signal()),
  ).rejects.toMatchObject({ code: "UNAVAILABLE" });
  const confirmed = await fixture([geometry(), unplaced, geometry(2000000, 2), point(1200000, 20)]);
  const historical = await planFrameTrail(
    request,
    { ...confirmed, sample: confirmed.sample([[0, 0]]) },
    signal(),
  );
  expect(historical.overlay.pointer).toEqual({ atSourceUs: 1200000, x: 20, y: 20 });
});

test("missing geometry, reference and generation remain explicit and scene cancellation propagates", async () => {
  const f = await fixture([point(1000000, 20)]);
  await expect(
    planFrameTrail(request, { ...f, sample: f.sample([[0, 0]]) }, signal()),
  ).rejects.toMatchObject({ code: "UNAVAILABLE" });
  const valid = await fixture([geometry(), point(1000000, 20)]);
  await expect(
    planFrameTrail(request, { ...valid, sample: valid.sample([[2000000, 0]]) }, signal()),
  ).rejects.toThrow("No reference sample");
  await expect(
    planFrameTrail(
      request,
      {
        ...valid,
        identity: { ...valid.identity, generation: "missing" },
        sample: valid.sample([[0, 0]]),
      },
      signal(),
    ),
  ).rejects.toMatchObject({ code: "NOT_READY" });
  const controller = new AbortController();
  const sample: VisualSampler = async (params) => {
    controller.abort();
    return valid.sample([[0, 0]])(params, controller.signal);
  };
  await expect(planFrameTrail(request, { ...valid, sample }, controller.signal)).rejects.toThrow();
});

test("point and observation budgets fail explicitly rather than dropping part of the gesture", async () => {
  for (const count of [1200, 1201, 5001]) {
    const f = await fixture([
      geometry(),
      ...Array.from({ length: count }, (_, i) => point(i * 100, 20)),
    ]);
    const pending = planFrameTrail(request, { ...f, sample: f.sample([[0, 0]]) }, signal());
    if (count === 1200) expect((await pending).overlay.trail[0]).toHaveLength(1200);
    else await expect(pending).rejects.toMatchObject({ code: "LIMIT_EXCEEDED" });
  }
});

test("native-normalized buffered pause fixture keeps only later source-time observations", async () => {
  const nativeFixture = new URL(
    "../../../specs/recording-for-ai/assets/trail-evidence/normalized.jsonl",
    import.meta.url,
  );
  const before = readFileSync(nativeFixture, "utf8");
  const f = await fixture(
    before
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line)),
  );
  const plan = await planFrameTrail(request, { ...f, sample: f.sample([[0, 0]]) }, signal());
  expect(plan.overlay.trail).toEqual([[{ atSourceUs: 101, x: 40, y: 20 }]]);
  expect(plan.overlay.pointer).toEqual({ atSourceUs: 101, x: 40, y: 20 });
  expect(readFileSync(nativeFixture, "utf8")).toBe(before);
});

test("a pause before a future identical image vetoes old evidence without acquiring a future pointer", async () => {
  const f = await fixture([
    geometry(),
    point(1000000, 20),
    { event: "pause", data: { atSourceUs: 1800000, elapsedPauseUs: 1000000 } },
    point(1900000, 80),
  ]);
  const plan = await planFrameTrail(
    request,
    {
      ...f,
      sample: f.sample([
        [0, 0],
        [2000000, 0],
      ]),
    },
    signal(),
  );
  expect(plan.scene.futureComparison?.boundary).toBe(false);
  expect(plan.overlay).toEqual({ trail: [], trailUs: 2000000, pointer: null });
  expect(plan.cutoffs).toContainEqual({ reason: "pause", atSourceUs: 1800000 });
  expect(plan.pointerObservation?.sourceUs).toBe(1000000);
});
