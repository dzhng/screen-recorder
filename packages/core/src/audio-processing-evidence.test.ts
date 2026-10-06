import { createCompiler, validateComposition } from "@yap/composition";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, expect } from "vitest";
import { checkProjectAudioResult } from "./audio-inspection.js";
import { normalizationTolerance } from "./audio-measurement.js";
test("normalization publication requires complete bound evidence and met targets", async () => {
  const dir = await mkdtemp(join(tmpdir(), "normalization-evidence-"));
  try {
    const output = join(dir, "audio.wav"),
      frames = 480;
    const wave = Buffer.alloc(44 + frames * 8);
    wave.write("RIFF");
    wave.writeUInt32LE(wave.length - 8, 4);
    wave.write("WAVEfmt ", 8);
    wave.writeUInt32LE(16, 16);
    wave.writeUInt16LE(3, 20);
    wave.writeUInt16LE(2, 22);
    wave.writeUInt32LE(48000, 24);
    wave.writeUInt32LE(384000, 28);
    wave.writeUInt16LE(8, 32);
    wave.writeUInt16LE(32, 34);
    wave.write("data", 36);
    wave.writeUInt32LE(frames * 8, 40);
    await writeFile(output, wave);
    const recipe = {
      type: "normalization" as const,
      mode: "gain-only" as const,
      targetIntegratedLufs: -20,
      truePeakCeilingDbtp: -2,
      maxLoudnessRangeLu: 7,
    };
    const model = validateComposition(
      {
        canvas: {
          width: 16,
          height: 16,
          fps: { numerator: 30, denominator: 1 },
          background: "#000000ff",
        },
        tracks: [{ id: "audio", kind: "audio", order: 0 }],
        groups: [],
        syncGroups: [],
        clips: [
          {
            id: "silence",
            trackId: "audio",
            source: { kind: "silence" },
            placement: { kind: "project", range: { startUs: 0, endUs: 10000 } },
          },
        ],
        processing: [
          {
            target: { kind: "output" },
            steps: [{ id: "normalize", enabled: true, processor: recipe }],
          },
        ],
      },
      [],
    );
    const compiled = createCompiler(model, "revision").audioWindow({
      range: { startUs: 0, endUs: 10000 },
      rendition: { sampleRate: 48000, channels: 2 },
      tap: { target: { kind: "output" }, point: { kind: "processed" } },
    });
    const window = {
      ...compiled,
      manifest: {
        ...compiled.manifest,
        requirements: compiled.manifest.requirements.map((r) => ({
          ...r,
          implementationId: "normalization-runtime",
        })),
      },
    };
    const receipt = {
      file: output,
      bytes: wave.length,
      sampleRate: 48000,
      channels: 2,
      frames,
      peak: 0,
      clippedSamples: 0,
      maximumBlockFrames: 480,
      peakResidentBytes: 0,
      decoderContext: {
        policy: "bounded-current-retained-run",
        sampleRate: 48000,
        maximumPrerollFrames: 0,
        maximumTailFrames: 0,
      },
      unavailable: [],
    };
    const measurement = {
      integratedLufs: -20,
      loudnessRangeLu: 3,
      samplePeakDbfs: -8,
      truePeakDbtp: -7,
      integratedReason: null,
      rangeReason: null,
      algorithm: "meter",
      version: "1",
    };
    const evidence = {
      domainIndex: 0,
      recipe,
      sampleRange: { start: 0, end: 480 },
      implementationId: "normalization-runtime",
      normalization: {
        before: { ...measurement, integratedLufs: -25, truePeakDbtp: -12 },
        after: measurement,
        meterImplementationId: "meter-runtime",
        tolerances: normalizationTolerance,
      },
    };
    expect(() => checkProjectAudioResult(receipt, window, output)).toThrow();
    expect(() =>
      checkProjectAudioResult(
        {
          ...receipt,
          processingEvidence: [
            {
              ...evidence,
              normalization: {
                ...evidence.normalization,
                after: { ...measurement, integratedLufs: -18 },
              },
            },
          ],
        },
        window,
        output,
      ),
    ).toThrow();
    expect(() =>
      checkProjectAudioResult(
        { ...receipt, processingEvidence: [{ ...evidence, implementationId: "other-runtime" }] },
        window,
        output,
      ),
    ).toThrow();
    expect(() =>
      checkProjectAudioResult(
        { ...receipt, processingEvidence: [evidence, evidence] },
        window,
        output,
      ),
    ).toThrow();
    expect(
      checkProjectAudioResult({ ...receipt, processingEvidence: [evidence] }, window, output)
        .processingEvidence,
    ).toEqual([evidence]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
