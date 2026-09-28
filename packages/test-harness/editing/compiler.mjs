import assert from "node:assert/strict";
import { applyBatch, createCompiler, validateComposition } from "../../composition/dist/index.js";

if (process.argv.slice(2).join(" ") !== "--fixture phase-offset")
  throw new Error("Usage: compiler.mjs --fixture phase-offset");
const document = {
  canvas: {
    width: 640,
    height: 480,
    fps: { numerator: 30000, denominator: 1001 },
    background: "#000000ff",
  },
  tracks: [
    { id: "video", kind: "video", order: 0 },
    { id: "audio", kind: "audio", order: 0, parentId: "voice" },
  ],
  groups: [{ id: "voice", kind: "audio", order: 1 }],
  clips: ["video", "audio"].map((kind) => ({
    id: kind,
    trackId: kind,
    assetId: "source",
    streamId: kind,
    source: { kind: "range", range: { startUs: 500000, endUs: 1500000 } },
    placement: { kind: "project", range: { startUs: 0, endUs: 700000 } },
  })),
  processing: [
    {
      target: { kind: "group", id: "voice" },
      steps: [{ id: "level", enabled: true, processor: { type: "gain", gain: 0.5 } }],
    },
  ],
  syncGroups: [],
  captions: [],
};
const assets = [
  {
    id: "source",
    streams: ["video", "audio"].map((kind) => ({
      id: kind,
      kind,
      bounds: { startUs: 0, endUs: 2000000 },
      available: [{ startUs: 0, endUs: 2000000 }],
    })),
  },
];
const model = validateComposition(document, assets);
const compiler = createCompiler(model);
const full = [...compiler.frames({ startUs: 0, endUs: 700000 })];
let comparisons = 0;
for (const startUs of [0, 1, 33366, 33367, 100001, 401234]) {
  const range = { startUs, endUs: Math.min(700000, startUs + 199999) };
  const short = [...compiler.frames(range)];
  assert.deepEqual(
    short,
    full.filter((frame) => frame.atUs >= range.startUs && frame.atUs < range.endUs),
  );
  for (const frame of short) {
    const time = Number((BigInt(frame.index) * 1001000000n) / 30000n);
    assert.equal(frame.atUs, time);
    assert.equal(frame.layers[0].sourceUs, 500000 + Math.floor((time * 10) / 7));
    comparisons++;
  }
}
const split = applyBatch(
  document,
  [{ operation: "split", clipIds: ["video", "audio"], atUs: 123457, scope: "selected" }],
  { assets, namespace: "compiler-probe" },
);
const after = createCompiler(validateComposition(split.document, assets));
assert.deepEqual(
  [...after.frames({ startUs: 0, endUs: 700000 })].map((frame) => [
    frame.atUs,
    frame.layers[0].sourceUs,
  ]),
  full.map((frame) => [frame.atUs, frame.layers[0].sourceUs]),
);
for (const sampleRate of [44100, 48000]) {
  const segments = [...after.audio({ startUs: 50001, endUs: 650009 }, sampleRate)];
  assert.equal(segments[0].sampleRange.start, Math.floor((50001 * sampleRate) / 1000000));
  assert.equal(segments.at(-1).sampleRange.end, Math.floor((650009 * sampleRate) / 1000000));
  assert.equal(segments[0].sampleRange.end, segments[1].sampleRange.start);
}
assert.deepEqual(compiler.processing({ startUs: 1, endUs: 2 }).at(-1).inputs, [
  { kind: "track", id: "video" },
  { kind: "group", id: "voice" },
]);
console.log(
  JSON.stringify(
    {
      fixture: "phase-offset",
      scope: "pure composition schedules; no service or native execution",
      comparisons,
      splitPreserved: true,
      outputSampleRates: [44100, 48000],
      nestedProcessing: true,
    },
    null,
    2,
  ),
);
