import { expect, test } from "vitest";
import { scenePolicy } from "./scenes.js";
import { createOriginalRevision, createRevision } from "./timeline.js";
import {
  selectIndex,
  type SelectionEvent,
  type SelectionInput,
  type SelectionRecord,
} from "./selection.js";
const input = (durationUs: number): SelectionInput => ({
  revision: createOriginalRevision(durationUs, ""),
  sourceIdentity: {
    owner: { kind: "recording" as const, recordingId: "r" },
    sourceId: "s",
    generation: "source",
  },
  sceneIdentity: {
    recordingId: "r",
    sourceId: "s",
    generation: "scene",
    policy: scenePolicy.id,
  },
  sourceWidth: 1000,
  sourceHeight: 1000,
});
async function ledger(config: SelectionInput, events: SelectionEvent[] = []) {
  const rows: SelectionRecord[] = [];
  for await (const row of selectIndex(config, events)) rows.push(row);
  return rows;
}
function candidates(rows: SelectionRecord[]) {
  return rows.filter((r) => r.kind === "candidate");
}
test("retained spans preserve both cut sides, first/last and bounded explicit coverage", async () => {
  const config = input(20_000_000);
  config.revision = createRevision(
    config.revision,
    [
      { startUs: 0, endUs: 6_000_000 },
      { startUs: 10_000_000, endUs: 12_000_000 },
    ],
    { id: "r1", createdAt: "", operation: "cut" },
  );
  const rows = await ledger(config);
  expect(
    candidates(rows).map((r) => [
      r.requestedSourceUs,
      r.requestedPlaybackUs,
      r.reasons.map((v) => v.kind),
    ]),
  ).toEqual([
    [0, 0, ["first"]],
    [5_000_000, 5_000_000, ["coverage"]],
    [5_999_999, 5_999_999, ["last", "cut"]],
    [10_000_000, 6_000_000, ["first", "cut"]],
    [11_999_999, 7_999_999, ["last", "cut"]],
  ]);
  expect(rows.filter((r) => r.kind === "coverage").map((r) => [r.source, r.playback])).toEqual([
    [
      { startUs: 0, endUs: 5_000_000 },
      { startUs: 0, endUs: 5_000_000 },
    ],
    [
      { startUs: 5_000_000, endUs: 6_000_000 },
      { startUs: 5_000_000, endUs: 6_000_000 },
    ],
    [
      { startUs: 10_000_000, endUs: 12_000_000 },
      { startUs: 6_000_000, endUs: 8_000_000 },
    ],
  ]);
});
const cursor = (
  sourceUs: number,
  x: number,
  y = 0,
  buttons = 0,
  sequence = sourceUs,
): SelectionEvent => ({
  kind: "cursor",
  sample: { sourceUs, x, y, buttons, sequence, eligibility: "inside", geometryEpoch: 1 },
});
const motionRows = (rows: SelectionRecord[]) =>
  candidates(rows).filter((r) => r.reasons.some((v) => v.kind === "cursor-motion"));
test("circle displacement survives return to origin and observed 300ms idle closes at last motion", async () => {
  const events = [
    cursor(0, 0),
    cursor(100_000, 10),
    cursor(200_000, 10, 10),
    cursor(300_000, 0, 10),
    cursor(400_000, 0),
    cursor(699_999, 0),
    cursor(700_000, 0),
  ];
  const rows = await ledger(input(1_000_000), events);
  expect(motionRows(rows).map((r) => [r.requestedSourceUs, r.reasons])).toEqual([
    [400_000, [{ kind: "cursor-motion", eventSourceUs: 400_000, trigger: "idle" }]],
  ]);
  const before = await ledger(input(700_000), events.slice(0, -1));
  expect(motionRows(before)[0]?.reasons[0]?.trigger).toBe("end");
});

test("continuous motion emits every two observed seconds and stillness before motion does not count", async () => {
  const events = Array.from({ length: 51 }, (_, i) => cursor(i * 100_000, i * 2));
  expect(
    motionRows(await ledger(input(5_100_000), events)).map((r) => [
      r.requestedSourceUs,
      r.reasons.find((v) => v.kind === "cursor-motion")?.trigger,
    ]),
  ).toEqual([
    [2_000_000, "continuous"],
    [4_000_000, "continuous"],
    [5_000_000, "end"],
  ]);
  const delayed = [
    ...Array.from({ length: 41 }, (_, i) => cursor(i * 100_000, 0)),
    cursor(4_100_000, 10),
    cursor(4_200_000, 20),
    cursor(4_300_000, 20),
    cursor(4_500_000, 20),
  ];
  expect(
    motionRows(await ledger(input(4_600_000), delayed)).map((r) => [
      r.requestedSourceUs,
      r.reasons.find((v) => v.kind === "cursor-motion")?.trigger,
    ]),
  ).toEqual([[4_200_000, "idle"]]);
});

test("acquisition gaps flush only the observed endpoint before later coverage", async () => {
  const rows = await ledger(input(7_000_000), [
    cursor(4_600_000, 0),
    cursor(4_700_000, 10),
    cursor(4_800_000, 10, 10),
    cursor(4_900_000, 0),
    cursor(6_000_000, 50),
  ]);
  expect(
    motionRows(rows).map((r) => [
      r.requestedSourceUs,
      r.reasons.find((v) => v.kind === "cursor-motion")?.trigger,
    ]),
  ).toEqual([[4_900_000, "acquisition_gap"]]);
  expect(candidates(rows).map((r) => r.requestedSourceUs)).toEqual([
    0, 4_900_000, 5_000_000, 6_999_999,
  ]);
  expect(candidates(rows).map((r) => r.ordinal)).toEqual([0, 1, 2, 3]);
});
function stillEvents(duration: number, changedAt = -1): SelectionEvent[] {
  const events: SelectionEvent[] = [];
  for (let time = 0; time < duration; time += 100_000) {
    events.push(cursor(time, 20));
    if (time % 200_000 === 0)
      events.push({
        kind: "visual",
        atSourceUs: time,
        actualSourceUs: time,
        stillnessRunStartUs: changedAt >= 0 && time >= changedAt ? changedAt : 0,
      });
  }
  return events;
}
test("static collapse retains explicit windows while a change beyond the stillness envelope blocks it", async () => {
  const rows = await ledger(input(12_000_000), stillEvents(12_000_000));
  expect(candidates(rows).map((r) => r.requestedSourceUs)).toEqual([0, 11_999_999]);
  expect(
    rows.filter((r) => r.kind === "coverage").map((r) => [r.ordinal, r.source, r.equality]),
  ).toEqual([
    [0, { startUs: 0, endUs: 5_000_000 }, "sampled"],
    [0, { startUs: 5_000_000, endUs: 10_000_000 }, "sampled"],
    [0, { startUs: 10_000_000, endUs: 12_000_000 }, "sampled"],
  ]);
  const changed = await ledger(input(12_000_000), stillEvents(12_000_000, 4_000_000));
  expect(candidates(changed).map((r) => r.requestedSourceUs)).toEqual([0, 5_000_000, 11_999_999]);
  const missing = await ledger(
    input(12_000_000),
    stillEvents(12_000_000).filter((e) => !(e.kind === "visual" && e.atSourceUs === 4_000_000)),
  );
  expect(candidates(missing).map((r) => r.requestedSourceUs)).toContain(5_000_000);
  const moved = stillEvents(12_000_000).map((e) =>
    e.kind === "cursor" && e.sample.sourceUs === 4_000_000 ? cursor(4_000_000, 20.5) : e,
  );
  expect(
    candidates(await ledger(input(12_000_000), moved)).map((r) => r.requestedSourceUs),
  ).toContain(5_000_000);
});

test("last normalized duplicate wins and rapid button downs bypass ordinary spacing", async () => {
  const rows = await ledger(input(1_000_000), [
    cursor(0, 0),
    cursor(100_000, 30, 0, 1, 1),
    cursor(100_000, 0, 0, 0, 2),
    cursor(200_000, 0, 0, 1),
    cursor(250_000, 0),
    cursor(300_000, 0, 0, 1),
    cursor(400_000, 0),
  ]);
  expect(
    candidates(rows)
      .filter((r) => r.reasons.some((v) => v.kind === "button-down"))
      .map((r) => r.requestedSourceUs),
  ).toEqual([200_000, 300_000]);
  expect(motionRows(rows)).toEqual([]);
});

test("jitter is ignored but slow displacement accumulates from the accepted anchor", async () => {
  const jitter = Array.from({ length: 30 }, (_, i) => cursor(i * 100_000, i % 2 ? 0.4 : 0));
  expect(motionRows(await ledger(input(3_000_000), jitter))).toEqual([]);
  const slow = Array.from({ length: 51 }, (_, i) => cursor(i * 100_000, i * 0.4));
  expect(motionRows(await ledger(input(5_100_000), slow)).map((r) => r.requestedSourceUs)).toEqual([
    2_700_000,
  ]);
});

test("pause and scene sides remain mandatory even one microsecond apart, geometry resets bursts", async () => {
  const events: SelectionEvent[] = [
    cursor(0, 0),
    cursor(100_000, 20),
    { kind: "boundary", atSourceUs: 200_000, reason: "pause" },
    { kind: "boundary", atSourceUs: 200_001, reason: "scene" },
    cursor(250_000, 0),
    cursor(300_000, 20),
    { kind: "boundary", atSourceUs: 350_000, reason: "geometry" },
    cursor(400_000, 0),
    cursor(500_000, 20),
  ];
  const rows = await ledger(input(600_000), events);
  expect(candidates(rows).map((r) => r.requestedSourceUs)).toEqual([
    0, 100_000, 199_999, 200_000, 200_001, 300_000, 500_000, 599_999,
  ]);
  expect(candidates(rows).find((r) => r.requestedSourceUs === 200_000)?.reasons).toEqual([
    { kind: "pause", eventSourceUs: 200_000, side: "after" },
    { kind: "scene", eventSourceUs: 200_001, side: "before" },
  ]);
  expect(
    motionRows(rows).map((r) => [
      r.requestedSourceUs,
      r.reasons.find((v) => v.kind === "cursor-motion")?.trigger,
    ]),
  ).toEqual([
    [100_000, "reset"],
    [300_000, "reset"],
    [500_000, "end"],
  ]);
});

test("sparse future scenes stay at actual time and removed held frames cannot establish equality", async () => {
  const events: SelectionEvent[] = [
    {
      kind: "visual",
      atSourceUs: 50_000_000,
      actualSourceUs: 100_000_000,
      stillnessRunStartUs: 1,
    },
    { kind: "boundary", atSourceUs: 100_000_000, reason: "scene" },
  ];
  const rows = await ledger(input(110_000_000), events);
  expect(
    candidates(rows)
      .filter((r) => r.reasons.some((v) => v.kind === "scene"))
      .map((r) => r.requestedSourceUs),
  ).toEqual([99_999_999, 100_000_000]);
  const config = input(12_000_000);
  config.revision = createRevision(config.revision, [{ startUs: 1_000_000, endUs: 12_000_000 }], {
    id: "r1",
    createdAt: "",
    operation: "trim",
  });
  const held = stillEvents(12_000_000).map((e) =>
    e.kind === "visual" ? { ...e, actualSourceUs: 0, stillnessRunStartUs: null } : e,
  );
  expect(candidates(await ledger(config, held)).map((r) => r.requestedSourceUs)).toEqual([
    1_000_000, 6_000_000, 11_000_000, 11_999_999,
  ]);
});

test("source paging and duplicate splits do not change the ledger", async () => {
  const events: SelectionEvent[] = [
    ...stillEvents(6_000_000),
    cursor(6_000_000, 40, 0, 1, 1),
    cursor(6_000_000, 20, 0, 0, 2),
    cursor(6_100_000, 40),
    cursor(6_200_000, 20),
    cursor(6_400_000, 20),
    cursor(6_500_000, 20),
  ];
  const expected = await ledger(input(7_000_000), events);
  for (const size of [1, 7, 31]) {
    async function* pages() {
      for (let offset = 0; offset < events.length; offset += size) {
        await Promise.resolve();
        yield* events.slice(offset, offset + size);
      }
    }
    const rows: SelectionRecord[] = [];
    for await (const row of selectIndex(input(7_000_000), pages())) rows.push(row);
    expect(rows).toEqual(expected);
  }
});

test("thirty-minute evidence is consumed incrementally and coverage references emitted images", async () => {
  let consumed = 0,
    firstOutputAt: number | undefined,
    candidateCount = 0,
    coverageCount = 0,
    lastEnd = 0;
  const emitted = new Set<number>();
  function* events(): Generator<SelectionEvent> {
    for (let time = 0; time < 1_800_000_000; time += 100_000) {
      consumed++;
      yield cursor(time, 20);
      if (time % 200_000 === 0) {
        consumed++;
        yield {
          kind: "visual",
          atSourceUs: time,
          actualSourceUs: time,
          stillnessRunStartUs: 0,
        };
      }
    }
  }
  for await (const row of selectIndex(input(1_800_000_000), events())) {
    firstOutputAt ??= consumed;
    if (row.kind === "candidate") {
      candidateCount++;
      emitted.add(row.ordinal);
    } else {
      expect(emitted.has(row.ordinal)).toBe(true);
      expect(row.source.startUs).toBe(lastEnd);
      expect(row.source.endUs - row.source.startUs).toBe(5_000_000);
      lastEnd = row.source.endUs;
      coverageCount++;
    }
  }
  expect(firstOutputAt).toBeLessThan(20);
  expect(consumed).toBe(27_000);
  expect(candidateCount).toBe(2);
  expect(coverageCount).toBe(360);
  expect(lastEnd).toBe(1_800_000_000);
});

test("ordinary coverage uses a nearby mandatory image without losing coverage", async () => {
  const rows = await ledger(input(7_000_000), [
    { kind: "boundary", atSourceUs: 4_800_000, reason: "pause" },
  ]);
  expect(candidates(rows).map((r) => r.requestedSourceUs)).toEqual([
    0, 4_799_999, 4_800_000, 6_999_999,
  ]);
  expect(rows.filter((r) => r.kind === "coverage").map((r) => [r.ordinal, r.source])).toEqual([
    [0, { startUs: 0, endUs: 5_000_000 }],
    [2, { startUs: 5_000_000, endUs: 7_000_000 }],
  ]);
});

test("outside and unknown observations break paths, while known absence can collapse", async () => {
  const events: SelectionEvent[] = [
    cursor(0, 0),
    cursor(100_000, 6),
    {
      kind: "cursor",
      sample: {
        sourceUs: 200_000,
        x: null,
        y: null,
        eligibility: "unknownGeometry",
        geometryEpoch: 1,
        buttons: 0,
        sequence: 2,
      },
    },
    cursor(300_000, 100),
    cursor(400_000, 106),
  ];
  expect(motionRows(await ledger(input(500_000), events))).toEqual([]);
  const outside = stillEvents(12_000_000).map((e) =>
    e.kind === "cursor"
      ? { ...e, sample: { ...e.sample, x: null, y: null, eligibility: "outside" } }
      : e,
  );
  expect(
    candidates(await ledger(input(12_000_000), outside)).map((r) => r.requestedSourceUs),
  ).toEqual([0, 11_999_999]);
});

test("cancellation interrupts long empty ranges and dense candidates fail explicitly", async () => {
  const controller = new AbortController(),
    stream = selectIndex(input(1_800_000_000), [], controller.signal);
  expect((await stream.next()).value?.kind).toBe("candidate");
  controller.abort();
  await expect(stream.next()).rejects.toThrow();
  function* dense(): Generator<SelectionEvent> {
    for (let i = 0; i < 6000; i++) {
      yield cursor(i * 2, 0, 0, 1);
      yield cursor(i * 2 + 1, 0);
    }
  }
  await expect(
    (async () => {
      for await (const record of selectIndex(input(100_000), dense())) void record;
    })(),
  ).rejects.toMatchObject({ code: "LIMIT_EXCEEDED" });
});

test("unconfirmed idle holds later candidates behind the last moving observation", async () => {
  const events: SelectionEvent[] = [
    cursor(4_800_000, 0),
    cursor(4_900_000, 20),
    cursor(5_199_999, 20),
    {
      kind: "visual",
      atSourceUs: 5_320_000,
      actualSourceUs: 5_320_000,
      stillnessRunStartUs: null,
    },
    cursor(5_399_999, 20),
  ];
  expect(
    candidates(await ledger(input(12_000_000), events)).map((r) => r.requestedSourceUs),
  ).toEqual([0, 4_900_000, 5_000_000, 10_000_000, 11_999_999]);
});

test("spacing cannot claim equality with a mandatory image preceding a measured change", async () => {
  const events: SelectionEvent[] = stillEvents(16_000_000, 5_000_000);
  events.push({ kind: "boundary", atSourceUs: 4_800_000, reason: "pause" });
  events.sort(
    (a, b) =>
      (a.kind === "cursor" ? a.sample.sourceUs : a.atSourceUs) -
      (b.kind === "cursor" ? b.sample.sourceUs : b.atSourceUs),
  );
  const rows = await ledger(input(16_000_000), events);
  expect(candidates(rows).map((r) => r.requestedSourceUs)).toEqual([
    0, 4_799_999, 4_800_000, 10_000_000, 15_999_999,
  ]);
  expect(rows.filter((r) => r.kind === "coverage").map((r) => [r.ordinal, r.equality])).toEqual([
    [0, "unproven"],
    [2, "unproven"],
    [3, "sampled"],
    [3, "sampled"],
  ]);
});
