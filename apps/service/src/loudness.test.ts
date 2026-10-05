import { expect, it } from "vitest";
import { parseLoudnessSummary } from "./loudness.js";
const summary = (i: string, threshold: string, peak = "-inf") => `Summary:
  Integrated loudness:
    I: ${i} LUFS
    Threshold: ${threshold} LUFS
  Loudness range:
    LRA: 0.0 LU
    Threshold: 0.0 LUFS
    LRA low: 0.0 LUFS
    LRA high: 0.0 LUFS
  Sample peak:
    Peak: ${peak} dBFS
  True peak:
    Peak: ${peak} dBFS
`;
it("silent and insufficient gates stay unmeasurable while finite quiet signal and peak remain evidence", () => {
  expect(
    parseLoudnessSummary(
      summary("-70.0", "0.0"),
      { frames: 48000, sampleRate: 48000, truePeak: true },
      "9",
    ),
  ).toMatchObject({
    integratedLufs: null,
    integratedReason: "below-gate",
    loudnessRangeLu: null,
    rangeReason: "insufficient-duration",
    samplePeakDbfs: null,
    truePeakDbtp: null,
  });
  expect(
    parseLoudnessSummary(
      summary("-70.0", "0.0", "-20.0"),
      { frames: 9600, sampleRate: 48000, truePeak: true },
      "9",
    ),
  ).toMatchObject({
    integratedLufs: null,
    integratedReason: "insufficient-duration",
    samplePeakDbfs: -20,
  });
  expect(
    parseLoudnessSummary(
      summary("-70.0", "-80.0", "-67.0"),
      { frames: 192000, sampleRate: 48000, truePeak: true },
      "9",
    ),
  ).toMatchObject({ integratedLufs: -70, integratedReason: null, samplePeakDbfs: -67 });
  expect(() =>
    parseLoudnessSummary(
      summary("NaN", "0"),
      { frames: 48000, sampleRate: 48000, truePeak: true },
      "9",
    ),
  ).toThrow();
});

it("a real zero LRA at a zero threshold remains measurable, and omitted true peak stays unrequested", () => {
  const text = summary("20.0", "10.0", "23.0")
    .replace("LRA low: 0.0", "LRA low: 20.0")
    .replace("LRA high: 0.0", "LRA high: 20.0")
    .replace(/  True peak:[\s\S]*/, "");
  expect(
    parseLoudnessSummary(text, { frames: 480000, sampleRate: 48000, truePeak: false }, "9"),
  ).toMatchObject({
    integratedLufs: 20,
    loudnessRangeLu: 0,
    rangeReason: null,
    samplePeakDbfs: 23,
    truePeakDbtp: null,
  });
});
