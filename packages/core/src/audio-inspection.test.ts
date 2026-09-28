import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { Catalog } from "./catalog.js";
import { AssetStore } from "./assets.js";
import { AcquisitionStore } from "./acquisitions.js";
import { JobQueue } from "./jobs.js";
import { DerivedCache } from "./cache.js";
import { MediaAudioInspection, type SourceAudioRenderer } from "./audio-inspection.js";

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});
function gate() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}
const renderer: SourceAudioRenderer = {
  implementationId: "fixture-wav",
  async render({ source, range, output }, signal) {
    signal.throwIfAborted();
    const sampleRate = 48000,
      channels = 2;
    const start = Math.floor((range.startUs * sampleRate) / 1e6),
      end = Math.floor((range.endUs * sampleRate) / 1e6);
    const bytes = Buffer.alloc(44 + (end - start) * channels * 4);
    bytes.write("RIFF");
    bytes.writeUInt32LE(bytes.length - 8, 4);
    bytes.write("WAVEfmt ", 8);
    bytes.writeUInt32LE(16, 16);
    bytes.writeUInt16LE(3, 20);
    bytes.writeUInt16LE(channels, 22);
    bytes.writeUInt32LE(sampleRate, 24);
    bytes.writeUInt32LE(sampleRate * channels * 4, 28);
    bytes.writeUInt16LE(channels * 4, 32);
    bytes.writeUInt16LE(32, 34);
    bytes.write("data", 36);
    bytes.writeUInt32LE(bytes.length - 44, 40);
    const unavailable = [];
    let at = range.startUs;
    for (const part of source.available) {
      if (part.endUs <= at) continue;
      if (part.startUs >= range.endUs) break;
      if (part.startUs > at) unavailable.push({ startUs: at, endUs: part.startUs });
      at = Math.min(range.endUs, part.endUs);
    }
    if (at < range.endUs) unavailable.push({ startUs: at, endUs: range.endUs });
    await writeFile(output, bytes, { flag: "wx" });
    return {
      file: output,
      mediaType: "audio/wav",
      bytes: bytes.length,
      sampleRate,
      channels,
      layout: "stereo",
      range,
      sampleRange: { start, end },
      frames: end - start,
      decodedFrames: end - start,
      unavailable,
    };
  },
};
async function fixture(render = renderer) {
  const home = await mkdtemp("/tmp/source-audio-inspection-");
  const catalog = new Catalog(join(home, "catalog.sqlite"));
  const assets = new AssetStore(catalog, home);
  await assets.recover();
  const acquisitions = new AcquisitionStore(catalog);
  const original = join(home, "external.mov");
  await writeFile(original, "immutable source bytes");
  const asset = await assets.import(original, { kind: "import" }, async () => ({
    originUs: 250000,
    streams: ["a", "b"].map((id) => ({
      id,
      kind: "audio" as const,
      codec: "pcm",
      decodable: true,
      startUs: 100000,
      endUs: 1000000,
      segments: [{ startUs: 100000, endUs: 1000000, empty: false }],
      sampleRate: 48000,
      channels: 2,
    })),
  }));
  // Seed completed import-boundary metadata; actual journal adoption has its own acquisition tests.
  catalog.catalog.prepare("INSERT INTO acquisitions VALUES(?,?,?,?,?)").run(
    "mask",
    "import-mask",
    home,
    "{}",
    JSON.stringify({
      id: "mask",
      bindings: [
        { assetId: asset.id, streamId: "a", available: [{ startUs: 200000, endUs: 800000 }] },
      ],
    }),
  );
  const cache = new DerivedCache(catalog, home, (owner) => {
    if (owner.kind !== "asset") throw new Error("Expected asset");
    assets.get(owner.assetId);
  });
  await cache.reconcile();
  let inspection!: MediaAudioInspection;
  let pinHook = () => {};
  const jobs = new JobQueue({
    store: catalog,
    providers: { newId: randomUUID },
    targets: {
      pin(target) {
        if (target.kind !== "asset") throw new Error("Expected asset");
        assets.get(target.assetId);
        pinHook();
        return target;
      },
      isAvailable: () => true,
      isDeleting: () => false,
      isCapturing: () => false,
    },
    execute: (execution) => inspection.execute(execution),
  });
  inspection = new MediaAudioInspection({
    assets,
    acquisitions,
    jobs,
    cache,
    sourceRenderer: render,
  });
  cleanup.push(async () => {
    await jobs.close();
    catalog.close();
    await rm(home, { recursive: true, force: true });
  });
  return {
    home,
    catalog,
    assets,
    acquisitions,
    cache,
    jobs,
    inspection,
    asset,
    original,
    selection: { assetId: asset.id, streamId: "a" },
    onPin(hook: () => void) {
      pinHook = hook;
    },
  };
}

test("source WAV jobs pin selection/support, retain actual job references and regenerate evicted delivery", async () => {
  const requests: Parameters<SourceAudioRenderer["render"]>[0][] = [];
  const f = await fixture({
    ...renderer,
    async render(request, signal) {
      requests.push(request);
      return renderer.render(request, signal);
    },
  });
  const selection = { ...f.selection, acquisitionId: "mask" };
  const first = f.inspection.request(selection);
  expect(first.range).toEqual({ startUs: 100000, endUs: 1000000 });
  expect(f.inspection.request(selection).jobId).toBe(first.jobId);
  expect(f.assets.references(f.asset.id)).toEqual([{ kind: "job", id: first.jobId }]);
  expect(f.acquisitions.references("mask")).toEqual([{ kind: "job", id: first.jobId }]);
  await f.jobs.idle();
  const ready = f.inspection.request(selection),
    audio = ready.published!.audio;
  expect(ready.state).toBe("ready");
  expect(audio.unavailable).toEqual([
    { startUs: 100000, endUs: 200000 },
    { startUs: 800000, endUs: 1000000 },
  ]);
  expect(requests[0]!.source).toEqual({
    source: f.assets.path(f.asset.id),
    streamId: "a",
    sourceOffsetUs: -250000,
    available: [{ startUs: 200000, endUs: 800000 }],
  });
  const original = await readFile(audio.file);
  const read = f.cache.acquire(audio.cacheId)!;
  const buffer = Buffer.alloc(read.bytes);
  expect(read.read(buffer, 0)).toBe(buffer.length);
  read.release();
  expect(buffer).toEqual(original);
  f.cache.remove(audio.cacheId);
  expect(f.inspection.request(selection).published).toBeNull();
  await f.jobs.idle();
  const again = f.inspection.request(selection);
  expect(again.jobId).toBe(first.jobId);
  expect(again.published!.generation).toBeGreaterThan(ready.published!.generation);
  expect(await readFile(again.published!.audio.file)).toEqual(original);
  expect(await readFile(f.original, "utf8")).toBe("immutable source bytes");
  expect(f.inspection.request(f.selection).jobId).not.toBe(first.jobId);
  expect(f.inspection.request({ ...f.selection, streamId: "b" }).jobId).not.toBe(first.jobId);
});

test("cancellation fences late renderer output and only explicit retry admits another attempt", async () => {
  const entered = gate(),
    release = gate();
  let calls = 0;
  const f = await fixture({
    ...renderer,
    async render(request, signal) {
      calls++;
      entered.resolve();
      await release.promise;
      return renderer.render(request, calls === 1 ? new AbortController().signal : signal);
    },
  });
  cleanup.push(async () => release.resolve());
  const input = { ...f.selection, range: { startUs: 71, endUs: 199991 } };
  const first = f.inspection.request(input);
  await entered.promise;
  f.jobs.cancel(first.jobId!);
  release.resolve();
  await f.jobs.idle();
  expect(f.inspection.request(input)).toMatchObject({ state: "not_requested", published: null });
  expect(calls).toBe(1);
  expect(await readdir(join(f.home, "cache", "derived"))).toEqual([]);
  f.inspection.retry(input);
  await f.jobs.idle();
  const ready = f.inspection.request(input);
  expect(ready.state).toBe("ready");
  expect(calls).toBe(2);
  expect(ready.published!.audio.sampleRange).toEqual({ start: 3, end: 9599 });
  expect(ready.published!.audio.unavailable).toEqual([{ startUs: 71, endUs: 100000 }]);
});

test("malformed native receipts and WAV files cannot publish and repeated reads do not loop", async () => {
  const defects = [
    "path",
    "rate",
    "range",
    "frames",
    "layout",
    "bytes",
    "unavailable",
    "header",
    "format",
    "payload",
  ];
  for (const defect of defects) {
    let calls = 0;
    const f = await fixture({
      ...renderer,
      async render(request, signal) {
        calls++;
        const value = (await renderer.render(request, signal)) as Record<string, unknown>;
        if (defect === "header")
          await writeFile(request.output, Buffer.alloc(value.bytes as number));
        else if (defect === "format" || defect === "payload") {
          const bytes = await readFile(request.output);
          if (defect === "format") bytes.writeUInt16LE(1, 22);
          else bytes.writeUInt32LE(bytes.length - 48, 40);
          await writeFile(request.output, bytes);
        } else
          value[defect === "path" ? "file" : defect === "rate" ? "sampleRate" : defect] = {
            path: "/tmp/unrelated.wav",
            rate: 44100,
            range: { startUs: 0, endUs: 1000000 },
            frames: 1,
            layout: "mono",
            bytes: 4,
            unavailable: [],
          }[defect];
        return value;
      },
    });
    const input = { ...f.selection, range: { startUs: 0, endUs: 200000 } };
    f.inspection.request(input);
    await f.jobs.idle();
    expect(f.inspection.request(input), defect).toMatchObject({
      state: "failed",
      published: null,
    });
    expect(f.jobs.job(f.inspection.request(input).jobId!).errorCode).toBe("INVALID_RESPONSE");
    expect(f.inspection.request(input).state).toBe("failed");
    expect(calls).toBe(1);
    expect(await readdir(join(f.home, "cache", "derived"))).toEqual([]);
  }
});

test("invalid ranges and acquisition/stream mismatches refuse before queue admission", async () => {
  const f = await fixture();
  expect(() =>
    f.inspection.request({ ...f.selection, range: { startUs: 0, endUs: 1000001 } }),
  ).toThrow(expect.objectContaining({ code: "INVALID_RANGE" }));
  expect(() =>
    f.inspection.request({ ...f.selection, streamId: "b", acquisitionId: "mask" }),
  ).toThrow(expect.objectContaining({ code: "INVALID_PARAMS" }));
  expect(f.assets.references(f.asset.id)).toEqual([]);
  expect(f.catalog.catalog.prepare("SELECT COUNT(*) AS count FROM jobs").get()).toEqual({
    count: 0,
  });
});

test("a failed dependency retain rolls back the job and earlier asset retain together", async () => {
  const f = await fixture();
  f.onPin(() => {
    f.catalog.catalog.prepare("UPDATE acquisitions SET metadata=NULL WHERE id=?").run("mask");
  });
  expect(() => f.inspection.request({ ...f.selection, acquisitionId: "mask" })).toThrow(
    expect.objectContaining({ code: "NOT_READY" }),
  );
  expect(f.assets.references(f.asset.id)).toEqual([]);
  expect(f.acquisitions.references("mask")).toEqual([]);
  expect(f.catalog.catalog.prepare("SELECT COUNT(*) AS count FROM jobs").get()).toEqual({
    count: 0,
  });
  expect(f.acquisitions.get("mask").bindings[0]!.streamId).toBe("a");
});
