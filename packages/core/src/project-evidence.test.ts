import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import type { EditOperation } from "@screenrec/composition";
import { Catalog } from "./catalog.js";
import { AssetStore } from "./assets.js";
import { AcquisitionStore } from "./acquisitions.js";
import { ProjectStore } from "./projects.js";
import { JobQueue } from "./jobs.js";
import { DerivedCache } from "./cache.js";
import { TranscriptStore, type TranscriptRecords } from "./transcript.js";
import {
  TranscriptProcessing,
  assetTranscriptOwner,
  type TranscriptionModels,
} from "./transcript-processing.js";
import {
  ProjectEvidenceInspection,
  type ProjectEvidenceInput,
  type ProjectTranscriptRow,
} from "./project-evidence.js";
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});
async function fixture() {
  const home = await mkdtemp("/tmp/project-evidence-");
  const catalog = new Catalog(join(home, "catalog.sqlite"));
  const assets = new AssetStore(catalog, home);
  await assets.recover();
  const acquisitions = new AcquisitionStore(catalog);
  const projects = new ProjectStore(catalog, assets, acquisitions);
  const cache = new DerivedCache(catalog, home, (owner) => {
    if (owner.kind !== "project") throw new Error("Wrong cache owner");
    projects.get(owner.projectId);
  });
  await cache.reconcile();
  const input = join(home, "media.mov");
  await writeFile(input, "original media");
  const asset = await assets.import(input, { kind: "import" }, async () => ({
    originUs: 500,
    streams: ["speech", "empty", "short", "narrow", "video"].map((id) => ({
      id,
      kind: id === "video" ? "video" : "audio",
      codec: "fixture",
      decodable: true,
      startUs: 0,
      endUs: 1000,
      segments: [{ startUs: 0, endUs: 1000, empty: false }],
    })),
  }));
  const records = new TranscriptStore(catalog, home, assetTranscriptOwner(assets, acquisitions));
  const reads: { source: string; rows: number; limit: number }[] = [];
  const observed: TranscriptRecords = {
    wordRecords(identity, query) {
      const rows = records.wordRecords(identity, query);
      reads.push({ source: identity.sourceId, rows: rows.length, limit: query.limit });
      return rows;
    },
    gapRecords(identity, query) {
      const rows = records.gapRecords(identity, query);
      reads.push({ source: identity.sourceId, rows: rows.length, limit: query.limit });
      return rows;
    },
  };
  const modelState = { ready: true };
  const models: TranscriptionModels = {
    status: () => ({ state: modelState.ready ? "ready" : "absent" }),
    nativeRequest: () => ({ directory: home, files: [] }),
    modelDigest: "a".repeat(64),
    pins: {
      runtime: "FluidAudio",
      runtimeVersion: "0.15.7",
      runtimeRevision: "runtime",
      decoder: "parakeet-tdt-batch",
      model: "model",
      modelRevision: "revision",
    },
  };
  let transcripts: TranscriptProcessing, evidence: ProjectEvidenceInspection;
  const jobs = new JobQueue({
    store: catalog,
    providers: { newId: randomUUID },
    targets: {
      pin: (target) => {
        if (target.kind === "asset") {
          assets.get(target.assetId);
          return target;
        }
        if (target.kind === "project")
          return {
            ...target,
            revisionId: projects.revision(target.projectId, target.revisionId).id,
          };
        throw new Error("Wrong job owner");
      },
      isAvailable: (target) => target.kind !== "project" || !projects.isDeleting(target.projectId),
      isDeleting: (owner) => owner.kind === "project" && projects.isDeleting(owner.projectId),
      isCapturing: () => false,
    },
    execute: (execution) =>
      execution.job.artifact === "transcript"
        ? transcripts.execute(execution)
        : evidence.execute(execution),
  });
  transcripts = new TranscriptProcessing({
    jobs,
    transcripts: records,
    models,
    asset: { assets, acquisitions },
    transcribe: async (request) => {
      const available =
        request.track.streamId === "narrow"
          ? request.track.available.map((source) => ({
              startUs: source.startUs + 100,
              endUs: source.endUs - 100,
            }))
          : request.track.available;
      const transcribed = available.map((source, ordinal) => ({
        ordinal,
        source,
        state: "transcribed" as const,
        words:
          request.track.streamId === "empty"
            ? []
            : [100, 400, 800]
                .filter((start) => start >= source.startUs && start + 100 <= source.endUs)
                .map((start, i) => ({
                  text: ["one", "two", "three"][i]!,
                  source: { startUs: start, endUs: start + 100 },
                  confidence: 0.9,
                })),
      }));
      const lines =
        request.track.streamId === "short"
          ? transcribed.map((line) => ({
              ...line,
              state: "skipped" as const,
              reason: "too_short" as const,
              words: [],
            }))
          : transcribed;
      const body = lines.map((line) => JSON.stringify(line) + "\n").join("");
      await writeFile(request.output, body);
      return {
        output: {
          file: request.output,
          bytes: Buffer.byteLength(body),
          sha256: createHash("sha256").update(body).digest("hex"),
        },
        engine: {
          runtime: models.pins.runtime,
          runtimeVersion: models.pins.runtimeVersion,
          decoder: models.pins.decoder,
          encoderPrecision: "int8",
          computeUnits: "cpuAndNeuralEngine",
        },
        segments: lines.map(({ words, ...line }) => ({ ...line, wordCount: words.length })),
        wordCount: lines.reduce((sum, line) => sum + line.words.length, 0),
      };
    },
  });
  evidence = new ProjectEvidenceInspection({
    projects,
    assets,
    jobs,
    cache,
    transcripts,
    records: observed,
  });
  cleanup.push(async () => {
    await jobs.close();
    catalog.close();
    await rm(home, { recursive: true, force: true });
  });
  function create(operations: EditOperation[]) {
    const created = projects.create({
      requestId: randomUUID(),
      canvas: {
        width: 160,
        height: 96,
        fps: { numerator: 30, denominator: 1 },
        background: "#000000ff",
      },
    });
    const revision = projects.apply(created.project.projectId, {
      requestId: randomUUID(),
      expectedRevisionId: created.revision.id,
      operations,
    }).revision;
    return { projectId: created.project.projectId, revisionId: revision.id };
  }
  async function ready(input: ProjectEvidenceInput) {
    for (let n = 0; n < 8; n++) {
      const status = evidence.request(input);
      if (status.published) return status;
      await jobs.idle();
    }
    throw new Error("Evidence did not prepare");
  }
  return {
    home,
    catalog,
    assets,
    acquisitions,
    projects,
    cache,
    records,
    reads,
    modelState,
    transcripts,
    jobs,
    evidence,
    asset,
    create,
    ready,
  };
}
const track = (label: string, order = 0): EditOperation => ({
  operation: "track.add",
  track: { kind: "audio", order },
  label,
});
const clip = (
  assetId: string,
  label: string,
  trackLabel: string,
  start: number,
  end: number,
  sourceStart = 0,
  sourceEnd = 1000,
  streamId = "speech",
): EditOperation => ({
  operation: "place",
  label,
  clip: {
    assetId,
    streamId,
    trackId: { label: trackLabel },
    source: { kind: "range", range: { startUs: sourceStart, endUs: sourceEnd } },
    placement: { kind: "project", range: { startUs: start, endUs: end } },
  },
});
async function pages(f: Awaited<ReturnType<typeof fixture>>, input: ProjectEvidenceInput) {
  const rows: ProjectTranscriptRow[] = [];
  let cursor: unknown;
  for (let n = 0; n < 2000; n++) {
    const result = await f.evidence.get({ ...input, ...(cursor === undefined ? {} : { cursor }) });
    if (!result.page) throw new Error("Not ready");
    rows.push(...result.page.rows);
    if (!result.page.nextCursor) return rows;
    cursor = result.page.nextCursor;
  }
  throw new Error("Pagination failed to advance");
}

test("project pages merge repeated, retimed and tied track words exactly at limit one", async () => {
  const f = await fixture();
  const input = f.create([
    track("a"),
    track("b", 1),
    clip(f.asset.id, "first", "a", 0, 1000),
    clip(f.asset.id, "repeat", "a", 1000, 1700),
    clip(f.asset.id, "reordered", "b", 100, 700, 400),
  ]);
  await f.ready(input);
  const rows = await pages(f, { ...input, limit: 1 });
  expect(
    rows
      .filter((row) => row.type === "word")
      .map((row) => [
        row.type === "word" ? row.text : "",
        row.fragments[0]!.project.startUs,
        row.trackRank,
      ]),
  ).toEqual([
    ["one", 100, 0],
    ["two", 100, 1],
    ["two", 400, 0],
    ["three", 500, 1],
    ["three", 800, 0],
    ["one", 1070, 0],
    ["two", 1280, 0],
    ["three", 1560, 0],
  ]);
  expect(rows.every((row) => !row.partial)).toBe(true);
  expect(await pages(f, { ...input, limit: 20 })).toEqual(rows);
});

test("query clipping preserves editorial partiality and cursors pin history and query identity", async () => {
  const f = await fixture();
  const input = f.create([
    track("a"),
    clip(f.asset.id, "whole", "a", 0, 1000),
    clip(f.asset.id, "partial", "a", 2000, 2850, 150),
  ]);
  await f.ready(input);
  const first = await f.evidence.get({ ...input, limit: 1 });
  const cursor = first.page!.nextCursor!;
  const trackId = f.projects.revision(input.projectId, input.revisionId).document.tracks[0]!.id;
  expect(
    (await f.evidence.get({ ...input, cursor, trackIds: [trackId, trackId], limit: 2 })).page!.rows,
  ).toHaveLength(2);
  f.projects.apply(input.projectId, {
    requestId: "edit",
    expectedRevisionId: input.revisionId,
    operations: [{ operation: "canvas.set", canvas: { width: 320 } }],
  });
  const resumed = await f.evidence.get({ projectId: input.projectId, cursor, limit: 2 });
  expect(resumed.revisionId).toBe(input.revisionId);
  expect(
    resumed
      .page!.rows.filter((row) => row.type === "word")
      .map((row) => (row.type === "word" ? row.text : "")),
  ).toEqual(["two", "three"]);
  await expect(
    f.evidence.get({ ...input, cursor, range: { startUs: 1, endUs: 2850 } }),
  ).rejects.toMatchObject({ code: "ARTIFACT_CHANGED" });
  await f.ready({ ...input, range: { startUs: 120, endUs: 130 } });
  expect((await pages(f, { ...input, range: { startUs: 120, endUs: 130 } }))[0]).toMatchObject({
    partial: false,
    sourceRange: { startUs: 100, endUs: 200 },
  });
  await f.ready({ ...input, range: { startUs: 2001, endUs: 2020 } });
  expect((await pages(f, { ...input, range: { startUs: 2001, endUs: 2020 } }))[0]).toMatchObject({
    partial: true,
    sourceRange: { startUs: 100, endUs: 200 },
  });
  f.cache.remove(cursor.checkpointId);
  await expect(f.evidence.get({ ...input, cursor })).rejects.toMatchObject({
    code: "ARTIFACT_CHANGED",
  });
});

test("empty projects, ready zero-word sources and unavailable models remain distinct", async () => {
  const f = await fixture();
  const empty = f.projects.create({
    requestId: "empty",
    canvas: {
      width: 16,
      height: 16,
      fps: { numerator: 30, denominator: 1 },
      background: "#000000ff",
    },
  });
  const emptyInput = { projectId: empty.project.projectId };
  await f.ready(emptyInput);
  expect((await f.evidence.get(emptyInput)).page).toEqual({ rows: [], nextCursor: null });
  expect(() => f.evidence.request({ ...emptyInput, range: { startUs: 0, endUs: 0 } })).toThrow(
    "Evidence range",
  );
  const zero = f.create([track("a"), clip(f.asset.id, "empty", "a", 0, 1000, 0, 1000, "empty")]);
  await f.ready(zero);
  const ready = await f.evidence.get(zero);
  expect(ready.page).toEqual({ rows: [], nextCursor: null });
  expect(ready.dependencies[0]!.transcript!.wordCount).toBe(0);
  const speech = f.create([track("a"), clip(f.asset.id, "speech", "a", 0, 1000)]);
  f.modelState.ready = false;
  const unavailable = await f.evidence.get(speech);
  expect(unavailable.page).toBeNull();
  expect(unavailable.dependencies[0]).toMatchObject({
    transcript: null,
    reason: "model_not_prepared",
  });
});

test("ancestor acquisition gaps remain explicit and original words stay partial across the hole", async () => {
  const f = await fixture();
  f.catalog.catalog.prepare("INSERT INTO acquisitions VALUES(?,?,?,?,?)").run(
    "mask",
    "mask",
    "fixture",
    "{}",
    JSON.stringify({
      id: "mask",
      bindings: [
        {
          assetId: f.asset.id,
          streamId: "video",
          available: [
            { startUs: 0, endUs: 450 },
            { startUs: 475, endUs: 1000 },
          ],
        },
      ],
    }),
  );
  const input = f.create([
    { operation: "track.add", track: { kind: "video", order: 0 }, label: "picture" },
    track("audio"),
    {
      operation: "place",
      label: "parent",
      clip: {
        assetId: f.asset.id,
        streamId: "video",
        acquisitionId: "mask",
        trackId: { label: "picture" },
        source: { kind: "range", range: { startUs: 0, endUs: 1000 } },
        placement: { kind: "project", range: { startUs: 0, endUs: 1000 } },
      },
    },
    {
      operation: "place",
      label: "child",
      clip: {
        assetId: f.asset.id,
        streamId: "speech",
        trackId: { label: "audio" },
        source: { kind: "range", range: { startUs: 0, endUs: 1000 } },
        placement: {
          kind: "content",
          clipId: { label: "parent" },
          sourceRange: { startUs: 0, endUs: 1000 },
        },
      },
    },
  ]);
  await f.ready(input);
  const rows = await pages(f, { ...input, limit: 1 });
  expect(rows.map((row) => (row.type === "word" ? row.text : row.reason))).toEqual([
    "one",
    "two",
    "not_acquired",
    "three",
  ]);
  expect(rows[1]).toMatchObject({
    partial: true,
    fragments: [
      { source: { startUs: 400, endUs: 450 }, project: { startUs: 400, endUs: 450 } },
      { source: { startUs: 475, endUs: 500 }, project: { startUs: 475, endUs: 500 } },
    ],
  });
  expect(rows[2]).toMatchObject({ type: "gap", sourceRange: { startUs: 450, endUs: 475 } });
});

test("generation changes during checkpoint publication reject the page instead of returning stale continuation", async () => {
  const f = await fixture();
  const input = f.create([track("a"), clip(f.asset.id, "speech", "a", 0, 1000)]);
  await f.ready(input);
  let published!: () => void, release!: () => void;
  const publishedPromise = new Promise<void>((resolve) => {
    published = resolve;
  });
  const releasePromise = new Promise<void>((resolve) => {
    release = resolve;
  });
  const publish = f.cache.publish.bind(f.cache);
  // Hold the completed real cache write before get can validate and return its continuation.
  f.cache.publish = async (id) => {
    const result = await publish(id);
    published();
    await releasePromise;
    return result;
  };
  const pending = f.evidence.get({ ...input, limit: 1 });
  try {
    await publishedPromise;
    const source = f.transcripts.sourceStatus({ assetId: f.asset.id, streamId: "speech" });
    f.jobs.regenerate(source.jobId!, f.jobs.job(source.jobId!).generation);
    await f.jobs.idle();
    expect(
      f.transcripts.sourceStatus({ assetId: f.asset.id, streamId: "speech" }).published!.generation,
    ).not.toBe(source.published!.generation);
    release();
    await expect(pending).rejects.toMatchObject({ code: "ARTIFACT_CHANGED" });
  } finally {
    release();
  }
});

test("tied tracks checkpoint bounded initialization and read near-linearly across limit-one pages", async () => {
  const f = await fixture();
  const tracks = 140;
  const operations = Array.from({ length: tracks }, (_, n) => [
    track(`t${n}`, n),
    clip(f.asset.id, `c${n}`, `t${n}`, 0, 1000),
  ]).flat();
  const input = f.create(operations);
  await f.ready(input);
  const first = await f.evidence.get({ ...input, limit: 1 });
  expect(first.page!.rows).toEqual([]);
  expect(first.page!.nextCursor).not.toBeNull();
  let cursor: unknown = first.page!.nextCursor;
  const rows: ProjectTranscriptRow[] = [];
  for (let calls = 0; calls < tracks * 4; calls++) {
    const before = f.reads.length;
    const page = (await f.evidence.get({ ...input, cursor, limit: 1 })).page!;
    expect(f.reads.length - before).toBeLessThanOrEqual(128 * 4);
    rows.push(...page.rows);
    if (!page.nextCursor) break;
    cursor = page.nextCursor;
  }
  expect(rows).toHaveLength(tracks * 3);
  expect(rows.slice(0, tracks).map((row) => row.trackRank)).toEqual(
    Array.from({ length: tracks }, (_, n) => n),
  );
  expect(f.reads.reduce((sum, read) => sum + read.rows, 0)).toBeLessThan(tracks * 8);
  expect(Math.max(...f.reads.map((read) => read.limit))).toBeLessThanOrEqual(4);
}, 30000);

test("a late narrow query seeks relevant source rows and never prepares an unrelated transcript", async () => {
  const f = await fixture();
  const external = join(f.home, "unrelated.mov");
  await writeFile(external, "unrelated media");
  const unrelated = await f.assets.import(external, { kind: "import" }, async () => ({
    originUs: 0,
    streams: [
      {
        id: "speech",
        kind: "audio",
        codec: "fixture",
        decodable: true,
        startUs: 0,
        endUs: 1000,
        segments: [{ startUs: 0, endUs: 1000, empty: false }],
      },
    ],
  }));
  const input = f.create([
    track("a"),
    track("other", 1),
    ...Array.from({ length: 200 }, (_, n) =>
      clip(f.asset.id, `c${n}`, "a", n * 1000, (n + 1) * 1000),
    ),
    clip(unrelated.id, "unrelated", "other", 0, 1000),
  ]);
  const query = { ...input, range: { startUs: 199100, endUs: 199901 } };
  await f.ready(query);
  const rows = await pages(f, { ...query, limit: 1 });
  expect(
    rows.filter((row) => row.type === "word").map((row) => (row.type === "word" ? row.text : "")),
  ).toEqual(["one", "two", "three"]);
  expect(f.reads.every((read) => read.source === f.asset.id)).toBe(true);
  expect(f.reads.reduce((sum, read) => sum + read.rows, 0)).toBeLessThan(15);
  expect(f.transcripts.sourceStatus({ assetId: unrelated.id, streamId: "speech" }).state).toBe(
    "not_requested",
  );
});

test("no audio tracks and a source with no acquired support have different evidence results", async () => {
  const f = await fixture();
  const video = f.create([
    { operation: "track.add", track: { kind: "video", order: 0 }, label: "v" },
    clip(f.asset.id, "picture", "v", 0, 1000, 0, 1000, "video"),
  ]);
  await f.ready(video);
  const noSpeech = await f.evidence.get(video);
  expect(noSpeech.dependencies).toEqual([]);
  expect(noSpeech.page).toEqual({ rows: [], nextCursor: null });
  f.catalog.catalog.prepare("INSERT INTO acquisitions VALUES(?,?,?,?,?)").run(
    "empty",
    "empty",
    "fixture",
    "{}",
    JSON.stringify({
      id: "empty",
      bindings: [{ assetId: f.asset.id, streamId: "speech", available: [] }],
    }),
  );
  const empty = f.create([
    track("a"),
    {
      operation: "place",
      clip: {
        assetId: f.asset.id,
        streamId: "speech",
        acquisitionId: "empty",
        trackId: { label: "a" },
        source: { kind: "range", range: { startUs: 0, endUs: 1000 } },
        placement: { kind: "project", range: { startUs: 0, endUs: 1000 } },
      },
    },
  ]);
  await f.ready(empty);
  const unavailable = await f.evidence.get(empty);
  expect(unavailable.dependencies[0]).toMatchObject({
    state: "unavailable",
    reason: "no_audio",
    transcript: null,
  });
  expect(unavailable.page!.rows).toMatchObject([
    {
      type: "gap",
      reason: "not_acquired",
      generation: null,
      sourceRange: { startUs: 0, endUs: 1000 },
    },
  ]);
});

test("future track envelopes do not initialize source readers before the next emitted word", async () => {
  const f = await fixture();
  const input = f.create(
    Array.from({ length: 100 }, (_, n) => [
      track(`track${n}`, n),
      clip(f.asset.id, `clip${n}`, `track${n}`, n * 1000, (n + 1) * 1000),
    ]).flat(),
  );
  await f.ready(input);
  const page = (await f.evidence.get({ ...input, limit: 1 })).page!;
  expect(page.rows).toMatchObject([{ type: "word", text: "one", trackRank: 0 }]);
  expect(f.reads.length).toBeLessThanOrEqual(4);
  expect(f.reads.reduce((sum, read) => sum + read.rows, 0)).toBeLessThanOrEqual(4);
});

test("raw too-short gaps project through the same retained source mapping", async () => {
  const f = await fixture();
  const input = f.create([track("a"), clip(f.asset.id, "short", "a", 100, 660, 100, 900, "short")]);
  await f.ready(input);
  expect(await pages(f, { ...input, limit: 1 })).toMatchObject([
    {
      type: "gap",
      reason: "too_short",
      partial: true,
      sourceRange: { startUs: 0, endUs: 1000 },
      fragments: [{ source: { startUs: 100, endUs: 900 }, project: { startUs: 100, endUs: 660 } }],
    },
  ]);
});

test("actual native gaps narrower than requested support survive project projection", async () => {
  const f = await fixture();
  const input = f.create([track("a"), clip(f.asset.id, "narrow", "a", 0, 1000, 0, 1000, "narrow")]);
  await f.ready(input);
  const rows = await pages(f, { ...input, limit: 1 });
  expect(
    rows.map((row) => (row.type === "word" ? row.text : [row.reason, row.sourceRange])),
  ).toEqual([
    ["not_acquired", { startUs: 0, endUs: 100 }],
    "one",
    "two",
    "three",
    ["not_acquired", { startUs: 900, endUs: 1000 }],
  ]);
});

test("continuation pages reuse the immutable revision execution context", async () => {
  const f = await fixture();
  const input = f.create([
    track("a"),
    ...Array.from({ length: 100 }, (_, n) =>
      clip(f.asset.id, `clip${n}`, "a", n * 1000, (n + 1) * 1000),
    ),
  ]);
  await f.ready(input);
  const first = (await f.evidence.get({ ...input, limit: 1 })).page!;
  let reads = 0;
  const revision = f.projects.revision.bind(f.projects);
  f.projects.revision = (...args) => {
    reads++;
    return revision(...args);
  };
  const rows = [
    ...first.rows,
    ...(await pages(f, { ...input, cursor: first.nextCursor, limit: 1 })),
  ];
  expect(rows).toHaveLength(300);
  expect(reads).toBe(0);
}, 30000);

test("a cold execution owner rebuilds once and a cached context never revives a deleting project", async () => {
  const f = await fixture();
  const input = f.create([track("a"), clip(f.asset.id, "speech", "a", 0, 1000)]);
  await f.ready(input);
  const first = (await f.evidence.get({ ...input, limit: 1 })).page!;
  let reads = 0;
  const revision = f.projects.revision.bind(f.projects);
  f.projects.revision = (...args) => {
    reads++;
    return revision(...args);
  };
  const restarted = new ProjectEvidenceInspection({
    projects: f.projects,
    assets: f.assets,
    jobs: f.jobs,
    cache: f.cache,
    transcripts: f.transcripts,
    records: f.records,
  });
  const second = (await restarted.get({ ...input, cursor: first.nextCursor, limit: 1 })).page!;
  expect(second.rows).toMatchObject([{ type: "word", text: "two" }]);
  const third = (await restarted.get({ ...input, cursor: second.nextCursor, limit: 1 })).page!;
  expect(third.rows).toMatchObject([{ type: "word", text: "three" }]);
  expect(reads).toBe(1);
  f.projects.markDeleting(input.projectId);
  await expect(
    restarted.get({ ...input, cursor: third.nextCursor, limit: 1 }),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
});
