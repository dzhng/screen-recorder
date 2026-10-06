import { expect, test } from "vitest";
import {
  createCompiler,
  validateComposition,
  compositionSchema,
  processingCapabilities,
} from "./index.js";
import { visualOperationsSchema } from "./pointer.js";
const correction = {
  type: "sdr-correction",
  exposureEV: 1,
  contrast: 1.2,
  saturation: 0.7,
  shadows: 0.2,
  highlights: 0.3,
  neutralKelvin: 5000,
  neutralTint: 10,
};
function document(processor = correction, enabled = true) {
  return {
    canvas: {
      width: 128,
      height: 64,
      fps: { numerator: 10, denominator: 1 },
      background: "#000000ff",
    },
    tracks: [{ id: "v", kind: "video", order: 0 }],
    groups: [],
    syncGroups: [],
    clips: ["a", "b"].map((id, i) => ({
      id,
      trackId: "v",
      assetId: "image",
      streamId: "i",
      source: { kind: "hold", atUs: 0 },
      placement: { kind: "project", range: { startUs: i * 100000, endUs: (i + 1) * 100000 } },
    })),
    processing: [
      {
        target: { kind: "track", id: "v" },
        steps: [
          { id: "grade", enabled, processor },
          { id: "opacity", enabled: true, processor: { type: "opacity", opacity: 0.5 } },
        ],
      },
    ],
  };
}
const assets = [{ id: "image", streams: [{ id: "i", kind: "image", width: 128, height: 64 }] }];
test("SDR correction defaults normalize identity and refuse unsupported or unbounded controls", () => {
  const doc = compositionSchema.parse(document({ type: "sdr-correction" } as typeof correction));
  expect(doc.processing[0]!.steps[0]!.processor).toEqual({
    ...correction,
    exposureEV: 0,
    contrast: 1,
    saturation: 1,
    shadows: 0,
    highlights: 0,
    neutralKelvin: 6500,
    neutralTint: 0,
  });
  for (const changed of [
    { exposureEV: 9 },
    { contrast: -1 },
    { saturation: 3 },
    { shadows: -1 },
    { highlights: 2 },
    { neutralKelvin: 10001 },
    { neutralTint: Infinity },
    { lut: "x" },
    { exposureEV: { keys: [] } },
  ])
    expect(
      compositionSchema.safeParse(document({ ...correction, ...changed } as typeof correction))
        .success,
    ).toBe(false);
});
test("ordered correction survives repeated occurrences, after-step taps and bypass", () => {
  const compiler = createCompiler(validateComposition(document(), assets), "sdr");
  const frames = [...compiler.frames({ startUs: 0, endUs: 200000 })];
  for (const frame of frames)
    expect(frame.visual.find((n) => n.target.kind === "track")!.operations).toEqual([
      {
        kind: "sdr-correction",
        ...Object.fromEntries(Object.entries(correction).filter(([k]) => k !== "type")),
      },
      { kind: "opacity", opacity: 0.5 },
    ]);
  const tap = compiler.videoWindow({
    range: { startUs: 0, endUs: 1 },
    rendition: { sampleRate: 48000, channels: 2 },
    tap: { target: { kind: "track", id: "v" }, point: { kind: "after-step", stepId: "grade" } },
  });
  expect([...tap.frames()][0]!.visual.at(-1)!.operations.map((op) => op.kind)).toEqual([
    "sdr-correction",
  ]);
  const bypass = createCompiler(validateComposition(document(correction, false), assets), "bypass");
  expect([...bypass.frames({ startUs: 0, endUs: 1 })][0]!.visual.at(-2)!.operations).toEqual([
    { kind: "opacity", opacity: 0.5 },
  ]);
});
test("color controls do not enter the pointer geometry prefix", () => {
  expect(
    visualOperationsSchema.safeParse([
      {
        kind: "sdr-correction",
        ...Object.fromEntries(Object.entries(correction).filter(([k]) => k !== "type")),
      },
      { kind: "pointer", stepId: "pointer", trailUs: 0, geometryPrefix: [] },
    ]).success,
  ).toBe(true);
});
test("correction execution is unavailable without its exact native identity", () => {
  const find = (ids = {}) => processingCapabilities(ids).find((c) => c.type === "sdr-correction");
  expect(find()).toMatchObject({ execution: false, implementationId: null });
  expect(find({ "sdr-correction": "coreimage-sdr-test" })).toMatchObject({
    execution: true,
    implementationId: "coreimage-sdr-test",
  });
});
