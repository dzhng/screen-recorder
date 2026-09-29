import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { resolve, join } from "node:path";
import { parseArgs } from "node:util";
const { values } = parseArgs({
  options: { out: { type: "string" }, reference: { type: "string" } },
});
assert(values.out && values.reference && process.env.SCREENREC_NATIVE);
const root = resolve(import.meta.dirname, "../../..");
const { createCompiler, validateComposition, applyBatch } = await import(
  root + "/packages/composition/dist/index.js"
);
const out = resolve(values.out);
mkdirSync(out);
const worker = resolve(process.env.SCREENREC_NATIVE);
const reference = resolve(values.reference);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const report = {
  scope: "linked fixed-recipe mono runtime; no listening acceptance",
  checks: [],
  nativeSha256: hash(readFileSync(worker)),
  harnessSha256: hash(readFileSync(import.meta.filename)),
  referenceSha256: hash(readFileSync(reference)),
};
assert.equal(
  report.referenceSha256,
  "697657e249b178c415d379511ba4041687055c7cf5d347af80a2d3a08cb6c5ee",
);
const save = () => writeFileSync(out + "/report.json", JSON.stringify(report, null, 2));
function compare(name, actual, expected, equal = true) {
  const result = {
    name,
    actual: hash(actual),
    expected: hash(expected),
    bytes: actual.length,
    equal: actual.equals(expected),
  };
  report.checks.push(result);
  save();
  assert.equal(result.equal, equal, name);
}
function denoise(name, pcm) {
  const inp = out + "/" + name + "-input.f32",
    raw = out + "/" + name + "-raw.f32";
  writeFileSync(inp, pcm);
  const r = spawnSync(reference, [inp, raw, "2"], { timeout: 30000 });
  assert.equal(r.status, 0, r.stderr?.toString());
  return readFileSync(raw).subarray(960 * 4, 960 * 4 + pcm.length);
}
let id = 0;
function native(operation, params) {
  const r = spawnSync(worker, [], {
    input: JSON.stringify({ id: String(++id), operation, params }) + "\n",
    encoding: "utf8",
    timeout: 30000,
  });
  assert.equal(r.status, 0, r.stderr);
  const result = JSON.parse(r.stdout);
  writeFileSync(out + `/response-${id}.json`, JSON.stringify(result, null, 2));
  assert(result.ok, JSON.stringify(result));
  return result.data;
}
const identity = native("media.audioCapabilities", {}).rnnoise;
const source = gunzipSync(
  readFileSync(root + "/specs/agent-editing/assets/12c-matched-noise/audio/mixture.f32.gz"),
);
const expected = gunzipSync(
  readFileSync(root + "/specs/agent-editing/assets/12c-matched-noise/audio/rnnoise-mixture.f32.gz"),
);
const header = Buffer.alloc(44);
header.write("RIFF");
header.writeUInt32LE(source.length + 36, 4);
header.write("WAVEfmt ", 8);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(3, 20);
header.writeUInt16LE(1, 22);
header.writeUInt32LE(48000, 24);
header.writeUInt32LE(192000, 28);
header.writeUInt16LE(4, 32);
header.writeUInt16LE(32, 34);
header.write("data", 36);
header.writeUInt32LE(source.length, 40);
writeFileSync(out + "/source.wav", Buffer.concat([header, source]));
const probe = native("media.probe", { path: out + "/source.wav" }),
  stream = probe.streams.find((s) => s.kind === "audio");
const asset = {
  id: "a",
  streams: [
    {
      id: stream.id,
      kind: "audio",
      sampleRate: stream.sampleRate,
      channels: stream.channels,
      bounds: { startUs: stream.startUs, endUs: stream.endUs },
      available: [{ startUs: stream.startUs, endUs: stream.endUs }],
    },
  ],
};
const duration = (source.length / 4 / 48000) * 1000000;
const range = { startUs: 0, endUs: duration };
const doc = {
  canvas: {
    width: 64,
    height: 64,
    fps: { numerator: 30, denominator: 1 },
    background: "#000000ff",
  },
  tracks: [{ id: "audio", kind: "audio", order: 0 }],
  groups: [],
  syncGroups: [],
  clips: [
    {
      id: "c",
      trackId: "audio",
      assetId: "a",
      streamId: stream.id,
      source: { kind: "range", range },
      placement: { kind: "project", range },
    },
  ],
  processing: [
    {
      target: { kind: "clip", id: "c" },
      steps: [{ id: "n", enabled: true, processor: { type: "rnnoise" } }],
    },
  ],
};
function render(
  name,
  document,
  range,
  fixture = {
    asset,
    binding: {
      assetId: "a",
      streamId: stream.id,
      path: out + "/source.wav",
      originUs: probe.originUs,
    },
  },
) {
  const w = createCompiler(validateComposition(document, [fixture.asset]), name).audioWindow({
    range,
    rendition: { sampleRate: 48000, channels: 2 },
    tap: { target: { kind: "output" }, point: { kind: "processed" } },
  });
  const params = {
    output: out + "/" + name + ".wav",
    range: w.manifest.sampleRange,
    clips: [...w.audio()],
    processing: w.processing(),
    state: { ...w.audioState(), implementationId: identity },
    assets: [fixture.binding],
  };
  writeFileSync(out + "/" + name + "-request.json", JSON.stringify(params, null, 2));
  native("media.mixCompositionAudio", params);
  const wav = readFileSync(params.output);
  let at = 12;
  while (wav.toString("ascii", at, at + 4) !== "data")
    at += 8 + wav.readUInt32LE(at + 4) + (wav.readUInt32LE(at + 4) % 2);
  const bytes = wav.subarray(at + 8, at + 8 + wav.readUInt32LE(at + 4));
  const mono = Buffer.alloc(bytes.length / 2);
  for (let i = 0; i < mono.length / 4; i++) {
    assert(bytes.subarray(i * 8, i * 8 + 4).equals(bytes.subarray(i * 8 + 4, i * 8 + 8)));
    bytes.copy(mono, i * 4, i * 8, i * 8 + 4);
  }
  return mono;
}
const full = render("full", doc, range);
compare("full-frozen-mixture", full, expected);
const part = render("range", doc, { startUs: 1000000, endUs: 3000000 });
compare("range-full", part, full.subarray(48000 * 4, 144000 * 4));
const split = applyBatch(
  doc,
  [{ operation: "split", clipIds: ["c"], atUs: 2000125, scope: "selected" }],
  { assets: [asset], namespace: "split" },
).document;
compare("pure-split", render("split", split, range), full);

const independent = structuredClone(split);
for (const stack of independent.processing) for (const step of stack.steps) delete step.stateKey;
compare("independent-reset-negative", render("independent", independent, range), full, false);
const trim = structuredClone(doc);
trim.clips[0].source.range = { startUs: 1000000, endUs: 3000000 };
trim.clips[0].placement.range = { startUs: 0, endUs: 2000000 };
compare(
  "trim-current-domain",
  render("trim", trim, { startUs: 0, endUs: 2000000 }),
  denoise("trim", source.subarray(48000 * 4, 144000 * 4)),
);
const gain = (bytes, value) => {
  const result = Buffer.alloc(bytes.length);
  for (let at = 0; at < bytes.length; at += 4)
    result.writeFloatLE(Math.fround(bytes.readFloatLE(at) * value), at);
  return result;
};
const before = structuredClone(doc);
before.processing[0].steps.unshift({
  id: "g",
  enabled: true,
  processor: { type: "gain", gain: 0.5 },
});
const after = structuredClone(doc);
after.processing[0].steps.push({ id: "g", enabled: true, processor: { type: "gain", gain: 0.5 } });
const pre = render("before", before, range),
  post = render("after", after, range);
compare("gain-before", pre, denoise("gain-before", gain(source, 0.5)));
compare("gain-after", post, gain(full, 0.5));
compare("gain-order-negative", pre, post, false);
const windowed = structuredClone(doc);
windowed.processing[0].steps[0].window = { kind: "project", range: { startUs: 1000, endUs: 3000 } };
const windowExpected = Buffer.from(source);
denoise("window", source.subarray(48 * 4, 144 * 4)).copy(windowExpected, 48 * 4);
compare("two-boundaries-and-resumed-decoder", render("window", windowed, range), windowExpected);
const different = structuredClone(split);
different.processing[1].steps.unshift({
  id: "rightGain",
  enabled: true,
  processor: { type: "gain", gain: 0.5 },
});
const prefix = Buffer.concat([
  source.subarray(0, 96006 * 4),
  gain(source.subarray(96006 * 4), 0.5),
]);
compare(
  "split-current-prefixes",
  render("different-prefix", different, range),
  denoise("different-prefix", prefix),
);
const nested = structuredClone(doc);
nested.processing[0].steps.push({ id: "second", enabled: true, processor: { type: "rnnoise" } });
compare("two-state-prefixes", render("nested", nested, range), denoise("nested", full));
const parent = structuredClone(doc);
parent.clips[0].source.range = { startUs: 0, endUs: 1000000 };
parent.clips[0].placement.range = { startUs: 0, endUs: 1000000 };
parent.clips.push({
  ...structuredClone(parent.clips[0]),
  id: "late",
  source: { kind: "range", range: { startUs: 2000000, endUs: 3000000 } },
  placement: { kind: "project", range: { startUs: 2000000, endUs: 3000000 } },
});
parent.processing = [
  {
    target: { kind: "track", id: "audio" },
    steps: [{ id: "parent", enabled: true, processor: { type: "rnnoise" } }],
  },
  {
    target: { kind: "output" },
    steps: [{ id: "post", enabled: true, processor: { type: "gain", gain: 2 } }],
  },
];
const gapPrefix = Buffer.concat([
  source.subarray(0, 48000 * 4),
  Buffer.alloc(48000 * 4),
  source.subarray(96000 * 4, 144000 * 4),
]);
const gapFull = gain(denoise("parent-gap", gapPrefix), 2);
compare("parent-gap", render("parent-gap", parent, { startUs: 0, endUs: 3000000 }), gapFull);
compare(
  "gap-only-routing",
  render("gap-only", parent, { startUs: 1000000, endUs: 2000000 }),
  gapFull.subarray(48000 * 4, 96000 * 4),
);

function refuse(name, change, code) {
  const params = JSON.parse(readFileSync(out + "/full-request.json"));
  params.output = out + "/" + name + ".wav";
  change(params);
  const request = { id: name, operation: "media.mixCompositionAudio", params };
  writeFileSync(out + "/" + name + "-request.json", JSON.stringify(request, null, 2));
  const r = spawnSync(worker, [], {
    input: JSON.stringify(request) + "\n",
    encoding: "utf8",
    timeout: 30000,
  });
  assert.equal(r.status, 0, r.stderr);
  const response = JSON.parse(r.stdout);
  writeFileSync(out + "/" + name + "-response.json", JSON.stringify(response, null, 2));
  assert.equal(response.ok, false);
  assert.equal(response.error.code, code);
  assert(!existsSync(params.output));
  report.checks.push({ name, refused: code, noPublishedFile: true });
  save();
}
refuse("wrong-identity", (p) => (p.state.implementationId = "unknown"), "INVALID_REQUEST");
refuse("unknown-format", (p) => (p.state.formats[0].channels = null), "NOT_READY");
refuse("changed-format", (p) => (p.state.formats[0].sampleRate = 44100), "NOT_READY");
refuse("missing-support", (p) => (p.state.clips[0].context = []), "NOT_READY");
refuse(
  "missing-activation",
  (p) => (p.state.processing[0].steps[0].processor.active = []),
  "INVALID_REQUEST",
);
refuse("dependency-cycle", (p) => (p.state.domains[0].dependencies = [0]), "INVALID_REQUEST");
const tiny = structuredClone(doc);
tiny.processing[0].steps[0].window = { kind: "project", range: { startUs: 1, endUs: 2 } };
compare("zero-sample-component", render("zero-sample", tiny, range), source);
for (const [cohort, directory] of [
  ["original", "12c-matched-noise/audio"],
  ["clean", "12c-clean-reference/native-level/audio"],
]) {
  for (const kind of ["reference", "noise", "mixture"]) {
    const pcm = gunzipSync(
      readFileSync(root + "/specs/agent-editing/assets/" + directory + "/" + kind + ".f32.gz"),
    );
    const expected = gunzipSync(
      readFileSync(
        root + "/specs/agent-editing/assets/" + directory + "/rnnoise-" + kind + ".f32.gz",
      ),
    );
    const name = cohort + "-" + kind,
      path = out + "/" + name + "-source.wav",
      h = Buffer.from(header);
    h.writeUInt32LE(pcm.length + 36, 4);
    h.writeUInt32LE(pcm.length, 40);
    writeFileSync(path, Buffer.concat([h, pcm]));
    const metadata = native("media.probe", { path }),
      stream = metadata.streams.find((s) => s.kind === "audio");
    const range = { startUs: 0, endUs: (pcm.length / 4 / 48000) * 1000000 };
    const fixture = {
      asset: {
        id: "a",
        streams: [
          {
            id: stream.id,
            kind: "audio",
            sampleRate: stream.sampleRate,
            channels: stream.channels,
            bounds: range,
            available: [range],
          },
        ],
      },
      binding: { assetId: "a", streamId: stream.id, path, originUs: metadata.originUs },
    };
    const document = structuredClone(doc);
    document.clips[0].streamId = stream.id;
    document.clips[0].source.range = range;
    document.clips[0].placement.range = range;
    compare(name + "-frozen", render(name, document, range, fixture), expected);
  }
}
report.identity = identity;
report.passed = true;
save();
console.log("PASS linked parity and state-domain comparisons");
