import { recordingSceneOwner, recordingSceneIdentity } from "./scene-evidence.js";
import { RetainedIndexRead } from "./index-read.js";
import { test, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID, createHash } from "node:crypto";
import { RevisionStore } from "./library.js";
import { SceneEvidenceStore } from "./scene-evidence.js";
import { SourceSceneAnalysis, scenePolicy } from "./scenes.js";
import { FileSceneEvidence, writeSceneEvidencePages } from "./scene-pages.js";
import { ScreenshotIndexStore } from "./screenshot-index.js";
import { FileScreenshotIndex, writeScreenshotIndexPages } from "./index-pages.js";
import { framePolicy } from "./frame-materialization.js";
import { trailPolicy } from "./trails.js";
import { selectionPolicy } from "./selection.js";
const roots: string[] = [],
  stores = new Set<RevisionStore>();
afterEach(() => {
  for (const store of stores) store.close();
  stores.clear();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7l8AAAAASUVORK5CYII=",
  "base64",
);
async function fixture(count = 260) {
  const root = mkdtempSync(join(tmpdir(), "portable-index-"));
  roots.push(root);
  const original = join(root, "original");
  mkdirSync(original);
  const store = new RevisionStore(join(original, "catalog.sqlite"), {
    now: () => "",
    newId: randomUUID,
  });
  stores.add(store);
  const take = store.allocate().recording,
    duration = count * 2_000_000;
  store.registerSource(take.recordingId, duration);
  const revision = store.revision(take.recordingId),
    sourceIdentity = {
      owner: { kind: "recording" as const, recordingId: take.recordingId },
      sourceId: take.sourceId,
      generation: "source1",
    };
  const sceneIdentity = {
    recordingId: sourceIdentity.owner.recordingId,
    sourceId: sourceIdentity.sourceId,
    generation: "scene1",
    policy: scenePolicy.id,
  };
  const scenes = new SceneEvidenceStore(store, recordingSceneOwner(store)),
    analysis = new SourceSceneAnalysis(take.recordingId, "/unused", duration, async (request) => ({
      sourceWidth: 1,
      sourceHeight: 1,
      samples: request.atSourceUs.map((at) => ({
        requestedSourceUs: at,
        actualSourceUs: at,
        distanceUs: 0,
        width: 1,
        height: 1,
        rgbBase64: Buffer.alloc(3, (Math.floor(at / 10_000_000) % 2) * 255).toString("base64"),
      })),
    }));
  for (let at = 0; at < duration; at += 10_000_000)
    scenes.append(
      recordingSceneIdentity(sceneIdentity),
      { kind: "recording", durationUs: duration },
      await analysis.analyze(
        { startUs: at, endUs: Math.min(duration, at + 10_000_000) },
        new AbortController().signal,
      ),
    );
  scenes.finish(recordingSceneIdentity(sceneIdentity));
  const identity = {
    recordingId: sourceIdentity.owner.recordingId,
    sourceId: sourceIdentity.sourceId,
    generation: "index1",
    sourceIdentity,
    sceneIdentity,
    revisionId: revision.id,
    framePolicy,
    trailPolicy: trailPolicy.id,
    selectionPolicy: selectionPolicy.id,
  };
  const index = new ScreenshotIndexStore(store, original);
  index.begin(identity);
  for (let ordinal = 0; ordinal < count; ordinal++) {
    const at = ordinal * 2_000_000,
      kept = { startUs: 0, endUs: duration },
      file = index.outputPath(identity, ordinal);
    writeFileSync(file, png);
    index.appendCandidate(
      identity,
      {
        kind: "candidate",
        ordinal,
        requestedSourceUs: at,
        requestedPlaybackUs: at,
        kept,
        reasons: [{ kind: "coverage", eventSourceUs: at }],
        sourceIdentity,
        sceneIdentity,
      },
      {
        file,
        mediaType: "image/png",
        bytes: png.length,
        width: 1,
        height: 1,
        sourceWidth: 1,
        sourceHeight: 1,
        requestedSourceUs: at,
        actualSourceUs: at,
        distanceUs: 0,
        requestedPlaybackUs: at,
        actualPlaybackUs: at,
        kept,
        clean: true,
        sourceEvidence: null,
        annotation: null,
        recordingId: take.recordingId,
        sourceId: take.sourceId,
        revisionId: revision.id,
      },
    );
    for (let part = 0; part < 2; part++) {
      const range = { startUs: at + part * 1_000_000, endUs: at + (part + 1) * 1_000_000 };
      index.appendCoverage(identity, {
        kind: "coverage",
        ordinal,
        source: range,
        playback: range,
        equality: part ? "unproven" : "sampled",
      });
    }
  }
  await index.finish(identity);
  return { root, original, store, scenes, index, identity, sceneIdentity, revision };
}
function framesWithoutPaths(entries: ReturnType<ScreenshotIndexStore["page"]>["entries"]) {
  return entries.map((entry) => {
    const { file, ...frame } = entry.frame;
    expect(file).toBeTruthy();
    return { ...entry, frame };
  });
}
test("scene chunks, retained images and coverage remain readable after library removal and relocation", async () => {
  const f = await fixture();
  const sceneFirst = f.scenes.page({ identity: recordingSceneIdentity(f.sceneIdentity), limit: 1 }),
    sceneNext = f.scenes.page({
      identity: recordingSceneIdentity(f.sceneIdentity),
      afterStartUs: 0,
      limit: 100,
    });
  const first = f.index.page({ identity: f.identity, limit: 200 }),
    next = f.index.page({ identity: f.identity, afterOrdinal: first.nextOrdinal!, limit: 200 });
  const coverage = f.index.coveragePage({ identity: f.identity, afterSequence: 254, limit: 200 }),
    candidateCoverage = f.index.coveragePage({
      identity: f.identity,
      candidateOrdinal: 259,
      limit: 1,
    });
  await writeSceneEvidencePages(
    f.scenes,
    recordingSceneIdentity(f.sceneIdentity),
    join(f.root, "scenes"),
  );
  await writeScreenshotIndexPages(f.index, f.identity, f.revision, join(f.root, "index"));
  f.store.close();
  stores.delete(f.store);
  rmSync(f.original, { recursive: true });
  renameSync(join(f.root, "scenes"), join(f.root, "moved-scenes"));
  renameSync(join(f.root, "index"), join(f.root, "moved-index"));
  const scenes = new FileSceneEvidence(
      join(f.root, "moved-scenes"),
      recordingSceneIdentity(f.sceneIdentity),
    ),
    index = new FileScreenshotIndex(join(f.root, "moved-index"), f.identity, f.revision);
  expect(scenes.page({ identity: recordingSceneIdentity(f.sceneIdentity), limit: 1 })).toEqual(
    sceneFirst,
  );
  expect(
    scenes.page({ identity: recordingSceneIdentity(f.sceneIdentity), afterStartUs: 0, limit: 100 }),
  ).toEqual(sceneNext);
  const movedFirst = index.page({ identity: f.identity, limit: 200 });
  expect({ ...movedFirst, entries: framesWithoutPaths(movedFirst.entries) }).toEqual({
    ...first,
    entries: framesWithoutPaths(first.entries),
  });
  expect(
    framesWithoutPaths(
      index.page({ identity: f.identity, afterOrdinal: first.nextOrdinal!, limit: 200 }).entries,
    ),
  ).toEqual(framesWithoutPaths(next.entries));
  expect(index.coveragePage({ identity: f.identity, afterSequence: 254, limit: 200 })).toEqual(
    coverage,
  );
  expect(index.coveragePage({ identity: f.identity, candidateOrdinal: 259, limit: 1 })).toEqual(
    candidateCoverage,
  );
  expect(
    index
      .coveragePage({
        identity: f.identity,
        candidateOrdinal: 259,
        afterSequence: candidateCoverage.nextSequence!,
        limit: 1,
      })
      .coverage.map((row) => row.equality),
  ).toEqual(["unproven"]);
  const image = index.openRead(f.identity, 259),
    bytes = Buffer.alloc(image.bytes);
  expect(image.read(bytes, 0)).toBe(png.length);
  expect(bytes).toEqual(png);
  image.release();
  expect(() => image.read(bytes, 0)).toThrow("released");
  expect(movedFirst.entries[0]!.frame.file.startsWith(join(f.root, "moved-index"))).toBe(true);
  const manifest = JSON.parse(readFileSync(join(f.root, "moved-index", "pages.json"), "utf8"));
  const entryFile = readFileSync(
    join(f.root, "moved-index", manifest.indexes.entries[0].file),
    "utf8",
  );
  expect(entryFile).not.toContain(f.original);
  expect(() =>
    index.coveragePage({ identity: f.identity, candidateOrdinal: 259, afterSequence: 0 }),
  ).toThrow("outside");
  expect(() => index.page({ identity: f.identity, afterOrdinal: 999 })).toThrow(
    expect.objectContaining({ code: "NOT_FOUND" }),
  );
  expect(() => index.page({ identity: { ...f.identity, generation: "wrong" } })).toThrow(
    "identity",
  );
});

test("portable policies, pinned contexts, required members and retained image bytes fail explicitly", async () => {
  const f = await fixture(2),
    directory = join(f.root, "index"),
    sceneDirectory = join(f.root, "scenes");
  await writeScreenshotIndexPages(f.index, f.identity, f.revision, directory);
  await writeSceneEvidencePages(f.scenes, recordingSceneIdentity(f.sceneIdentity), sceneDirectory);
  expect(() => new FileScreenshotIndex(directory, f.identity, { ...f.revision, id: "r1" })).toThrow(
    "pinned revision",
  );
  const path = join(directory, "pages.json"),
    body = readFileSync(path),
    manifest = JSON.parse(body.toString());
  manifest.metadata.framePolicy = "future-frame";
  writeFileSync(path, JSON.stringify(manifest));
  expect(() => new FileScreenshotIndex(directory, f.identity, f.revision)).toThrow("Unsupported");
  writeFileSync(path, body);
  const index = new FileScreenshotIndex(directory, f.identity, f.revision);
  const mutable = index.page({ identity: f.identity }).metadata;
  Reflect.set(mutable.sourceIdentity, "generation", "mutated by caller");
  expect(index.page({ identity: f.identity }).metadata.sourceIdentity).toEqual(
    f.identity.sourceIdentity,
  );
  const imagePath = index.page({ identity: f.identity }).entries[0]!.frame.file;
  const changed = Buffer.from(png);
  changed[40] = changed[40]! ^ 1;
  writeFileSync(imagePath, changed);
  expect(() => index.openRead(f.identity, 0)).toThrow("differs");
  const scenePath = join(sceneDirectory, "pages.json"),
    sceneBody = readFileSync(scenePath),
    sceneManifest = JSON.parse(sceneBody.toString());
  sceneManifest.metadata.policy = "future-scene";
  writeFileSync(scenePath, JSON.stringify(sceneManifest));
  expect(
    () => new FileSceneEvidence(sceneDirectory, recordingSceneIdentity(f.sceneIdentity)),
  ).toThrow("Unsupported");
  writeFileSync(scenePath, sceneBody);
  const scenes = new FileSceneEvidence(sceneDirectory, recordingSceneIdentity(f.sceneIdentity));
  expect(() =>
    scenes.page({ identity: { ...recordingSceneIdentity(f.sceneIdentity), sourceId: "other" } }),
  ).toThrow("identity");
  rmSync(join(sceneDirectory, sceneManifest.indexes.chunks[0].file));
  expect(() => scenes.page({ identity: recordingSceneIdentity(f.sceneIdentity) })).toThrow();
  rmSync(join(directory, manifest.indexes.coverage[0].file));
  expect(() => index.coveragePage({ identity: f.identity })).toThrow();
});

test("portable chunks apply the append owner's semantic validation even with matching hashes", async () => {
  const f = await fixture(2),
    directory = join(f.root, "scenes");
  await writeSceneEvidencePages(f.scenes, recordingSceneIdentity(f.sceneIdentity), directory);
  const manifestPath = join(directory, "pages.json"),
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const descriptor = manifest.indexes.chunks[0],
    path = join(directory, descriptor.file),
    original = JSON.parse(readFileSync(path, "utf8"));
  for (const mutate of [
    (chunk: (typeof original)[number]) => {
      chunk.coverage[1].requestedSourceUs++;
    },
    (chunk: (typeof original)[number]) => {
      chunk.coverage[1].distanceUs++;
    },
    (chunk: (typeof original)[number]) => {
      chunk.coverage[2].actualSourceUs = 0;
      chunk.coverage[2].distanceUs = chunk.coverage[2].requestedSourceUs;
    },
    (chunk: (typeof original)[number]) => {
      chunk.comparisons[0].actualSourceUs = chunk.comparisons[0].previousActualSourceUs;
    },
  ]) {
    const rows = structuredClone(original);
    mutate(rows[0]);
    const bytes = Buffer.from(JSON.stringify(rows));
    writeFileSync(path, bytes);
    descriptor.bytes = bytes.length;
    descriptor.sha256 = createHash("sha256").update(bytes).digest("hex");
    writeFileSync(manifestPath, JSON.stringify(manifest));
    const reader = new FileSceneEvidence(directory, recordingSceneIdentity(f.sceneIdentity));
    expect(() => reader.page({ identity: recordingSceneIdentity(f.sceneIdentity) })).toThrow(
      expect.objectContaining({ code: "INVALID_EVIDENCE" }),
    );
  }
});

test("portable chunks must continue their predecessor and cover the whole source", async () => {
  const f = await fixture(12),
    directory = join(f.root, "scenes");
  await writeSceneEvidencePages(f.scenes, recordingSceneIdentity(f.sceneIdentity), directory);
  const manifestPath = join(directory, "pages.json"),
    manifestBody = readFileSync(manifestPath, "utf8");
  const pagePath = join(directory, JSON.parse(manifestBody).indexes.chunks[0].file),
    original = JSON.parse(readFileSync(pagePath, "utf8"));
  expect(original.map((chunk: { range: object }) => chunk.range)).toEqual([
    { startUs: 0, endUs: 10_000_000 },
    { startUs: 10_000_000, endUs: 20_000_000 },
    { startUs: 20_000_000, endUs: 24_000_000 },
  ]);
  const boundary = original[0].comparisons.at(-1);
  expect(boundary).toMatchObject({ actualSourceUs: 10_000_000, boundary: true });
  const write = (rows: typeof original) => {
    const manifest = JSON.parse(manifestBody),
      descriptor = manifest.indexes.chunks[0],
      bytes = Buffer.from(JSON.stringify(rows));
    writeFileSync(pagePath, bytes);
    Object.assign(descriptor, {
      rows: rows.length,
      last: [rows.at(-1).range.startUs],
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
    manifest.metadata.chunkCount = rows.length;
    writeFileSync(manifestPath, JSON.stringify(manifest));
  };
  const repeated = structuredClone(original);
  repeated[1].comparisons.unshift(boundary);
  for (const rows of [repeated, [original[0], original[2]], original.slice(0, 2)]) {
    write(rows);
    const reader = new FileSceneEvidence(directory, recordingSceneIdentity(f.sceneIdentity));
    expect(() => reader.page({ identity: recordingSceneIdentity(f.sceneIdentity) })).toThrow(
      expect.objectContaining({ code: "INVALID_EVIDENCE" }),
    );
  }
  write(original);
  expect(
    new FileSceneEvidence(directory, recordingSceneIdentity(f.sceneIdentity)).page({
      identity: recordingSceneIdentity(f.sceneIdentity),
    }).chunks,
  ).toEqual(original);
});

test("shared retained index reads bind package continuations and preserve both reader behaviors", async () => {
  const f = await fixture(2),
    directory = join(f.root, "shared-index");
  await writeScreenshotIndexPages(f.index, f.identity, f.revision, directory);
  const portable = new FileScreenshotIndex(directory, f.identity, f.revision);
  const reference = {
    packageHandle: "package-one",
    revisionId: f.revision.id,
    generation: f.identity.generation,
  };
  for (const reader of [f.index, portable]) {
    const metadata = reader.metadata(f.identity);
    const read = new RetainedIndexRead(reader, metadata, reference);
    const first = read.get({ limit: 1 });
    expect(first.page.entries[0]!.reference).toEqual({ ...reference, ordinal: 0 });
    expect(first.page.nextCursor).toEqual({ ...reference, afterOrdinal: 0 });
    const next = read.get({ cursor: first.page.nextCursor!, limit: 1 });
    expect(next.page.entries[0]!.reference).toEqual({ ...reference, ordinal: 1 });
    expect(next.page.nextCursor).toBeNull();
    expect(() =>
      read.get({ cursor: { ...first.page.nextCursor!, packageHandle: "another-package" } }),
    ).toThrow(expect.objectContaining({ code: "ARTIFACT_CHANGED" }));
    const coverage = read.coverage({ candidateOrdinal: 1, limit: 1 });
    expect(coverage.coverage[0]!.equality).toBe("sampled");
    expect(coverage.nextCursor).toEqual({ ...reference, candidateOrdinal: 1, afterSequence: 2 });
    expect(
      read.coverage({ candidateOrdinal: 1, cursor: coverage.nextCursor!, limit: 1 }).coverage[0]!
        .equality,
    ).toBe("unproven");
    expect(() => read.coverage({ candidateOrdinal: 0, cursor: coverage.nextCursor! })).toThrow(
      expect.objectContaining({ code: "ARTIFACT_CHANGED" }),
    );
    expect(() =>
      read.coverage({
        candidateOrdinal: 1,
        cursor: { ...coverage.nextCursor!, packageHandle: "another-package" },
      }),
    ).toThrow(expect.objectContaining({ code: "ARTIFACT_CHANGED" }));
    expect(read.frame(1)).toMatchObject({
      ...reference,
      ordinal: 1,
      state: "ready",
      candidate: { ordinal: 1 },
      coverageCount: 2,
    });
    expect(() => read.frame(-1)).toThrow(expect.objectContaining({ code: "INVALID_PARAMS" }));
    for (const absent of [2, 3, 50]) {
      expect(() => read.frame(absent)).toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
      expect(() => read.openRead(absent)).toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
      expect(() => read.coverage({ candidateOrdinal: absent })).toThrow(
        expect.objectContaining({ code: "NOT_FOUND" }),
      );
    }
    expect(() => read.openRead(-1)).toThrow(expect.objectContaining({ code: "INVALID_PARAMS" }));
    const image = read.openRead(1),
      bytes = Buffer.alloc(image.bytes);
    try {
      expect(image.read(bytes, 0)).toBe(png.length);
      expect(bytes).toEqual(png);
    } finally {
      image.release();
    }
    expect(() => image.read(bytes, 0)).toThrow("released");
    for (const wrong of [
      { ...reference, generation: "wrong" },
      { ...reference, revisionId: "wrong" },
    ])
      expect(() => new RetainedIndexRead(reader, metadata, wrong)).toThrow(
        expect.objectContaining({ code: "ARTIFACT_CHANGED" }),
      );
    Reflect.set(metadata.sourceIdentity, "generation", "changed after controller admission");
    expect(read.get({ limit: 1 }).page.metadata.sourceIdentity.generation).toBe(
      f.identity.sourceIdentity.generation,
    );
  }
});
