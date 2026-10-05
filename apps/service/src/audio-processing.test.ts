import {
  applyBatch,
  createCompiler,
  validateComposition,
  type ProcessingStep,
  resolveOutputSettings,
} from "@screenrec/composition";
import { constants, readSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { open, realpath } from "node:fs/promises";
import { readAudioWave } from "@screenrec/core/audio-wave";
import { mkdtemp, mkdir, writeFile, readFile, rm, copyFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { callLocal } from "@screenrec/client";
import { setTimeout as delay } from "node:timers/promises";
import { startProjectService } from "./project-service.js";
import { test, expect } from "vitest";
import {
  projectAudioRenderer,
  projectMovieRenderer,
  nativeAudioCapabilities,
} from "./project-render.js";
import { audioProcessingRuntime } from "./audio-processing.js";
import { mediaWorker } from "./worker.js";
const installation = process.env.SCREENREC_FFMPEG_DIRECTORY;
const native = process.env.SCREENREC_NATIVE;
function wave(frames: number, sample?: (frame: number) => [number, number]) {
  const b = Buffer.alloc(44 + frames * 8);
  b.write("RIFF");
  b.writeUInt32LE(b.length - 8, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(3, 20);
  b.writeUInt16LE(2, 22);
  b.writeUInt32LE(48000, 24);
  b.writeUInt32LE(384000, 28);
  b.writeUInt16LE(8, 32);
  b.writeUInt16LE(32, 34);
  b.write("data", 36);
  b.writeUInt32LE(frames * 8, 40);
  for (let i = 0; i < frames; i++) {
    const [left, right] = sample?.(i) ?? [0.8 * Math.sin(i * 0.17), 0.3 * Math.cos(i * 0.21)];
    b.writeFloatLE(left, 44 + i * 8);
    b.writeFloatLE(right, 48 + i * 8);
  }
  return b;
}
async function fixture(
  steps: ProcessingStep[],
  durationUs = 1000000,
  detector = false,
  clipProcessing = false,
) {
  const dir = await mkdtemp(join(tmpdir(), "typed-audio-"));
  const path = join(dir, "source.wav");
  await writeFile(path, wave((durationUs * 48000) / 1000000));
  const asset = {
    id: "a".repeat(64),
    streams: [
      {
        id: "track:1",
        kind: "audio" as const,
        channels: 2,
        sampleRate: 48000,
        bounds: { startUs: 0, endUs: durationUs },
        available: [{ startUs: 0, endUs: durationUs }],
      },
    ],
  };
  const document = {
    canvas: {
      width: 16,
      height: 16,
      fps: { numerator: 30, denominator: 1 },
      background: "#000000ff",
    },
    tracks: [
      { id: "audio", kind: "audio" as const, order: 0 },
      ...(detector ? [{ id: "detector", kind: "audio" as const, order: 1 }] : []),
    ],
    groups: [],
    syncGroups: [],
    clips: [
      {
        id: "clip",
        trackId: "audio",
        assetId: asset.id,
        streamId: "track:1",
        source: { kind: "range" as const, range: { startUs: 0, endUs: durationUs } },
        placement: { kind: "project" as const, range: { startUs: 0, endUs: durationUs } },
      },
      ...(detector
        ? [
            {
              id: "silent",
              trackId: "detector",
              source: { kind: "silence" as const },
              placement: { kind: "project" as const, range: { startUs: 0, endUs: durationUs } },
            },
          ]
        : []),
    ],
    processing: [
      {
        target: clipProcessing
          ? { kind: "clip" as const, id: "clip" }
          : { kind: "output" as const },
        steps,
      },
    ],
  };
  const worker = mediaWorker({ SCREENREC_NATIVE: native });
  const capabilities = await nativeAudioCapabilities(worker);
  const runtime = await audioProcessingRuntime(
    {
      directory: installation!,
      receiptSha256:
        process.env.SCREENREC_FFMPEG_RECEIPT ??
        "27350ff2f953bbd4d6ca8bfe0f6808b99b9752192657d289146b50319099f66a",
    },
    native,
    capabilities.statePreparation,
    new AbortController().signal,
  );
  const renderer = projectAudioRenderer(
    worker,
    join(dir, "render"),
    capabilities,
    new AbortController().signal,
    runtime,
  );
  const render = async (startUs: number, endUs: number, label: string, doc: unknown = document) => {
    const compiled = createCompiler(validateComposition(doc, [asset]), "revision").audioWindow({
      range: { startUs, endUs },
      rendition: { sampleRate: 48000, channels: 2 },
      tap: { target: { kind: "output" }, point: { kind: "processed" } },
    });
    const window = {
      ...compiled,
      manifest: {
        ...compiled.manifest,
        requirements: compiled.manifest.requirements.map((r) => ({
          ...r,
          implementationId:
            r.kind === "processor"
              ? (runtime?.processors[r.processor.type] ?? capabilities.rnnoise ?? null)
              : r.implementationId,
        })),
      },
    };
    const output = join(dir, label + ".wav");
    await mkdir(join(dir, "render"), { recursive: true, mode: 0o700 });
    const receipt = await renderer.render(
      { window, assets: [{ assetId: asset.id, streamId: "track:1", path, originUs: 0 }], output },
      new AbortController().signal,
    );
    const file = await open(output);
    try {
      const bytes = await readFile(output);
      const audio = readAudioWave({
        bytes: bytes.length,
        read: (b, p) => readSync(file.fd, b, 0, b.length, p),
      });
      return {
        receipt,
        bytes: bytes.subarray(audio.dataOffset, audio.dataOffset + audio.dataBytes),
      };
    } finally {
      await file.close();
    }
  };
  return { dir, document, asset, render, worker, capabilities, runtime };
}
const limiter = {
  id: "limit",
  enabled: true,
  processor: { type: "limiter" as const, ceilingDbfs: -6, lookaheadMs: 5, releaseMs: 50 },
};
const real = test.runIf(Boolean(native && installation));
real(
  "bundled limiter renders the full state domain before an exact late crop",
  async () => {
    const f = await fixture([limiter]);
    let passed = false;
    try {
      const full = await f.render(0, 1000000, "full"),
        excerpt = await f.render(800000, 900000, "excerpt");
      expect(excerpt.receipt).toMatchObject({
        frames: 4800,
        processingEvidence: [
          { domainIndex: 0, sampleRange: { start: 0, end: 48000 }, recipe: { type: "limiter" } },
        ],
      });
      expect(excerpt.bytes.equals(full.bytes.subarray(38400 * 8, 43200 * 8))).toBe(true);
      let peak = 0;
      for (let at = 0; at < full.bytes.length; at += 4)
        peak = Math.max(peak, Math.abs(full.bytes.readFloatLE(at)));
      expect(peak).toBeLessThanOrEqual(10 ** (-6 / 20) + 1e-6);
      passed = true;
    } finally {
      if (passed) await rm(f.dir, { recursive: true, force: true });
      else process.stderr.write(`Unverified audio operands retained: ${f.dir}\n`);
    }
  },
  30000,
);
real(
  "a declared silent sidechain leaves signed stereo program unchanged",
  async () => {
    const f = await fixture(
      [
        {
          id: "compress",
          enabled: true,
          processor: {
            type: "compressor",
            thresholdDbfs: -20,
            ratio: 4,
            kneeDb: 3,
            attackMs: 5,
            releaseMs: 50,
            detector: {
              kind: "tap",
              tap: { target: { kind: "track", id: "detector" }, point: { kind: "processed" } },
            },
          },
        },
      ],
      1000000,
      true,
    );
    let passed = false;
    try {
      const result = await f.render(0, 1000000, "sidechain");
      const original = wave(48000).subarray(44);
      let delta = 0;
      for (let at = 0; at < original.length; at += 4)
        delta = Math.max(delta, Math.abs(result.bytes.readFloatLE(at) - original.readFloatLE(at)));
      expect(delta).toBeLessThanOrEqual(1e-6);
      expect(result.receipt).toMatchObject({
        processingEvidence: [{ recipe: { type: "compressor" } }],
      });
      passed = true;
    } finally {
      if (passed) await rm(f.dir, { recursive: true, force: true });
      else process.stderr.write(`Unverified audio operands retained: ${f.dir}\n`);
    }
  },
  30000,
);
real(
  "RNNoise and FF recipes compose across a shared split and late window",
  async () => {
    const f = await fixture(
      [
        { id: "first-noise", enabled: true, processor: { type: "rnnoise" } },
        limiter,
        { id: "last-noise", enabled: true, processor: { type: "rnnoise" } },
      ],
      1000000,
      false,
      true,
    );
    let passed = false;
    try {
      const full = await f.render(0, 1000000, "full"),
        excerpt = await f.render(800000, 900000, "excerpt");
      expect(excerpt.bytes.equals(full.bytes.subarray(38400 * 8, 43200 * 8))).toBe(true);
      const split = applyBatch(
        f.document,
        [{ operation: "split", clipIds: ["clip"], atUs: 500000, scope: "selected" }],
        { assets: [f.asset], namespace: "split" },
      );
      const splitOutput = await f.render(0, 1000000, "split", split.document);
      expect(splitOutput.bytes.equals(full.bytes)).toBe(true);
      passed = true;
    } finally {
      if (passed) await rm(f.dir, { recursive: true, force: true });
      else process.stderr.write(`Unverified audio operands retained: ${f.dir}\n`);
    }
  },
  30000,
);
real(
  "gain-only and dynamic normalization retain complete measurements and refuse infeasible gain",
  async () => {
    for (const mode of ["gain-only", "dynamic"] as const) {
      const f = await fixture(
        [
          {
            id: "normalize",
            enabled: true,
            processor: {
              type: "normalization",
              mode,
              targetIntegratedLufs: -20,
              truePeakCeilingDbtp: -2,
              maxLoudnessRangeLu: 7,
            },
          },
        ],
        8000000,
      );
      let passed = false;
      try {
        const result = await f.render(7000000, 7100000, "normalized");
        expect(result.receipt).toMatchObject({
          frames: 4800,
          processingEvidence: [
            {
              recipe: { type: "normalization", mode },
              sampleRange: { start: 0, end: 384000 },
              normalization: { after: { integratedLufs: expect.closeTo(-20, 1) } },
            },
          ],
        });
        if (mode === "gain-only") {
          const impossible = structuredClone(f.document);
          impossible.processing[0]!.steps[0]!.processor = {
            type: "normalization",
            mode,
            targetIntegratedLufs: -5,
            truePeakCeilingDbtp: -9,
            maxLoudnessRangeLu: 7,
          };
          await expect(f.render(0, 8000000, "refused", impossible)).rejects.toMatchObject({
            code: "NORMALIZATION_NOT_FEASIBLE",
          });
        }
        passed = true;
      } finally {
        if (passed) await rm(f.dir, { recursive: true, force: true });
        else process.stderr.write(`Unverified audio operands retained: ${f.dir}\n`);
      }
    }
  },
  30000,
);

real(
  "dynamic normalization refuses the stepped whole-domain LRA miss before delivery",
  async () => {
    const f = await fixture(
      [
        {
          id: "normalize",
          enabled: true,
          processor: {
            type: "normalization",
            mode: "dynamic",
            targetIntegratedLufs: -18,
            truePeakCeilingDbtp: -1,
            maxLoudnessRangeLu: 7,
          },
        },
      ],
      12000000,
    );
    let passed = false;
    try {
      await writeFile(
        join(f.dir, "source.wav"),
        wave(48000 * 12, (i) => {
          const amp = i < 48000 * 4 ? 0.05 : i < 48000 * 8 ? 0.15 : 0.03;
          const taper = Math.min(1, i / (48000 * 0.05), (48000 * 12 - 1 - i) / (48000 * 0.05));
          const v =
            amp *
            taper *
            (Math.sin((2 * Math.PI * 997 * i) / 48000) +
              0.2 * Math.sin((2 * Math.PI * 233 * i) / 48000));
          return [v, v];
        }),
      );
      await expect(f.render(11000000, 11100000, "refused")).rejects.toMatchObject({
        code: "NORMALIZATION_TARGETS_UNMET",
        details: { after: { loudnessRangeLu: expect.any(Number) } },
      });
      await expect(open(join(f.dir, "refused.wav"))).rejects.toMatchObject({ code: "ENOENT" });
      passed = true;
    } finally {
      if (passed) await rm(f.dir, { recursive: true, force: true });
      else process.stderr.write(`Unverified audio operands retained: ${f.dir}\n`);
    }
  },
  30000,
);

real(
  "an unmeasurable complete signal refuses normalization without delivery",
  async () => {
    const f = await fixture(
      [
        {
          id: "normalize",
          enabled: true,
          processor: {
            type: "normalization",
            mode: "gain-only",
            targetIntegratedLufs: -20,
            truePeakCeilingDbtp: -2,
            maxLoudnessRangeLu: 7,
          },
        },
      ],
      8000000,
    );
    let passed = false;
    try {
      await writeFile(
        join(f.dir, "source.wav"),
        wave(384000, () => [0, 0]),
      );
      await expect(f.render(0, 8000000, "refused")).rejects.toMatchObject({
        code: "NORMALIZATION_UNMEASURABLE",
      });
      await expect(open(join(f.dir, "refused.wav"))).rejects.toMatchObject({ code: "ENOENT" });
      passed = true;
    } finally {
      if (passed) await rm(f.dir, { recursive: true, force: true });
      else process.stderr.write(`Unverified audio operands retained: ${f.dir}\n`);
    }
  },
  30000,
);

real(
  "movie mux consumes the same held limited domain",
  async () => {
    const f = await fixture([limiter]);
    let passed = false;
    try {
      const model = validateComposition(f.document, [f.asset]);
      const window = createCompiler(model, "revision").window({
        range: { startUs: 0, endUs: 1000000 },
        rendition: { sampleRate: 48000, channels: 2 },
        tap: { target: { kind: "output" }, point: { kind: "processed" } },
      });
      const renderer = projectMovieRenderer(
        f.worker,
        join(f.dir, "render"),
        undefined,
        f.capabilities,
        new AbortController().signal,
        {},
        f.runtime,
      );
      const output = join(f.dir, "movie.mp4");
      const movie = await renderer.render(
        {
          model,
          window,
          assets: [
            {
              assetId: f.asset.id,
              streamId: "track:1",
              path: join(f.dir, "source.wav"),
              originUs: 0,
            },
          ],
          fonts: [],
          output,
          settings: resolveOutputSettings(),
        },
        new AbortController().signal,
      );
      expect(movie).toMatchObject({
        file: output,
        frameCount: 30,
        audio: {
          frames: 48000,
          sampleRate: 48000,
          channels: 2,
          processingEvidence: [
            { recipe: { type: "limiter" }, sampleRange: { start: 0, end: 48000 } },
          ],
        },
      });
      passed = true;
    } finally {
      if (passed) await rm(f.dir, { recursive: true, force: true });
      else process.stderr.write(`Unverified audio operands retained: ${f.dir}\n`);
    }
  },
  30000,
);
real(
  "a sub-sample state domain contributes no processed PCM or measurement",
  async () => {
    const f = await fixture([limiter]);
    let passed = false;
    try {
      const document = {
        ...f.document,
        clips: [
          {
            id: "short",
            trackId: "audio",
            source: { kind: "silence" },
            placement: { kind: "project", range: { startUs: 0, endUs: 1 } },
          },
          {
            id: "long",
            trackId: "audio",
            source: { kind: "silence" },
            placement: { kind: "project", range: { startUs: 1, endUs: 1000000 } },
          },
        ],
        processing: [{ target: { kind: "clip", id: "short" }, steps: [limiter] }],
      };
      const result = await f.render(0, 1000000, "zero-domain", document);
      expect(result.bytes.equals(Buffer.alloc(48000 * 8))).toBe(true);
      expect(result.receipt).not.toHaveProperty("processingEvidence");
      passed = true;
    } finally {
      if (passed) await rm(f.dir, { recursive: true, force: true });
      else process.stderr.write(`Unverified audio operands retained: ${f.dir}\n`);
    }
  },
  30000,
);
real(
  "public prepared processing binds runtime caches and survives excerpt/package adoption",
  async () => {
    const home = await realpath(await mkdtemp(join(tmpdir(), "public-typed-audio-")));
    let service: Awaited<ReturnType<typeof startProjectService>> | undefined;
    let passed = false;
    try {
      const path = join(home, "source.wav");
      await writeFile(path, wave(384000));
      service = await startProjectService({
        home,
        nativeExecutable: native!,
        ffmpeg: {
          directory: installation!,
          receiptSha256:
            process.env.SCREENREC_FFMPEG_RECEIPT ??
            "27350ff2f953bbd4d6ca8bfe0f6808b99b9752192657d289146b50319099f66a",
        },
      });
      const call = async <T>(operation: string, params: Record<string, unknown>) => {
        const result = await callLocal(service!.socketPath, {
          id: "typed-audio",
          operation,
          params,
        });
        if (!result.ok) throw Error(JSON.stringify(result));
        return result.data as T;
      };
      const job = async (jobId: string) => {
        const deadline = performance.now() + 10000;
        for (;;) {
          const result = await call<{
            state: string;
            result: unknown;
            errorCode: string | null;
            errorMessage: string | null;
          }>("job.get", { jobId });
          if (result.state === "ready") return result;
          if (
            ["failed", "canceled", "unavailable"].includes(result.state) ||
            performance.now() > deadline
          )
            throw Error(JSON.stringify(result));
          await delay(10);
        }
      };
      const imported = await call<{ jobId: string }>("asset.import", { requestId: "source", path });
      const importedJob = await job(imported.jobId);
      const assetId = (importedJob.result as { assetId: string }).assetId;
      const created = await call<{ project: { projectId: string }; revision: { id: string } }>(
        "project.create",
        {
          requestId: "project",
          canvas: {
            width: 16,
            height: 16,
            fps: { numerator: 30, denominator: 1 },
            background: "#000000ff",
          },
        },
      );
      const edited = await call<{ revision: { id: string } }>("edit.apply", {
        projectId: created.project.projectId,
        expectedRevisionId: created.revision.id,
        requestId: "media",
        operations: [
          { operation: "track.add", track: { kind: "audio", order: 0 }, label: "audio" },
          {
            operation: "place",
            clip: {
              trackId: { label: "audio" },
              assetId,
              streamId: "track:1",
              source: { kind: "range", range: { startUs: 0, endUs: 8000000 } },
              placement: { kind: "project", range: { startUs: 0, endUs: 8000000 } },
            },
          },
          {
            operation: "processing.set",
            target: { kind: "output" },
            steps: [
              {
                enabled: true,
                processor: {
                  type: "normalization",
                  mode: "gain-only",
                  targetIntegratedLufs: -20,
                  truePeakCeilingDbtp: -2,
                  maxLoudnessRangeLu: 7,
                },
              },
              { enabled: true, processor: limiter.processor },
              {
                enabled: true,
                processor: {
                  type: "compressor",
                  thresholdDbfs: -25,
                  ratio: 2,
                  kneeDb: 3,
                  attackMs: 5,
                  releaseMs: 50,
                  detector: { kind: "input" },
                },
              },
            ],
          },
        ],
      });
      const selection = { projectId: created.project.projectId, revisionId: edited.revision.id };
      type Prepared = {
        state: string;
        jobId: string;
        published: null | { audio: { resourceId: string; processingEvidence: unknown[] } };
      };
      const cachedInput = { ...selection, range: { startUs: 7000000, endUs: 7100000 } };
      const originalCache = await call<{ jobId: string }>("audio.get", cachedInput);
      await job(originalCache.jobId);
      await service.close();
      const replaced = join(home, "replacement-tools");
      const receipt = JSON.parse(await readFile(join(installation!, "receipt.json"), "utf8")) as {
        files: Record<string, string>;
      };
      for (const relative of Object.keys(receipt.files)) {
        const target = join(replaced, relative);
        await mkdir(dirname(target), { recursive: true });
        await copyFile(join(installation!, relative), target, constants.COPYFILE_FICLONE);
      }
      const receiptBytes = JSON.stringify({ ...receipt, fixtureGeneration: "replacement" });
      await writeFile(join(replaced, "receipt.json"), receiptBytes);
      service = await startProjectService({
        home,
        nativeExecutable: native!,
        ffmpeg: {
          directory: replaced,
          receiptSha256: createHash("sha256").update(receiptBytes).digest("hex"),
        },
      });
      const replacementCache = await call<{ jobId: string }>("audio.get", cachedInput);
      expect(replacementCache.jobId).not.toBe(originalCache.jobId);
      await job(replacementCache.jobId);
      const pending = await call<Prepared>("audio.prepare", selection);
      await job(pending.jobId);
      const ready = await call<Prepared>("audio.prepare", selection);
      expect(ready).toMatchObject({
        state: "ready",
        jobId: pending.jobId,
        published: {
          audio: {
            processingEvidence: [
              {
                recipe: { type: "normalization" },
                sampleRange: { start: 0, end: 384000 },
                normalization: {
                  before: { integratedLufs: expect.any(Number) },
                  after: { integratedLufs: expect.closeTo(-20, 1) },
                },
              },
              { recipe: { type: "limiter" }, sampleRange: { start: 0, end: 384000 } },
              { recipe: { type: "compressor" }, sampleRange: { start: 0, end: 384000 } },
            ],
          },
        },
      });
      const excerpt = await call<{ jobId: string; state: string }>("audio.get", {
        ...selection,
        range: { startUs: 7000000, endUs: 7100000 },
      });
      const excerptJob = await job(excerpt.jobId);
      expect(excerptJob.result).toMatchObject({
        frames: 4800,
        sampleRange: { start: 336000, end: 340800 },
        processingEvidence: ready.published!.audio.processingEvidence,
      });
      const exportId = randomUUID();
      await call("export.create", {
        ...selection,
        exportId,
        kind: "processed-package",
        directory: home,
        leaf: "prepared.zip",
      });
      const exportDeadline = performance.now() + 10000;
      for (;;) {
        const status = await call<{ state: string; output: string | null }>("export.status", {
          exportId,
        });
        if (status.state === "committed") break;
        if (
          ["failed", "unavailable", "canceled"].includes(status.state) ||
          performance.now() > exportDeadline
        )
          throw Error(JSON.stringify(status));
        await delay(10);
      }
      const admission = await call<{ id: string }>("package.open", {
        path: join(home, "prepared.zip"),
      });
      let packageHandle: string | undefined;
      const packageDeadline = performance.now() + 10000;
      for (;;) {
        const status = await call<{ state: string; packageHandle?: string }>("package.status", {
          admissionId: admission.id,
        });
        if (status.state === "ready") {
          packageHandle = status.packageHandle;
          break;
        }
        if (
          ["failed", "unavailable", "canceled"].includes(status.state) ||
          performance.now() > packageDeadline
        )
          throw Error(JSON.stringify(status));
        await delay(10);
      }
      const adoptedDeadline = performance.now() + 10000;
      let adopted: { projectId: string; revisionId: string } | undefined;
      for (;;) {
        const status = await call<{
          state: string;
          result: { projectId: string; revisionId: string } | null;
        }>("package.adopt", { packageHandle, requestId: "adopt" });
        if (status.state === "ready") {
          adopted = status.result!;
          break;
        }
        if (
          ["failed", "unavailable", "canceled"].includes(status.state) ||
          performance.now() > adoptedDeadline
        )
          throw Error(JSON.stringify(status));
        await delay(10);
      }
      await call("package.close", { admissionId: admission.id });
      const adoptedAudio = await call<Prepared>("audio.prepare", adopted!);
      expect(adoptedAudio).toMatchObject({
        state: "ready",
        published: { audio: { processingEvidence: ready.published!.audio.processingEvidence } },
      });
      passed = true;
    } finally {
      await service?.close();
      if (passed) await rm(home, { recursive: true, force: true });
      else process.stderr.write(`Unverified public audio operands retained: ${home}\n`);
    }
  },
  30000,
);
