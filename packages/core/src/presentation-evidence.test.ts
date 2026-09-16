import { afterEach, expect, test } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { PresentationEvidence } from "./presentation-evidence.js";
import { createOriginalRevision, createRevision } from "./timeline.js";
import { observeVisualSamples } from "./scenes.js";

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});
const signal = () => new AbortController().signal;
const time = (value: number, timescale = 1_000_000) => ({ value: String(value), timescale });
const frame = (start: number, end: number, pts: number, shade: number, spanIndex = 0) => ({
  spanIndex,
  start: time(start),
  end: time(end),
  empty: false,
  sampleTime: time(pts),
  actualSourceUs: pts,
  width: 8,
  height: 8,
  rgbBase64: Buffer.alloc(8 * 8 * 3, shade).toString("base64"),
});
const revision = createRevision(
  createOriginalRevision(2_000_000, "fixture"),
  [{ startUs: 750_000, endUs: 1_250_000 }],
  { id: "cut", operation: "cut", createdAt: "fixture" },
);
async function fixture(
  records: unknown[] = [
    frame(750_000, 1_000_000, 0, 0),
    frame(1_000_000, 1_250_000, 1_000_000, 255),
  ],
  pinned = revision,
) {
  const root = await mkdtemp(join(tmpdir(), "presentation-reader-"));
  cleanups.push(() => rm(root, { recursive: true, force: true }));
  const file = join(root, "support.jsonl");
  const body = [
    {
      version: 1,
      sourceWidth: 8,
      sourceHeight: 8,
      durationUs: pinned.durationUs,
      spanCount: pinned.spans.length,
    },
    ...records,
  ]
    .map((r) => JSON.stringify(r) + "\n")
    .join("");
  await writeFile(file, body);
  const receipt = {
    file,
    version: 1 as const,
    sourceWidth: 8,
    sourceHeight: 8,
    durationUs: pinned.durationUs,
    records: records.length,
    bytes: Buffer.byteLength(body),
  };
  return { file, receipt, body };
}
test("exact support accepts held PTS before a cut while still membership stays strict", async () => {
  const f = await fixture();
  const source = await PresentationEvidence.open(f.receipt, revision, signal());
  cleanups.push(() => source.close());
  const cursor = source.cursor(signal());
  const held = await cursor.at(0, 750_000);
  expect(held.empty).toBe(false);
  if (held.empty) throw new Error("Expected held picture");
  expect(held.actualSourceUs).toBe(0);
  expect((await cursor.at(0, 1_000_000)).actualSourceUs).toBe(1_000_000);
  await expect(cursor.at(0, 1_250_000)).rejects.toMatchObject({ code: "INVALID_RANGE" });
  await expect(
    observeVisualSamples(
      {
        recordingId: "fixture",
        source: "/video.mov",
        kept: revision.spans[0]!,
        atSourceUs: [750_000],
      },
      async () => ({
        sourceWidth: 8,
        sourceHeight: 8,
        samples: [
          {
            requestedSourceUs: 750_000,
            actualSourceUs: 0,
            distanceUs: 750_000,
            width: 8,
            height: 8,
            rgbBase64: held.rgbBase64,
          },
        ],
      }),
      signal(),
    ),
  ).rejects.toMatchObject({ code: "INVALID_EVIDENCE" });
});

test("fractional boundaries use exact integer arithmetic, including clock values beyond Number precision", async () => {
  for (const boundary of [
    { value: "1", timescale: 3 },
    { value: "9007199254740993", timescale: 1000000000 },
  ]) {
    const below = Number((BigInt(boundary.value) * 1000000n) / BigInt(boundary.timescale));
    const actual = Number(
      (BigInt(boundary.value) * 2000000n + BigInt(boundary.timescale)) /
        (2n * BigInt(boundary.timescale)),
    );
    const pinned = createOriginalRevision(below + 2, "fixture");
    const f = await fixture(
      [
        { ...frame(0, 1, 0, 0), end: boundary },
        { ...frame(1, below + 2, actual, 255), start: boundary, sampleTime: boundary },
      ],
      pinned,
    );
    const source = await PresentationEvidence.open(f.receipt, pinned, signal());
    cleanups.push(() => source.close());
    const cursor = source.cursor(signal());
    expect((await cursor.at(0, below)).actualSourceUs).toBe(0);
    expect((await cursor.at(0, below + 1)).actualSourceUs).toBe(actual);
  }
});

test("independent cursors progress monotonically and honor close, cancellation and mutation", async () => {
  const f = await fixture();
  const source = await PresentationEvidence.open(f.receipt, revision, signal());
  cleanups.push(() => source.close());
  const lifetime = new AbortController(),
    current = source.cursor(lifetime.signal),
    prior = source.cursor(signal());
  expect((await current.at(0, 1_100_000)).actualSourceUs).toBe(1_000_000);
  expect((await prior.at(0, 800_000)).actualSourceUs).toBe(0);
  await expect(current.at(0, 800_000)).rejects.toMatchObject({ code: "INVALID_RANGE" });
  lifetime.abort();
  await expect(current.at(0, 1_200_000)).rejects.toMatchObject({ name: "AbortError" });
  await writeFile(f.file, f.body.replace('"actualSourceUs":0', '"actualSourceUs":1'));
  await expect(prior.at(0, 900_000)).rejects.toMatchObject({ code: "INVALID_EVIDENCE" });
  await source.close();
  await expect(prior.at(0, 900_000)).rejects.toMatchObject({ code: "UNAVAILABLE" });
});

test("admission rejects gaps, overlaps, false pictures and missing tail coverage", async () => {
  for (const records of [
    [frame(750_001, 1_250_000, 0, 0)],
    [frame(750_000, 1_000_001, 0, 0), frame(1_000_000, 1_250_000, 1_000_000, 255)],
    [frame(750_000, 1_000_000, 0, 0)],
    [frame(750_000, 1_250_000, 1_000_000, 0)],
    [{ ...frame(750_000, 1_250_000, 0, 0), rgbBase64: "bad" }],
  ]) {
    const f = await fixture(records);
    await expect(PresentationEvidence.open(f.receipt, revision, signal())).rejects.toMatchObject({
      code: "INVALID_EVIDENCE",
    });
  }
  const f = await fixture();
  for (const body of [f.body.slice(0, -1), " ".repeat(65_536) + "\n"]) {
    await writeFile(f.file, body);
    await expect(
      PresentationEvidence.open(
        { ...f.receipt, bytes: Buffer.byteLength(body) },
        revision,
        signal(),
      ),
    ).rejects.toMatchObject({ code: "INVALID_EVIDENCE" });
  }
});

test("retained spans skip deleted time while proving complete explicit empty support", async () => {
  const pinned = createRevision(
    createOriginalRevision(3_000_000, "fixture"),
    [
      { startUs: 0, endUs: 100_000 },
      { startUs: 2_000_000, endUs: 3_000_000 },
    ],
    { id: "cuts", operation: "cut", createdAt: "fixture" },
  );
  const f = await fixture(
    [
      frame(0, 100_000, 0, 0),
      { spanIndex: 1, start: time(2_000_000), end: time(3_000_000), empty: true },
    ],
    pinned,
  );
  const source = await PresentationEvidence.open(f.receipt, pinned, signal());
  cleanups.push(() => source.close());
  const cursor = source.cursor(signal());
  await expect(cursor.at(0, 100_000)).rejects.toMatchObject({ code: "INVALID_RANGE" });
  expect(await cursor.at(1, 2_000_000)).toMatchObject({ empty: true, actualSourceUs: null });
  await expect(cursor.at(0, 0)).rejects.toMatchObject({ code: "INVALID_RANGE" });
});
