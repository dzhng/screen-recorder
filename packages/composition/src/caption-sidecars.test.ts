import { expect, test } from "vitest";
import { validateComposition } from "./model.js";
import { captionSidecar } from "./caption-sidecars.js";
import { applyBatch } from "./edits.js";

const font = { assetId: "font", postScriptName: "ArialMT" };
const source = (text: string) => ({
  kind: "text" as const,
  text,
  font,
  width: 320,
  height: 80,
  size: 32,
  color: "#ffffffff",
  alignment: "left" as const,
  wrap: true,
});
const assets = [{ id: "font", streams: [], fontFaces: ["ArialMT"] }];
function model(clips: unknown[]) {
  return validateComposition(
    {
      canvas: {
        width: 320,
        height: 80,
        fps: { numerator: 8, denominator: 1 },
        background: "#000000ff",
      },
      tracks: [{ id: "captions", kind: "video", order: 0 }],
      groups: [],
      processing: [],
      syncGroups: [],
      clips,
    },
    assets,
  );
}
function textClip(id: string, text: string, startUs: number, endUs: number) {
  return {
    id,
    trackId: "captions",
    source: source(text),
    placement: { kind: "project", range: { startUs, endUs } },
  };
}

test("selected displayed captions retain corrected Unicode text and outward timing in plain sidecars", () => {
  const composition = model([
    textClip("a", "Café & x < y\n二", 999, 1500),
    textClip("b", "Next", 1500, 2501),
  ]);
  const request = { placementIds: ["b", "a"] };
  const srt = captionSidecar(composition, { ...request, kind: "srt" });
  expect(srt.content).toBe(
    "1\n00:00:00,000 --> 00:00:00,002\nCafé & x < y\n二\n\n2\n00:00:00,001 --> 00:00:00,003\nNext\n\n",
  );
  expect(srt.cues).toEqual([
    {
      placementId: "a",
      fragment: 0,
      text: "Café & x < y\n二",
      exact: { startUs: 999, endUs: 1500 },
      startMs: 0,
      endMs: 2,
    },
    {
      placementId: "b",
      fragment: 0,
      text: "Next",
      exact: { startUs: 1500, endUs: 2501 },
      startMs: 1,
      endMs: 3,
    },
  ]);
  expect(srt.addedOverlaps).toEqual([
    {
      left: { placementId: "a", fragment: 0 },
      right: { placementId: "b", fragment: 0 },
      startMs: 1,
      endMs: 2,
    },
  ]);
  expect(srt.omitted).toEqual([]);
  expect(srt.discardedStyling).toEqual(["a", "b"]);
  const vtt = captionSidecar(composition, { ...request, kind: "vtt" });
  expect(vtt.content).toBe(
    "WEBVTT\n\n00:00:00.000 --> 00:00:00.002\nCafé &amp; x &lt; y\n二\n\n00:00:00.001 --> 00:00:00.003\nNext\n\n",
  );
});

test("content and normalized anchors use exact retimed support, keep repeated takes distinct and report omissions", () => {
  const parents = [0, 3000].map((startUs, index) => ({
    id: `take${index}`,
    trackId: "audio",
    assetId: "a",
    streamId: "audio",
    source: { kind: "range", range: { startUs: 0, endUs: 3000 } },
    placement: { kind: "project", range: { startUs, endUs: startUs + 1000 } },
  }));
  const captions = parents.map((parent, index) => ({
    id: `caption${index}`,
    trackId: "captions",
    source: source("Corrected display"),
    placement: { kind: "content", clipId: parent.id, sourceRange: { startUs: 1000, endUs: 2500 } },
  }));
  const composition = validateComposition(
    {
      canvas: {
        width: 320,
        height: 80,
        fps: { numerator: 8, denominator: 1 },
        background: "#000000ff",
      },
      tracks: [
        { id: "audio", kind: "audio", order: 0 },
        { id: "captions", kind: "video", order: 1 },
        { id: "overlay", kind: "video", order: 2 },
      ],
      groups: [],
      processing: [],
      syncGroups: [],
      clips: [
        ...parents,
        ...captions,
        {
          id: "normalized",
          trackId: "overlay",
          source: source("Normalized"),
          placement: {
            kind: "clip",
            clipId: "take0",
            start: { numerator: 1, denominator: 4 },
            end: { numerator: 3, denominator: 4 },
          },
        },
        {
          id: "hole",
          trackId: "overlay",
          source: source("Hidden"),
          placement: {
            kind: "content",
            clipId: "take1",
            sourceRange: { startUs: 1500, endUs: 2000 },
          },
        },
        { ...textClip("blank", "", 5000, 6000), trackId: "overlay" },
      ],
    },
    [
      ...assets,
      {
        id: "a",
        streams: [
          {
            id: "audio",
            kind: "audio",
            bounds: { startUs: 0, endUs: 3000 },
            available: [
              { startUs: 0, endUs: 1500 },
              { startUs: 2000, endUs: 3000 },
            ],
          },
        ],
      },
    ],
  );
  const output = captionSidecar(composition, {
    kind: "vtt",
    placementIds: ["caption1", "hole", "blank", "caption0", "normalized"],
  });
  expect(output.cues.map(({ placementId, exact }) => ({ placementId, exact }))).toEqual([
    { placementId: "normalized", exact: { startUs: 250, endUs: 500 } },
    {
      placementId: "caption0",
      exact: { startUs: { numerator: 1000, denominator: 3 }, endUs: 500 },
    },
    {
      placementId: "caption0",
      exact: {
        startUs: { numerator: 2000, denominator: 3 },
        endUs: { numerator: 2500, denominator: 3 },
      },
    },
    {
      placementId: "normalized",
      exact: { startUs: { numerator: 2000, denominator: 3 }, endUs: 750 },
    },
    {
      placementId: "caption1",
      exact: { startUs: { numerator: 10000, denominator: 3 }, endUs: 3500 },
    },
    {
      placementId: "caption1",
      exact: {
        startUs: { numerator: 11000, denominator: 3 },
        endUs: { numerator: 11500, denominator: 3 },
      },
    },
  ]);
  expect(output.omitted).toEqual([
    { placementId: "hole", reason: "no-display-support" },
    { placementId: "blank", reason: "empty-text" },
  ]);
  expect(output.addedOverlaps).toContainEqual({
    left: { placementId: "caption0", fragment: 0 },
    right: { placementId: "caption0", fragment: 1 },
    startMs: 0,
    endMs: 1,
  });
});

test("malformed selection and unsafe cue boundaries refuse rather than changing displayed text", () => {
  for (const text of [
    "one\n\ntwo",
    "\nleading",
    "trailing\n",
    "one\n \ntwo",
    "bad\u0000",
    "bad\ud800",
  ]) {
    expect(() =>
      captionSidecar(model([textClip("a", text, 0, 1000)]), { kind: "vtt", placementIds: ["a"] }),
    ).toThrow();
  }
  const composition = model([textClip("a", "one\r\ntwo --> literal", 0, 1000)]);
  expect(captionSidecar(composition, { kind: "srt", placementIds: ["a"] }).content).toContain(
    "one\ntwo --> literal",
  );
  for (const placementIds of [[], ["a", "a"], ["missing"]]) {
    expect(() => captionSidecar(composition, { kind: "srt", placementIds })).toThrow();
  }
});

test("sidecar diagnostics refuse excessive introduced overlaps without dropping any cue", () => {
  const clips = Array.from({ length: 200 }, (_, i) =>
    textClip(`caption${i}`, "x", i * 2, i * 2 + 1),
  );
  expect(() =>
    captionSidecar(model(clips), { kind: "srt", placementIds: clips.map((clip) => clip.id) }),
  ).toThrow(
    expect.objectContaining({ code: "LIMIT_EXCEEDED", details: { maximumAddedOverlaps: 10000 } }),
  );
});

test("trimmed captions retain their support and genuine equal-start overlaps keep stable ID order", () => {
  const base = model([textClip("z", "Z", 0, 5000)]);
  const original = validateComposition(
    {
      ...base.document,
      tracks: [...base.document.tracks, { id: "other", kind: "video", order: 1 }],
      clips: [...base.document.clips, { ...textClip("a", "A", 1000, 4000), trackId: "other" }],
    },
    assets,
  );
  const trimmed = applyBatch(
    original.document,
    [{ operation: "trim", clipId: "z", range: { startUs: 1000, endUs: 3000 }, ripple: "none" }],
    { assets, namespace: "sidecar-trim" },
  );
  const output = captionSidecar(validateComposition(trimmed.document, assets), {
    kind: "srt",
    placementIds: ["z", "a"],
  });
  expect(output.cues.map(({ placementId, exact }) => ({ placementId, exact }))).toEqual([
    { placementId: "a", exact: { startUs: 1000, endUs: 4000 } },
    { placementId: "z", exact: { startUs: 1000, endUs: 3000 } },
  ]);
  expect(output.addedOverlaps).toEqual([]);
});

test("SRT preserves comparisons and ampersands, while literal formatting requires VTT", () => {
  const ordinary = captionSidecar(model([textClip("a", "x < y, 2 < 3 > 1, R&D", 0, 1000)]), {
    kind: "srt",
    placementIds: ["a"],
  });
  expect(ordinary.content).toContain("x < y, 2 < 3 > 1, R&D");
  for (const text of [
    "<b>literal</b>",
    "<unknown>literal</unknown>",
    "&amp; literal",
    "{\\an8}literal",
    "\\N literal",
  ]) {
    const composition = model([textClip("a", text, 0, 1000)]);
    expect(() => captionSidecar(composition, { kind: "srt", placementIds: ["a"] })).toThrow(
      expect.objectContaining({
        code: "UNSUPPORTED_FORMAT",
        details: { placementId: "a", format: "srt", alternative: "vtt" },
      }),
    );
    expect(captionSidecar(composition, { kind: "vtt", placementIds: ["a"] }).cues[0]!.text).toBe(
      text,
    );
  }
});

test("SRT refuses timestamp-shaped payload lines rather than inventing another cue", () => {
  for (const text of [
    "Before\n00:00:10,000 --> 00:00:20,000\nAfter",
    "0:0:10.0-->0:0:20.0",
    "  +00:+00:+10,+000 --> +00:+00:+20,+000 suffix",
  ]) {
    const composition = model([textClip("a", text, 0, 1000000)]);
    expect(() => captionSidecar(composition, { kind: "srt", placementIds: ["a"] })).toThrow(
      expect.objectContaining({ code: "UNSUPPORTED_FORMAT" }),
    );
    const vtt = captionSidecar(composition, { kind: "vtt", placementIds: ["a"] });
    expect(vtt.cues).toEqual([
      {
        placementId: "a",
        fragment: 0,
        text,
        exact: { startUs: 0, endUs: 1000000 },
        startMs: 0,
        endMs: 1000,
      },
    ]);
    expect(vtt.content).toContain(text.replaceAll(">", "&gt;"));
  }
});

test("SRT refuses whitespace-prefixed tags that readers interpret as formatting", () => {
  for (const text of ["hello < b>bold", "hello < b >bold", 'hello < font color="red">literal']) {
    const composition = model([textClip("a", text, 0, 1000000)]);
    expect(() => captionSidecar(composition, { kind: "srt", placementIds: ["a"] })).toThrow(
      expect.objectContaining({ code: "UNSUPPORTED_FORMAT" }),
    );
    expect(captionSidecar(composition, { kind: "vtt", placementIds: ["a"] }).cues[0]!.text).toBe(
      text,
    );
  }
});
