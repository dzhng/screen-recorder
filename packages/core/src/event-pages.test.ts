import { afterEach, expect, test } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, statSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { fileAccess } from "./files.js";
import { RevisionStore } from "./library.js";
import { SourceEvidenceStore } from "./evidence.js";
import { SourceSceneAnalysis, scenePolicy } from "./scenes.js";
import { SceneEvidenceStore } from "./scene-evidence.js";
import { FileSourceEvidence, writeSourceEvidencePages } from "./evidence-pages.js";
import { FileSceneEvidence, writeSceneEvidencePages } from "./scene-pages.js";
import { createOriginalRevision, createRevision } from "./timeline.js";
import {
  FileTimelineEvents,
  writeTimelineEventPages,
  validateTimelineEventPages,
} from "./event-pages.js";
const roots: string[] = [],
  stores: RevisionStore[] = [];
afterEach(() => {
  stores.splice(0).forEach((s) => s.close());
  roots.splice(0).forEach((p) => rmSync(p, { recursive: true, force: true }));
});
async function fixture(staticScenes = false) {
  const root = mkdtempSync(join(tmpdir(), "event-pages-"));
  roots.push(root);
  const store = new RevisionStore(join(root, "db"), { now: () => "fixture", newId: randomUUID });
  stores.push(store);
  const recording = store.allocate().recording,
    sourceIdentity = {
      recordingId: recording.recordingId,
      sourceId: recording.sourceId,
      generation: "source-1",
    };
  const duration = 2_600_000_000;
  store.registerSource(recording.recordingId, duration);
  const source = new SourceEvidenceStore(store);
  const records = [];
  for (let i = 0; i < 520; i++) {
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
  await source.ingest({
    ...sourceIdentity,
    file,
    receipt: {
      file,
      header: { sessionID: sourceIdentity.sourceId },
      journal: "capture.journal.jsonl",
      cursorSamples: 0,
      geometryRecords: 520,
      displaySpaces: 0,
      pauseEvents: 520,
      audioIntervals: 0,
      lastSequence: records.length,
      incompleteTail: false,
      finished: true,
      bytes: Buffer.byteLength(body),
    },
  });
  const sceneIdentity = { ...sourceIdentity, generation: "scene-1", policy: scenePolicy.id },
    scenes = new SceneEvidenceStore(store);
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
      sceneIdentity,
      await analysis.analyze(
        { startUs, endUs: startUs + 10_000_000 },
        new AbortController().signal,
      ),
    );
  scenes.finish(sceneIdentity, duration);
  const revision = createRevision(
    createOriginalRevision(duration, "fixture"),
    [
      { startUs: 0, endUs: 5_000_000 },
      { startUs: 15_000_000, endUs: duration },
    ],
    { id: "r1", createdAt: "fixture", operation: "cut" },
  );
  await writeSourceEvidencePages(source, sourceIdentity, join(root, "source"));
  await writeSceneEvidencePages(scenes, sceneIdentity, join(root, "scenes"));
  const input = {
    source: new FileSourceEvidence(join(root, "source"), sourceIdentity),
    sourceIdentity,
    scenes: new FileSceneEvidence(join(root, "scenes"), sceneIdentity),
    sceneIdentity,
    revision,
    interrupted: true,
  };
  const metadata = { sourceIdentity, sceneIdentity, revision, interrupted: true };
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
    f.metadata.sceneIdentity,
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
