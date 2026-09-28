import { afterEach, expect, test } from "vitest";
import { mkdtemp, rm, writeFile, mkdir, readFile, rename, access } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { RevisionStore } from "./library.js";
import { JobQueue, recordingJobTargets } from "./jobs.js";
import { DerivedCache, recordingCacheOwnerCheck } from "./cache.js";
import { recordingEvidenceOwner, SourceEvidenceStore } from "./evidence.js";
import { SourceProcessing } from "./processing.js";
import {
  LibraryAudioInspection,
  planAudioExcerpt,
  planAudioTracks,
  type AudioDecoder,
  type AudioRole,
} from "./audio.js";
import { createRevision, cutSpans } from "./timeline.js";
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
  const cache = new DerivedCache(store, home, recordingCacheOwnerCheck(store), 100);
  await cache.reconcile();
  const evidence = new SourceEvidenceStore(store, recordingEvidenceOwner(store));
  let processing!: SourceProcessing, audio!: LibraryAudioInspection;
  const requests: Parameters<AudioDecoder>[0][] = [];
  let sourceCalls = 0;
  const jobs = new JobQueue({
    store,
    targets: recordingJobTargets(store),
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
  audio = new LibraryAudioInspection(
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

test("shared audio planning resolves moved generated media and matches the live executor plan", async () => {
  const f = await fixture({
    intervals: [
      { role: "narration", startUs: 0, endUs: 750_000 },
      { role: "narration", startUs: 3_250_000, endUs: 4_000_000 },
    ],
  });
  const revision = f.store.edit(f.take.recordingId, {
    operation: "cut",
    requestId: "portable-plan",
    expectedRevisionId: "r0",
    ranges: [{ startUs: 1_000_000, endUs: 3_000_000 }],
  });
  const range = { startUs: 500_000, endUs: 1_500_000 };
  const metadata = f.processing.status(f.take.recordingId).published!.evidence;
  const original = join(f.home, "original-media"),
    moved = join(f.home, "moved-media");
  await mkdir(original);
  // A generated four-second mono PCM WAVE; this checkpoint verifies paths/plans, not decoding.
  const wave = Buffer.alloc(44 + 32_000 * 2);
  wave.write("RIFF", 0);
  wave.writeUInt32LE(wave.length - 8, 4);
  wave.write("WAVEfmt ", 8);
  wave.writeUInt32LE(16, 16);
  wave.writeUInt16LE(1, 20);
  wave.writeUInt16LE(1, 22);
  wave.writeUInt32LE(8_000, 24);
  wave.writeUInt32LE(16_000, 28);
  wave.writeUInt16LE(2, 32);
  wave.writeUInt16LE(16, 34);
  wave.write("data", 36);
  wave.writeUInt32LE(wave.length - 44, 40);
  for (let i = 0; i < 32_000; i++)
    wave.writeInt16LE(Math.round(Math.sin((i * Math.PI) / 8) * 4_000), 44 + i * 2);
  await writeFile(join(original, "narration.wav"), wave);
  await rename(original, moved);
  await expect(access(original)).rejects.toMatchObject({ code: "ENOENT" });
  const input = {
    recordingId: f.take.recordingId,
    sourceId: f.take.sourceId,
    revision,
    sourceEvidence: metadata,
    range,
    track: "mix" as const,
  };
  const plan = planAudioExcerpt(input, f.evidence, (role) => {
    if (role !== "narration") throw new Error("An unacquired track must not require an asset");
    return join(moved, "narration.wav");
  });
  expect(plan).toEqual({
    spans: [
      { startUs: 500_000, endUs: 1_000_000 },
      { startUs: 3_000_000, endUs: 3_500_000 },
    ],
    tracks: [
      {
        role: "narration",
        source: join(moved, "narration.wav"),
        sourceOffsetUs: 0,
        available: [
          { startUs: 500_000, endUs: 750_000 },
          { startUs: 3_250_000, endUs: 3_500_000 },
        ],
      },
    ],
    missingRoles: [{ role: "system", reason: "not_acquired" }],
  });
  expect(await readFile(plan.tracks[0]!.source)).toEqual(wave);
  f.audio.request({ ...f.input, range, revisionId: revision.id });
  await f.jobs.idle();
  const live = f.audio.request({ ...f.input, range, revisionId: revision.id });
  expect(live.state).toBe("ready");
  expect(f.requests[0]!.spans).toEqual(plan.spans);
  expect(f.requests[0]!.tracks.map(({ source: _source, ...track }) => track)).toEqual(
    plan.tracks.map(({ source: _source, ...track }) => track),
  );
  expect(live.published!.audio.missingRoles).toEqual(plan.missingRoles);
  if (process.env.SCREENREC_AUDIO_PLAN_EVIDENCE)
    await writeFile(
      process.env.SCREENREC_AUDIO_PLAN_EVIDENCE,
      JSON.stringify(
        {
          scope:
            "Generated media path relocation and shared plan only; evidence still uses the real catalog; no package/native parity claim",
          oldMediaPathAbsent: true,
          relocatedBytes: wave.length,
          assetReadEqualsGeneratedSource: true,
          spans: plan.spans,
          tracks: plan.tracks.map(({ source: _source, ...track }) => track),
          missingRoles: plan.missingRoles,
          liveExecutorPlanMatches: true,
        },
        null,
        2,
      ) + "\n",
      { flag: "wx" },
    );
});

test("shared audio planning rejects mismatched source identity and unresolved asset paths", async () => {
  const f = await fixture();
  const input = {
    recordingId: f.take.recordingId,
    sourceId: f.take.sourceId,
    revision: f.store.revision(f.take.recordingId),
    sourceEvidence: f.processing.status(f.take.recordingId).published!.evidence,
    range: f.input.range,
    track: "mix" as const,
  };
  for (const mismatched of [{ recordingId: "other" }, { sourceId: "other" }])
    expect(() =>
      planAudioExcerpt({ ...input, ...mismatched }, f.evidence, () => {
        throw new Error("Asset resolution should not be reached");
      }),
    ).toThrow(expect.objectContaining({ code: "INVALID_EVIDENCE" }));
  expect(() => planAudioExcerpt(input, f.evidence, () => "relative.wav")).toThrow(
    expect.objectContaining({ code: "INVALID_PATH" }),
  );
});

test("full-revision audio preserves an allowed thousand-cut batch without excerpt limits", async () => {
  const f = await fixture();
  const original = f.store.revision(f.take.recordingId);
  const cuts = Array.from({ length: 1000 }, (_, i) => ({
    startUs: 10_000 + i * 30_000,
    endUs: 15_000 + i * 30_000,
  }));
  const revision = createRevision(original, cutSpans(original, cuts), {
    id: "many-cuts",
    operation: "cut",
    createdAt: "fixture",
  });
  const input = {
    recordingId: f.take.recordingId,
    sourceId: f.take.sourceId,
    revision,
    sourceEvidence: f.processing.status(f.take.recordingId).published!.evidence,
  };
  const resolve = (role: AudioRole) => join(f.home, role + ".mov");
  const planned = planAudioTracks(
    { ...input, spans: input.revision.spans, track: "mix" },
    f.evidence,
    resolve,
  );
  expect(revision.spans).toHaveLength(1001);
  expect(revision.durationUs).toBe(35_000_000);
  expect(planned.tracks.map((track) => track.available)).toEqual([revision.spans, revision.spans]);
  expect(planned.missingRoles).toEqual([]);
  expect(() =>
    planAudioExcerpt(
      { ...input, track: "mix", range: { startUs: 0, endUs: revision.durationUs } },
      f.evidence,
      resolve,
    ),
  ).toThrow(expect.objectContaining({ code: "LIMIT_EXCEEDED" }));
  expect(() =>
    planAudioExcerpt(
      { ...input, track: "mix", range: { startUs: 0, endUs: 25_010_000 } },
      f.evidence,
      resolve,
    ),
  ).toThrow(expect.objectContaining({ code: "LIMIT_EXCEEDED" }));
  const short = { ...input, range: { startUs: 0, endUs: 100_000 }, track: "mix" as const };
  expect(
    planAudioExcerpt(short, f.evidence, resolve).tracks.map((track) => track.available),
  ).toEqual(
    [0, 1].map(() => [
      { startUs: 0, endUs: 10_000 },
      { startUs: 15_000, endUs: 40_000 },
      { startUs: 45_000, endUs: 70_000 },
      { startUs: 75_000, endUs: 100_000 },
      { startUs: 105_000, endUs: 120_000 },
    ]),
  );
});

test("silent movie planning preserves missing-role reasons without resolving absent assets", async () => {
  const f = await fixture({ microphone: false, systemAudio: true, intervals: [] });
  const input = {
    recordingId: f.take.recordingId,
    sourceId: f.take.sourceId,
    revision: f.store.revision(f.take.recordingId),
    sourceEvidence: f.processing.status(f.take.recordingId).published!.evidence,
  };
  const resolve = () => {
    throw new Error("Absent audio has no asset");
  };
  const plan = planAudioTracks(
    { ...input, spans: input.revision.spans, track: "mix" },
    f.evidence,
    resolve,
  );
  expect(plan.tracks).toEqual([]);
  expect(plan.missingRoles).toEqual([
    { role: "narration", reason: "not_requested" },
    { role: "system", reason: "not_acquired" },
  ]);
  expect(() => planAudioExcerpt({ ...input, ...f.input }, f.evidence, resolve)).toThrow(
    expect.objectContaining({ code: "UNAVAILABLE" }),
  );
  expect(() =>
    planAudioTracks(
      { ...input, sourceId: "other", spans: input.revision.spans, track: "mix" },
      f.evidence,
      resolve,
    ),
  ).toThrow(expect.objectContaining({ code: "INVALID_EVIDENCE" }));
});
