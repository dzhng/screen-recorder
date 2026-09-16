import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const executable =
  process.env.SCREENREC_NATIVE ??
  new URL("../.build/debug/screenrec-native", import.meta.url).pathname;
function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), "screenrec-visual-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const source = join(directory, "source.mov");
  const generated = spawnSync(
    "ffmpeg",
    [
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "color=c=red:size=160x90:rate=10:duration=11",
      "-an",
      "-c:v",
      "libx264",
      source,
    ],
    { encoding: "utf8", timeout: 15_000 },
  );
  assert.equal(generated.status, 0, generated.stderr);
  return { directory, source, kept: { startUs: 0, endUs: 11_000_000 } };
}
function request(params, timed = false) {
  const run = spawnSync(timed ? "/usr/bin/time" : executable, timed ? ["-l", executable] : [], {
    input: JSON.stringify({ id: "visual", operation: "media.visualSamples", params }) + "\n",
    encoding: "utf8",
    timeout: 30_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  assert.equal(run.status, 0, run.stderr);
  return { response: JSON.parse(run.stdout), bytes: run.stdout.length, stats: run.stderr };
}

test("visual samples return bounded clean sRGB pixels without derivatives or source mutation", (t) => {
  const f = fixture(t);
  const before = readFileSync(f.source);
  const start = performance.now();
  const result = request(
    {
      source: f.source,
      kept: f.kept,
      atSourceUs: Array.from({ length: 52 }, (_, i) => i * 200_000),
    },
    true,
  );
  const elapsedMs = performance.now() - start;
  assert.equal(result.response.ok, true, JSON.stringify(result.response));
  const data = result.response.data;
  assert.equal(data.sourceWidth, 160);
  assert.equal(data.sourceHeight, 90);
  assert.equal(data.samples.length, 52);
  for (const [i, sample] of data.samples.entries()) {
    assert.equal(sample.requestedSourceUs, i * 200_000);
    assert.equal(sample.actualSourceUs, i * 200_000);
    assert.equal(sample.distanceUs, 0);
    assert.equal(sample.width, 64);
    assert.equal(sample.height, 36);
    const rgb = Buffer.from(sample.rgbBase64, "base64");
    assert.equal(rgb.length, 64 * 36 * 3);
    assert.ok(rgb[0] > 220 && rgb[1] < 60 && rgb[2] < 40, `sRGB red ${rgb.subarray(0, 3)}`);
  }
  const rss = Number(result.stats.match(/(\d+)\s+maximum resident set size/)[1]);
  assert.ok(rss < 256 * 1024 * 1024, `peak RSS ${rss}`);
  assert.ok(elapsedMs < 30_000);
  assert.ok(result.bytes < 8 * 1024 * 1024);
  t.diagnostic(
    `52 samples: ${elapsedMs.toFixed(1)}ms, ${rss} peak RSS bytes, ${result.bytes} response bytes`,
  );
  assert.deepEqual(readFileSync(f.source), before);
  assert.deepEqual(readdirSync(f.directory), ["source.mov"]);
});

test("visual samples reject malformed shapes, timestamps and missing kept samples", (t) => {
  const f = fixture(t);
  const params = { source: f.source, kept: f.kept, atSourceUs: [150_000] };
  for (const changed of [
    { ...params, atSourceUs: [] },
    { ...params, atSourceUs: [2, 1] },
    { ...params, atSourceUs: [1, 1] },
    { ...params, atSourceUs: [-1] },
    { ...params, atSourceUs: [9_007_199_254_740_992] },
    { ...params, atSourceUs: [0, 10_200_001] },
    { ...params, atSourceUs: Array.from({ length: 53 }, (_, i) => i) },
    { ...params, kept: { startUs: 1, endUs: 1 } },
  ])
    assert.equal(request(changed).response.error.code, "INVALID_RANGE");
  for (const changed of [
    { ...params, overlay: {} },
    { ...params, crop: {} },
    { ...params, output: f.source },
    { ...params, atSourceUs: [true] },
    { ...params, atSourceUs: [1.5] },
    { ...params, source: "relative" },
    { ...params, source: f.source + "\0" },
    { ...params, kept: { ...f.kept, extra: 1 } },
  ])
    assert.equal(request(changed).response.error.code, "INVALID_REQUEST");
  const held = request({
    ...params,
    atSourceUs: [150_000, 195_000],
    kept: { startUs: 0, endUs: 200_000 },
  }).response;
  assert.equal(held.ok, true);
  assert.deepEqual(
    held.data.samples.map((s) => s.actualSourceUs),
    [100_000, 100_000],
  );
  assert.equal(
    request({ ...params, kept: { startUs: 110_000, endUs: 190_000 } }).response.error.code,
    "UNAVAILABLE",
  );
});
