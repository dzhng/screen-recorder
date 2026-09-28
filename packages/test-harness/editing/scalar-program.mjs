import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createCompiler, validateComposition } from "../../composition/dist/index.js";
import { compileScalarCurve } from "../../composition/dist/curve.js";
import { sampleScalarSamples } from "../../composition/dist/scalar-program.js";

const root = new URL("../../../", import.meta.url).pathname;
const scratch = mkdtempSync(join(tmpdir(), "screenrec-scalar-program-"));
const doc = {
  canvas: {
    width: 64,
    height: 48,
    fps: { numerator: 30, denominator: 1 },
    background: "#000000ff",
  },
  tracks: [],
  groups: [],
  processing: [],
  syncGroups: [],
  captions: [],
  clips: [],
};
const compiler = createCompiler(validateComposition(doc, []), "scalar");
const key = (at, value, interpolation = "linear") => ({ at, value, interpolation });
const project = { kind: "project", range: { startUs: 0, endUs: Number.MAX_SAFE_INTEGER } };
const vectors = [];
function add(name, keys, frames, analytic) {
  const curve = compiler.curve({ keys }, project);
  vectors.push({ name, program: curve.samples(48000), frames, analytic });
}
const frames = Array.from({ length: 1001 }, (_, i) => i * 48);
add(
  "flat start",
  [key(0, 0, { cubic: [0, 1, 0, 1] }), key(1000000, 1)],
  frames,
  (frame) => 1 - (1 - Math.cbrt(frame / 48000)) ** 3,
);
add(
  "flat end",
  [key(0, 0, { cubic: [1, 0, 1, 0] }), key(1000000, 1)],
  frames,
  (frame) => (1 - Math.cbrt(1 - frame / 48000)) ** 3,
);
add("flat center", [key(0, 0, { cubic: [1, 0, 0, 1] }), key(1000000, 1)], frames, (frame) => {
  const t = 0.5 + Math.cbrt((frame / 48000 - 0.5) / 4);
  return 3 * t * t - 2 * t * t * t;
});
add(
  "ceil key ownership",
  [key(21, 2, "hold"), key(43, 4, "hold"), key(125, 8)],
  [0, 1, 2, 3, 5, 6, 7],
  (frame) => (frame < 3 ? 2 : frame < 6 ? 4 : 8),
);
const end = Number.MAX_SAFE_INTEGER - 1;
const lastFrame = Number((BigInt(end) * 48000n) / 1000000n);
add(
  "large endpoint remainder",
  [key(0, 0, { cubic: [1, 0, 1, 0] }), key(end, 1)],
  [lastFrame - 100, lastFrame - 1, lastFrame],
  (frame) =>
    (1 -
      Math.cbrt(
        Number(BigInt(end) * 48000n - BigInt(frame) * 1000000n) / Number(BigInt(end) * 48000n),
      )) **
    3,
);
for (const handles of [
  [0.2, -0.4, 0.8, 1.6],
  [0.9999999999999999, 0, 0.0000000000000001, 1],
])
  add(`cross runtime ${handles}`, [key(0, 0.125, { cubic: handles }), key(1000000, 0.875)], frames);
const clipDoc = {
  ...doc,
  tracks: [{ id: "v", kind: "video", order: 0 }],
  clips: [
    {
      id: "c",
      trackId: "v",
      assetId: "a",
      streamId: "v",
      source: { kind: "range", range: { startUs: 0, endUs: 1000000 } },
      placement: { kind: "project", range: { startUs: 0, endUs: 1000000 } },
    },
  ],
};
const assets = [
  {
    id: "a",
    streams: [
      {
        id: "v",
        kind: "video",
        width: 64,
        height: 48,
        bounds: { startUs: 0, endUs: 1000000 },
        available: [{ startUs: 0, endUs: 1000000 }],
      },
    ],
  },
];
const model = validateComposition(clipDoc, assets);
const anchor = {
  kind: "clip",
  clipId: "c",
  start: { numerator: 0, denominator: 1 },
  end: { numerator: 1, denominator: 1 },
};
const normalized = {
  keys: [
    { ...key(0, 0), at: { numerator: 0, denominator: 1 } },
    { ...key(1, 1), at: { numerator: 1, denominator: 1 } },
  ],
};
const max = 9007199254740881;
for (const [name, start, end, analytic] of [
  [
    "Int128 overflow admitted phase",
    { numerator: 1, denominator: max },
    { numerator: 1, denominator: max - 2 },
    () => 1 / max,
  ],
  [
    "signed origin after trim",
    { numerator: 1, denominator: 3 },
    { numerator: 2, denominator: 3 },
    (frame) => 1 / 3 + frame / 48000 / 3,
  ],
]) {
  const curve = compileScalarCurve(model, normalized, anchor, { start, end });
  vectors.push({ name, program: curve.samples(48000), frames, analytic });
}
add(
  "exact interior cubic key",
  [key(0, 1), key(1000000, 0, { cubic: [0.5, 1e20, 0.5, 0] }), key(2000000, 1)],
  [48000],
  () => 0,
);
const longDoc = structuredClone(clipDoc),
  longAssets = structuredClone(assets);
longDoc.clips[0].source.range.endUs = max;
longDoc.clips[0].placement.range.endUs = max;
longAssets[0].streams[0].bounds.endUs = max;
longAssets[0].streams[0].available[0].endUs = max;
const start = { numerator: 1, denominator: max },
  endRange = { numerator: 1, denominator: max - 2 };
const extremeCurve = compileScalarCurve(
  validateComposition(longDoc, longAssets),
  {
    keys: [
      { ...key(0, 0, { cubic: [0, 1e38, 0, 1e38] }), at: start },
      { ...key(1, 1), at: { numerator: 1, denominator: 1 } },
    ],
  },
  anchor,
  { start, end: endRange },
);
vectors.push({
  name: "small legal phase with large finite weight",
  program: extremeCurve.samples(48000),
  frames: [0, 1, 2, 100, 48000],
  analytic: (frame) => {
    const phase = ((frame * 1000000) / 48000 / max) * (2 / (max - 2) / (max - 1));
    const t = Math.cbrt(phase);
    return 3 * (1 - t) * t * 1e38 + t * t * t;
  },
  float32Analytic: true,
});
try {
  const input = join(scratch, "vectors.json");
  writeFileSync(input, JSON.stringify(vectors));
  const binary =
    process.env.SCALAR_NATIVE ?? join(root, "helpers/mac/.build/debug/ScreenRecorderScalarTests");
  const result = spawnSync(binary, [input], { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr || String(result.error));
  const native = JSON.parse(result.stdout);
  let maxDelta = 0,
    samples = 0;
  for (const [index, vector] of vectors.entries()) {
    assert.equal(native[index].length, vector.frames.length);
    for (const [at, frame] of vector.frames.entries()) {
      const expected = sampleScalarSamples(vector.program, frame),
        actual = native[index][at];
      assert.equal(
        Math.fround(actual),
        Math.fround(expected),
        `${vector.name} frame ${frame} Float32 parity`,
      );
      maxDelta = Math.max(maxDelta, Math.abs(actual - expected));
      if (vector.float32Analytic)
        assert.equal(
          Math.fround(actual),
          Math.fround(vector.analytic(frame)),
          `${vector.name} analytic Float32`,
        );
      else if (vector.analytic)
        assert.ok(
          Math.abs(actual - vector.analytic(frame)) <= 1e-10,
          `${vector.name} frame ${frame}: ${actual} vs analytic ${vector.analytic(frame)}`,
        );
      samples++;
    }
  }
  for (const mutation of [
    (p) => {
      p.pieces[0].end = p.pieces[0].start;
    },
    (p) => {
      p.pieces[0].kernel.time = [1];
    },
    (p) => {
      p.pieces[0].offset = null;
    },
  ]) {
    const broken = JSON.parse(JSON.stringify(vectors[0]));
    mutation(broken.program);
    writeFileSync(input, JSON.stringify([broken]));
    const rejected = spawnSync(binary, [input], { encoding: "utf8" });
    assert.equal(rejected.status, 1, "Malformed program must be refused before evaluation");
  }
  console.log(
    JSON.stringify({
      vectors: vectors.length,
      samples,
      maxFloat64Delta: maxDelta,
      float32Parity: true,
      analyticTolerance: 1e-10,
    }),
  );
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
