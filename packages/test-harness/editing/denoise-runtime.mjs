import { createDenoiseReference } from "./denoise-reference.mjs";
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
  scope: "linked fixed recipe with independent output channels; no listening acceptance",
  checks: [],
  nativeSha256: hash(readFileSync(worker)),
  harnessSha256: hash(readFileSync(import.meta.filename)),
  referenceSha256: hash(readFileSync(reference)),
};
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
const denoise = createDenoiseReference(reference, out);
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
  readFileSync(root + "/specs/done/agent-editing/assets/12c-matched-noise/audio/mixture.f32.gz"),
);
const expected = gunzipSync(
  readFileSync(root + "/specs/done/agent-editing/assets/12c-matched-noise/audio/rnnoise-mixture.f32.gz"),
);
function sourceFixture(name, pcm, channels = 1) {
  const path = join(out, name + ".wav"),
    header = Buffer.alloc(44);
  header.write("RIFF");
  header.writeUInt32LE(pcm.length + 36, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(3, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(48000, 24);
  header.writeUInt32LE(48000 * channels * 4, 28);
  header.writeUInt16LE(channels * 4, 32);
  header.writeUInt16LE(32, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  writeFileSync(path, Buffer.concat([header, pcm]));
  const metadata = native("media.probe", { path }),
    stream = metadata.streams.find((s) => s.kind === "audio");
  const range = { startUs: stream.startUs, endUs: stream.endUs };
  return {
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
}
const initial = sourceFixture("source", source),
  asset = initial.asset,
  stream = asset.streams[0];
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
function renderPCM(
  name,
  document,
  range,
  fixture = initial,
  tap = { target: { kind: "output" }, point: { kind: "processed" } },
) {
  const w = createCompiler(validateComposition(document, [fixture.asset]), name).audioWindow({
    range,
    rendition: { sampleRate: 48000, channels: 2 },
    tap,
  });
  const state = w.audioState();
  const params = {
    output: out + "/" + name + ".wav",
    range: w.manifest.sampleRange,
    clips: [...w.audio()],
    processing: w.processing(),
    ...(state ? { state: { ...state, implementationId: identity } } : {}),
    assets: [fixture.binding],
  };
  writeFileSync(out + "/" + name + "-request.json", JSON.stringify(params, null, 2));
  native("media.mixCompositionAudio", params);
  const wav = readFileSync(params.output);
  let at = 12;
  while (wav.toString("ascii", at, at + 4) !== "data")
    at += 8 + wav.readUInt32LE(at + 4) + (wav.readUInt32LE(at + 4) % 2);
  const bytes = wav.subarray(at + 8, at + 8 + wav.readUInt32LE(at + 4));
  return bytes;
}
function render(...args) {
  const bytes = renderPCM(...args),
    mono = Buffer.alloc(bytes.length / 2);
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

function refuse(name, change, code, message) {
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
  if (message) assert(response.error.message.includes(message), response.error.message);
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
      readFileSync(root + "/specs/done/agent-editing/assets/" + directory + "/" + kind + ".f32.gz"),
    );
    const expected = gunzipSync(
      readFileSync(
        root + "/specs/done/agent-editing/assets/" + directory + "/rnnoise-" + kind + ".f32.gz",
      ),
    );
    const name = cohort + "-" + kind;
    const fixture = sourceFixture(name + "-source", pcm);
    const range = { startUs: 0, endUs: (pcm.length / 4 / 48000) * 1000000 };
    const document = structuredClone(doc);
    document.clips[0].streamId = fixture.binding.streamId;
    document.clips[0].source.range = range;
    document.clips[0].placement.range = range;
    compare(name + "-frozen", render(name, document, range, fixture), expected);
  }
}
const selectedWindow = structuredClone(doc);
selectedWindow.processing[0].steps[0].window = {
  kind: "project",
  range: { startUs: 1000000, endUs: 3000000 },
};
const poisoned = Buffer.from(source);
for (let frame = 0; frame < poisoned.length / 4; frame++)
  if (frame < 48000 || frame >= 144000) poisoned.writeFloatLE(frame % 2 ? 0.9 : -0.9, frame * 4);
const poisonedFixture = sourceFixture("poisoned", poisoned);
const selected = { startUs: 1000000, endUs: 3000000 };
const selectedPCM = render("selected-window", selectedWindow, selected);
compare(
  "selected-input-poison-isolation",
  render("poison-window", selectedWindow, selected, poisonedFixture),
  selectedPCM,
);
compare(
  "selected-input-reference",
  selectedPCM,
  denoise("selected-window", source.subarray(48000 * 4, 144000 * 4)),
);
compare(
  "full-asset-before-selection-negative",
  denoise("whole-poison", poisoned).subarray(48000 * 4, 144000 * 4),
  selectedPCM,
  false,
);
const touching = structuredClone(
  applyBatch(doc, [{ operation: "split", clipIds: ["c"], atUs: 2000001, scope: "selected" }], {
    assets: [asset],
    namespace: "touching",
  }).document,
);
touching.processing[0].steps[0].window = { kind: "project", range: { startUs: 0, endUs: 2000000 } };
touching.processing[1].steps[0].window = {
  kind: "project",
  range: { startUs: 2000001, endUs: 5000000 },
};
const disconnected = Buffer.concat([
  denoise("touching-first", source.subarray(0, 96000 * 4)),
  denoise("touching-second", source.subarray(96000 * 4)),
]);
compare(
  "exact-disconnected-sample-touching",
  render("touching-components", touching, range),
  disconnected,
);
compare("concatenated-state-negative", disconnected, full, false);
const mixed = structuredClone(doc);
mixed.groups = [{ id: "bus", kind: "audio", order: 0 }];
mixed.tracks[0].parentId = "bus";
mixed.tracks.push({ id: "second", kind: "audio", order: 1, parentId: "bus" });
mixed.clips.push({
  ...structuredClone(mixed.clips[0]),
  id: "secondClip",
  trackId: "second",
  source: { kind: "range", range: { startUs: 0, endUs: 2000000 } },
  placement: { kind: "project", range: { startUs: 2000000, endUs: 4000000 } },
});
mixed.processing = [
  {
    target: { kind: "group", id: "bus" },
    steps: [{ id: "mixedNoise", enabled: true, processor: { type: "rnnoise" } }],
  },
];
const mixedDry = structuredClone(mixed);
mixedDry.processing[0].steps[0].enabled = false;
const upstreamMix = render("overlap-upstream", mixedDry, range);
const processedMix = render("overlap-group", mixed, range);
compare("overlap-group-input", processedMix, denoise("overlap-upstream", upstreamMix));
const perClip = structuredClone(mixed);
perClip.processing = perClip.clips.map((clip) => ({
  target: { kind: "clip", id: clip.id },
  steps: [{ id: "noise-" + clip.id, enabled: true, processor: { type: "rnnoise" } }],
}));
compare(
  "process-before-mix-negative",
  render("per-clip-overlap", perClip, range),
  processedMix,
  false,
);
const automated = structuredClone(selectedWindow);
const automation = {
  id: "automation",
  enabled: true,
  window: { kind: "project", range: selected },
  processor: {
    type: "gain",
    gain: {
      keys: [
        { at: 1000000, value: 0.25, interpolation: "linear" },
        { at: 3000000, value: 1.25, interpolation: "linear" },
      ],
    },
  },
};
automated.processing[0].steps.unshift(automation);
const automationDry = structuredClone(automated);
automationDry.processing[0].steps[1].enabled = false;
const automatedPrefix = render("automation-prefix", automationDry, range);
const automatedExpected = Buffer.from(source);
denoise("automation-prefix", automatedPrefix.subarray(48000 * 4, 144000 * 4)).copy(
  automatedExpected,
  48000 * 4,
);
const automatedOutput = render("automation-before", automated, range);
compare("automation-before-state", automatedOutput, automatedExpected);
const automatedAfter = structuredClone(automated);
automatedAfter.processing[0].steps.reverse();
const selectedFull = render("window-full", selectedWindow, range),
  selectedFixture = sourceFixture("selected-processed", selectedFull);
compare(
  "automation-after-state",
  render("automation-after", automatedAfter, range),
  render("automation-after-oracle", automationDry, range, selectedFixture),
);
compare(
  "automation-order-negative",
  render("automation-after-negative", automatedAfter, range),
  automatedOutput,
  false,
);
compare(
  "automation-dry-prefix",
  automatedOutput.subarray(0, 48000 * 4),
  source.subarray(0, 48000 * 4),
);
compare("automation-dry-tail", automatedOutput.subarray(144000 * 4), source.subarray(144000 * 4));
const rightChannel = gunzipSync(
  readFileSync(root + "/specs/done/agent-editing/assets/12c-matched-noise/audio/reference.f32.gz"),
);
assert.equal(rightChannel.length, source.length);
const stereo = Buffer.alloc(source.length * 2);
for (let frame = 0; frame < source.length / 4; frame++) {
  source.copy(stereo, frame * 8, frame * 4, frame * 4 + 4);
  rightChannel.copy(stereo, frame * 8 + 4, frame * 4, frame * 4 + 4);
}
const stereoFixture = sourceFixture("differing-stereo", stereo, 2);
assert.equal(stereoFixture.asset.streams[0].channels, 2);
refuse(
  "actual-stereo-false-mono-provenance",
  (p) => {
    p.assets = [stereoFixture.binding];
  },
  "NOT_READY",
);
const rightExpected = gunzipSync(
  readFileSync(
    root + "/specs/done/agent-editing/assets/12c-matched-noise/audio/rnnoise-reference.f32.gz",
  ),
);
function interleave(left, right) {
  assert.equal(left.length, right.length);
  const result = Buffer.alloc(left.length * 2);
  for (let frame = 0; frame < left.length / 4; frame++) {
    left.copy(result, frame * 8, frame * 4, frame * 4 + 4);
    right.copy(result, frame * 8 + 4, frame * 4, frame * 4 + 4);
  }
  return result;
}
const stereoExpected = interleave(expected, rightExpected);
compare(
  "matching-stereo-independent-reference",
  renderPCM("matching-stereo", doc, range, stereoFixture),
  stereoExpected,
);
const swappedFixture = sourceFixture("swapped-stereo", interleave(rightChannel, source), 2);
compare(
  "independent-channel-order",
  renderPCM("swapped-stereo-output", doc, range, swappedFixture),
  interleave(rightExpected, expected),
);
const changedRight = gain(rightChannel, 0.5),
  changedFixture = sourceFixture("changed-right-stereo", interleave(source, changedRight), 2);
compare(
  "right-perturbation-no-left-crosstalk",
  renderPCM("changed-right-output", doc, range, changedFixture),
  interleave(expected, denoise("changed-right", changedRight)),
);
compare(
  "stereo-range-full",
  renderPCM("stereo-range", doc, selected, stereoFixture),
  stereoExpected.subarray(48000 * 8, 144000 * 8),
);
compare(
  "stereo-shared-split",
  renderPCM("stereo-split", split, range, stereoFixture),
  stereoExpected,
);
const stereoWindowExpected = Buffer.from(stereo);
interleave(
  denoise("window-left", source.subarray(48000 * 4, 144000 * 4)),
  denoise("window-right", rightChannel.subarray(48000 * 4, 144000 * 4)),
).copy(stereoWindowExpected, 48000 * 8);
compare(
  "stereo-window-dry-neighbors",
  renderPCM("stereo-window", selectedWindow, range, stereoFixture),
  stereoWindowExpected,
);
compare(
  "stereo-dependent-components",
  renderPCM("stereo-dependent", nested, range, stereoFixture),
  interleave(denoise("dependent-left", expected), denoise("dependent-right", rightExpected)),
);
const tailRange = { startUs: 0, endUs: 1001000 },
  tailDocument = structuredClone(doc);
tailDocument.clips[0].source.range = tailRange;
tailDocument.clips[0].placement.range = tailRange;
const tailLeft = source.subarray(0, 48048 * 4),
  tailRight = rightChannel.subarray(0, 48048 * 4),
  tailFixture = sourceFixture("stereo-tail", interleave(tailLeft, tailRight), 2);
compare(
  "stereo-partial-frame-tail",
  renderPCM("stereo-tail-output", tailDocument, tailRange, tailFixture),
  interleave(denoise("tail-left", tailLeft), denoise("tail-right", tailRight)),
);
refuse(
  "prior-mono-policy-identity",
  (p) => {
    p.state.implementationId =
      "rnnoise-70f1d256-d6021b7697677c4d2274c912975e143765552b0e6f25500aa660fdb4a9849be5-f480-s32768-flush2-delay960-v1";
  },
  "INVALID_REQUEST",
);
const quad = Buffer.alloc(source.length * 4);
for (let frame = 0; frame < source.length / 4; frame++)
  source.copy(quad, frame * 16, frame * 4, frame * 4 + 4);
const quadFixture = sourceFixture("four-channel", quad, 4);
assert.equal(quadFixture.asset.streams[0].channels, 4);
refuse(
  "physical-more-than-two-channels",
  (p) => {
    p.assets = [quadFixture.binding];
    p.state.formats[0].channels = 4;
  },
  "UNSUPPORTED_FORMAT",
);
const inverted = gain(source, -1),
  invertedExpected = gunzipSync(
    readFileSync(root + "/specs/done/agent-editing/assets/12c-channel-relations/inverted-output.f32.gz"),
  );
const invertedFixture = sourceFixture("opposite-polarity-stereo", interleave(source, inverted), 2);
compare(
  "opposite-polarity-no-downmix",
  renderPCM("opposite-polarity-output", doc, range, invertedFixture),
  interleave(expected, invertedExpected),
);
refuse(
  "active-reader-overlap-bound",
  (p) => {
    const clip = p.clips[0];
    delete p.state;
    p.clips = Array.from({ length: 257 }, (_, i) => ({
      ...clip,
      clipId: `c${i}`,
      trackId: `t${i}`,
    }));
    p.processing = [
      ...p.clips.map((c) => ({
        target: { kind: "clip", id: c.clipId },
        mediaKind: "audio",
        inputs: [],
        steps: [],
      })),
      ...p.clips.map((c) => ({
        target: { kind: "track", id: c.trackId },
        mediaKind: "audio",
        inputs: [{ kind: "clip", id: c.clipId }],
        steps: [],
      })),
      {
        target: { kind: "output" },
        mediaKind: "output",
        inputs: p.clips.map((c) => ({ kind: "track", id: c.trackId })),
        steps: [],
      },
    ];
  },
  "INVALID_REQUEST",
  "256 simultaneously active source occurrences",
);
report.identity = identity;
report.passed = true;
save();
console.log("PASS linked parity and state-domain comparisons");
