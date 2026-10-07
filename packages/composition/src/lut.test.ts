import { expect, test } from "vitest";
import { createCompiler, documentAssetIds, validateComposition } from "./index.js";

const range = { startUs: 0, endUs: 200000 };
const document = {
  canvas: {
    width: 64,
    height: 48,
    fps: { numerator: 10, denominator: 1 },
    background: "#000000ff",
  },
  tracks: [{ id: "v", kind: "video", order: 0 }],
  groups: [],
  syncGroups: [],
  clips: [
    {
      id: "shot",
      trackId: "v",
      assetId: "image",
      streamId: "i",
      source: { kind: "hold", atUs: 0 },
      placement: { kind: "project", range },
    },
  ],
  processing: [
    {
      target: { kind: "clip", id: "shot" },
      steps: [
        {
          id: "look",
          enabled: true,
          processor: {
            type: "lut",
            assetId: "cube",
            colorSpace: "linear-srgb",
            interpolation: "trilinear",
          },
        },
        { id: "fade", enabled: true, processor: { type: "opacity", opacity: 0.5 } },
      ],
    },
  ],
};
const assets = [
  { id: "image", streams: [{ id: "i", kind: "image", width: 64, height: 48 }] },
  {
    id: "cube",
    streams: [],
    lut: { format: "cube-3d", size: 3, domain: "unit", ordering: "red-fastest" },
  },
];

test("an ordered LUT retains an immutable non-media dependency and survives compilation/taps", () => {
  const model = validateComposition(document, assets);
  expect(documentAssetIds(model.document)).toEqual(["image", "cube"]);
  const compiler = createCompiler(model, "lut-revision");
  const window = compiler.videoWindow({
    range,
    rendition: { sampleRate: 48000, channels: 2 },
    tap: { target: { kind: "clip", id: "shot" }, point: { kind: "after-step", stepId: "look" } },
  });
  expect(window.manifest.luts).toEqual(["cube"]);
  expect([...window.frames()][0]!.visual[0]!.operations[0]).toEqual({
    kind: "lut",
    assetId: "cube",
    colorSpace: "linear-srgb",
    interpolation: "trilinear",
  });
  expect(window.manifest.requirements).toContainEqual(
    expect.objectContaining({
      kind: "processor",
      processor: document.processing[0]!.steps[0]!.processor,
    }),
  );
});

test("unknown and non-LUT asset references refuse even while bypassed", () => {
  const bypassed = structuredClone(document);
  bypassed.processing[0]!.steps[0]!.enabled = false;
  for (const admitted of [assets.slice(0, 1), [...assets.slice(0, 1), { id: "cube", streams: [] }]])
    expect(() => validateComposition(bypassed, admitted)).toThrow(/immutable cube asset/);
  const model = validateComposition(bypassed, assets);
  expect(documentAssetIds(model.document)).toEqual(["image", "cube"]);
  expect(
    createCompiler(model, "bypass").videoWindow({
      range,
      rendition: { sampleRate: 48000, channels: 2 },
      tap: { target: { kind: "output" }, point: { kind: "processed" } },
    }).manifest.luts,
  ).toEqual([]);
});
