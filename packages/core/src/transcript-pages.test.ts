import { afterEach, expect, test } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { RevisionStore } from "./library.js";
import { TranscriptStore } from "./transcript.js";
import { TranscriptRead } from "./transcript-read.js";
import {
  FileTranscript,
  validateTranscriptPages,
  writeEditedTranscriptPages,
  writeTranscriptPages,
} from "./transcript-pages.js";

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});

const narration = [
  { startUs: 500_000, endUs: 4_000_000 },
  { startUs: 5_500_000, endUs: 8_000_000 },
  { startUs: 8_500_000, endUs: 8_600_000 },
];
const script = [
  { text: "Um,", startUs: 1_000_000, endUs: 1_300_000 },
  { text: "hello", startUs: 1_400_000, endUs: 1_900_000 },
  { text: "world.", startUs: 2_000_000, endUs: 2_600_000 },
  { text: "Hello", startUs: 6_000_000, endUs: 6_500_000 },
  { text: "World", startUs: 6_600_000, endUs: 7_000_000 },
  { text: "Uhm.", startUs: 7_200_000, endUs: 7_200_000 },
];

/** A published generation inserted through the store's own ingest, then written as portable pages. */
async function fixture() {
  const home = await mkdtemp("/tmp/screenrec-transcript-pages-");
  const store = new RevisionStore(join(home, "library.sqlite"), {
    now: () => "fixture",
    newId: randomUUID,
  });
  cleanup.push(async () => {
    store.close();
    await rm(home, { recursive: true, force: true });
  });
  const { recordingId, sourceId } = store.allocate().recording;
  store.ingestLifecycle(recordingId, {
    sourceId,
    sequence: 1,
    state: "interrupted",
    reason: "fixture",
    sourceDurationUs: 10_000_000,
  });
  const transcripts = new TranscriptStore(store, home);
  const identity = { recordingId, sourceId, generation: "attempt" };
  const output = await transcripts.reserve(identity);
  const lines = narration.map((interval, ordinal) => {
    const skipped = interval.endUs - interval.startUs < 200_000;
    const words = skipped
      ? []
      : script
          .filter((word) => word.startUs >= interval.startUs && word.endUs <= interval.endUs)
          .map((word) => ({
            ...word,
            source: { startUs: word.startUs, endUs: word.endUs },
            confidence: 0.5,
          }));
    return {
      ordinal,
      source: interval,
      state: skipped ? ("skipped" as const) : ("transcribed" as const),
      ...(skipped ? { reason: "too_short" as const } : {}),
      words,
    };
  });
  const raw = lines.map((line) => `${JSON.stringify(line)}\n`).join("");
  await writeFile(output, raw);
  const engine = {
    runtime: "FluidAudio",
    runtimeVersion: "0.15.7",
    decoder: "parakeet-tdt-batch",
    encoderPrecision: "float16",
    computeUnits: "cpuAndNeuralEngine",
  };
  const metadata = await transcripts.ingest({
    identity,
    sourceGeneration: "source-1",
    request: {
      models: { directory: join(home, "models"), files: [] },
      track: {
        role: "narration",
        source: join(home, "narration.mov"),
        sourceOffsetUs: 0,
        available: narration,
      },
      output,
    },
    receipt: {
      output: {
        file: output,
        bytes: Buffer.byteLength(raw),
        sha256: createHash("sha256").update(raw).digest("hex"),
      },
      engine,
      segments: lines.map(({ words, ...line }) => ({ ...line, wordCount: words.length })),
      wordCount: script.length,
    },
    pins: {
      ...engine,
      runtimeRevision: "revision",
      model: "model",
      modelRevision: "model-revision",
      modelDigest: "a".repeat(64),
    },
    signal: new AbortController().signal,
  });
  // Cut through "Hello" and all of "world." so the pinned revision holds partial and removed words.
  const revision = store.edit(recordingId, {
    operation: "cut",
    requestId: "cut",
    expectedRevisionId: "r0",
    ranges: [
      { startUs: 1_950_000, endUs: 2_700_000 },
      { startUs: 6_250_000, endUs: 6_550_000 },
    ],
  });
  const source = join(home, "package", "source-transcript"),
    edited = join(home, "package", "edited-transcript");
  await mkdir(join(home, "package"));
  await writeTranscriptPages(transcripts, metadata, source);
  await copyFile(output, join(source, "raw.jsonl"));
  const library = new TranscriptRead(transcripts, metadata, revision);
  await writeEditedTranscriptPages(
    library,
    {
      recordingId,
      sourceId,
      revisionId: revision.id,
      generation: "attempt",
      policy: "transcript-v1",
    },
    edited,
  );
  const validate = () =>
    validateTranscriptPages({
      source,
      edited,
      identity,
      revision,
      narration,
    });
  /** Rewrites one order's rows with valid page descriptors, so only transcript meaning can refuse it. */
  async function tamper(
    directory: string,
    index: string,
    mutate: (rows: Record<string, any>[]) => void,
  ) {
    const manifest = JSON.parse(await readFile(join(directory, "pages.json"), "utf8"));
    for (const descriptor of manifest.indexes[index]) {
      const rows = JSON.parse(await readFile(join(directory, descriptor.file), "utf8"));
      mutate(rows);
      const body = Buffer.from(JSON.stringify(rows));
      const key = (row: Record<string, any>) =>
        index === "words"
          ? [row.sourceRange.startUs, row.ordinal]
          : index === "gaps"
            ? [row.sourceRange.startUs]
            : index === "segments"
              ? [row.ordinal]
              : [row.position];
      Object.assign(descriptor, {
        first: key(rows[0]),
        last: key(rows.at(-1)),
        bytes: body.length,
        sha256: createHash("sha256").update(body).digest("hex"),
      });
      await writeFile(join(directory, descriptor.file), body);
    }
    await writeFile(join(directory, "pages.json"), JSON.stringify(manifest));
  }
  return {
    home,
    store,
    transcripts,
    metadata,
    revision,
    library,
    source,
    edited,
    validate,
    tamper,
  };
}

test("portable pages read exactly as the library transcript, including partial words after a cut", async () => {
  const f = await fixture();
  const portable = await f.validate();
  expect(portable.metadata).toEqual({
    ...f.metadata,
    narration: { source: "source/narration.mov", sourceOffsetUs: 0 },
  });
  const reopened = new TranscriptRead(new FileTranscript(f.source), portable.metadata, f.revision);
  const rows = f.library.page({ limit: 1000 }).rows;
  expect(rows.find((row) => row.type === "word" && row.text === "Hello")).toMatchObject({
    id: "w3",
    partial: true,
  });
  expect(rows.some((row) => row.type === "word" && row.text === "world.")).toBe(false);
  for (const range of [undefined, { startUs: 1_200_000, endUs: 6_000_000 }])
    for (const limit of [1, 2, 1000]) {
      let cursor: unknown;
      do {
        const input = { limit, ...(cursor ? { cursor } : { range }) };
        const expected = f.library.page(input);
        expect(reopened.page(input)).toEqual(expected);
        cursor = expected.nextCursor;
      } while (cursor);
    }
  for (const text of ["hello world", "world.", "uhm"]) {
    let cursor: unknown;
    do {
      const input = { text, limit: 1, ...(cursor ? { cursor } : {}) };
      const expected = f.library.search(input);
      expect(reopened.search(input)).toEqual(expected);
      cursor = expected.nextCursor;
    } while (cursor);
  }
});

test("reopen refuses tampered transcript pages as an invalid package", async () => {
  const cases: [string, (f: Awaited<ReturnType<typeof fixture>>) => Promise<void>, RegExp][] = [
    [
      "word outside its segment",
      (f) =>
        f.tamper(f.source, "words", (rows) => {
          rows[2]!.sourceRange.endUs = 4_100_000;
        }),
      /outside its segment/,
    ],
    [
      "reordered ordinals",
      (f) =>
        f.tamper(f.source, "words", (rows) => {
          [rows[1]!.ordinal, rows[2]!.ordinal] = [2, 1];
          [rows[1]!.id, rows[2]!.id] = ["w2", "w1"];
        }),
      /not contiguous/,
    ],
    [
      "duplicate ordinal",
      (f) =>
        f.tamper(f.source, "words", (rows) => {
          Object.assign(rows[2]!, { ordinal: 1, id: "w1" });
        }),
      /not contiguous/,
    ],
    [
      "changed word id",
      (f) =>
        f.tamper(f.source, "words", (rows) => {
          rows[1]!.id = "w7";
        }),
      /not canonical/,
    ],
    [
      "renumbered ordinals",
      (f) =>
        f.tamper(f.source, "words", (rows) => {
          for (const row of rows)
            Object.assign(row, { ordinal: row.ordinal + 1, id: `w${row.ordinal + 1}` });
        }),
      /not contiguous/,
    ],
    [
      "gap overlapping a segment",
      (f) =>
        f.tamper(f.source, "gaps", (rows) => {
          rows[0]!.sourceRange.endUs = 700_000;
        }),
      /gaps differ/,
    ],
    [
      "segment moved away from acquired narration",
      (f) =>
        f.tamper(f.source, "segments", (rows) => {
          rows[1]!.sourceRange.startUs = 5_000_000;
        }),
      /outside acquired narration/,
    ],
    [
      "page hash mismatch",
      async (f) => {
        const manifest = JSON.parse(await readFile(join(f.source, "pages.json"), "utf8"));
        const file = join(f.source, manifest.indexes.words[0].file);
        await writeFile(file, (await readFile(file, "utf8")).replace("hello", "jello"));
      },
      /differs from its descriptor/,
    ],
    [
      "raw output hash mismatch",
      async (f) => {
        const file = join(f.source, "raw.jsonl");
        await writeFile(file, (await readFile(file, "utf8")).replace("hello", "jello"));
      },
      /Raw transcript differs/,
    ],
    [
      "edited row that is not the pinned projection",
      (f) =>
        f.tamper(f.edited, "rows", (rows) => {
          rows.find((row) => row.text === "Hello")!.partial = false;
        }),
      /differs from the pinned projection/,
    ],
  ];
  for (const [name, mutate, message] of cases) {
    const f = await fixture();
    await f.validate();
    await mutate(f);
    await expect(f.validate(), name).rejects.toMatchObject({
      code: "INVALID_PACKAGE",
      message: expect.stringMatching(message),
    });
  }
});
