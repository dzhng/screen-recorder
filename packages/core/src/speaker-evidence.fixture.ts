import type { SpeakerEvidenceSource } from "./speaker-evidence.js";

export function nativeOutput(
  lines = ["0.000 1.000 speaker_0", "0.500 2.000 speaker_1"],
  modelSha256 = "b".repeat(64),
) {
  const tensor = Buffer.alloc(375 * 4 * 4);
  const scores = Array.from({ length: 375 }, (_, frame) =>
    Array.from({ length: 4 }, (_, slot) => {
      const value = ((frame % 4) + slot) / 8;
      tensor.writeFloatLE(value, (frame * 4 + slot) * 4);
      return value;
    }),
  );
  return {
    nativeReceipt: JSON.stringify({
      verified: false,
      encoding: "dtype/shape + base64 native tensor bytes",
      nativeSegmentLines: [lines],
      nativeTensors: [{ shape: [1, 375, 4], dtype: "<f4", bytesBase64: tensor.toString("base64") }],
    }),
    report: JSON.stringify({
      nativeSegmentLines: lines,
      nativeProbabilities: scores,
      probabilityShape: [375, 4],
      sampleRate: 16000,
      sourceFrames: 480000,
      frameSeconds: 0.08,
      modelSha256,
      pcmSha256: "c".repeat(64),
    }),
  };
}

export const speakerSource: SpeakerEvidenceSource = {
  streamId: "audio",
  acquisitionId: null,
  supportDigest: "support",
  channel: 1,
  originUs: -250000,
  durationUs: 40000000,
  observationRange: {
    startUs: { numerator: 125, denominator: 2 },
    endUs: { numerator: 60000125, denominator: 2 },
  },
  pcm: { sha256: "c".repeat(64), sampleRate: 16000, frames: 480000 },
  decoder: {
    recipe: "source-selected-span-avfoundation-f32-16k-v1",
    workerSha256: "d".repeat(64),
    osBuild: "fixture-macos",
  },
  engine: {
    modelId: "speaker-runtime-control",
    descriptorDigest: "1".repeat(64),
    modelDigest: "2".repeat(64),
    modelSha256: "b".repeat(64),
    runtimeDigest: "e".repeat(64),
    workerSha256: "f".repeat(64),
    recipe: "original30s",
  },
};
