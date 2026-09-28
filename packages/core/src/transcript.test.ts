import { afterEach, expect, test } from "vitest";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { RevisionStore } from "./library.js";
import { JobQueue, recordingJobTargets } from "./jobs.js";
import { SourceEvidenceStore } from "./evidence.js";
import { SourceProcessing } from "./processing.js";
import { TranscriptStore, type SpeechTranscriber } from "./transcript.js";
import { TranscriptProcessing, type TranscriptionModels } from "./transcript-processing.js";

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});

type Word = { text: string; startUs: number; endUs: number };
/** A merged word as native writes it to raw.jsonl: engine seconds beside its source range. */
type RawWord = { text: string; source: { startUs: number; endUs: number } };
type Line = { ordinal: number; source: { startUs: number; endUs: number }; state: string } & Record<
  string,
  unknown
>;
const script: Word[] = [
  { text: "Um,", startUs: 1_000_000, endUs: 1_300_000 },
  { text: "hello", startUs: 1_400_000, endUs: 1_900_000 },
  { text: "world.", startUs: 2_000_000, endUs: 2_600_000 },
  { text: "uh-huh", startUs: 3_000_000, endUs: 3_400_000 },
  { text: "Hello", startUs: 6_000_000, endUs: 6_500_000 },
  { text: "World", startUs: 6_600_000, endUs: 7_000_000 },
  { text: "Uhm.", startUs: 7_200_000, endUs: 7_200_000 },
];
const acquired = [
  { startUs: 500_000, endUs: 4_000_000 },
  { startUs: 5_500_000, endUs: 8_000_000 },
  { startUs: 8_500_000, endUs: 8_600_000 },
];
const pins = {
  runtime: "FluidAudio",
  runtimeVersion: "0.15.7",
  runtimeRevision: "41540ea237350afe5117a082b5c28eda642d0612",
  decoder: "parakeet-tdt-batch",
  model: "FluidInference/parakeet-tdt-0.6b-v2-coreml",
  modelRevision: "ee09c569f73759e6d44c9bd16766f477b2b36d39",
};
const modelDigest = "a".repeat(64);

type Options = {
  microphone?: boolean;
  script?: Word[];
  intervals?: typeof acquired;
  /** The parts of the acquired intervals the fake narration movie actually holds. */
  occupied?: typeof acquired;
  models?: "absent" | "ready";
  hold?: Promise<void>;
  corrupt?: (lines: Line[], receipt: Record<string, unknown>) => void;
  tamperHash?: boolean;
  retained?: (recordingId: string, generation: string) => boolean;
  path?: string;
};

async function fixture(options: Options = {}) {
  const home = options.path ?? (await mkdtemp("/tmp/screenrec-transcript-"));
  const store = new RevisionStore(join(home, "library.sqlite"), {
    now: () => "2026-09-17T00:00:00Z",
    newId: randomUUID,
  });
  const evidence = new SourceEvidenceStore(store);
  const transcripts = new TranscriptStore(store, home);
  let source!: SourceProcessing;
  let transcript!: TranscriptProcessing;
  const jobs = new JobQueue({
    store,
    targets: recordingJobTargets(store),
    providers: { newId: randomUUID },
    execute: (execution) =>
      execution.job.artifact === "transcript"
        ? transcript.execute(execution)
        : source.execute(execution),
    onCapacity: () => {
      source.resume();
      transcript.resume();
    },
  });
  const intervals = options.intervals ?? acquired;
  source = new SourceProcessing(store, jobs, evidence, home, async (_directory, output) => {
    const recording = store.list().recordings[0]!;
    const text = intervals
      .map((data) =>
        JSON.stringify({ event: "audioAcquired", data: { role: "narration", ...data } }),
      )
      .map((line) => `${line}\n`)
      .join("");
    await writeFile(output, text);
    return {
      file: output,
      journal: "capture.journal.jsonl",
      header: {
        sessionID: recording.sourceId,
        microphone: options.microphone ?? true,
        systemAudio: false,
      },
      cursorSamples: 0,
      geometryRecords: 0,
      displaySpaces: 0,
      pauseEvents: 0,
      audioIntervals: intervals.length,
      lastSequence: intervals.length,
      incompleteTail: false,
      finished: true,
      bytes: Buffer.byteLength(text),
    };
  });
  const models: TranscriptionModels & { state: "absent" | "ready" } = {
    state: options.models ?? "ready",
    status: () => ({ state: models.state }),
    nativeRequest: () => ({
      directory: join(home, "models", "parakeet", pins.modelRevision, "parakeet-tdt-0.6b-v2"),
      files: [{ path: "parakeet_vocab.json", bytes: 2, sha256: "b".repeat(64) }],
    }),
    modelDigest,
    pins,
  };
  const requests: Parameters<SpeechTranscriber>[0][] = [];
  const transcribe: SpeechTranscriber = async (request, signal) => {
    requests.push(request);
    if (options.hold)
      await new Promise<void>((resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        void options.hold!.then(resolve);
      });
    const lines: Line[] = (options.occupied ?? request.track.available).map((interval, ordinal) => {
      if (interval.endUs - interval.startUs < 200_000)
        return { ordinal, source: interval, state: "skipped", reason: "too_short", words: [] };
      const words = (options.script ?? script).filter(
        (word) => word.startUs >= interval.startUs && word.endUs <= interval.endUs,
      );
      return {
        ordinal,
        source: interval,
        state: "transcribed",
        text: words.map((word) => word.text).join(" "),
        confidence: 0.9,
        tokenTimings: words.map((word) => ({ token: word.text, startTime: word.startUs / 1e6 })),
        words: words.map((word, index) => ({
          text: word.text,
          startSeconds: (word.startUs - interval.startUs) / 1e6,
          endSeconds: (word.endUs - interval.startUs) / 1e6,
          confidence: index === 0 ? null : 0.75,
          source: { startUs: word.startUs, endUs: word.endUs },
        })),
      };
    });
    const receipt: Record<string, unknown> = {
      engine: {
        runtime: "FluidAudio",
        runtimeVersion: "0.15.7",
        decoder: "parakeet-tdt-batch",
        encoderPrecision: "float16",
        computeUnits: "cpuAndNeuralEngine",
      },
      segments: lines.map((line) => ({
        ordinal: line.ordinal,
        source: line.source,
        state: line.state,
        ...(line.reason ? { reason: line.reason } : {}),
        wordCount: (line.words as unknown[]).length,
      })),
      wordCount: lines.reduce((sum, line) => sum + (line.words as unknown[]).length, 0),
    };
    options.corrupt?.(lines, receipt);
    const text = lines.map((line) => `${JSON.stringify(line)}\n`).join("");
    await writeFile(request.output, text);
    receipt.output = {
      file: request.output,
      bytes: Buffer.byteLength(text),
      sha256: createHash("sha256")
        .update(options.tamperHash ? `${text} ` : text)
        .digest("hex"),
    };
    return receipt as unknown as Awaited<ReturnType<SpeechTranscriber>>;
  };
  transcript = new TranscriptProcessing(
    store,
    jobs,
    transcripts,
    source,
    evidence,
    models,
    home,
    transcribe,
    options.retained,
  );
  cleanup.push(async () => {
    await jobs.close();
    store.close();
    if (!options.path) await rm(home, { recursive: true, force: true });
  });
  const finish = () => {
    const { recordingId, sourceId } = store.allocate().recording;
    store.ingestLifecycle(recordingId, { sourceId, sequence: 1, state: "recording" });
    store.ingestLifecycle(recordingId, { sourceId, sequence: 2, state: "finalizing" });
    store.ingestLifecycle(recordingId, {
      sourceId,
      sequence: 3,
      state: "complete",
      sourceDurationUs: 10_000_000,
    });
    return recordingId;
  };
  return { home, store, jobs, transcripts, transcript, models, requests, finish };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;

async function transcribed(f: Fixture) {
  const recordingId = f.finish();
  f.transcript.prepare(recordingId);
  await f.jobs.idle();
  return recordingId;
}

function words(result: ReturnType<Fixture["transcript"]["get"]>) {
  return "page" in result && result.page
    ? result.page.rows.flatMap((row) => (row.type === "word" ? [row] : []))
    : [];
}

test("narration becomes one published generation read as interleaved words and gaps", async () => {
  const f = await fixture();
  const recordingId = await transcribed(f);
  const status = f.transcript.status(recordingId);
  expect(status).toMatchObject({ state: "ready", reason: null, dependencies: [] });
  const transcript = status.published!.transcript;
  expect(transcript).toMatchObject({
    recordingId,
    segmentCount: 3,
    wordCount: 7,
    gapCount: 5,
    engine: {
      ...pins,
      modelDigest,
      encoderPrecision: "float16",
      computeUnits: "cpuAndNeuralEngine",
      policy: "transcript-v1",
      kindPolicy: "word-kind-v1",
    },
  });
  expect(f.requests).toHaveLength(1);
  expect(f.requests[0]!.track).toEqual({
    source: join(f.home, "recordings", recordingId, "source", "narration.mov"),
    sourceOffsetUs: 0,
    available: acquired,
  });
  const raw = await readFile(
    join(
      f.home,
      "recordings",
      recordingId,
      "evidence",
      "transcript",
      transcript.generation,
      "raw.jsonl",
    ),
  );
  expect(transcript.raw).toEqual({
    bytes: raw.length,
    sha256: createHash("sha256").update(raw).digest("hex"),
  });

  const page = f.transcript.get({ recordingId });
  expect(page).toMatchObject({
    state: "ready",
    revisionId: "r0",
    generation: transcript.generation,
  });
  const rows = "page" in page ? page.page!.rows : [];
  expect(rows.map((row) => (row.type === "gap" ? `gap:${row.reason}` : row.text))).toEqual([
    "gap:not_acquired",
    "Um,",
    "hello",
    "world.",
    "uh-huh",
    "gap:not_acquired",
    "Hello",
    "World",
    "Uhm.",
    "gap:not_acquired",
    "gap:too_short",
    "gap:not_acquired",
  ]);
  expect(rows[0]).toEqual({
    type: "gap",
    sourceRange: { startUs: 0, endUs: 500_000 },
    reason: "not_acquired",
    partial: false,
    fragments: [
      { source: { startUs: 0, endUs: 500_000 }, playback: { startUs: 0, endUs: 500_000 } },
    ],
  });
  expect(rows[1]).toEqual({
    type: "word",
    id: "w0",
    ordinal: 0,
    text: "Um,",
    kind: "filler",
    sourceRange: { startUs: 1_000_000, endUs: 1_300_000 },
    confidence: null,
    segment: 0,
    partial: false,
    fragments: [
      {
        source: { startUs: 1_000_000, endUs: 1_300_000 },
        playback: { startUs: 1_000_000, endUs: 1_300_000 },
      },
    ],
  });
  expect(rows[4]).toMatchObject({ id: "w3", kind: "vocalization", confidence: 0.75 });
  expect(rows[8]).toMatchObject({
    id: "w6",
    text: "Uhm.",
    kind: "filler",
    instant: true,
    sourceRange: { startUs: 7_200_000, endUs: 7_200_001 },
    segment: 1,
  });
  expect(rows[10]).toMatchObject({
    type: "gap",
    reason: "too_short",
    sourceRange: { startUs: 8_500_000, endUs: 8_600_000 },
  });
  expect("page" in page && page.page!.nextCursor).toBe(null);
});

test("edits project words without retranscribing: cut words vanish and cut-through words keep their id", async () => {
  const f = await fixture();
  const recordingId = await transcribed(f);
  // Remove "world." entirely and the second half of "Hello".
  const revision = f.store.edit(recordingId, {
    operation: "cut",
    requestId: "cut",
    expectedRevisionId: "r0",
    ranges: [
      { startUs: 1_950_000, endUs: 2_700_000 },
      { startUs: 6_250_000, endUs: 6_550_000 },
    ],
  });
  const page = f.transcript.get({ recordingId });
  expect(page).toMatchObject({ revisionId: revision.id });
  const projected = words(page);
  expect(projected.map((word) => word.id)).toEqual(["w0", "w1", "w3", "w4", "w5", "w6"]);
  expect(projected.find((word) => word.id === "w4")).toMatchObject({
    text: "Hello",
    partial: true,
    sourceRange: { startUs: 6_000_000, endUs: 6_500_000 },
    fragments: [
      {
        source: { startUs: 6_000_000, endUs: 6_250_000 },
        playback: { startUs: 5_250_000, endUs: 5_500_000 },
      },
    ],
  });
  expect(words(f.transcript.get({ recordingId, revisionId: "r0" })).map((word) => word.id)).toEqual(
    ["w0", "w1", "w2", "w3", "w4", "w5", "w6"],
  );

  const hello = f.transcript.search({ recordingId, text: "HELLO world" });
  expect("page" in hello && hello.page!.entries).toEqual([
    {
      wordIds: ["w4", "w5"],
      sourceRange: { startUs: 6_000_000, endUs: 7_000_000 },
      partial: true,
      fragments: [
        {
          source: { startUs: 6_000_000, endUs: 6_250_000 },
          playback: { startUs: 5_250_000, endUs: 5_500_000 },
        },
        {
          source: { startUs: 6_550_000, endUs: 7_000_000 },
          playback: { startUs: 5_500_000, endUs: 5_950_000 },
        },
      ],
    },
  ]);
  const original = f.transcript.search({ recordingId, revisionId: "r0", text: "hello, world" });
  expect("page" in original && original.page!.entries.map((entry) => entry.wordIds)).toEqual([
    ["w1", "w2"],
    ["w4", "w5"],
  ]);
  const cut = f.transcript.search({ recordingId, text: "world." });
  expect("page" in cut && cut.page!.entries.map((entry) => entry.wordIds)).toEqual([["w5"]]);
  expect(f.requests).toHaveLength(1);
});

test("pages under a playback range traverse to exactly the single-page result", async () => {
  const f = await fixture();
  const recordingId = await transcribed(f);
  f.store.edit(recordingId, {
    operation: "cut",
    requestId: "cut",
    expectedRevisionId: "r0",
    ranges: [{ startUs: 1_950_000, endUs: 2_700_000 }],
  });
  for (const range of [undefined, { startUs: 1_200_000, endUs: 6_000_000 }]) {
    const whole = f.transcript.get({ recordingId, range, limit: 1000 });
    const expected = "page" in whole ? whole.page!.rows : [];
    for (const limit of [1, 2, 5]) {
      const rows = [];
      let cursor: unknown;
      for (let pages = 0; pages < 20; pages++) {
        const page = f.transcript.get({ recordingId, ...(cursor ? { cursor } : { range }), limit });
        if (!("page" in page) || !page.page) throw new Error("transcript not ready");
        expect(page.page.rows.length).toBeLessThanOrEqual(limit);
        rows.push(...page.page.rows);
        cursor = page.page.nextCursor;
        if (!cursor) break;
      }
      expect(cursor).toBeNull();
      expect(rows).toEqual(expected);
    }
  }
  const ranged = f.transcript.get({ recordingId, range: { startUs: 1_200_000, endUs: 6_000_000 } });
  const labels =
    "page" in ranged
      ? ranged.page!.rows.map((row) => (row.type === "gap" ? row.reason : row.id))
      : [];
  // Playback 1.2–6.0 s after the 0.75 s cut is source 1.2–1.95 s and 2.7–6.75 s.
  expect(labels).toEqual(["w0", "w1", "w3", "not_acquired", "w4", "w5"]);
  // Playback 3.5–5.0 s is source 4.25–5.75 s: inside the unacquired gap that began at 4.0 s.
  const insideGap = f.transcript.get({
    recordingId,
    range: { startUs: 3_500_000, endUs: 5_000_000 },
  });
  expect("page" in insideGap && insideGap.page!.rows).toEqual([
    {
      type: "gap",
      sourceRange: { startUs: 4_000_000, endUs: 5_500_000 },
      reason: "not_acquired",
      partial: false,
      fragments: [
        {
          source: { startUs: 4_000_000, endUs: 5_500_000 },
          playback: { startUs: 3_250_000, endUs: 4_750_000 },
        },
      ],
    },
  ]);
  expect(() => f.transcript.get({ recordingId, range: { startUs: 0, endUs: 20_000_000 } })).toThrow(
    expect.objectContaining({ code: "INVALID_RANGE" }),
  );
  expect(() => f.transcript.get({ recordingId, limit: 1001 })).toThrow(
    expect.objectContaining({ code: "INVALID_PARAMS" }),
  );
  expect(() => f.transcript.search({ recordingId, text: "hello", limit: 501 })).toThrow(
    expect.objectContaining({ code: "INVALID_PARAMS" }),
  );
  expect(() => f.transcript.search({ recordingId, text: "..." })).toThrow(
    expect.objectContaining({ code: "INVALID_PARAMS" }),
  );
});

test("time the narration movie does not hold inside an acquired interval reads as a gap", async () => {
  const f = await fixture({
    intervals: [{ startUs: 500_000, endUs: 8_600_000 }],
    occupied: acquired,
  });
  const recordingId = await transcribed(f);
  expect(f.transcript.status(recordingId)).toMatchObject({
    state: "ready",
    published: { transcript: { segmentCount: 3, wordCount: 7 } },
  });
  const page = f.transcript.get({ recordingId });
  const rows = "page" in page ? page.page!.rows : [];
  expect(
    rows.flatMap((row) => (row.type === "gap" ? [[row.reason, row.sourceRange]] : [])),
  ).toEqual([
    ["not_acquired", { startUs: 0, endUs: 500_000 }],
    ["not_acquired", { startUs: 4_000_000, endUs: 5_500_000 }],
    ["not_acquired", { startUs: 8_000_000, endUs: 8_500_000 }],
    ["too_short", { startUs: 8_500_000, endUs: 8_600_000 }],
    ["not_acquired", { startUs: 8_600_000, endUs: 10_000_000 }],
  ]);
  expect(words(page).map((word) => word.text)).toEqual(script.map((word) => word.text));
});

test("a long narration pages and searches identically across storage batches", async () => {
  const long = Array.from({ length: 3000 }, (_, index) => ({
    text: `word${index % 1000}`,
    startUs: index * 3_000,
    endUs: index * 3_000 + 2_000,
  }));
  const f = await fixture({
    script: long,
    intervals: [
      { startUs: 0, endUs: 4_500_000 },
      { startUs: 4_600_000, endUs: 10_000_000 },
    ],
  });
  const recordingId = await transcribed(f);
  // Words 1500–1533 start inside the unacquired 4.5–4.6 s gap and are not in any interval.
  const expected = long.filter((word) => word.startUs < 4_500_000 || word.startUs >= 4_600_000);
  const rows = [];
  let cursor: unknown;
  let pages = 0;
  do {
    const page = f.transcript.get({ recordingId, limit: 1000, ...(cursor ? { cursor } : {}) });
    if (!("page" in page) || !page.page) throw new Error("transcript not ready");
    rows.push(...page.page.rows);
    cursor = page.page.nextCursor;
    pages++;
  } while (cursor);
  expect(pages).toBe(3);
  const gapIndex = rows.findIndex((row) => row.type === "gap");
  expect(rows[gapIndex]).toMatchObject({ sourceRange: { startUs: 4_500_000, endUs: 4_600_000 } });
  expect(rows.filter((row) => row.type === "gap")).toHaveLength(1);
  expect(
    rows.flatMap((row) => (row.type === "word" ? [[row.text, row.sourceRange.startUs]] : [])),
  ).toEqual(expected.map((word) => [word.text, word.startUs]));
  expect(
    rows.slice(gapIndex - 1, gapIndex + 2).map((row) => ("id" in row ? row.id : "gap")),
  ).toEqual(["w1499", "gap", "w1500"]);

  const found = f.transcript.search({ recordingId, text: "WORD999 word0", limit: 1 });
  const entries = "page" in found ? found.page!.entries : [];
  expect(entries).toEqual([
    {
      wordIds: ["w999", "w1000"],
      sourceRange: { startUs: 2_997_000, endUs: 3_002_000 },
      partial: false,
      fragments: [
        {
          source: { startUs: 2_997_000, endUs: 3_002_000 },
          playback: { startUs: 2_997_000, endUs: 3_002_000 },
        },
      ],
    },
  ]);
  const rest = f.transcript.search({
    recordingId,
    text: "WORD999 word0",
    cursor: "page" in found ? found.page!.nextCursor : null,
  });
  // The second occurrence straddles the gap: word1999 at 5.997 s is ordinal 1965 after 34 dropped words.
  expect("page" in rest && rest.page).toMatchObject({
    entries: [{ wordIds: ["w1965", "w1966"] }],
    nextCursor: null,
  });
});

test("a continuation fails with ARTIFACT_CHANGED once its generation or filter changes", async () => {
  const f = await fixture();
  const recordingId = await transcribed(f);
  const first = f.transcript.get({ recordingId, limit: 2 });
  const search = f.transcript.search({ recordingId, text: "hello", limit: 1 });
  const cursor = "page" in first ? first.page!.nextCursor : null;
  const searchCursor = "page" in search ? search.page!.nextCursor : null;
  expect(cursor).toMatchObject({ revisionId: "r0", afterSourceUs: 1_000_000, afterOrdinal: 0 });
  expect(searchCursor).toMatchObject({ text: "hello", afterOrdinal: 1 });
  expect(() =>
    f.transcript.get({ recordingId, cursor, range: { startUs: 0, endUs: 1_000_000 } }),
  ).toThrow(expect.objectContaining({ code: "ARTIFACT_CHANGED" }));
  expect(() => f.transcript.search({ recordingId, cursor: searchCursor, text: "world" })).toThrow(
    expect.objectContaining({ code: "ARTIFACT_CHANGED" }),
  );
  const next = f.transcript.search({ recordingId, cursor: searchCursor, text: "hello" });
  expect("page" in next && next.page!.entries.map((entry) => entry.wordIds)).toEqual([["w4"]]);

  const status = f.transcript.status(recordingId);
  f.jobs.regenerate(status.jobId!, status.published!.generation);
  await f.jobs.idle();
  const regenerated = f.transcript.status(recordingId);
  expect(regenerated.published!.transcript.generation).not.toBe(
    status.published!.transcript.generation,
  );
  expect(() => f.transcript.get({ recordingId, cursor })).toThrow(
    expect.objectContaining({ code: "ARTIFACT_CHANGED" }),
  );
  expect(() => f.transcript.search({ recordingId, cursor: searchCursor, text: "hello" })).toThrow(
    expect.objectContaining({ code: "ARTIFACT_CHANGED" }),
  );
});

test("missing narration is unavailable without transcription", async () => {
  for (const options of [{ microphone: false }, { intervals: [] }]) {
    const f = await fixture(options);
    const recordingId = await transcribed(f);
    expect(f.transcript.status(recordingId)).toMatchObject({
      state: "unavailable",
      reason: "no_narration",
      retryable: false,
      jobId: null,
    });
    expect(() => f.transcript.retry(recordingId)).toThrow(
      expect.objectContaining({ code: "UNAVAILABLE" }),
    );
    expect(f.transcript.get({ recordingId })).toMatchObject({
      state: "unavailable",
      reason: "no_narration",
      page: null,
    });
    expect(f.requests).toEqual([]);
  }
});

test("unprepared models are a retryable unavailable state that starts no job", async () => {
  const f = await fixture({ models: "absent" });
  const recordingId = await transcribed(f);
  expect(f.transcript.status(recordingId)).toMatchObject({
    state: "unavailable",
    reason: "model_not_prepared",
    retryable: true,
    jobId: null,
  });
  expect(() => f.transcript.retry(recordingId)).toThrow(
    expect.objectContaining({ code: "MODEL_NOT_PREPARED", retryable: true }),
  );
  f.transcript.resume();
  await f.jobs.idle();
  expect(f.jobs.isArtifactBusy("transcript")).toBe(false);
  expect(f.transcript.status(recordingId).jobId).toBeNull();
  expect(f.requests).toEqual([]);

  f.models.state = "ready";
  f.transcript.resume();
  await f.jobs.idle();
  expect(f.transcript.status(recordingId)).toMatchObject({ state: "ready" });
  expect(f.requests).toHaveLength(1);
});

test("background admission waits for published source evidence before transcribing", async () => {
  const f = await fixture();
  const recordingId = f.finish();
  f.transcript.resume();
  await f.jobs.idle();
  expect(f.transcript.status(recordingId)).toMatchObject({
    state: "not_requested",
    jobId: null,
    dependencies: [{ artifact: "source", state: "not_requested", jobId: null }],
  });
  f.transcript.prepare(recordingId);
  expect(f.transcript.status(recordingId)).toMatchObject({
    state: "processing",
    jobId: null,
    dependencies: [{ artifact: "source", state: "processing", jobId: expect.any(String) }],
  });
  await f.jobs.idle();
  expect(f.transcript.status(recordingId)).toMatchObject({ state: "ready", dependencies: [] });
  expect(f.requests).toHaveLength(1);
});

test("retry while transcribing returns the running job instead of starting another", async () => {
  let release!: () => void;
  const f = await fixture({ hold: new Promise((resolve) => (release = resolve)) });
  const recordingId = await (async () => {
    const id = f.finish();
    f.transcript.prepare(id);
    await expect.poll(() => f.requests.length).toBe(1);
    return id;
  })();
  const running = f.transcript.status(recordingId);
  expect(running).toMatchObject({ state: "processing", jobId: expect.any(String) });
  expect(f.transcript.retry(recordingId)).toMatchObject({
    state: "processing",
    jobId: running.jobId,
  });
  release();
  await f.jobs.idle();
  expect(f.transcript.status(recordingId)).toMatchObject({
    state: "ready",
    jobId: running.jobId,
    published: { generation: 1 },
  });
  expect(f.requests).toHaveLength(1);
});

test("a process killed mid-transcription reopens failed, interrupted and retryable", async () => {
  const home = await mkdtemp("/tmp/screenrec-transcript-restart-");
  cleanup.push(() => rm(home, { recursive: true, force: true }));
  const killed = await fixture({ path: home, hold: new Promise(() => {}) });
  const recordingId = killed.finish();
  killed.transcript.prepare(recordingId);
  await expect.poll(() => killed.requests.length).toBe(1);
  const lost = killed.transcript.status(recordingId);
  expect(lost.state).toBe("processing");

  const reopened = await fixture({ path: home });
  expect(reopened.transcript.status(recordingId)).toMatchObject({
    state: "failed",
    reason: "interrupted",
    retryable: true,
    jobId: lost.jobId,
  });
  reopened.transcript.retry(recordingId);
  await reopened.jobs.idle();
  expect(reopened.transcript.status(recordingId)).toMatchObject({
    state: "ready",
    jobId: lost.jobId,
    published: { generation: 2 },
  });
  expect(words(reopened.transcript.get({ recordingId }))).toHaveLength(7);
});

test("ingest refuses inconsistent native output and leaves no generation behind", async () => {
  const cases: [Options, string][] = [
    [
      {
        corrupt: (lines) => {
          (lines[0]!.words as RawWord[])[0]!.source.startUs = 100_000;
        },
      },
      "Transcript word lies outside its segment",
    ],
    [
      {
        corrupt: (lines) => {
          (lines[0]!.words as RawWord[])[1]!.source.endUs = 1_000_000;
        },
      },
      "Transcript word range is reversed",
    ],
    [
      {
        corrupt: (lines) => {
          const words = lines[0]!.words as RawWord[];
          [words[1], words[2]] = [words[2]!, words[1]!];
        },
      },
      "Transcript words must be ordered by start",
    ],
    [
      {
        // A word whose span reaches into the next one would take that word with it when it was
        // cut, and the transcript would then say it was never spoken.
        corrupt: (lines) => {
          const words = lines[0]!.words as RawWord[];
          words[1]!.source.endUs = words[2]!.source.endUs;
        },
      },
      "Transcript words must not overlap",
    ],
    [
      {
        corrupt: (lines, receipt) => {
          lines[1]!.ordinal = 0;
          (receipt.segments as Line[])[1]!.ordinal = 0;
        },
      },
      "Transcription segment ordinals must be unique and ordered",
    ],
    [
      {
        corrupt: (lines, receipt) => {
          [lines[0], lines[1]] = [lines[1]!, lines[0]!];
          const segments = receipt.segments as Line[];
          [segments[0], segments[1]] = [segments[1]!, segments[0]!];
        },
      },
      "Transcription segment ordinals must be unique and ordered",
    ],
    [
      {
        corrupt: (lines) => {
          [lines[0], lines[1]] = [lines[1]!, lines[0]!];
        },
      },
      "Raw transcript segment differs from its receipt",
    ],
    [
      {
        corrupt: (_lines, receipt) => {
          (receipt.segments as Line[])[0]!.source = { startUs: 0, endUs: 4_000_000 };
        },
      },
      "Transcription segment does not lie in an acquired narration interval",
    ],
    [{ tamperHash: true }, "Raw transcript does not match its receipt"],
  ];
  for (const [options, reason] of cases) {
    const f = await fixture(options);
    const recordingId = await transcribed(f);
    expect(f.transcript.status(recordingId), reason).toMatchObject({
      state: "failed",
      reason,
      retryable: true,
      published: null,
    });
    expect(
      f.store.catalog
        .prepare(
          "SELECT (SELECT COUNT(*) FROM transcript_generations)+(SELECT COUNT(*) FROM transcript_words)+(SELECT COUNT(*) FROM transcript_segments)+(SELECT COUNT(*) FROM transcript_gaps) AS n",
        )
        .get(),
      reason,
    ).toEqual({ n: 0 });
    expect(
      await readdir(join(f.home, "recordings", recordingId, "evidence", "transcript")),
      reason,
    ).toEqual([]);
  }
});

test("cleanup reclaims abandoned generations but keeps published and retained ones", async () => {
  const f = await fixture({ retained: (_recordingId, generation) => generation === "exported" });
  const recordingId = await transcribed(f);
  const published = f.transcript.status(recordingId).published!.transcript.generation;
  const parent = join(f.home, "recordings", recordingId, "evidence", "transcript");
  for (const generation of ["exported", "abandoned-file", "abandoned-rows"]) {
    if (generation !== "abandoned-rows") {
      await mkdir(join(parent, generation));
      await writeFile(join(parent, generation, "raw.jsonl"), "partial");
    }
    if (generation !== "abandoned-file")
      f.store.catalog
        .prepare(
          "INSERT INTO transcript_generations(recordingId,sourceId,generation,sourceGeneration,engine,narration,segmentCount,state) VALUES(?,?,?,?,?,?,0,'ingesting')",
        )
        .run(recordingId, "source", generation, "source", "{}", "{}");
  }
  await f.transcript.cleanup(new AbortController().signal);
  expect((await readdir(parent)).sort()).toEqual(["exported", published].sort());
  expect(
    f.store.catalog
      .prepare("SELECT generation FROM transcript_generations ORDER BY generation")
      .all()
      .map((row) => row.generation),
  ).toEqual(["exported", published].sort());
  expect(words(f.transcript.get({ recordingId })).map((word) => word.text)).toEqual(
    script.map((word) => word.text),
  );

  f.store.markDeleting(recordingId);
  await f.transcripts.purgeRecording(recordingId, new AbortController().signal);
  expect(await readdir(parent)).toEqual([]);
  expect(
    f.store.catalog
      .prepare(
        "SELECT (SELECT COUNT(*) FROM transcript_generations)+(SELECT COUNT(*) FROM transcript_words)+(SELECT COUNT(*) FROM transcript_segments)+(SELECT COUNT(*) FROM transcript_gaps) AS n",
      )
      .get(),
  ).toEqual({ n: 0 });
});
