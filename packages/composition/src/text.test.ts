import { expect, test } from "vitest";
import {
  applyBatch,
  createCompiler,
  documentAssetIds,
  projectToSource,
  validateComposition,
} from "./index.js";
const empty = {
  canvas: {
    width: 420,
    height: 100,
    fps: { numerator: 8, denominator: 1 },
    background: "#00000000",
  },
  tracks: [],
  groups: [],
  clips: [],
  processing: [],
  syncGroups: [],
};
const source = {
  kind: "text",
  text: "Hello, world!\nCaption two.",
  font: { assetId: "font", postScriptName: "ArialMT" },
  width: 420,
  height: 100,
  size: 32,
  color: "#ffffffff",
  alignment: "left",
  wrap: true,
};
const assets = [
  { id: "font", streams: [], fontFaces: ["ArialMT"] },
  {
    id: "audio",
    streams: [
      {
        id: "a",
        kind: "audio",
        bounds: { startUs: 0, endUs: 2000000 },
        available: [{ startUs: 0, endUs: 2000000 }],
      },
    ],
  },
];
const context = { assets, namespace: "text" };
const ref = (label: string) => ({ label });

test("replacing a transcript-seeded caption retires its seed and keeps occurrence timing and processing", () => {
  const range = { startUs: 250000, endUs: 1250000 };
  const document = {
    ...empty,
    tracks: [{ id: "captions", kind: "video", order: 0 }],
    clips: [
      {
        id: "caption",
        trackId: "captions",
        placement: { kind: "project", range },
        source,
        seed: {
          kind: "transcript",
          source: { assetId: "audio", streamId: "a" },
          generation: "recognized",
          occurrenceClipId: "narration",
          words: [{ ordinal: 0, sourceRange: { startUs: 250000, endUs: 1250000 } }],
        },
      },
    ],
    processing: [
      {
        target: { kind: "clip", id: "caption" },
        steps: [{ id: "opacity", enabled: true, processor: { type: "opacity", opacity: 0.5 } }],
      },
    ],
  };
  const mediaAssets = [
    ...assets,
    {
      id: "picture",
      streams: [
        { id: "still", kind: "image", width: 420, height: 100 },
        {
          id: "movie",
          kind: "video",
          width: 420,
          height: 100,
          bounds: { startUs: 0, endUs: 1000000 },
          available: [{ startUs: 0, endUs: 1000000 }],
        },
      ],
    },
  ];
  for (const media of [
    { assetId: "picture", streamId: "still", source: { kind: "hold", atUs: 0 } },
    {
      assetId: "picture",
      streamId: "movie",
      source: { kind: "range", range: { startUs: 0, endUs: 1000000 } },
    },
  ]) {
    const result = applyBatch(
      document,
      [{ operation: "replace", clipId: "caption", kind: "video", media }],
      { ...context, assets: mediaAssets },
    );
    expect(result.document.clips).toEqual([
      {
        id: "caption",
        trackId: "captions",
        placement: { kind: "project", range },
        ...media,
      },
    ]);
    expect(result.document.processing).toEqual(document.processing);
    expect(result.createdIds).toEqual([]);
    expect(documentAssetIds(result.document)).toEqual(["picture"]);
    expect(
      projectToSource(validateComposition(result.document, mediaAssets), 250000),
    ).toMatchObject([
      { clipId: "caption", assetId: "picture", streamId: media.streamId, sourceUs: 0 },
    ]);
  }
});

test("literal text uses existing anchors and survives parent split, move and retime", () => {
  const result = applyBatch(
    empty,
    [
      { operation: "track.add", track: { kind: "audio", order: 0 }, label: "a" },
      { operation: "track.add", track: { kind: "video", order: 1 }, label: "v" },
      {
        operation: "place",
        label: "parent",
        clip: {
          trackId: ref("a"),
          assetId: "audio",
          streamId: "a",
          source: { kind: "range", range: { startUs: 0, endUs: 2000000 } },
          placement: { kind: "project", range: { startUs: 0, endUs: 2000000 } },
        },
      },
      {
        operation: "place",
        label: "caption",
        clip: {
          trackId: ref("v"),
          source,
          placement: {
            kind: "content",
            clipId: ref("parent"),
            sourceRange: { startUs: 250000, endUs: 1750000 },
          },
        },
      },
    ],
    context,
  );
  expect(documentAssetIds(result.document).sort()).toEqual(["audio", "font"]);
  const frames = (document: unknown) =>
    [
      ...createCompiler(validateComposition(document, assets), "r").frames({
        startUs: 0,
        endUs: 2000000,
      }),
    ].map((f) => f.layers.map((l) => (l.kind === "text" ? l.text : l.kind)));
  expect(frames(result.document)[4]).toEqual([source]);
  const split = applyBatch(
    result.document,
    [{ operation: "split", clipIds: [result.labels.parent], atUs: 1000000 }],
    context,
  );
  expect(frames(split.document)).toEqual(frames(result.document));
  const retimed = applyBatch(
    result.document,
    [
      {
        operation: "retime",
        clipIds: [result.labels.parent],
        durationUs: 1000000,
        pitch: "preserve",
        ripple: "none",
      },
    ],
    context,
  );
  const caption = validateComposition(retimed.document, assets).clips.find(
    (v) => v.clip.id === result.labels.caption,
  )!;
  expect(caption.range).toEqual({
    start: { numerator: 125000n, denominator: 1n },
    end: { numerator: 875000n, denominator: 1n },
  });
  const moved = applyBatch(
    retimed.document,
    [{ operation: "move", clipIds: [result.labels.parent], atUs: 2000000, ripple: "none" }],
    context,
  );
  expect(
    validateComposition(moved.document, assets).clips.find(
      (v) => v.clip.id === result.labels.caption,
    )!.range.start,
  ).toEqual({ numerator: 2125000n, denominator: 1n });
});

test("text edits preserve placement and reject a font name outside its asset", () => {
  const result = applyBatch(
    empty,
    [
      { operation: "track.add", track: { kind: "video", order: 0 }, label: "v" },
      {
        operation: "place",
        label: "caption",
        clip: {
          trackId: ref("v"),
          source,
          placement: { kind: "project", range: { startUs: 0, endUs: 1000000 } },
        },
      },
    ],
    context,
  );
  const edited = applyBatch(
    result.document,
    [
      {
        operation: "text.set",
        clipId: result.labels.caption,
        source: { ...source, text: "Corrected!" },
      },
    ],
    context,
  );
  expect(edited.document.clips[0]!.placement).toEqual(result.document.clips[0]!.placement);
  expect(edited.document.clips[0]!.source).toEqual({ ...source, text: "Corrected!" });
  expect(() =>
    applyBatch(
      result.document,
      [
        {
          operation: "text.set",
          clipId: result.labels.caption,
          source: { ...source, font: { assetId: "font", postScriptName: "Absent" } },
        },
      ],
      context,
    ),
  ).toThrow(/font face/);
});

test("explicit vertical text placement survives authoring and compiled frame delivery", () => {
  const authored = { ...source, verticalAlignment: "bottom" };
  const result = applyBatch(
    empty,
    [
      { operation: "track.add", label: "v", track: { kind: "video", order: 0 } },
      {
        operation: "place",
        clip: {
          trackId: ref("v"),
          source: authored,
          placement: { kind: "project", range: { startUs: 0, endUs: 1000000 } },
        },
      },
    ],
    context,
  );
  const frames = [
    ...createCompiler(validateComposition(result.document, assets), "r").frames({
      startUs: 0,
      endUs: 1000000,
    }),
  ];
  expect(frames[0]!.layers).toMatchObject([{ kind: "text", text: authored }]);
  expect(result.document.clips[0]!.source).toEqual(authored);
});

test("text decorations are explicit, bounded, and retained in compiled layers", () => {
  const authored = {
    ...source,
    stroke: { color: "#000000cc", width: 3 },
    shadow: { color: "#00000080", offsetX: 4, offsetY: -2, blur: 6 },
    background: { color: "#112233dd", padding: 8, cornerRadius: 5 },
  };
  const result = applyBatch(
    empty,
    [
      { operation: "track.add", label: "v", track: { kind: "video", order: 0 } },
      {
        operation: "place",
        clip: {
          trackId: ref("v"),
          source: authored,
          placement: { kind: "project", range: { startUs: 0, endUs: 1000000 } },
        },
      },
    ],
    context,
  );
  const frame = [
    ...createCompiler(validateComposition(result.document, assets), "r").frames({
      startUs: 0,
      endUs: 1000000,
    }),
  ][0]!;
  expect(frame.layers[0]!.kind).toBe("text");
  if (frame.layers[0]!.kind === "text") expect(frame.layers[0]!.text).toEqual(authored);
  expect(() =>
    validateComposition(
      {
        ...result.document,
        clips: [
          {
            ...result.document.clips[0]!,
            source: { ...authored, stroke: { ...authored.stroke, width: 65 } },
          },
        ],
      },
      assets,
    ),
  ).toThrow();
});
