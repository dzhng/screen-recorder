import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { Catalog } from "./catalog.js";
import { TranscriptStore, type TranscriptMetadata } from "./transcript.js";
import { SourceTranscriptRead, type SourceTranscriptRow } from "./transcript-read.js";

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});
const pins = {
  runtime: "FluidAudio",
  runtimeVersion: "0.15.7",
  runtimeRevision: "pin",
  decoder: "parakeet-tdt-batch",
  model: "model",
  modelRevision: "pin",
  modelDigest: "a".repeat(64),
};
type Word = { text: string; startUs: number; endUs: number };
async function fixture(
  segments = [
    {
      startUs: 100,
      endUs: 500,
      words: [
        { text: "Hello,", startUs: 100, endUs: 250 },
        { text: "WORLD!", startUs: 250, endUs: 300 },
        { text: "last", startUs: 400, endUs: 500 },
      ],
    },
    {
      startUs: 700,
      endUs: 900,
      words: [
        { text: "first", startUs: 700, endUs: 750 },
        { text: "hello", startUs: 800, endUs: 900 },
      ],
    },
  ] as { startUs: number; endUs: number; words: Word[] }[],
  durationUs = 1000,
) {
  const home = await mkdtemp("/tmp/source-transcript-read-");
  const catalog = new Catalog(join(home, "catalog.sqlite"));
  cleanup.push(async () => {
    catalog.close();
    await rm(home, { recursive: true, force: true });
  });
  const store = new TranscriptStore(catalog, home, () => {});
  const identity = {
    owner: { kind: "asset" as const, assetId: "asset-a" },
    sourceId: "asset-a",
    generation: "generation-a",
  };
  const output = await store.reserve(identity);
  const lines = segments.map(({ startUs, endUs, words }, ordinal) => ({
    ordinal,
    source: { startUs, endUs },
    state: "transcribed" as const,
    words: words.map(({ text, startUs, endUs }) => ({
      text,
      source: { startUs, endUs },
      confidence: 0.75,
    })),
  }));
  const raw = lines.map((line) => JSON.stringify(line) + "\n").join("");
  await writeFile(output, raw);
  const metadata = await store.ingest({
    identity,
    source: {
      kind: "asset",
      streamId: "track:7",
      acquisitionId: "capture-a",
      durationUs,
      supportDigest: "b".repeat(64),
    },
    request: {
      models: { directory: join(home, "models"), files: [] },
      output,
      track: {
        source: join(home, "source.mov"),
        streamId: "track:7",
        sourceOffsetUs: -500,
        available: segments.map(({ startUs, endUs }) => ({ startUs, endUs })),
      },
    },
    receipt: {
      output: {
        file: output,
        bytes: Buffer.byteLength(raw),
        sha256: createHash("sha256").update(raw).digest("hex"),
      },
      engine: { ...pins, encoderPrecision: "int8", computeUnits: "cpuAndNeuralEngine" },
      segments: lines.map(({ ordinal, source, state, words }) => ({
        ordinal,
        source,
        state,
        wordCount: words.length,
      })),
      wordCount: lines.reduce((sum, line) => sum + line.words.length, 0),
    },
    pins,
    signal: new AbortController().signal,
  });
  return { store, metadata, read: new SourceTranscriptRead(store, metadata) };
}

test("source pages preserve words and raw acquisition gaps across one-row continuations", async () => {
  const { read } = await fixture();
  const rows: SourceTranscriptRow[] = [];
  let cursor: unknown;
  do {
    const page = read.page({ limit: 1, cursor });
    rows.push(...page.rows);
    cursor = page.nextCursor;
  } while (cursor);
  expect(
    rows.map((row) => [row.type === "word" ? row.text : row.reason, row.sourceRange, row.partial]),
  ).toEqual([
    ["not_acquired", { startUs: 0, endUs: 100 }, false],
    ["Hello,", { startUs: 100, endUs: 250 }, false],
    ["WORLD!", { startUs: 250, endUs: 300 }, false],
    ["last", { startUs: 400, endUs: 500 }, false],
    ["not_acquired", { startUs: 500, endUs: 700 }, false],
    ["first", { startUs: 700, endUs: 750 }, false],
    ["hello", { startUs: 800, endUs: 900 }, false],
    ["not_acquired", { startUs: 900, endUs: 1000 }, false],
  ]);
  expect(rows).toEqual(read.page({}).rows);
  expect(rows.every((row) => !("fragments" in row))).toBe(true);
  expect(
    read
      .page({ range: { startUs: 200, endUs: 225 } })
      .rows.map((row) => [row.sourceRange, row.partial]),
  ).toEqual([[{ startUs: 100, endUs: 250 }, true]]);
});

test("source search folds literal words, pages matches and refuses phrases across acquisition segments", async () => {
  const { read } = await fixture();
  expect(read.search({ text: "HELLO world" }).entries).toEqual([
    { wordIds: ["w0", "w1"], sourceRange: { startUs: 100, endUs: 300 } },
  ]);
  expect(read.search({ text: "last first" }).entries).toEqual([]);
  expect(read.search({ text: "h.*llo" }).entries).toEqual([]);
  const first = read.search({ text: "hello", limit: 1 });
  expect(first.entries).toEqual([{ wordIds: ["w0"], sourceRange: { startUs: 100, endUs: 250 } }]);
  const second = read.search({ text: "hello", limit: 1, cursor: first.nextCursor });
  expect(second.entries).toEqual([{ wordIds: ["w4"], sourceRange: { startUs: 800, endUs: 900 } }]);
  expect(second.nextCursor).toBeNull();
});

test("source continuations pin every source identity dimension, generation and query", async () => {
  const { read, store, metadata } = await fixture();
  const page = read.page({ limit: 1, range: { startUs: 100, endUs: 900 } });
  const search = read.search({ text: "hello", limit: 1 });
  for (const field of [
    "assetId",
    "streamId",
    "acquisitionId",
    "generation",
    "supportDigest",
  ] as const) {
    expect(() => read.page({ cursor: { ...page.nextCursor, [field]: "different" } })).toThrow(
      expect.objectContaining({ code: "ARTIFACT_CHANGED" }),
    );
    expect(() =>
      read.search({ text: "hello", cursor: { ...search.nextCursor, [field]: "different" } }),
    ).toThrow(expect.objectContaining({ code: "ARTIFACT_CHANGED" }));
  }
  expect(() => read.page({ cursor: page.nextCursor, range: { startUs: 100, endUs: 800 } })).toThrow(
    expect.objectContaining({ code: "ARTIFACT_CHANGED" }),
  );
  expect(() => read.search({ text: "world", cursor: search.nextCursor })).toThrow(
    expect.objectContaining({ code: "ARTIFACT_CHANGED" }),
  );
  expect(() => read.page({ cursor: { ...page.nextCursor, acquisitionId: null } })).toThrow(
    expect.objectContaining({ code: "ARTIFACT_CHANGED" }),
  );
  const next = new SourceTranscriptRead(store, { ...metadata, generation: "next" });
  expect(() => next.page({ cursor: page.nextCursor })).toThrow(
    expect.objectContaining({ code: "ARTIFACT_CHANGED" }),
  );
  const physicalMetadata: TranscriptMetadata = {
    ...metadata,
    source: { kind: "asset", durationUs: 1000, streamId: "track:7", supportDigest: "b".repeat(64) },
  };
  const physical = new SourceTranscriptRead(store, physicalMetadata).page({ limit: 1 });
  expect(physical.nextCursor?.acquisitionId).toBeNull();
  expect(() => read.page({ range: { startUs: 0, endUs: 1001 } })).toThrow(
    expect.objectContaining({ code: "INVALID_RANGE" }),
  );
  expect(() => read.page({ limit: 0 })).toThrow(
    expect.objectContaining({ code: "INVALID_PARAMS" }),
  );
  expect(() => read.page({ cursor: {} })).toThrow(
    expect.objectContaining({ code: "INVALID_PARAMS" }),
  );
});

test("late source windows stay bounded and no-match search yields resumable empty pages", async () => {
  const words = Array.from({ length: 10_003 }, (_, i) => ({
    text: i === 10_001 ? "needle" : "hay",
    startUs: i * 10,
    endUs: i * 10 + 5,
  }));
  const { read, store, metadata } = await fixture([{ startUs: 0, endUs: 100_030, words }], 100_030);
  const bounds: number[] = [];
  const inspected = new SourceTranscriptRead(
    {
      wordRecords(identity, query) {
        const rows = store.wordRecords(identity, query);
        bounds.push(rows.length);
        return rows;
      },
      gapRecords(identity, query) {
        return store.gapRecords(identity, query);
      },
    },
    metadata,
  );
  expect(inspected.page({ range: { startUs: 100_011, endUs: 100_013 } }).rows).toMatchObject([
    {
      type: "word",
      text: "needle",
      sourceRange: { startUs: 100_010, endUs: 100_015 },
      partial: true,
    },
  ]);
  expect(bounds.reduce((sum, count) => sum + count, 0)).toBeLessThanOrEqual(2);
  const first = read.search({ text: "needle" });
  expect(first.entries).toEqual([]);
  expect(first.nextCursor?.afterOrdinal).toBe(9999);
  expect(read.search({ text: "needle", cursor: first.nextCursor })).toEqual({
    entries: [{ wordIds: ["w10001"], sourceRange: { startUs: 100_010, endUs: 100_015 } }],
    nextCursor: null,
  });
});
