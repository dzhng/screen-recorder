import { expect, test } from "vitest";
import { createCompiler, validateComposition, type ProcessingTap } from "@screenrec/composition";
import { projectCapabilities } from "./project-window.js";
import { compositionPointerSources } from "./composition-pointer.js";

const bounds = { startUs: 0, endUs: 2_000_000 };
const assets = [
  {
    id: "source",
    streams: [{ id: "v", kind: "video", width: 100, height: 80, bounds, available: [bounds] }],
  },
];
const selection = { assetId: "source", streamId: "v", acquisitionId: "capture" };
const pointer = { id: "pointer", enabled: true, processor: { type: "pointer", trailUs: 100_000 } };
const base = {
  canvas: {
    width: 100,
    height: 80,
    fps: { numerator: 10, denominator: 1 },
    background: "#000000ff",
  },
  tracks: [{ id: "video", kind: "video", order: 0 }],
  groups: [],
  captions: [],
  syncGroups: [],
  clips: [
    {
      id: "clip",
      trackId: "video",
      ...selection,
      source: { kind: "range", range: bounds },
      placement: { kind: "project", range: bounds },
    },
  ],
  processing: [{ target: { kind: "clip", id: "clip" }, steps: [pointer] }],
};
function sources(
  document: unknown,
  available: (typeof bounds)[],
  range: typeof bounds,
  tap: ProcessingTap = { target: { kind: "output" }, point: { kind: "processed" } },
) {
  const model = validateComposition(document, assets, [
    { id: "capture", bindings: [{ assetId: "source", streamId: "v", available }] },
  ]);
  const compiler = createCompiler(model, "pointer-admission");
  const window = compiler.videoWindow({
    range,
    tap,
    rendition: { sampleRate: 48000, channels: 2 },
  });
  return compositionPointerSources({
    model,
    compiler,
    range,
    processing: window.manifest.processing,
  });
}
test("admission uses discrete contributing samples including the first floor-selected frame", () => {
  expect(
    sources(base, [{ startUs: 100_000, endUs: 100_001 }], { startUs: 150_001, endUs: 160_000 }),
  ).toEqual([selection]);
  expect(
    sources(base, [{ startUs: 100_001, endUs: 199_999 }], { startUs: 100_001, endUs: 200_000 }),
  ).toEqual([]);
  expect(
    sources(base, [{ startUs: 100_001, endUs: 200_001 }], { startUs: 100_001, endUs: 200_001 }),
  ).toEqual([selection]);
});
test("dry and before-pointer taps need no history while the matching after-step tap does", () => {
  const range = { startUs: 0, endUs: 1 };
  expect(
    sources(base, [bounds], range, {
      target: { kind: "clip", id: "clip" },
      point: { kind: "dry" },
    }),
  ).toEqual([]);
  expect(
    sources(base, [bounds], range, {
      target: { kind: "clip", id: "clip" },
      point: { kind: "after-step", stepId: "pointer" },
    }),
  ).toEqual([selection]);
  const document = {
    ...base,
    processing: [
      {
        target: { kind: "clip", id: "clip" },
        steps: [
          { id: "fade", enabled: true, processor: { type: "opacity", opacity: 0.5 } },
          pointer,
        ],
      },
    ],
  };
  expect(
    sources(document, [bounds], range, {
      target: { kind: "clip", id: "clip" },
      point: { kind: "after-step", stepId: "fade" },
    }),
  ).toEqual([]);
});
test("inactive and disabled pointers do not manufacture history dependencies", () => {
  const document = {
    ...base,
    clips: [
      {
        ...base.clips[0]!,
        source: { kind: "range", range: { startUs: 0, endUs: 500_000 } },
        placement: { kind: "project", range: { startUs: 0, endUs: 500_000 } },
      },
      {
        ...base.clips[0]!,
        id: "timer",
        placement: { kind: "project", range: { startUs: 500_000, endUs: 2_500_000 } },
      },
    ],
  };
  expect(
    sources(
      document,
      [bounds],
      { startUs: 1_000_000, endUs: 1_000_001 },
      { target: { kind: "clip", id: "clip" }, point: { kind: "processed" } },
    ),
  ).toEqual([]);
  expect(
    sources(
      {
        ...base,
        processing: [
          { target: { kind: "clip", id: "clip" }, steps: [{ ...pointer, enabled: false }] },
        ],
      },
      [bounds],
      bounds,
    ),
  ).toEqual([]);
});
test("hold and repeated clip occurrences share immutable source history without duration scanning", () => {
  const document = {
    ...base,
    clips: [
      {
        ...base.clips[0]!,
        source: { kind: "hold", atUs: 150_000 },
        placement: { kind: "project", range: { startUs: 0, endUs: 100_000_000_000 } },
      },
    ],
  };
  expect(sources(document, [bounds], { startUs: 0, endUs: 100_000_000_000 })).toEqual([selection]);
  expect(
    sources(document, [{ startUs: 200_000, endUs: 300_000 }], {
      startUs: 0,
      endUs: 100_000_000_000,
    }),
  ).toEqual([]);
});

test("sub-microsecond projected availability must contain the integer sampled instant", () => {
  const document = {
    ...base,
    clips: [
      {
        ...base.clips[0]!,
        source: { kind: "range", range: { startUs: 0, endUs: 600000 } },
        placement: { kind: "project", range: { startUs: 0, endUs: 200000 } },
      },
    ],
  };
  const range = { startUs: 100001, endUs: 100002 };
  expect(sources(document, [{ startUs: 299999, endUs: 300001 }], range)).toEqual([selection]);
  expect(sources(document, [{ startUs: 300001, endUs: 300002 }], range)).toEqual([]);
  expect(sources(document, [{ startUs: 299999, endUs: 300000 }], range)).toEqual([]);
});

test("resolved unavailable ancestor support suppresses child pointer preparation", () => {
  const document = {
    ...base,
    tracks: [...base.tracks, { id: "parent", kind: "video", order: 1 }],
    clips: [
      { ...base.clips[0]!, placement: { kind: "content", clipId: "anchor", sourceRange: bounds } },
      { ...base.clips[0]!, id: "anchor", trackId: "parent", acquisitionId: "parent-capture" },
    ],
  };
  const model = validateComposition(document, assets, [
    { id: "capture", bindings: [{ assetId: "source", streamId: "v", available: [bounds] }] },
    {
      id: "parent-capture",
      bindings: [
        {
          assetId: "source",
          streamId: "v",
          available: [
            { startUs: 0, endUs: 100000 },
            { startUs: 200000, endUs: 2000000 },
          ],
        },
      ],
    },
  ]);
  const compiler = createCompiler(model, "anchor-pointer");
  for (const [startUs, expected] of [
    [150001, []],
    [200001, [selection]],
  ] as const) {
    const range = { startUs, endUs: startUs + 1 };
    const window = compiler.videoWindow({
      range,
      rendition: { sampleRate: 48000, channels: 2 },
      tap: { target: { kind: "clip", id: "clip" }, point: { kind: "processed" } },
    });
    expect(
      compositionPointerSources({ model, compiler, range, processing: window.manifest.processing }),
    ).toEqual(expected);
  }
});

test("renderers without a preparation owner do not advertise executable pointer steps", () => {
  expect(
    projectCapabilities({ implementationId: "fixture-picture" }).find((p) => p.type === "pointer"),
  ).toMatchObject({ execution: false, implementationId: null });
});
