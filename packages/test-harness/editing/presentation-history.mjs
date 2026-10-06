import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { PresentationEvidence } from "../../core/dist/presentation-evidence.js";
const out = resolve(process.argv[2] ?? "");
assert.ok(
  process.argv[2] && process.env.YAP_NATIVE && process.env.YAP_COMPOSITION_CANCEL_TEST,
);
await mkdir(out);
const run = (program, args, input) => {
  const result = spawnSync(program, args, { input, maxBuffer: 16 * 1024 * 1024, timeout: 60000 });
  assert.equal(result.status, 0, result.stderr.toString());
  return result.stdout;
};
const call = (native, params, operation = "media.presentationEvidence") =>
  JSON.parse(run(native, [], JSON.stringify({ id: "history", operation, params }) + "\n"));
for (const [name, size, color] of [
  ["first", "64x48", "black"],
  ["second", "32x24", "white"],
])
  run("ffmpeg", [
    "-v",
    "error",
    "-nostdin",
    "-f",
    "lavfi",
    "-i",
    `color=${color}:s=${size}:r=30:d=3`,
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    join(out, name + ".mov"),
  ]);
const author = join(out, "author");
run("swiftc", [
  "-parse-as-library",
  "packages/test-harness/editing/presentation-history.swift",
  "-o",
  author,
]);
const source = join(out, "multitrack.mov");
run(author, [join(out, "first.mov"), join(out, "second.mov"), source]);
const probe = call(process.env.YAP_NATIVE, { path: source }, "media.probe");
assert.ok(probe.ok, JSON.stringify(probe));
assert.equal(probe.data.originUs, 1_000_000);
assert.equal(probe.data.streams.length, 2);
const plan = (startUs, endUs) => [
  { source: { startUs, endUs }, playback: { startUs: 0, endUs: endUs - startUs } },
];
const legacy = { source, plan: plan(1_000_000, 4_000_000), maxBytes: 8 * 1024 ** 2 };
const old = process.env.YAP_BASELINE_NATIVE
  ? call(process.env.YAP_BASELINE_NATIVE, {
      ...legacy,
      output: join(out, "legacy-before.jsonl"),
    })
  : undefined;
const current = call(process.env.YAP_NATIVE, {
  ...legacy,
  output: join(out, "legacy-after.jsonl"),
});
assert.ok(current.ok, JSON.stringify(current));
if (old) {
  assert.ok(old.ok, JSON.stringify(old));
  assert.deepEqual(await readFile(old.data.file), await readFile(current.data.file));
}
const rows = [];
for (const offset of [0, 2_000_000, -1_000_000]) {
  const startUs = 2_000_000 - offset,
    endUs = 3_000_000 - offset;
  const request = {
    source,
    streamId: "track:2",
    clockOffsetUs: offset,
    plan: plan(startUs, endUs),
    maxBytes: 8 * 1024 ** 2,
    maxRecords: 1000,
    maxDecodedSamples: 1000,
    output: join(out, `selected-${offset}.jsonl`),
  };
  const result = call(process.env.YAP_NATIVE, request);
  assert.ok(result.ok, JSON.stringify(result));
  assert.equal(result.data.sourceWidth, 32);
  assert.equal(result.data.sourceHeight, 24);
  const evidence = await PresentationEvidence.open(
    result.data,
    [{ startUs, endUs }],
    new AbortController().signal,
  );
  try {
    const cursor = evidence.cursor(new AbortController().signal);
    const gap = await cursor.at(0, startUs + 500_000);
    assert.equal(gap.record.empty, true);
    const after = await cursor.at(0, startUs + 900_000);
    assert.equal(after.record.empty, false);
    assert.equal(
      BigInt(after.emptyThrough.value) * 3_000_000n,
      BigInt(8_000_000 - offset * 3) * BigInt(after.emptyThrough.timescale),
    );
    const direct = await evidence.cursor(new AbortController().signal).at(0, startUs + 900_000);
    assert.deepEqual(direct, after);
    assert.ok(
      Buffer.from(after.record.rgbBase64, "base64").every((value) => value >= 250),
      "Selected stream pixels came from wrong track",
    );
    rows.push({
      offset,
      startUs,
      endUs,
      gap: gap.record,
      emptyThrough: after.emptyThrough,
      records: result.data.records,
    });
  } finally {
    await evidence.close();
  }
}
for (const [name, limits] of [
  ["bytes", { maxBytes: 1 }],
  ["records", { maxRecords: 1 }],
  ["decode", { maxDecodedSamples: 1 }],
]) {
  const directory = join(out, name);
  await mkdir(directory);
  const response = call(process.env.YAP_NATIVE, {
    source,
    streamId: "track:2",
    clockOffsetUs: 2_000_000,
    plan: plan(0, 1_000_000),
    maxBytes: 8 * 1024 ** 2,
    ...limits,
    output: join(directory, "history.jsonl"),
  });
  assert.equal(response.error?.code, "LIMIT_EXCEEDED", JSON.stringify(response));
  assert.deepEqual(await readdir(directory), []);
  rows.push({ limit: name, error: response.error });
}
const precisionSource = join(out, "precision.mov");
run("ffmpeg", [
  "-v",
  "error",
  "-nostdin",
  "-f",
  "lavfi",
  "-i",
  "color=white:s=16x16:r=3003:d=0.003",
  "-c:v",
  "libx264",
  "-bf",
  "0",
  "-video_track_timescale",
  "3003",
  precisionSource,
]);
const precisionDirectory = join(out, "precision");
await mkdir(precisionDirectory);
const precision = call(process.env.YAP_NATIVE, {
  source: precisionSource,
  streamId: "track:1",
  clockOffsetUs: -1,
  plan: plan(1, 1001),
  maxBytes: 8 * 1024 ** 2,
  output: join(precisionDirectory, "history.jsonl"),
});
assert.equal(precision.error?.code, "UNAVAILABLE", JSON.stringify(precision));
assert.match(precision.error.message, /exact precision/);
assert.deepEqual(await readdir(precisionDirectory), []);
rows.push({ precisionRefusal: precision.error, unpublished: true });
const canceled = join(out, "canceled");
await mkdir(canceled);
const requestFile = join(out, "canceled-request.json");
await writeFile(
  requestFile,
  JSON.stringify({
    source,
    streamId: "track:2",
    clockOffsetUs: 2_000_000,
    plan: Array.from({ length: 10_000 }, (_, i) => ({
      source: { startUs: i * 2, endUs: i * 2 + 1 },
      playback: { startUs: i, endUs: i + 1 },
    })),
    maxBytes: 128 * 1024 ** 2,
    output: join(canceled, "history.jsonl"),
  }),
);
run(process.env.YAP_COMPOSITION_CANCEL_TEST, [requestFile, "media.presentationEvidence"]);
assert.deepEqual(await readdir(canceled), []);
rows.push({ cancellation: true, unpublished: true });
await writeFile(
  join(out, "report.json"),
  JSON.stringify(
    { passed: true, legacyBytesExact: old ? true : null, originUs: probe.data.originUs, rows },
    null,
    2,
  ),
);
console.log(JSON.stringify({ passed: true, out }));
