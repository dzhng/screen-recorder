import { expect, test } from "vitest";
import { applyBatch, createCompiler, validateComposition } from "./index.js";
import { sampleScalarSamples } from "./scalar-program.js";
const assets = [
  {
    id: "a",
    streams: [
      {
        id: "s",
        kind: "audio",
        bounds: { startUs: 0, endUs: 1000000 },
        available: [{ startUs: 0, endUs: 1000000 }],
      },
    ],
  },
];
const document = {
  canvas: {
    width: 64,
    height: 48,
    fps: { numerator: 30, denominator: 1 },
    background: "#000000ff",
  },
  tracks: [{ id: "a", kind: "audio", order: 0 }],
  groups: [],
  syncGroups: [],
  clips: [
    {
      id: "c",
      trackId: "a",
      assetId: "a",
      streamId: "s",
      source: { kind: "range", range: { startUs: 0, endUs: 1000000 } },
      placement: { kind: "project", range: { startUs: 0, endUs: 1000000 } },
    },
  ],
  processing: [
    {
      target: { kind: "clip", id: "c" },
      steps: [
        {
          id: "g",
          enabled: true,
          processor: {
            type: "gain",
            gain: {
              keys: [
                { at: { numerator: 0, denominator: 1 }, value: 0, interpolation: "linear" },
                { at: { numerator: 1, denominator: 1 }, value: 1, interpolation: "linear" },
              ],
            },
          },
        },
      ],
    },
  ],
};
const window = (value: unknown, range = { startUs: 0, endUs: 1000000 }) =>
  createCompiler(validateComposition(value, assets), "r").window({
    range,
    rendition: { sampleRate: 48000, channels: 2 },
    tap: { target: { kind: "output" }, point: { kind: "processed" } },
  });

test("audio execution lowers gain while inspection retains the authored curve", () => {
  const compiled = window(document);
  expect(compiled.manifest.processing[0]!.steps[0]!.processor).toEqual(
    document.processing[0]!.steps[0]!.processor,
  );
  const gain = compiled.processing()[0]!.steps[0]!.processor;
  if (gain.type !== "gain" || typeof gain.gain === "number")
    throw Error("Expected numerical gain program");
  expect(gain.active).toEqual([{ start: 0, end: 48000 }]);
  expect(sampleScalarSamples(gain.gain, 24000)).toBe(0.5);
  expect(window(document, { startUs: 500000, endUs: 750000 }).processing()).toEqual(
    compiled.processing(),
  );
});

test("audio activation floors fractional windows without clamping the original value phase", () => {
  const edited = structuredClone(document);
  const step = edited.processing[0]!.steps[0]!;
  const value = {
    ...edited,
    processing: [
      {
        ...edited.processing[0],
        steps: [
          {
            ...step,
            window: {
              kind: "project",
              range: { startUs: { numerator: 1001, denominator: 3 }, endUs: 667 },
            },
            processor: {
              type: "gain",
              gain: {
                keys: [
                  { at: 0, value: 0, interpolation: "linear" },
                  { at: 1000, value: 3, interpolation: "linear" },
                ],
              },
            },
          },
        ],
      },
    ],
  };
  const gain = window(value).processing()[0]!.steps[0]!.processor;
  if (gain.type !== "gain" || typeof gain.gain === "number") throw Error("Expected numerical gain");
  expect(gain.active).toEqual([{ start: 16, end: 32 }]);
  expect(sampleScalarSamples(gain.gain, 16)).toBe(1);
  expect(sampleScalarSamples(gain.gain, 32)).toBe(2);
});

test("slower and faster edits retain normalized and content gain phase before stretch execution is bound", () => {
  const content = {
    ...document,
    processing: [
      {
        ...document.processing[0],
        steps: [
          {
            id: "g",
            enabled: true,
            window: { kind: "content", clipId: "c", sourceRange: { startUs: 0, endUs: 1000000 } },
            processor: {
              type: "gain",
              gain: {
                keys: [
                  { at: 0, value: 0, interpolation: "linear" },
                  { at: 1000000, value: 1, interpolation: "linear" },
                ],
              },
            },
          },
        ],
      },
    ],
  };
  for (const input of [document, content])
    for (const durationUs of [500000, 2000000]) {
      const edited = applyBatch(
        input,
        [
          { operation: "retime", clipIds: ["c"], durationUs, ripple: "none" },
          { operation: "move", clipIds: ["c"], atUs: 1000000, ripple: "none" },
        ],
        { assets, namespace: `gain-${durationUs}` },
      ).document;
      const compiled = window(edited, { startUs: 1000000, endUs: 1000000 + durationUs });
      const gain = compiled.processing()[0]!.steps[0]!.processor;
      if (gain.type !== "gain" || typeof gain.gain === "number")
        throw Error("Expected numerical gain");
      expect(gain.active).toEqual([{ start: 48000, end: 48000 + (durationUs * 48000) / 1000000 }]);
      expect(sampleScalarSamples(gain.gain, 48000 + (durationUs * 48000) / 1000000 / 2)).toBe(0.5);
      expect(
        compiled.manifest.requirements.some(
          (r) => r.kind === "retime" && r.implementationId === null,
        ),
      ).toBe(true);
    }
});
