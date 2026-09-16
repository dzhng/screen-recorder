import { afterEach, expect, test } from "vitest";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  unlinkSync,
  symlinkSync,
  linkSync,
  existsSync,
} from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DerivedCache } from "./cache.js";
import { RevisionStore } from "./library.js";
import { ScreenshotIndexStore } from "./screenshot-index.js";
import type { SelectedCandidate } from "./selection.js";
import type { MaterializedFrame } from "./frame-materialization.js";
const stores: RevisionStore[] = [],
  roots: string[] = [];
afterEach(() => {
  stores.splice(0).forEach((s) => s.close());
  roots.splice(0).forEach((p) => rmSync(p, { recursive: true, force: true }));
});
function fixture() {
  const home = mkdtempSync(join(tmpdir(), "selected-index-"));
  roots.push(home);
  const path = join(home, "catalog.sqlite");
  let id = 0;
  const providers = { now: () => "", newId: () => String(++id) };
  const catalog = new RevisionStore(path, providers);
  stores.push(catalog);
  const recording = catalog.allocate().recording;
  catalog.registerSource(recording.recordingId, 10_000_000);
  const sourceIdentity = {
    recordingId: recording.recordingId,
    sourceId: recording.sourceId,
    generation: "source-1",
  };
  const identity = {
    ...sourceIdentity,
    generation: "index-1",
    revisionId: "r0",
    sourceIdentity,
    sceneIdentity: { ...sourceIdentity, generation: "scene-1", policy: "scene-v1" },
    selectionPolicy: "selection-v1",
    framePolicy: "frame-v2",
    trailPolicy: "trail-v1",
  };
  const index = new ScreenshotIndexStore(catalog, home);
  return { home, path, providers, catalog, identity, index };
}
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7l8AAAAASUVORK5CYII=",
  "base64",
);
function add(
  f: ReturnType<typeof fixture>,
  ordinal = 0,
  at = 0,
  mutate: (frame: MaterializedFrame) => void = () => {},
) {
  const candidate: SelectedCandidate = {
    kind: "candidate",
    ordinal,
    requestedSourceUs: at,
    requestedPlaybackUs: at,
    kept: { startUs: 0, endUs: 10_000_000 },
    reasons: [{ kind: "first", eventSourceUs: at }],
    sourceIdentity: f.identity.sourceIdentity,
    sceneIdentity: f.identity.sceneIdentity,
  };
  const file = f.index.outputPath(f.identity, ordinal);
  writeFileSync(file, png);
  const frame: MaterializedFrame = {
    file,
    mediaType: "image/png",
    requestedSourceUs: at,
    actualSourceUs: at,
    distanceUs: 0,
    width: 1,
    height: 1,
    sourceWidth: 1,
    sourceHeight: 1,
    bytes: png.length,
    recordingId: f.identity.recordingId,
    sourceId: f.identity.sourceId,
    revisionId: "r0",
    requestedPlaybackUs: at,
    actualPlaybackUs: at,
    kept: candidate.kept,
    clean: true,
    annotation: null,
    sourceEvidence: null,
  };
  mutate(frame);
  f.index.appendCandidate(f.identity, candidate, frame);
  return { candidate, frame };
}
test("complete selected images and explicit coverage survive a catalog restart", async () => {
  const f = fixture();
  f.index.begin(f.identity);
  const first = add(f);
  expect(() => f.index.page({ identity: f.identity })).toThrow("complete");
  f.index.appendCoverage(f.identity, {
    kind: "coverage",
    ordinal: 0,
    source: { startUs: 0, endUs: 5_000_000 },
    playback: { startUs: 0, endUs: 5_000_000 },
    equality: "sampled",
  });
  f.index.appendCoverage(f.identity, {
    kind: "coverage",
    ordinal: 0,
    source: { startUs: 5_000_000, endUs: 10_000_000 },
    playback: { startUs: 5_000_000, endUs: 10_000_000 },
    equality: "sampled",
  });
  const metadata = await f.index.finish(f.identity);
  f.catalog.close();
  const reopened = new RevisionStore(f.path, f.providers);
  stores.push(reopened);
  const index = new ScreenshotIndexStore(reopened, f.home);
  expect(index.page({ identity: f.identity })).toEqual({
    metadata,
    entries: [{ candidate: first.candidate, frame: first.frame, coverageCount: 1 }],
    nextOrdinal: null,
  });
  expect(index.coveragePage({ identity: f.identity }).coverage).toEqual([
    {
      sequence: 0,
      kind: "coverage",
      ordinal: 0,
      source: { startUs: 0, endUs: 10_000_000 },
      playback: { startUs: 0, endUs: 10_000_000 },
      equality: "sampled",
    },
  ]);
  const lease = index.openRead(f.identity, 0);
  const buffer = Buffer.alloc(lease.bytes);
  expect(lease.read(buffer, 0)).toBe(png.length);
  expect(buffer).toEqual(png);
  lease.release();
});
function cover(
  f: ReturnType<typeof fixture>,
  ordinal = 0,
  startUs = 0,
  endUs = 10_000_000,
  equality: "sampled" | "unproven" = "sampled",
) {
  f.index.appendCoverage(f.identity, {
    kind: "coverage",
    ordinal,
    source: { startUs, endUs },
    playback: { startUs, endUs },
    equality,
  });
}
test("pages and filtered coverage remain bounded and reject unrelated anchors", async () => {
  const f = fixture();
  f.index.begin(f.identity);
  add(f);
  add(f, 1, 1_000_000);
  cover(f, 0, 0, 2_000_000);
  cover(f, 1, 2_000_000, 3_000_000);
  cover(f, 0, 3_000_000, 6_000_000);
  cover(f, 0, 6_000_000, 10_000_000, "unproven");
  await f.index.finish(f.identity);
  const first = f.index.page({ identity: f.identity, limit: 1 });
  expect(first.entries[0]?.coverageCount).toBe(3);
  expect(first.nextOrdinal).toBe(0);
  const second = f.index.page({ identity: f.identity, afterOrdinal: 0, limit: 1 });
  expect(second.entries[0]?.candidate.ordinal).toBe(1);
  expect(second.nextOrdinal).toBeNull();
  const coverage = f.index.coveragePage({ identity: f.identity, candidateOrdinal: 0, limit: 1 });
  expect(coverage.coverage[0]?.playback).toEqual({ startUs: 0, endUs: 2_000_000 });
  expect(coverage.nextSequence).toBe(0);
  const next = f.index.coveragePage({
    identity: f.identity,
    candidateOrdinal: 0,
    afterSequence: 0,
  });
  expect(next.coverage.map((c) => [c.sequence, c.playback, c.equality])).toEqual([
    [2, { startUs: 3_000_000, endUs: 6_000_000 }, "sampled"],
    [3, { startUs: 6_000_000, endUs: 10_000_000 }, "unproven"],
  ]);
  expect(() => f.index.page({ identity: f.identity, afterOrdinal: 50 })).toThrow("Unknown");
  expect(() => f.index.page({ identity: f.identity, limit: 201 })).toThrow("limit");
  expect(() =>
    f.index.coveragePage({ identity: f.identity, candidateOrdinal: 0, afterSequence: 1 }),
  ).toThrow("outside");
  expect(() => f.index.page({ identity: { ...f.identity, revisionId: "r1" } })).toThrow("identity");
  expect(() => f.index.openRead({ ...f.identity, sourceId: "other" }, 0)).toThrow("identity");
});
test("incomplete coverage and missing retained files cannot become complete", async () => {
  const f = fixture();
  f.index.begin(f.identity);
  const image = add(f);
  cover(f, 0, 0, 4_000_000);
  await expect(f.index.finish(f.identity)).rejects.toThrow("incomplete");
  expect(() => cover(f, 0, 5_000_000, 10_000_000)).toThrow("contiguously");
  cover(f, 0, 4_000_000, 10_000_000);
  unlinkSync(image.frame.file);
  await expect(f.index.finish(f.identity)).rejects.toThrow();
  expect(() => f.index.page({ identity: f.identity })).toThrow("complete");
  await f.index.remove(f.identity);
});
test("canceling final validation hides partial evidence and prevents late appends", async () => {
  const f = fixture();
  f.index.begin(f.identity);
  add(f);
  cover(f);
  const controller = new AbortController();
  const finishing = f.index.finish(f.identity, controller.signal);
  expect(() => f.index.outputPath(f.identity, 1)).toThrow("writable");
  controller.abort();
  await expect(finishing).rejects.toThrow();
  expect(() => f.index.page({ identity: f.identity })).toThrow("complete");
  await f.index.reclaim(f.identity.recordingId, () => false);
  expect(() => f.index.outputPath(f.identity, 0)).toThrow("identity");
});
test("an acquired read survives deletion while new reads fail", async () => {
  const f = fixture();
  f.index.begin(f.identity);
  const image = add(f);
  cover(f);
  await f.index.finish(f.identity);
  const read = f.index.openRead(f.identity, 0);
  await f.index.remove(f.identity);
  expect(existsSync(image.frame.file)).toBe(false);
  expect(() => f.index.openRead(f.identity, 0)).toThrow("identity");
  const bytes = Buffer.alloc(read.bytes + 10, 5);
  expect(read.read(bytes, 0)).toBe(png.length);
  expect(bytes.subarray(0, png.length)).toEqual(png);
  expect(bytes.subarray(png.length)).toEqual(Buffer.alloc(10, 5));
  expect(() => read.read(bytes, -1)).toThrow("position");
  read.release();
  read.release();
  expect(() => read.read(bytes, 0)).toThrow("released");
});
test("retained evidence survives derived cache eviction and owner-directed reclamation", async () => {
  const f = fixture();
  f.index.begin(f.identity);
  const image = add(f);
  cover(f);
  await f.index.finish(f.identity);
  const cache = new DerivedCache(f.catalog, f.home, png.length);
  await cache.reconcile();
  const reserved = cache.reserve();
  writeFileSync(reserved.path, png);
  await cache.publish(reserved.id);
  const later = cache.reserve();
  writeFileSync(later.path, png);
  await cache.publish(later.id);
  expect(cache.acquire(reserved.id)).toBeNull();
  expect(existsSync(image.frame.file)).toBe(true);
  const read = f.index.openRead(f.identity, 0);
  read.release();
  const partial = { ...f.identity, generation: "partial" };
  f.index.begin(partial);
  const stray = f.index.outputPath(partial, 0);
  writeFileSync(stray, png);
  await f.index.reclaim(f.identity.recordingId, (id) => id.generation === f.identity.generation);
  expect(existsSync(stray)).toBe(false);
  expect(f.index.page({ identity: f.identity }).entries[0]?.frame.bytes).toBe(png.length);
});
test("replaced, symlinked and hard-linked image files never become retained reads", async () => {
  const f = fixture();
  f.index.begin(f.identity);
  const image = add(f);
  cover(f);
  await f.index.finish(f.identity);
  const outside = join(f.home, "outside.png");
  writeFileSync(outside, png);
  unlinkSync(image.frame.file);
  symlinkSync(outside, image.frame.file);
  expect(() => f.index.openRead(f.identity, 0)).toThrow();
  unlinkSync(image.frame.file);
  linkSync(outside, image.frame.file);
  expect(() => f.index.openRead(f.identity, 0)).toThrow("PNG");
  unlinkSync(image.frame.file);
  writeFileSync(image.frame.file, png);
  expect(() => f.index.openRead(f.identity, 0)).toThrow("changed");
  await f.index.remove(f.identity);
  expect(existsSync(outside)).toBe(true);
});
test("a substituted FIFO is rejected without blocking file validation", async () => {
  const f = fixture();
  f.index.begin(f.identity);
  const image = add(f);
  cover(f);
  await f.index.finish(f.identity);
  unlinkSync(image.frame.file);
  execFileSync("mkfifo", [image.frame.file]);
  const sourceDirectory = new URL("./", import.meta.url).href;
  const child = spawnSync(
    process.execPath,
    [
      "--experimental-transform-types",
      "--disable-warning=ExperimentalWarning",
      "--input-type=module",
      "-e",
      `
 import { registerHooks } from 'node:module';
 const sourceDirectory=${JSON.stringify(sourceDirectory)};
 // This Node subprocess must exercise the current source, including its .js TS imports.
 registerHooks({resolve(specifier,context,next){
   if(context.parentURL?.startsWith(sourceDirectory) && specifier.startsWith('.') && specifier.endsWith('.js'))
     specifier=new URL(specifier.slice(0,-3)+'.ts',context.parentURL).href;
   return next(specifier,context);
 }});
 const { RevisionStore } = await import(${JSON.stringify(new URL("./library.ts", import.meta.url).href)});
 const { ScreenshotIndexStore } = await import(${JSON.stringify(new URL("./screenshot-index.ts", import.meta.url).href)});
 const catalog=new RevisionStore(${JSON.stringify(f.path)});
 try {
   new ScreenshotIndexStore(catalog,${JSON.stringify(f.home)}).openRead(${JSON.stringify(f.identity)},0);
   process.exitCode=1;
 } catch(error) {
   console.log(JSON.stringify({code:error.code,message:error.message}));
 } finally {catalog.close();}
 `,
    ],
    { timeout: 1000, encoding: "utf8" },
  );
  expect(child.stderr).toBe("");
  expect(child.error).toBeUndefined();
  expect({ status: child.status, signal: child.signal }).toEqual({ status: 0, signal: null });
  expect(JSON.parse(child.stdout)).toEqual({
    code: "INVALID_EVIDENCE",
    message: "Invalid retained PNG file or byte receipt",
  });
});
test("one damaged generation does not starve unrelated reclamation", async () => {
  const f = fixture();
  f.index.begin(f.identity);
  const image = add(f);
  cover(f);
  await f.index.finish(f.identity);
  const next = { ...f.identity, generation: "next-partial" };
  f.index.begin(next);
  const nextPath = f.index.outputPath(next, 0);
  writeFileSync(nextPath, png);
  writeFileSync(join(image.frame.file, "..", "unexpected.txt"), "foreign file");
  const error = await f.index.reclaim(f.identity.recordingId, () => false).catch((error) => error);
  expect(error).toBeInstanceOf(Error);
  expect(existsSync(nextPath)).toBe(false);
  expect(() => f.index.page({ identity: f.identity })).toThrow("complete");
});
test("candidate and coverage pages cap work independently at 50 by default and 200 maximum", async () => {
  const f = fixture();
  f.index.begin(f.identity);
  for (let i = 0; i < 205; i++) add(f, i, i * 1000);
  for (let i = 0; i < 205; i++)
    cover(f, i % 2, Math.floor((i * 10_000_000) / 205), Math.floor(((i + 1) * 10_000_000) / 205));
  await f.index.finish(f.identity);
  expect(f.index.page({ identity: f.identity }).entries.map((e) => e.candidate.ordinal)).toEqual(
    Array.from({ length: 50 }, (_, i) => i),
  );
  const first = f.index.page({ identity: f.identity, limit: 200 });
  expect(first.nextOrdinal).toBe(199);
  expect(
    f.index
      .page({ identity: f.identity, afterOrdinal: first.nextOrdinal! })
      .entries.map((e) => e.candidate.ordinal),
  ).toEqual([200, 201, 202, 203, 204]);
  expect(f.index.coveragePage({ identity: f.identity }).nextSequence).toBe(49);
  const coverage = f.index.coveragePage({ identity: f.identity, limit: 200 });
  expect(coverage.nextSequence).toBe(199);
  expect(
    f.index
      .coveragePage({ identity: f.identity, afterSequence: 199 })
      .coverage.map((c) => c.sequence),
  ).toEqual([200, 201, 202, 203, 204]);
});
test("a rendered receipt cannot silently change pinned source evidence", () => {
  const f = fixture();
  f.index.begin(f.identity);
  expect(() =>
    add(f, 0, 0, (frame) => {
      frame.sourceEvidence = {
        ...f.identity.sourceIdentity,
        generation: "different-source-attempt",
        integrity: {
          finished: true,
          incompleteTail: false,
          invalidAtSequence: null,
          lastSequence: 0,
          openPauseHostUs: null,
        },
      };
    }),
  ).toThrow("receipt");
});
test("compact finish metadata is a usable pinned identity for pages and reads", async () => {
  const f = fixture();
  f.index.begin(f.identity);
  add(f);
  cover(f);
  const metadata = await f.index.finish(f.identity);
  expect(f.index.page({ identity: metadata }).entries[0]?.candidate.ordinal).toBe(0);
  const read = f.index.openRead(metadata, 0);
  expect(read.bytes).toBe(png.length);
  read.release();
  expect(() => f.index.page({ identity: { ...metadata, framePolicy: "different" } })).toThrow(
    "identity",
  );
});
