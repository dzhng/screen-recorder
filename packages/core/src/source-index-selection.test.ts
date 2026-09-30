import { expect, test } from "vitest";
import type { SourceSceneChunk } from "./source-scene-chunks.js";
import {
  selectSourceIndex,
  sourceIndexQueryRanges,
  type SourceIndexRequest,
} from "./source-index-selection.js";
const clock = (start: number, end: number) => ({
  value: String(start + 1250000),
  timescale: 1000000,
  endValue: String(end + 1250000),
  endTimescale: 1000000,
});
const point = (
  at: number,
  start: number,
  end: number,
  run = start,
  continuous = at !== 0,
): SourceSceneChunk["coverage"][number] => ({
  requestedSourceUs: at,
  status: "available",
  actualSourceUs: start,
  sample: clock(start, end),
  width: 1,
  height: 1,
  continuousFromPrevious: continuous,
  stillnessRunStartUs: run,
});
function chunk(
  coverage: SourceSceneChunk["coverage"],
  comparisons: SourceSceneChunk["comparisons"] = [],
): SourceSceneChunk {
  return {
    policy: "fixture",
    assetId: "a",
    streamId: "v",
    originUs: 1250000,
    sourceWidth: 1,
    sourceHeight: 1,
    durationUs: 20000000,
    range: { startUs: 0, endUs: 20000000 },
    coverage,
    comparisons,
  };
}
async function collect(support: { startUs: number; endUs: number }[], chunks: SourceSceneChunk[]) {
  const rows: SourceIndexRequest[] = [];
  for await (const row of selectSourceIndex(support, chunks)) rows.push(row);
  return rows;
}
const pictures = (rows: SourceIndexRequest[]) => rows.filter((r) => r.kind === "picture");
test("scene sides select observed old/new samples instead of two requests in the new held frame", async () => {
  // The physical picture changes at 250ms, first observed on the 400ms grid.
  const before = clock(0, 250000),
    after = clock(250000, 1000000);
  const rows = pictures(
    await collect(
      [{ startUs: 0, endUs: 1000000 }],
      [
        chunk(
          [
            point(0, 0, 250000),
            point(200000, 0, 250000, 0),
            point(400000, 250000, 1000000, 400000),
            point(600000, 250000, 1000000, 400000),
          ],
          [
            {
              previous: before,
              current: after,
              actualSourceUs: 250000,
              changedPixelFraction: 1,
              changedCellFraction: 1,
              meanAbsoluteChannelDifference: 1,
              boundary: true,
            },
          ],
        ),
      ],
    ),
  );
  const sides = rows.filter((r) => r.reasons.some((reason) => reason.kind === "scene"));
  expect(sides.map((r) => r.requestedSourceUs)).toEqual([200000, 400000]);
  expect(sides.map((r) => r.reasons.find((reason) => reason.kind === "scene"))).toEqual([
    { kind: "scene", side: "before", observedSourceUs: 400000, sample: after, originUs: 1250000 },
    { kind: "scene", side: "after", observedSourceUs: 400000, sample: after, originUs: 1250000 },
  ]);
  const physical = (at: number) => (at < 250000 ? "old" : "new");
  expect(sides.map((r) => physical(r.requestedSourceUs))).toEqual(["old", "new"]);
  expect([399999, 400000].map(physical)).toEqual(["new", "new"]);
});
test("short support islands still request both edges when the scene grid observes neither", async () => {
  const rows = await collect(
    [{ startUs: 50000, endUs: 100000 }],
    [
      chunk(
        [0, 200000, 400000].map((at) => ({
          requestedSourceUs: at,
          status: "unavailable",
          reason: "outside_support",
          continuousFromPrevious: false,
        })),
      ),
    ],
  );
  expect(rows).toEqual([
    {
      kind: "picture",
      requestedSourceUs: 50000,
      support: { startUs: 50000, endUs: 100000 },
      reasons: [{ kind: "first", eventSourceUs: 50000 }],
    },
    {
      kind: "picture",
      requestedSourceUs: 99999,
      support: { startUs: 50000, endUs: 100000 },
      reasons: [{ kind: "last", eventSourceUs: 100000 }],
    },
  ]);
});
test("stillness suppresses redundant periodic frames while moving footage retains periodic requests", async () => {
  const observed = Array.from({ length: 61 }, (_, i) => point(i * 200000, 0, 13000000, 0));
  const still = pictures(await collect([{ startUs: 0, endUs: 13000000 }], [chunk(observed)]));
  expect(still.map((r) => r.requestedSourceUs)).toEqual([0, 12999999]);
  const moving = pictures(
    await collect(
      [{ startUs: 0, endUs: 13000000 }],
      [
        chunk(
          observed.map((p) =>
            point(p.requestedSourceUs, p.requestedSourceUs, p.requestedSourceUs + 200000),
          ),
        ),
      ],
    ),
  );
  expect(moving.map((r) => r.requestedSourceUs)).toEqual([0, 5000000, 10000000, 12999999]);
});
test("unavailable observations reset representative continuity without inventing an interval of missing pixels", async () => {
  const gap = {
    requestedSourceUs: 200000,
    status: "unavailable" as const,
    reason: "empty_edit" as const,
    continuousFromPrevious: false,
  };
  const rows = await collect(
    [{ startUs: 0, endUs: 1000000 }],
    [
      chunk([
        point(0, 0, 200000),
        gap,
        { ...gap, requestedSourceUs: 400000 },
        point(600000, 550000, 1000000, 600000, false),
      ]),
    ],
  );
  expect(rows.filter((r) => r.kind === "unavailable")).toEqual([
    {
      kind: "unavailable",
      requestedSourceUs: 200000,
      support: { startUs: 0, endUs: 1000000 },
      observation: gap,
    },
  ]);
  expect(pictures(rows).find((r) => r.requestedSourceUs === 600000)?.reasons).toEqual([
    { kind: "availability", eventSourceUs: 600000 },
  ]);
});
test("overlapping scene chunks preserve before/after reasons and ordered requests once", async () => {
  const a = point(0, 0, 250000),
    b = point(200000, 0, 250000, 0),
    c = point(400000, 250000, 1000000, 400000);
  const pair = {
    previous: clock(0, 250000),
    current: clock(250000, 1000000),
    actualSourceUs: 250000,
    changedPixelFraction: 1,
    changedCellFraction: 1,
    meanAbsoluteChannelDifference: 1,
    boundary: true,
  };
  expect(
    await collect([{ startUs: 0, endUs: 1000000 }], [chunk([a, b]), chunk([b, c], [pair])]),
  ).toEqual(await collect([{ startUs: 0, endUs: 1000000 }], [chunk([a, b, c], [pair])]));
});

test("known unavailable final observation does not turn into a picture request", async () => {
  const unavailable = (requestedSourceUs: number) => ({
    requestedSourceUs,
    status: "unavailable" as const,
    reason: "empty_edit" as const,
    continuousFromPrevious: false,
  });
  const rows = await collect(
    [{ startUs: 0, endUs: 400001 }],
    [chunk([unavailable(0), unavailable(200000), unavailable(400000)])],
  );
  expect(pictures(rows)).toEqual([]);
  expect(rows.map((r) => r.requestedSourceUs)).toEqual([0, 400000]);
});

test("dense support edges stop at the shared pending-work budget", async () => {
  const support = Array.from({ length: 3000 }, (_, i) => ({
    startUs: i * 4 + 1,
    endUs: i * 4 + 3,
  }));
  await expect(
    collect(support, [chunk([point(0, 0, 200000), point(200000, 200000, 400000)])]),
  ).rejects.toThrow("Too many source screenshot requests");
});

test("source index edges query only integer points inside exact support", async () => {
  const queries = sourceIndexQueryRanges([
    { startUs: { numerator: 1, denominator: 3 }, endUs: { numerator: 10, denominator: 3 } },
    { startUs: { numerator: 13, denominator: 3 }, endUs: { numerator: 14, denominator: 3 } },
    { startUs: 6, endUs: 8 },
  ]);
  expect(queries).toEqual([
    { startUs: 1, endUs: 4 },
    { startUs: 6, endUs: 8 },
  ]);
  const result = pictures(await collect(queries, []));
  expect(result.map((row) => row.requestedSourceUs)).toEqual([1, 3, 6, 7]);
});
