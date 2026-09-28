import {
  recordingSceneOwner,
  recordingSceneIdentity,
  recordingSceneMetadata,
} from "./scene-evidence.js";
import { afterEach, expect, test } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, statSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { fileAccess } from "./files.js";
import { TimelineInspection } from "./timeline-inspection.js";
import { RevisionStore } from "./library.js";
import { CatalogError } from "./catalog.js";
import { recordingEvidenceOwner, SourceEvidenceStore } from "./evidence.js";
import { SourceSceneAnalysis, scenePolicy } from "./scenes.js";
import { SceneEvidenceStore } from "./scene-evidence.js";
import { FileSourceEvidence, writeSourceEvidencePages } from "./evidence-pages.js";
import { FileSceneEvidence, writeSceneEvidencePages } from "./scene-pages.js";
import { createOriginalRevision, createRevision } from "./timeline.js";
import {
  FileTimelineEvents,
  TimelineEventRead,
  writeTimelineEventPages,
  validateTimelineEventPages,
} from "./event-pages.js";
const roots: string[] = [],
  stores: RevisionStore[] = [];
afterEach(() => {
  stores.splice(0).forEach((s) => s.close());
  roots.splice(0).forEach((p) => rmSync(p, { recursive: true, force: true }));
});
async function fixture(staticScenes = false, sourceCount = 520, duration = 2_600_000_000) {
  const root = mkdtempSync(join(tmpdir(), "event-pages-"));
  roots.push(root);
  const store = new RevisionStore(join(root, "db"), { now: () => "fixture", newId: randomUUID });
  stores.push(store);
  const recording = store.allocate().recording,
    sourceIdentity = {
      owner: { kind: "recording" as const, recordingId: recording.recordingId },
      sourceId: recording.sourceId,
      generation: "source-1",
    };
  store.registerSource(recording.recordingId, duration);
  const source = new SourceEvidenceStore(store, recordingEvidenceOwner(store));
  const records = [];
  for (let i = 0; i < sourceCount; i++) {
    const atSourceUs = i * 5_000_000;
    records.push({
      event: "geometry",
      data: {
        epoch: i,
        hostUs: i,
        sourceUs: atSourceUs,
        geometry: {
          outputWidth: 10,
          outputHeight: 10,
          contentScale: 1,
          scaleFactor: 1,
          contentRect: { x: 0, y: 0, width: 10, height: 10 },
        },
      },
    });
    records.push({ event: "pause", data: { atSourceUs, elapsedPauseUs: i + 123 } });
  }
  const file = join(root, "normalized.jsonl"),
    body = records.map((row) => JSON.stringify(row) + "\n").join("");
  writeFileSync(file, body);
  const sourceMetadata = await source.ingest({
    ...sourceIdentity,
    file,
    receipt: {
      file,
      header: { sessionID: sourceIdentity.sourceId },
      journal: "capture.journal.jsonl",
      cursorSamples: 0,
      geometryRecords: sourceCount,
      displaySpaces: 0,
      pauseEvents: sourceCount,
      audioIntervals: 0,
      lastSequence: records.length,
      incompleteTail: false,
      finished: true,
      bytes: Buffer.byteLength(body),
    },
  });
  const sceneIdentity = {
      recordingId: sourceIdentity.owner.recordingId,
      sourceId: sourceIdentity.sourceId,
      generation: "scene-1",
      policy: scenePolicy.id,
    },
    scenes = new SceneEvidenceStore(store, recordingSceneOwner(store));
  const analysis = new SourceSceneAnalysis(
    recording.recordingId,
    "unused",
    duration,
    async (request) => ({
      sourceWidth: 10,
      sourceHeight: 10,
      samples: request.atSourceUs.map((at) => ({
        requestedSourceUs: at,
        actualSourceUs: at,
        distanceUs: 0,
        width: 1,
        height: 1,
        rgbBase64: Buffer.alloc(
          3,
          !staticScenes && Math.floor(at / 5_000_000) % 2 ? 255 : 0,
        ).toString("base64"),
      })),
    }),
  );
  for (let startUs = 0; startUs < duration; startUs += 10_000_000)
    scenes.append(
      recordingSceneIdentity(sceneIdentity),
      { kind: "recording", durationUs: duration },
      await analysis.analyze(
        { startUs, endUs: startUs + 10_000_000 },
        new AbortController().signal,
      ),
    );
  const sceneMetadata = recordingSceneMetadata(
    scenes.finish(recordingSceneIdentity(sceneIdentity)),
  );
  const revision = createRevision(
    createOriginalRevision(duration, "fixture"),
    [
      { startUs: 0, endUs: 5_000_000 },
      { startUs: 15_000_000, endUs: duration },
    ],
    { id: "r1", createdAt: "fixture", operation: "cut" },
  );
  await writeSourceEvidencePages(source, sourceIdentity, join(root, "source"));
  await writeSceneEvidencePages(
    scenes,
    recordingSceneIdentity(sceneIdentity),
    join(root, "scenes"),
  );
  const input = {
    source: new FileSourceEvidence(join(root, "source"), sourceIdentity),
    sourceIdentity: sourceMetadata,
    scenes: new FileSceneEvidence(join(root, "scenes"), recordingSceneIdentity(sceneIdentity)),
    sceneIdentity: sceneMetadata,
    revision,
    interrupted: true,
  };
  const metadata = {
    sourceIdentity: sourceMetadata,
    sceneIdentity: sceneMetadata,
    revision,
    interrupted: true,
  };
  return { root, input, metadata };
}
test("portable events preserve all source/scene pages, journal ties, cuts and pause boundary markers", async () => {
  const f = await fixture(),
    directory = join(f.root, "events");
  await writeTimelineEventPages(f.input, directory);
  const reader = new FileTimelineEvents(directory, f.metadata);
  await validateTimelineEventPages(reader, f.input);
  const rows = [];
  let afterOrdinal: number | undefined;
  for (;;) {
    const page = reader.page(
      afterOrdinal === undefined ? { limit: 7 } : { afterOrdinal, limit: 7 },
    );
    rows.push(...page.rows);
    if (page.nextOrdinal === null) break;
    afterOrdinal = page.nextOrdinal;
  }
  expect(rows.filter((row) => row.atUs === 5_000_000).map((row) => row.event)).toEqual([
    { kind: "geometry", atSourceUs: 5_000_000 },
    { kind: "pause", atSourceUs: 5_000_000, elapsedPauseUs: 124 },
    { kind: "scene", atSourceUs: 5_000_000 },
    {
      kind: "cut",
      atSourceUs: 5_000_000,
      removedSourceSpans: [{ startUs: 5_000_000, endUs: 15_000_000 }],
    },
    { kind: "geometry", atSourceUs: 15_000_000 },
    { kind: "pause", atSourceUs: 15_000_000, elapsedPauseUs: 126 },
    { kind: "scene", atSourceUs: 15_000_000 },
  ]);
  expect(rows.some((row) => row.event.atSourceUs === 10_000_000)).toBe(false);
  expect(
    rows.find((row) => row.event.kind === "pause" && row.event.atSourceUs === 2_595_000_000),
  ).toMatchObject({ atUs: 2_585_000_000, event: { elapsedPauseUs: 642 } });
  expect(
    rows.find((row) => row.event.kind === "scene" && row.event.atSourceUs === 2_595_000_000),
  ).toBeDefined();
  expect(rows.at(-1)).toMatchObject({
    atUs: 2_590_000_000,
    event: { kind: "interruption", atSourceUs: 2_600_000_000 },
  });
  expect(
    () =>
      new FileTimelineEvents(directory, {
        ...f.metadata,
        sourceIdentity: { ...f.metadata.sourceIdentity, generation: "wrong" },
      }),
  ).toThrow();
  // A correctly rehashed forgery is still not a valid projection.
  const manifest = JSON.parse(readFileSync(join(directory, "pages.json"), "utf8")),
    descriptor = manifest.indexes.events[0],
    path = join(directory, descriptor.file),
    page = JSON.parse(readFileSync(path, "utf8"));
  page[0].atUs = 1;
  const forged = JSON.stringify(page);
  writeFileSync(path, forged);
  descriptor.bytes = Buffer.byteLength(forged);
  descriptor.sha256 = createHash("sha256").update(forged).digest("hex");
  writeFileSync(join(directory, "pages.json"), JSON.stringify(manifest));
  expect(() => new FileTimelineEvents(directory, f.metadata).page()).toThrow("projection");
  manifest.metadata.sourceIdentity.receipt = f.input.sourceIdentity.receipt;
  writeFileSync(join(directory, "pages.json"), JSON.stringify(manifest));
  expect(() => new FileTimelineEvents(directory, f.metadata)).toThrow();
});

test("complete event admission rejects missing evidence and excludes unacquired interruptions", async () => {
  const f = await fixture(),
    directory = join(f.root, "events"),
    input = { ...f.input, interrupted: false };
  await writeTimelineEventPages(input, directory);
  const reader = new FileTimelineEvents(directory, { ...f.metadata, interrupted: false });
  await validateTimelineEventPages(reader, input);
  let afterOrdinal: number | undefined;
  for (;;) {
    const page = reader.page(afterOrdinal === undefined ? {} : { afterOrdinal });
    expect(page.rows.some((row) => row.event.kind === "interruption")).toBe(false);
    if (page.nextOrdinal === null) break;
    afterOrdinal = page.nextOrdinal;
  }
  const path = join(directory, "pages.json"),
    manifest = JSON.parse(readFileSync(path, "utf8"));
  manifest.indexes.events.pop();
  writeFileSync(path, JSON.stringify(manifest));
  await expect(
    validateTimelineEventPages(
      new FileTimelineEvents(directory, { ...f.metadata, interrupted: false }),
      input,
    ),
  ).rejects.toThrow("omit");
  const canceled = new AbortController();
  canceled.abort(new Error("canceled export"));
  await expect(
    writeTimelineEventPages(input, join(f.root, "canceled"), canceled.signal),
  ).rejects.toThrow("canceled export");
});

test("static scene scans yield cancellation before repeated decoding exhausts their input budget", async () => {
  const f = await fixture(true),
    root = join(f.root, "scenes"),
    files = fileAccess(root),
    controller = new AbortController();
  const descriptors = JSON.parse(readFileSync(join(root, "pages.json"), "utf8")).indexes.chunks;
  const inputBytes = descriptors.reduce(
    (sum: number, page: { bytes: number }) => sum + page.bytes,
    0,
  );
  let decodedBytes = 0,
    scheduled = false;
  const scenes = new FileSceneEvidence(
    {
      ...files,
      open(file) {
        if (file !== "pages.json") {
          decodedBytes += statSync(join(root, file)).size;
          if (!scheduled) {
            scheduled = true;
            setImmediate(() => controller.abort(new Error("stop static scan")));
          }
        }
        return files.open(file);
      },
    },
    recordingSceneIdentity(f.metadata.sceneIdentity),
  );
  await expect(
    writeTimelineEventPages(
      { ...f.input, scenes },
      join(f.root, "cancel-static"),
      controller.signal,
    ),
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(decodedBytes).toBeLessThanOrEqual(inputBytes * 2);
  expect(existsSync(join(f.root, "cancel-static/pages.json"))).toBe(false);
});

test("validation yields cancellation across cut-only event pages", async () => {
  const f = await fixture(true, 1, 20_000_000);
  const revision = createRevision(
    createOriginalRevision(20_000_000, "fixture"),
    Array.from({ length: 300 }, (_, i) => ({ startUs: i * 2, endUs: i * 2 + 1 })),
    { id: "many-cuts", createdAt: "fixture", operation: "cut" },
  );
  const input = { ...f.input, revision, interrupted: false };
  const metadata = { ...f.metadata, revision, interrupted: false };
  const directory = join(f.root, "cut-events");
  await writeTimelineEventPages(input, directory);
  const reader = new FileTimelineEvents(directory, metadata);
  const controller = new AbortController();
  const abort = setImmediate(() => controller.abort());
  try {
    await expect(
      validateTimelineEventPages(reader, input, controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
  } finally {
    clearImmediate(abort);
  }
  await validateTimelineEventPages(reader, input);
});

test("timeline pages advance through removed evidence without emitting phantom ordinals", async () => {
  const f = await fixture(true);
  const revision = createRevision(
    createOriginalRevision(2_600_000_000, "fixture"),
    [{ startUs: 2_595_000_000, endUs: 2_600_000_000 }],
    { id: "tail", operation: "trim", createdAt: "fixture" },
  );
  const reader = new TimelineEventRead({ ...f.input, revision });
  const first = await reader.page({ limit: 2 });
  expect(first.rows).toEqual([]);
  expect(first.nextCursor).not.toBeNull();
  expect(first.nextCursor!.ordinal).toBe(0);
  const rows = [];
  let cursor = first.nextCursor;
  const seen = new Set<string>();
  while (cursor) {
    const position = JSON.stringify(cursor);
    expect(seen.has(position)).toBe(false);
    seen.add(position);
    const page = await reader.page({ cursor, limit: 2 });
    rows.push(...page.rows);
    cursor = page.nextCursor;
  }
  expect(rows).toEqual([
    {
      ordinal: 0,
      atUs: 0,
      event: {
        kind: "cut",
        atSourceUs: 0,
        removedSourceSpans: [{ startUs: 0, endUs: 2_595_000_000 }],
      },
    },
    { ordinal: 1, atUs: 0, event: { kind: "geometry", atSourceUs: 2_595_000_000 } },
    {
      ordinal: 2,
      atUs: 0,
      event: { kind: "pause", atSourceUs: 2_595_000_000, elapsedPauseUs: 642 },
    },
    { ordinal: 3, atUs: 5_000_000, event: { kind: "interruption", atSourceUs: 2_600_000_000 } },
  ]);
});

test("timeline continuations pin revision and authority across target and generation changes", async () => {
  const f = await fixture(true),
    original = createOriginalRevision(2_600_000_000, "fixture");
  let current = f.input.revision,
    generation = f.input.sourceIdentity.generation,
    closed = false;
  class Inspection extends TimelineInspection<{ id: string }> {
    protected resolve(input: { id: string; revisionId?: string | undefined }) {
      if (closed) throw new CatalogError("CONTEXT_CLOSED", "Closed fixture context");
      const revision =
        input.revisionId === original.id
          ? original
          : input.revisionId === f.input.revision.id
            ? f.input.revision
            : current;
      return {
        target: { id: input.id },
        events: { ...f.input, revision, sourceIdentity: { ...f.input.sourceIdentity, generation } },
      };
    }
  }
  const inspection = new Inspection();
  const first = await inspection.get({ id: "one", limit: 1 });
  expect(first.revisionId).toBe(f.input.revision.id);
  current = original;
  const second = await inspection.get({ id: "one", cursor: first.nextCursor!, limit: 1 });
  expect(second.revisionId).toBe(f.input.revision.id);
  expect(second.rows[0]!.ordinal).toBe(1);
  await expect(inspection.get({ id: "two", cursor: first.nextCursor! })).rejects.toMatchObject({
    code: "ARTIFACT_CHANGED",
  });
  await expect(
    inspection.get({ id: "one", revisionId: "r0", cursor: first.nextCursor! }),
  ).rejects.toMatchObject({ code: "ARTIFACT_CHANGED" });
  generation = "reprocessed";
  await expect(inspection.get({ id: "one", cursor: first.nextCursor! })).rejects.toMatchObject({
    code: "ARTIFACT_CHANGED",
  });
  generation = f.input.sourceIdentity.generation;
  current = f.input.revision;
  const concurrentEdit = setImmediate(() => {
    current = original;
  });
  try {
    const admitted = await inspection.get({ id: "one", limit: 500 });
    expect(admitted.revisionId).toBe(f.input.revision.id);
    expect(current.id).toBe(original.id);
  } finally {
    clearImmediate(concurrentEdit);
  }
  const revoke = setImmediate(() => {
    closed = true;
  });
  try {
    await expect(inspection.get({ id: "one", limit: 500 })).rejects.toMatchObject({
      code: "CONTEXT_CLOSED",
    });
  } finally {
    clearImmediate(revoke);
  }
});
