import { spectralWindows } from "./audio-spectrum.js";
import { WaveformInspection } from "./waveform.js";
import { waveformBuckets } from "./audio-wave.js";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { Catalog } from "./catalog.js";
import { AssetStore } from "./assets.js";
import { AcquisitionStore } from "./acquisitions.js";
import { ProjectStore } from "./projects.js";
import { JobQueue } from "./jobs.js";
import { DerivedCache } from "./cache.js";
import { MediaAudioInspection, type ProjectAudioRenderer } from "./audio-inspection.js";

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});
async function wave(file: string, frames: number) {
  const bytes = Buffer.alloc(44 + frames * 8);
  bytes.write("RIFF");
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write("WAVEfmt ", 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(3, 20);
  bytes.writeUInt16LE(2, 22);
  bytes.writeUInt32LE(48000, 24);
  bytes.writeUInt32LE(384000, 28);
  bytes.writeUInt16LE(8, 32);
  bytes.writeUInt16LE(32, 34);
  bytes.write("data", 36);
  bytes.writeUInt32LE(frames * 8, 40);
  for (let i = 0; i < frames; i++) {
    bytes.writeFloatLE(0.25, 44 + i * 8);
    bytes.writeFloatLE(-0.125, 48 + i * 8);
  }
  await writeFile(file, bytes, { flag: "wx" });
  return bytes.length;
}
const render: ProjectAudioRenderer["render"] = async ({ window, output }, signal) => {
  signal.throwIfAborted();
  const frames = window.manifest.sampleRange.end - window.manifest.sampleRange.start;
  return {
    file: output,
    bytes: await wave(output, frames),
    sampleRate: 48000,
    channels: 2,
    frames,
    peak: 0.25,
    clippedSamples: 0,
    maximumBlockFrames: 1024,
    peakResidentBytes: 1,
    decoderContext: {
      policy: "bounded-current-retained-run",
      sampleRate: 48000,
      maximumPrerollFrames: 0,
      maximumTailFrames: 0,
    },
    unavailable: [...window.audio()]
      .filter((clip) => clip.source.kind === "range")
      .map((clip) => ({ clipId: clip.clipId, ranges: [] })),
  };
};
async function fixture(renderer = render, budget?: number, durationUs = 1000000) {
  const home = await mkdtemp("/tmp/project-audio-");
  const catalog = new Catalog(join(home, "catalog.sqlite"));
  const assets = new AssetStore(catalog, home);
  await assets.recover();
  const acquisitions = new AcquisitionStore(catalog);
  const projects = new ProjectStore(catalog, assets, acquisitions);
  const cache = new DerivedCache(
    catalog,
    home,
    (owner) => {
      if (owner.kind !== "project") throw new Error("project expected");
      projects.get(owner.projectId);
    },
    budget,
  );
  await cache.reconcile();
  let inspection!: MediaAudioInspection;
  let waveform!: WaveformInspection;
  const jobs = new JobQueue({
    store: catalog,
    providers: { newId: randomUUID },
    targets: {
      pin(target) {
        if (target.kind !== "project") throw new Error("project expected");
        return { ...target, revisionId: projects.revision(target.projectId, target.revisionId).id };
      },
      isAvailable: (owner) => owner.kind === "project" && !projects.isDeleting(owner.projectId),
      isDeleting: (owner) => owner.kind === "project" && projects.isDeleting(owner.projectId),
      isCapturing: () => false,
    },
    execute: (execution) =>
      execution.job.artifact === "waveform"
        ? waveform.execute(execution)
        : inspection.execute(execution),
  });
  inspection = new MediaAudioInspection({
    assets,
    acquisitions,
    cache,
    jobs,
    sourceRenderer: {
      implementationId: "unused-source",
      render: async () => {
        throw new Error("no source executor");
      },
    },
    project: { projects, renderer: { implementationId: "fixture-audio", render: renderer } },
  });
  waveform = new WaveformInspection({ audio: inspection, jobs, cache });
  cleanups.push(async () => {
    await jobs.close();
    catalog.close();
    await rm(home, { recursive: true, force: true });
  });
  const source = join(home, "source.wav");
  await wave(source, 48000);
  const asset = await assets.import(source, { kind: "import" }, async () => ({
    originUs: 0,
    streams: [
      {
        id: "track:1",
        kind: "audio",
        codec: "pcm",
        decodable: true,
        startUs: 0,
        endUs: durationUs,
        segments: [{ startUs: 0, endUs: durationUs, empty: false }],
        sampleRate: 48000,
        channels: 2,
      },
      {
        id: "picture",
        kind: "video",
        codec: "not-audio",
        decodable: true,
        startUs: 0,
        endUs: durationUs,
        segments: [{ startUs: 0, endUs: durationUs, empty: false }],
        width: 32,
        height: 32,
      },
    ],
  }));
  const created = projects.create({
    requestId: "project",
    canvas: {
      width: 32,
      height: 32,
      fps: { numerator: 30, denominator: 1 },
      background: "#000000ff",
    },
  });
  const ref = (label: string) => ({ label });
  const placed = projects.apply(created.project.projectId, {
    requestId: "clips",
    expectedRevisionId: created.revision.id,
    operations: [
      { operation: "group.add", label: "outer", group: { kind: "audio", order: 0 } },
      {
        operation: "group.add",
        label: "inner",
        group: { kind: "audio", order: 0, parentId: ref("outer") },
      },
      {
        operation: "track.add",
        label: "voice",
        track: { kind: "audio", order: 0, parentId: ref("inner") },
      },
      { operation: "track.add", label: "video", track: { kind: "video", order: 0 } },
      ...["voice", "video"].map((label) => ({
        operation: "place",
        label: `${label}-clip`,
        clip: {
          trackId: ref(label),
          assetId: asset.id,
          streamId: label === "voice" ? "track:1" : "picture",
          source: { kind: "range", range: { startUs: 0, endUs: durationUs } },
          placement: { kind: "project", range: { startUs: 0, endUs: durationUs } },
        },
      })),
      ...[
        ["clip", "voice-clip", 2],
        ["track", "voice", 3],
        ["group", "inner", 5],
        ["group", "outer", 7],
        ["output", "output", 11],
      ].map(([kind, label, gain]) => ({
        operation: "processing.set",
        target: kind === "output" ? { kind } : { kind, id: ref(String(label)) },
        steps: [
          { label: `step-${label}`, processor: { type: "gain", gain } },
          { enabled: false, processor: { type: "gain", gain: 99 } },
          { processor: { type: "gain", gain: 0.5 } },
        ],
      })),
    ],
  });
  return {
    home,
    projects,
    cache,
    jobs,
    inspection,
    waveform,
    asset,
    source,
    placed,
    projectId: created.project.projectId,
  };
}

test("project audio taps bind only their descendants and target-owned processing, with absolute sample clocks", async () => {
  const requests: Parameters<ProjectAudioRenderer["render"]>[0][] = [];
  const f = await fixture(async (request, signal) => {
    requests.push(request);
    return render(request, signal);
  });
  const targets = [
    { kind: "clip", id: f.placed.edit.labels["voice-clip"]! },
    { kind: "track", id: f.placed.edit.labels.voice! },
    { kind: "group", id: f.placed.edit.labels.inner! },
    { kind: "group", id: f.placed.edit.labels.outer! },
    { kind: "output" },
  ] as const;
  const expected = [2, 3, 5, 7, 11];
  for (const [index, target] of targets.entries()) {
    for (const point of [
      { kind: "dry" },
      { kind: "processed" },
      {
        kind: "after-step",
        stepId:
          f.placed.edit.labels[
            `step-${["voice-clip", "voice", "inner", "outer", "output"][index]}`
          ]!,
      },
    ] as const) {
      const input = {
        projectId: f.projectId,
        range: { startUs: 333, endUs: 999000 },
        tap: { target, point },
      };
      const pending = f.inspection.request(input);
      await f.jobs.idle();
      const ready = f.inspection.request(input);
      expect(ready.state).toBe("ready");
      expect(ready.jobId).toBe(pending.jobId);
      expect(ready.published!.audio.sampleRange).toEqual({ start: 15, end: 47952 });
      const request = requests.at(-1)!;
      expect(request.assets.map((asset) => asset.streamId)).toEqual(["track:1"]);
      expect([...request.window.frames()]).toEqual([]);
      expect(
        request.window.manifest.requirements
          .filter((r) => r.kind === "executor")
          .map((r) => r.mediaKind),
      ).toEqual(["audio"]);
      const nodes = request.window.manifest.processing;
      expect(nodes.map((n) => n.target)).toEqual(targets.slice(0, index + 1));
      expect(nodes.slice(0, -1).map((n) => n.steps[0]!.processor.gain)).toEqual(
        expected.slice(0, index),
      );
      expect(nodes.at(-1)!.steps.map((step) => step.processor.gain)).toEqual(
        point.kind === "dry"
          ? []
          : point.kind === "processed"
            ? [expected[index], 99, 0.5]
            : [expected[index]],
      );
      const bytes = await readFile(ready.published!.audio.file);
      expect(bytes.readFloatLE(44)).toBe(0.25);
      expect(bytes.readFloatLE(48)).toBe(-0.125);
    }
  }
});

test("audio history and cache recovery keep revision, tap and byte source pinned", async () => {
  const f = await fixture();
  const old = f.inspection.request({ projectId: f.projectId });
  await f.jobs.idle();
  const pinned = { projectId: f.projectId, revisionId: old.revisionId };
  const first = f.inspection.request(pinned).published!.audio;
  f.projects.apply(f.projectId, {
    requestId: "change",
    expectedRevisionId: old.revisionId,
    operations: [{ operation: "processing.set", target: { kind: "output" }, steps: [] }],
  });
  expect(f.inspection.request(pinned).published!.audio).toEqual(first);
  expect(f.inspection.request({ projectId: f.projectId }).jobId).not.toBe(old.jobId);
  f.cache.remove(first.cacheId);
  f.inspection.request(pinned);
  await f.jobs.idle();
  expect(f.inspection.request(pinned).published!.audio.cacheId).not.toBe(first.cacheId);
});

test("project full-WAV capacity refuses before admission and malformed WAV cannot publish", async () => {
  const f = await fixture(render, 1000);
  expect(() => f.inspection.request({ projectId: f.projectId })).toThrow(
    expect.objectContaining({ code: "LIMIT_EXCEEDED" }),
  );

  const bad = await fixture(async (request, signal) => {
    const result = (await render(request, signal)) as { frames: number };
    return { ...result, frames: result.frames - 1 };
  });
  const pending = bad.inspection.request({ projectId: bad.projectId });
  await bad.jobs.idle();
  expect(bad.jobs.job(pending.jobId!)).toMatchObject({
    state: "failed",
    errorCode: "INVALID_RESPONSE",
  });
  expect(bad.inspection.request({ projectId: bad.projectId }).published).toBeNull();
  expect(bad.cache.bytes).toBe(0);
});

test("audio taps reject a picture target, retiming and sub-sample output before rendering", async () => {
  let calls = 0;
  const f = await fixture(async (request, signal) => {
    calls++;
    return render(request, signal);
  });
  expect(() =>
    f.inspection.request({
      projectId: f.projectId,
      tap: { target: { kind: "track", id: f.placed.edit.labels.video! }, point: { kind: "dry" } },
    }),
  ).toThrow(expect.objectContaining({ code: "INVALID_COMPOSITION" }));
  expect(() =>
    f.inspection.request({ projectId: f.projectId, range: { startUs: 0, endUs: 1 } }),
  ).toThrow(expect.objectContaining({ code: "INVALID_RANGE" }));
  f.projects.apply(f.projectId, {
    requestId: "retime",
    expectedRevisionId: f.placed.revision.id,
    operations: [
      {
        operation: "retime",
        clipIds: [f.placed.edit.labels["voice-clip"]!],
        durationUs: 500000,
        ripple: "none",
      },
    ],
  });
  expect(() => f.inspection.request({ projectId: f.projectId })).toThrow(
    expect.objectContaining({ code: "NOT_READY" }),
  );
  expect(calls).toBe(0);
});

test.runIf(Boolean(process.env.SCREENREC_NATIVE))(
  "native mixer serves every project audio tap without parent leakage or clock reset",
  async () => {
    const native: ProjectAudioRenderer["render"] = async ({ window, assets, output }, signal) => {
      signal.throwIfAborted();
      const result = spawnSync(process.env.SCREENREC_NATIVE!, [], {
        encoding: "utf8",
        timeout: 30000,
        input:
          JSON.stringify({
            id: "project-core-tap",
            operation: "media.mixCompositionAudio",
            params: {
              output,
              range: window.manifest.sampleRange,
              clips: [...window.audio()],
              processing: window.manifest.processing,
              assets,
            },
          }) + "\n",
      });
      expect(result.status, result.stderr).toBe(0);
      const reply = JSON.parse(result.stdout);
      expect(reply.ok, JSON.stringify(reply)).toBe(true);
      return reply.data;
    };
    const f = await fixture(native);
    const targets = [
      { kind: "clip", id: f.placed.edit.labels["voice-clip"]! },
      { kind: "track", id: f.placed.edit.labels.voice! },
      { kind: "group", id: f.placed.edit.labels.inner! },
      { kind: "group", id: f.placed.edit.labels.outer! },
      { kind: "output" },
    ] as const;
    const gains = [2, 3, 5, 7, 11];
    for (const [index, target] of targets.entries()) {
      for (const mode of ["dry", "after-step", "processed"] as const) {
        const point =
          mode === "after-step"
            ? {
                kind: mode,
                stepId:
                  f.placed.edit.labels[
                    `step-${["voice-clip", "voice", "inner", "outer", "output"][index]}`
                  ]!,
              }
            : { kind: mode };
        const input = {
          projectId: f.projectId,
          tap: { target, point },
          range: { startUs: 333, endUs: 999000 },
        };
        f.inspection.request(input);
        await f.jobs.idle();
        const ready = f.inspection.request(input);
        expect(ready.state, JSON.stringify(ready)).toBe("ready");
        const receipt = ready.published!.audio;
        expect(receipt.sampleRange).toEqual({ start: 15, end: 47952 });
        const bytes = await readFile(receipt.file);
        let at = 12;
        while (bytes.toString("ascii", at, at + 4) !== "data") {
          const size = bytes.readUInt32LE(at + 4);
          at += 8 + size + (size % 2);
        }
        const data = bytes.subarray(at + 8, at + 8 + bytes.readUInt32LE(at + 4));
        const gain =
          gains.slice(0, index).reduce((value, next) => value * next * 0.5, 1) *
          (mode === "dry" ? 1 : gains[index]! * (mode === "processed" ? 0.5 : 1));
        const expectedPCM = Buffer.alloc(receipt.frames * 8);
        for (let frame = 0; frame < receipt.frames; frame++) {
          expectedPCM.writeFloatLE(0.25 * gain, frame * 8);
          expectedPCM.writeFloatLE(-0.125 * gain, frame * 8 + 4);
        }
        expect(data.equals(expectedPCM), `${target.kind}/${mode} complete stereo PCM`).toBe(true);
        f.waveform.request({ ...input, bucketFrames: 480 });
        await f.jobs.idle();
        const acoustic = f.waveform.request({ ...input, bucketFrames: 480 });
        expect(acoustic.state).toBe("ready");
        const document = JSON.parse(await readFile(acoustic.published!.waveform.file, "utf8"));
        expect(document).toMatchObject({
          domain: "project",
          projectId: f.projectId,
          revisionId: ready.revisionId,
          tap: input.tap,
          sampleRange: receipt.sampleRange,
          range: input.range,
          bucketFrames: 480,
          audio: { jobId: ready.jobId, generation: ready.published!.generation },
        });
        for (const bucket of document.buckets)
          expect(bucket.channels).toEqual([
            { min: 0.25 * gain, max: 0.25 * gain, rms: 0.25 * gain },
            { min: -0.125 * gain, max: -0.125 * gain, rms: 0.125 * gain },
          ]);
        const lease = f.cache.acquire(receipt.cacheId)!;
        try {
          const waveform = await waveformBuckets(
            lease,
            receipt,
            { bucketFrames: 480 },
            new AbortController().signal,
          );
          expect(waveform.buckets[0]!.sampleRange).toEqual({ start: 15, end: 480 });
          expect(waveform.buckets.at(-1)!.sampleRange).toEqual({ start: 47520, end: 47952 });
          const spectrum = await spectralWindows(
            lease,
            receipt,
            {
              fftFrames: 32,
              hopFrames: 32,
              window: "rectangular",
              sampleRange: { start: 480, end: 512 },
            },
            new AbortController().signal,
          );
          expect(spectrum.columns[0]).toMatchObject({
            sampleRange: { start: 480, end: 512 },
            analysis: { start: 480, end: 512 },
            partial: false,
          });
          for (let channel = 0; channel < 2; channel++)
            for (let bin = 0; bin < 17; bin++)
              expect(spectrum.density[channel * 17 + bin]).toBeCloseTo(
                bin === 0 ? (((channel === 0 ? 0.25 : -0.125) * gain) ** 2 * 32) / 48000 : 0,
                12,
              );
          for (const bucket of waveform.buckets)
            expect(bucket.channels).toEqual([
              { min: 0.25 * gain, max: 0.25 * gain, rms: 0.25 * gain },
              { min: -0.125 * gain, max: -0.125 * gain, rms: 0.125 * gain },
            ]);
        } finally {
          lease.release();
        }
      }
    }
  },
  30000,
);

test("cancel and retry discard unpublished project WAV bytes and retire deletion targets", async () => {
  let release!: () => void, entered!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  let attempts = 0;
  const f = await fixture(async (request, signal) => {
    const result = await render(request, signal);
    if (++attempts === 1) {
      entered();
      await held;
    }
    return result;
  });
  const input = { projectId: f.projectId, revisionId: f.placed.revision.id };
  const pending = f.inspection.request(input);
  await started;
  f.jobs.cancel(pending.jobId!);
  release();
  await f.jobs.idle();
  expect(f.inspection.request(input).published).toBeNull();
  expect(f.cache.bytes).toBe(0);
  f.inspection.retry(input);
  await f.jobs.idle();
  expect(f.inspection.request(input).state).toBe("ready");
  expect(attempts).toBe(2);
  f.projects.markDeleting(f.projectId);
  expect(() => f.inspection.request(input)).toThrow();
});
