import { afterEach, expect, test } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { RevisionStore } from "./library.js";
import { JobQueue } from "./jobs.js";
import { DerivedCache } from "./cache.js";
import { SourceEvidenceStore } from "./evidence.js";
import { SourceProcessing } from "./processing.js";
import { AudioInspection, type AudioDecoder, type AudioRole } from "./audio.js";
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});
type Acquisition = { role: AudioRole; startUs: number; endUs: number };
async function fixture(
  options: {
    intervals?: Acquisition[];
    microphone?: boolean;
    systemAudio?: boolean;
    decode?: AudioDecoder;
    beforeDecode?: () => Promise<void>;
    sourceFailure?: boolean;
    prepare?: boolean;
  } = {},
) {
  const home = await mkdtemp("/tmp/screenrec-audio-core-");
  const store = new RevisionStore(join(home, "library.sqlite"), {
    now: () => new Date().toISOString(),
    newId: randomUUID,
  });
  const cache = new DerivedCache(store, home, 100);
  await cache.reconcile();
  const evidence = new SourceEvidenceStore(store);
  let processing!: SourceProcessing, audio!: AudioInspection;
  const requests: Parameters<AudioDecoder>[0][] = [];
  let sourceCalls = 0;
  const jobs = new JobQueue({
    store,
    providers: { newId: randomUUID },
    execute: (execution) =>
      execution.job.artifact === "audio" ? audio.execute(execution) : processing.execute(execution),
  });
  const take = store.allocate().recording;
  store.ingestLifecycle(take.recordingId, {
    sourceId: take.sourceId,
    sequence: 1,
    state: "interrupted",
    reason: "fixture",
    sourceDurationUs: 40_000_000,
  });
  processing = new SourceProcessing(store, jobs, evidence, home, async (_directory, output) => {
    sourceCalls++;
    if (options.sourceFailure) throw new Error("source export failed");
    const intervals = options.intervals ?? [
      { role: "narration", startUs: 0, endUs: 40_000_000 },
      { role: "system", startUs: 0, endUs: 40_000_000 },
    ];
    const text =
      intervals.map((data) => JSON.stringify({ event: "audioAcquired", data })).join("\n") +
      (intervals.length ? "\n" : "");
    await writeFile(output, text);
    return {
      file: output,
      journal: "capture.journal.jsonl",
      header: {
        sessionID: take.sourceId,
        microphone: options.microphone ?? true,
        systemAudio: options.systemAudio ?? true,
      },
      cursorSamples: 0,
      geometryRecords: 0,
      displaySpaces: 0,
      pauseEvents: 0,
      audioIntervals: intervals.length,
      lastSequence: intervals.length,
      incompleteTail: true,
      invalidAtSequence: 9,
      finished: false,
      bytes: Buffer.byteLength(text),
    };
  });
  audio = new AudioInspection(
    store,
    jobs,
    cache,
    evidence,
    processing,
    home,
    async (request, signal) => {
      requests.push(request);
      if (options.decode) return options.decode(request, signal);
      await options.beforeDecode?.();
      await writeFile(request.output, "wave");
      const durationUs = request.spans.reduce((sum, span) => sum + span.endUs - span.startUs, 0);
      return {
        file: request.output,
        mediaType: "audio/wav",
        sampleRate: 48000,
        channels: 1,
        frames: (durationUs * 48000) / 1_000_000,
        durationUs,
        bytes: 4,
        spans: request.spans.map((span) => ({ endUs: span.endUs, startUs: span.startUs })),
        tracks: request.tracks.map((track) => ({
          role: track.role,
          gain: request.tracks.length === 1 ? 1 : 0.5,
          sampleRate: 48000,
          channels: 1,
          unavailable: track.available.length ? [] : [...request.spans],
        })),
      };
    },
  );
  cleanup.push(async () => {
    await jobs.close();
    store.close();
    await rm(home, { recursive: true, force: true });
  });
  if (options.prepare !== false) {
    processing.prepare(take.recordingId);
    await jobs.idle();
  }
  const input = {
    recordingId: take.recordingId,
    range: { startUs: 0, endUs: 1_000_000 },
    track: "mix" as const,
  };
  return {
    home,
    store,
    jobs,
    cache,
    evidence,
    processing,
    audio,
    take,
    input,
    requests,
    sourceCalls: () => sourceCalls,
  };
}

test("audio projects one edited playback range into matching track acquisition and preserved integrity", async () => {
  const f = await fixture();
  const revision = f.store.edit(f.take.recordingId, {
    operation: "cut",
    requestId: "cut",
    expectedRevisionId: "r0",
    ranges: [{ startUs: 1_000_000, endUs: 3_000_000 }],
  });
  const input = { ...f.input, range: { startUs: 500000, endUs: 1500000 } };
  f.audio.request(input);
  await f.jobs.idle();
  const result = f.audio.request(input);
  expect(result.published?.audio).toMatchObject({
    revisionId: revision.id,
    requestedPlaybackRange: input.range,
    spans: [
      { startUs: 500000, endUs: 1000000 },
      { startUs: 3000000, endUs: 3500000 },
    ],
    durationUs: 1000000,
    sourceEvidence: { receipt: { incompleteTail: true, invalidAtSequence: 9, finished: false } },
  });
  expect(
    f.requests[0]?.tracks.map((track) => ({
      role: track.role,
      sourceOffsetUs: track.sourceOffsetUs,
      available: track.available,
    })),
  ).toEqual([
    {
      role: "narration",
      sourceOffsetUs: 0,
      available: [
        { startUs: 500000, endUs: 1000000 },
        { startUs: 3000000, endUs: 3500000 },
      ],
    },
    {
      role: "system",
      sourceOffsetUs: 0,
      available: [
        { startUs: 500000, endUs: 1000000 },
        { startUs: 3000000, endUs: 3500000 },
      ],
    },
  ]);
  expect(result.published?.audio.tracks.map((track) => track.gain)).toEqual([0.5, 0.5]);
  expect(f.requests).toHaveLength(1);
  expect(() => f.audio.request({ ...input, range: { startUs: 0, endUs: 31_000_000 } })).toThrow(
    expect.objectContaining({ code: "LIMIT_EXCEEDED" }),
  );
});

test("globally acquired audio remains a planned track even when the clip is entirely in its gap", async () => {
  const f = await fixture({
    intervals: [{ role: "narration", startUs: 2000000, endUs: 3000000 }],
    systemAudio: false,
  });
  f.audio.request(f.input);
  await f.jobs.idle();
  const audio = f.audio.request(f.input).published!.audio;
  expect(f.requests[0]?.tracks).toEqual([
    {
      role: "narration",
      source: join(f.home, "recordings", f.take.recordingId, "source", "narration.mov"),
      sourceOffsetUs: 0,
      available: [],
    },
  ]);
  expect(audio.tracks).toMatchObject([
    { role: "narration", gain: 1, unavailable: [f.input.range] },
  ]);
  expect(audio.missingRoles).toEqual([{ role: "system", reason: "not_requested" }]);
  expect(() => f.audio.request({ ...f.input, track: "system" })).toThrow(
    expect.objectContaining({
      code: "UNAVAILABLE",
      details: { missingRoles: [{ role: "system", reason: "not_requested" }] },
    }),
  );
});

test("requested but never acquired roles are absent from mixes, while explicit selection is unavailable", async () => {
  const f = await fixture({ intervals: [{ role: "system", startUs: 0, endUs: 2000000 }] });
  f.audio.request(f.input);
  await f.jobs.idle();
  expect(f.audio.request(f.input).published?.audio).toMatchObject({
    missingRoles: [{ role: "narration", reason: "not_acquired" }],
    tracks: [{ role: "system", gain: 1 }],
  });
  expect(() => f.audio.request({ ...f.input, track: "narration" })).toThrow(
    expect.objectContaining({ code: "UNAVAILABLE" }),
  );
  expect(f.requests).toHaveLength(1);
});

test("pending and failed source evidence remain explicit dependencies without implicit retry or audio work", async () => {
  const f = await fixture({ prepare: false, sourceFailure: true });
  const pending = f.audio.request(f.input);
  expect(pending).toMatchObject({
    jobId: null,
    published: null,
    dependency: { artifact: "source", jobId: expect.any(String) },
  });
  expect(["queued", "processing"]).toContain(pending.state);
  await f.jobs.idle();
  expect(f.audio.retry(f.input)).toMatchObject({
    state: "failed",
    retryable: true,
    jobId: null,
    published: null,
    dependency: { artifact: "source" },
  });
  expect(f.sourceCalls()).toBe(1);
  expect(f.requests).toEqual([]);
});

test("a held audio decode stays pinned across a concurrent edit", async () => {
  let started!: () => void, release!: () => void;
  const entered = new Promise<void>((resolve) => {
    started = resolve;
  });
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const f = await fixture({
    beforeDecode: async () => {
      started();
      await held;
    },
  });
  const admitted = f.audio.request(f.input);
  await entered;
  const edited = f.store.edit(f.take.recordingId, {
    operation: "cut",
    requestId: "cut",
    expectedRevisionId: "r0",
    ranges: [{ startUs: 0, endUs: 2000000 }],
  });
  release();
  await f.jobs.idle();
  expect(
    f.audio.request({ ...f.input, revisionId: admitted.revisionId }).published?.audio,
  ).toMatchObject({ revisionId: "r0", spans: [{ startUs: 0, endUs: 1000000 }] });
  f.audio.request(f.input);
  await f.jobs.idle();
  expect(f.audio.request(f.input).published?.audio).toMatchObject({
    revisionId: edited.id,
    spans: [{ startUs: 2000000, endUs: 3000000 }],
  });
});

test("audio reuses publication, regenerates an evicted file and retries failures only explicitly", async () => {
  let calls = 0;
  const f = await fixture({
    beforeDecode: async () => {
      if (++calls === 1) throw new Error("audio interrupted");
    },
  });
  f.audio.request(f.input);
  await f.jobs.idle();
  expect(f.audio.request(f.input)).toMatchObject({
    state: "failed",
    retryable: true,
    published: null,
  });
  expect(calls).toBe(1);
  f.audio.retry(f.input);
  await f.jobs.idle();
  const first = f.audio.request(f.input);
  expect(first).toMatchObject({ state: "ready", published: { generation: 2 } });
  expect(f.audio.request(f.input)).toEqual(first);
  expect(calls).toBe(2);
  f.cache.remove(first.published!.audio.cacheId);
  expect(f.audio.request(f.input).published).toBeNull();
  await f.jobs.idle();
  const next = f.audio.request(f.input);
  expect(next.published?.generation).toBe(3);
  expect(next.published?.audio.cacheId).not.toBe(first.published?.audio.cacheId);
  expect(next.published?.audio.spans).toEqual(first.published?.audio.spans);
  expect(calls).toBe(3);
});

test("an unrelated native excerpt is rejected and its unpublished file reclaimed", async () => {
  const f = await fixture({
    decode: async (request) => {
      await writeFile(request.output, "bad");
      return {
        file: request.output,
        mediaType: "audio/wav",
        sampleRate: 48000,
        channels: 1,
        frames: 48000,
        durationUs: 1000000,
        bytes: 3,
        spans: [{ startUs: 2000000, endUs: 3000000 }],
        tracks: request.tracks.map((track) => ({
          role: track.role,
          gain: 0.5,
          sampleRate: 48000,
          channels: 1,
          unavailable: [],
        })),
      };
    },
  });
  f.audio.request(f.input);
  await f.jobs.idle();
  expect(f.audio.request(f.input)).toMatchObject({
    state: "failed",
    retryable: false,
    published: null,
  });
  expect(f.cache.bytes).toBe(0);
});

test("audio publication rejects a native byte report that differs from the actual cached file", async () => {
  const f = await fixture({
    decode: async (request) => {
      await writeFile(request.output, "tiny");
      return {
        file: request.output,
        mediaType: "audio/wav",
        sampleRate: 48000,
        channels: 1,
        frames: 48000,
        durationUs: 1000000,
        bytes: 9,
        spans: [...request.spans],
        tracks: request.tracks.map((track) => ({
          role: track.role,
          gain: 0.5,
          sampleRate: 48000,
          channels: 1,
          unavailable: [],
        })),
      };
    },
  });
  f.audio.request(f.input);
  await f.jobs.idle();
  expect(f.audio.request(f.input)).toMatchObject({ state: "failed", published: null });
  expect(f.cache.bytes).toBe(0);
});

test("audio demand admits its unprepared source instead of waiting for automatic backfill", async () => {
  const f = await fixture({ prepare: false });
  const pending = f.audio.request(f.input);
  expect(pending.dependency?.jobId).toEqual(expect.any(String));
  expect(["queued", "processing"]).toContain(pending.state);
  await f.jobs.idle();
  expect(f.processing.status(f.take.recordingId).state).toBe("ready");
  f.audio.request(f.input);
  await f.jobs.idle();
  expect(f.audio.request(f.input).state).toBe("ready");
  expect(f.sourceCalls()).toBe(1);
  expect(f.requests).toHaveLength(1);
});
