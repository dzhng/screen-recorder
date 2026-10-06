import {
  applyBatch,
  createCompiler,
  validateComposition,
  type ProcessingStep,
  resolveOutputSettings,
} from "@yap/composition";
import { constants, readSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createHash, randomUUID } from "node:crypto";
import { open, realpath } from "node:fs/promises";
import { readAudioWave } from "@yap/core/audio-wave";
import { mkdtemp, mkdir, writeFile, readFile, rm, copyFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { callLocal } from "@yap/client";
import { setTimeout as delay } from "node:timers/promises";
import { startProjectService } from "./project-service.js";
import { test, expect } from "vitest";
import {
  projectAudioRenderer,
  projectMovieRenderer,
  nativeAudioCapabilities,
} from "./project-render.js";
import { ffmpegLoudnessAnalyzer } from "./loudness.js";
import { audioProcessingRuntime } from "./audio-processing.js";
import { mediaWorker } from "./worker.js";
const installation = process.env.YAP_FFMPEG_DIRECTORY;
const native = process.env.YAP_NATIVE;
const acceptanceEvidence = process.env.YAP_AUDIO_ACCEPTANCE_EVIDENCE;
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
  const worker = mediaWorker({ YAP_NATIVE: native });
  const capabilities = await nativeAudioCapabilities(worker);
  const runtime = await audioProcessingRuntime(
    {
      directory: installation!,
      receiptSha256:
        process.env.YAP_FFMPEG_RECEIPT ??
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
              : r.kind === "retime"
                ? (capabilities.retime ?? null)
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
  "complete recipe context refuses program and detector source holes before a late crop",
  async () => {
    const cases: ProcessingStep[][] = [
      [limiter],
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
              tap: { target: { kind: "track", id: "detector" }, point: { kind: "dry" } },
            },
          },
        },
      ],
    ];
    for (const steps of cases) {
      const external = steps[0]!.processor.type === "compressor";
      const f = await fixture(steps, 8000000, external);
      let passed = false;
      try {
        const original = await readFile(join(f.dir, "source.wav"));
        f.asset.streams[0]!.available = [
          { startUs: 0, endUs: 1000000 },
          { startUs: 2000000, endUs: 8000000 },
        ];
        const document = external
          ? {
              ...f.document,
              clips: [
                {
                  id: "clip",
                  trackId: "audio",
                  source: { kind: "silence" },
                  placement: { kind: "project", range: { startUs: 0, endUs: 8000000 } },
                },
                { ...f.document.clips[0]!, id: "source-detector", trackId: "detector" },
              ],
            }
          : f.document;
        await expect(f.render(7000000, 7100000, "refused-hole", document)).rejects.toMatchObject({
          code: "NOT_READY",
        });
        await expect(open(join(f.dir, "refused-hole.wav"))).rejects.toMatchObject({
          code: "ENOENT",
        });
        expect(await readFile(join(f.dir, "source.wav"))).toEqual(original);
        passed = true;
      } finally {
        if (passed) await rm(f.dir, { recursive: true, force: true });
        else process.stderr.write(`Unverified source-hole operands retained: ${f.dir}\n`);
      }
    }
  },
  30000,
);

real(
  "retimed repeated recipe domains preserve split and late-crop PCM",
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
          limiter,
          {
            id: "compress",
            enabled: true,
            processor: {
              type: "compressor",
              thresholdDbfs: -24,
              ratio: 4,
              kneeDb: 3,
              attackMs: 5,
              releaseMs: 50,
              detector: { kind: "input" },
            },
          },
        ],
        8000000,
        false,
        true,
      );
      let passed = false;
      try {
        const original = await readFile(join(f.dir, "source.wav"));
        const retimed = applyBatch(
          f.document,
          [{ operation: "retime", clipIds: ["clip"], durationUs: 12000000, ripple: "none" }],
          { assets: [f.asset], namespace: "retime" },
        ).document;
        const repeated = {
          ...retimed,
          clips: [
            ...retimed.clips,
            {
              ...structuredClone(retimed.clips[0]!),
              id: "repeat",
              placement: { kind: "project", range: { startUs: 12000000, endUs: 24000000 } },
            },
          ],
          processing: [
            ...retimed.processing,
            {
              ...structuredClone(retimed.processing[0]!),
              target: { kind: "clip", id: "repeat" },
              steps: retimed.processing[0]!.steps.map((step) => ({
                ...step,
                id: `repeat-${step.id}`,
              })),
            },
          ],
        };
        const split = applyBatch(
          repeated,
          [
            { operation: "split", clipIds: ["clip"], atUs: 6000000, scope: "selected" },
            { operation: "split", clipIds: ["repeat"], atUs: 18000000, scope: "selected" },
          ],
          { assets: [f.asset], namespace: "split" },
        ).document;
        const full = await f.render(0, 24000000, "repeated", repeated);
        const partitioned = await f.render(0, 24000000, "split", split);
        const late = await f.render(11000000, 11100000, "late", repeated);
        const maximumDelta = (a: Buffer, b: Buffer) => {
          expect(a.length).toBe(b.length);
          let delta = 0;
          for (let at = 0; at < a.length; at += 4)
            delta = Math.max(delta, Math.abs(a.readFloatLE(at) - b.readFloatLE(at)));
          return delta;
        };
        expect(full.receipt).toMatchObject({
          frames: 1152000,
          processingEvidence: [
            { recipe: { type: "normalization" }, sampleRange: { start: 0, end: 576000 } },
            { recipe: { type: "limiter" }, sampleRange: { start: 0, end: 576000 } },
            { recipe: { type: "compressor" }, sampleRange: { start: 0, end: 576000 } },
            { recipe: { type: "normalization" }, sampleRange: { start: 576000, end: 1152000 } },
            { recipe: { type: "limiter" }, sampleRange: { start: 576000, end: 1152000 } },
            { recipe: { type: "compressor" }, sampleRange: { start: 576000, end: 1152000 } },
          ],
        });
        expect(maximumDelta(partitioned.bytes, full.bytes)).toBeLessThanOrEqual(1e-6);
        expect(
          maximumDelta(late.bytes, full.bytes.subarray(528000 * 8, 532800 * 8)),
        ).toBeLessThanOrEqual(1e-6);
        expect(
          maximumDelta(full.bytes.subarray(0, 576000 * 8), full.bytes.subarray(576000 * 8)),
        ).toBeLessThanOrEqual(1e-6);
        expect(await readFile(join(f.dir, "source.wav"))).toEqual(original);
        passed = true;
      } finally {
        if (passed) await rm(f.dir, { recursive: true, force: true });
        else process.stderr.write(`Unverified retimed operands retained: ${f.dir}\n`);
      }
    }
  },
  60000,
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
  "movie preflight refuses impossible gain before native picture encoding",
  async () => {
    const f = await fixture(
      [
        {
          id: "normalize",
          enabled: true,
          processor: {
            type: "normalization",
            mode: "gain-only",
            targetIntegratedLufs: -5,
            truePeakCeilingDbtp: -9,
            maxLoudnessRangeLu: 7,
          },
        },
      ],
      8000000,
    );
    let pictures = 0,
      passed = false;
    try {
      const model = validateComposition(f.document, [f.asset]);
      const compiled = createCompiler(model, "revision").window({
        range: { startUs: 0, endUs: 8000000 },
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
                ? (f.runtime!.processors[r.processor.type] ?? null)
                : r.kind === "executor"
                  ? "preflight-movie"
                  : r.implementationId,
          })),
        },
      };
      const renderer = projectMovieRenderer(
        async (operation, ...args) => {
          if (operation === "media.renderCompositionMovie") {
            pictures++;
            throw new Error("Picture encoding started before known audio refusal");
          }
          return f.worker(operation, ...args);
        },
        join(f.dir, "render"),
        undefined,
        f.capabilities,
        new AbortController().signal,
        {},
        f.runtime,
      );
      const output = join(f.dir, "refused.mp4");
      await expect(
        renderer.render(
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
        ),
      ).rejects.toMatchObject({ code: "NORMALIZATION_NOT_FEASIBLE" });
      expect(pictures).toBe(0);
      await expect(open(output)).rejects.toMatchObject({ code: "ENOENT" });
      passed = true;
    } finally {
      if (passed) await rm(f.dir, { recursive: true, force: true });
      else process.stderr.write(`Unverified preflight operands retained: ${f.dir}\n`);
    }
  },
  30000,
);
real(
  "AAC delivery retains separately measured decoded peak evidence",
  async () => {
    const normalization: ProcessingStep = {
      id: "normalize",
      enabled: true,
      processor: {
        type: "normalization",
        mode: "gain-only",
        targetIntegratedLufs: -6,
        truePeakCeilingDbtp: -1,
        maxLoudnessRangeLu: 7,
      },
    };
    const f = await fixture([normalization, limiter], 8000000);
    let passed = false;
    try {
      const pcm = await f.render(0, 8000000, "prepared");
      const model = validateComposition(f.document, [f.asset]);
      const window = createCompiler(model, "revision").window({
        range: { startUs: 0, endUs: 8000000 },
        rendition: { sampleRate: 48000, channels: 2 },
        tap: { target: { kind: "output" }, point: { kind: "processed" } },
      });
      const settings = resolveOutputSettings();
      const output = join(f.dir, "delivery.mp4");
      const movie = await projectMovieRenderer(
        f.worker,
        join(f.dir, "render"),
        undefined,
        f.capabilities,
        new AbortController().signal,
        {},
        f.runtime,
      ).render(
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
          settings,
        },
        new AbortController().signal,
      );
      const probed = await f.worker("media.probe", { path: output });
      if (!probed.ok) throw new Error(JSON.stringify(probed));
      const stream = (probed.data as { streams: { kind: string; id: string }[] }).streams.find(
        (stream) => stream.kind === "audio",
      )!;
      const decoded = join(f.dir, "decoded.wav");
      const range = { startUs: 0, endUs: 8000000 };
      const decode = await f.worker("media.sourceAudio", {
        source: { source: output, streamId: stream.id, sourceOffsetUs: 0, available: [range] },
        range,
        output: decoded,
      });
      if (!decode.ok) throw new Error(JSON.stringify(decode));
      const measure = async (path: string) => {
        const source = await open(path);
        try {
          const bytes = Number((await source.stat()).size);
          const audio = readAudioWave({
            bytes,
            read: (buffer, position) => readSync(source.fd, buffer, 0, buffer.length, position),
          });
          return {
            audio,
            measured: await ffmpegLoudnessAnalyzer(f.runtime!.installation, native).measure(
              {
                source: { fd: source.fd, bytes },
                audio,
                channelInterpretation: "native",
                truePeak: true,
              },
              new AbortController().signal,
            ),
          };
        } finally {
          await source.close();
        }
      };
      const prepared = await measure(join(f.dir, "prepared.wav"));
      const delivered = await measure(decoded);
      const evidence = {
        settings,
        sourceSha256: createHash("sha256")
          .update(await readFile(join(f.dir, "source.wav")))
          .digest("hex"),
        requested: [normalization.processor, limiter.processor],
        prepared: prepared.measured,
        encodedDecoded: delivered.measured,
        movie: movie.audio,
        decodedFrames: delivered.audio.frames,
      };
      await writeFile(join(f.dir, "encoded-evidence.json"), JSON.stringify(evidence, null, 2));
      if (acceptanceEvidence) {
        const retained = join(acceptanceEvidence, "encoded");
        await mkdir(retained, { recursive: true });
        for (const filename of [
          "source.wav",
          "prepared.wav",
          "delivery.mp4",
          "decoded.wav",
          "encoded-evidence.json",
        ])
          await copyFile(join(f.dir, filename), join(retained, filename));
      }
      expect(settings.audio.codec).toBe("aac");
      expect(delivered.audio.frames).toBe(384000);
      expect(delivered.measured.truePeakDbtp).toEqual(expect.any(Number));
      expect(prepared.measured.truePeakDbtp).toEqual(expect.any(Number));
      expect((await readFile(decoded)).equals(await readFile(join(f.dir, "prepared.wav")))).toBe(
        false,
      );
      expect(pcm.receipt).toMatchObject({
        processingEvidence: [
          { recipe: { type: "normalization" } },
          { recipe: { type: "limiter" } },
        ],
      });
      passed = true;
    } finally {
      if (passed) await rm(f.dir, { recursive: true, force: true });
      else process.stderr.write(`Unverified encoded operands retained: ${f.dir}\n`);
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
    let requireRetainedMix = false,
      retainedMovieCalls = 0;
    const nativeWorker = mediaWorker({ YAP_NATIVE: native });
    const worker: typeof nativeWorker = async (operation, params, options) => {
      if (requireRetainedMix) {
        if (
          operation === "media.prepareCompositionAudioDomain" ||
          operation === "media.mixCompositionAudio"
        )
          throw new Error("Prepared movie unexpectedly rerendered audio");
        if (operation === "media.renderCompositionMovie") {
          expect(params).toMatchObject({ audio: { retained: { descriptor: 3 } } });
          retainedMovieCalls++;
        }
      }
      return nativeWorker(operation, params, options);
    };
    try {
      const path = join(home, "source.wav");
      await writeFile(path, wave(384000));
      service = await startProjectService({
        home,
        nativeExecutable: native!,
        worker,
        ffmpeg: {
          directory: installation!,
          receiptSha256:
            process.env.YAP_FFMPEG_RECEIPT ??
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
            published: { output: unknown } | null;
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
      const assetId = (importedJob.published!.output as { assetId: string }).assetId;
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
        published: null | { output: { resourceId: string; processingEvidence: unknown[] } };
      };
      const drySelection = {
        ...selection,
        tap: { target: { kind: "output" }, point: { kind: "dry" } },
      };
      const dryPending = await call<Prepared>("audio.prepare", drySelection);
      await job(dryPending.jobId);
      const dryReady = await call<Prepared>("audio.prepare", drySelection);
      expect(dryReady.state).toBe("ready");
      expect(dryReady.published!.output.processingEvidence ?? []).toEqual([]);
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
        worker,
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
      expect(ready.published!.output.resourceId).not.toBe(dryReady.published!.output.resourceId);
      expect(ready).toMatchObject({
        state: "ready",
        jobId: pending.jobId,
        published: {
          output: {
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
      expect(excerptJob.published?.output).toMatchObject({
        frames: 4800,
        sampleRange: { start: 336000, end: 340800 },
        processingEvidence: ready.published!.output.processingEvidence,
      });
      requireRetainedMix = true;
      const movieExportId = randomUUID();
      await call("export.create", {
        ...selection,
        exportId: movieExportId,
        kind: "video",
        directory: home,
        leaf: "prepared.mp4",
      });
      const movieDeadline = performance.now() + 10000;
      for (;;) {
        const status = await call<{ state: string }>("export.status", { exportId: movieExportId });
        if (status.state === "committed") break;
        if (
          ["failed", "unavailable", "canceled", "conflicted"].includes(status.state) ||
          performance.now() > movieDeadline
        )
          throw Error(JSON.stringify(status));
        await delay(10);
      }
      expect(retainedMovieCalls).toBe(1);
      expect((await readFile(join(home, "prepared.mp4"))).length).toBeGreaterThan(0);
      requireRetainedMix = false;
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
          published: { output: { projectId: string; revisionId: string } } | null;
        }>("package.adopt", { packageHandle, requestId: "adopt" });
        if (status.state === "ready") {
          adopted = status.published!.output;
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
        published: { output: { processingEvidence: ready.published!.output.processingEvidence } },
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

real(
  "descriptor exhaustion fails an actual preparation job and drains before reuse",
  async () => {
    for (const limit of [64, 256]) {
      const home = await realpath(await mkdtemp(join(tmpdir(), "audio-fd-pressure-")));
      let passed = false;
      try {
        const child = spawn(
          "/bin/sh",
          [
            "-c",
            `ulimit -n ${limit}\nexec "$@"`,
            "audio-pressure",
            process.execPath,
            fileURLToPath(new URL("../fixtures/audio-descriptor-pressure.mjs", import.meta.url)),
          ],
          {
            env: {
              ...process.env,
              YAP_PRESSURE_HOME: home,
              YAP_PRESSURE_EXPECT_FAILURE: limit === 64 ? "1" : "0",
            },
            stdio: ["ignore", "pipe", "pipe"],
          },
        );
        let stdout = "",
          stderr = "";
        child.stdout.on("data", (chunk) => (stdout += chunk));
        child.stderr.on("data", (chunk) => (stderr += chunk));
        const exit = await new Promise<number | null>((resolve, reject) => {
          const timer = setTimeout(() => child.kill("SIGKILL"), 45000);
          child.once("error", reject);
          child.once("close", (code) => {
            clearTimeout(timer);
            resolve(code);
          });
        });
        await writeFile(join(home, "child-stdout.json"), stdout);
        await writeFile(join(home, "child-stderr.log"), stderr);
        expect(exit, stderr).toBe(0);
        const report = JSON.parse(stdout);
        if (acceptanceEvidence) {
          await mkdir(acceptanceEvidence, { recursive: true });
          await writeFile(
            join(acceptanceEvidence, `descriptors-${limit}.json`),
            JSON.stringify(report, null, 2),
          );
        }
        expect(report.failed).toMatchObject({
          state: limit === 64 ? "failed" : "ready",
          ...(limit === 64 ? { published: null } : {}),
        });
        expect(report.recovered).toMatchObject({ state: "ready" });
        expect(report.completedPrefixes).toBeGreaterThan(0);
        if (limit === 256) expect(report.maximumHeld).toBe(80);
        passed = true;
      } finally {
        if (passed) await rm(home, { recursive: true, force: true });
        else process.stderr.write(`Unverified descriptor operands retained: ${home}\n`);
      }
    }
  },
  60000,
);
