import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
const native =
  process.env.SCREENREC_NATIVE ??
  fileURLToPath(new URL("../.build/debug/screenrec-native", import.meta.url));
function run(file, args, options = {}) {
  const result = spawnSync(file, args, { timeout: 30000, ...options });
  assert.equal(result.status, 0, String(result.stderr || result.error));
  return result.stdout;
}
test("selected source pictures preserve explicit streams, physical sample clocks and excluded support", () => {
  const dir =
    process.env.SCREENREC_SOURCE_FRAME_EVIDENCE ?? mkdtempSync(join(tmpdir(), "source-frame-"));
  mkdirSync(dir, { recursive: true });
  try {
    for (const [name, color, box] of [
      ["first", "red", "blue"],
      ["second", "green", "yellow"],
    ]) {
      run("ffmpeg", [
        "-v",
        "error",
        "-nostdin",
        "-f",
        "lavfi",
        "-i",
        `color=c=${color}:s=64x48:r=10:d=1,drawbox=x=0:y=0:w=12:h=24:color=${box}:t=fill`,
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-color_primaries",
        "bt709",
        "-color_trc",
        "bt709",
        "-colorspace",
        "bt709",
        join(dir, `${name}.mov`),
      ]);
    }
    const fixture = join(dir, "fixture");
    run("swiftc", [
      "-parse-as-library",
      fileURLToPath(new URL("SourceFrame/fixture.swift", import.meta.url)),
      "-o",
      fixture,
    ]);
    const source = join(dir, "source.mov");
    run(fixture, [join(dir, "first.mov"), join(dir, "second.mov"), source]);
    const hash = () => createHash("sha256").update(readFileSync(source)).digest("hex");
    const before = hash();
    let ordinal = 0;
    const trace = [];
    const call = (changes = {}) => {
      const params = {
        asset: { assetId: before, streamId: "track:1", path: source, originUs: 1250000 },
        available: [{ startUs: 0, endUs: 1000000 }],
        atUs: 150000,
        output: join(dir, `frame-${ordinal++}.png`),
        ...changes,
      };
      const reply = JSON.parse(
        run(native, [], {
          input:
            JSON.stringify({ id: "source-frame", operation: "media.sourceFrame", params }) + "\n",
          encoding: "utf8",
        }),
      );
      trace.push({ params, reply });
      if (process.env.SCREENREC_SOURCE_FRAME_EVIDENCE)
        writeFileSync(join(dir, "requests.json"), JSON.stringify(trace, null, 2));
      return { params, reply };
    };
    const first = call();
    assert.equal(first.reply.ok, true, JSON.stringify(first.reply));
    const value = first.reply.data;
    assert.equal(value.streamId, "track:1");
    assert.equal(value.actualSourceUs, 100000);
    assert.equal(value.requestedSourceUs, 150000);
    assert.equal(BigInt(value.sample.value) * 1000000n, 1350000n * BigInt(value.sample.timescale));
    assert.equal(
      BigInt(value.sample.endValue) * 1000000n,
      1450000n * BigInt(value.sample.endTimescale),
    );
    assert.equal(value.sample.originUs, 1250000);
    assert.ok(value.decodedSamples > 0 && value.decodedSamples <= 2);
    assert.equal(value.bytes, readFileSync(value.file).length);
    const merged = call({ available: [{ startUs: 0, endUs: 850000 }] });
    const touching = call({
      available: [
        { startUs: 0, endUs: 150000 },
        { startUs: 150000, endUs: 850000 },
      ],
    });
    assert.equal(merged.reply.ok, true, JSON.stringify(merged.reply));
    assert.equal(touching.reply.ok, true, JSON.stringify(touching.reply));
    const { file: mergedFile, ...mergedReceipt } = merged.reply.data;
    const { file: touchingFile, ...touchingReceipt } = touching.reply.data;
    assert.deepEqual(touchingReceipt, mergedReceipt);
    assert.deepEqual(readFileSync(touchingFile), readFileSync(mergedFile));
    const second = call({ asset: { ...first.params.asset, streamId: "track:2" } });
    assert.equal(second.reply.ok, true, JSON.stringify(second.reply));
    const pixels = (file) =>
      run("ffmpeg", ["-v", "error", "-i", file, "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"]);
    const rgb1 = pixels(value.file),
      rgb2 = pixels(second.reply.data.file);
    const middle = (24 * 64 + 32) * 3,
      left = (12 * 64 + 3) * 3;
    assert.ok(rgb1[middle] > rgb1[middle + 1] + 100);
    assert.ok(rgb1[left + 2] > rgb1[left] + 100);
    assert.ok(rgb2[middle + 1] > rgb2[middle] + 50);
    assert.ok(rgb2[left] > 150 && rgb2[left + 1] > 150);
    const lowerLeft = (36 * 64 + 3) * 3;
    assert.ok(rgb1[lowerLeft] > rgb1[lowerLeft + 2] + 100);
    assert.ok(rgb2[lowerLeft + 1] > rgb2[lowerLeft] + 50);
    for (const changes of [
      { atUs: 450000 }, // The caller cannot turn a physical empty edit into a picture.
      { available: [{ startUs: 600000, endUs: 1000000 }] },
      { asset: { ...first.params.asset, streamId: "track:999" } },
    ]) {
      const failed = call(changes);
      assert.equal(failed.reply.ok, false);
      assert.equal(failed.reply.error.code, "UNAVAILABLE");
      assert.equal(existsSync(failed.params.output), false);
    }
    const late = call({ atUs: 950000, maxLongEdge: 32 });
    assert.equal(late.reply.ok, true, JSON.stringify(late.reply));
    assert.equal(late.reply.data.actualSourceUs, 900000);
    assert.equal(late.reply.data.width, 32);
    assert.equal(late.reply.data.height, 24);
    assert.ok(late.reply.data.decodedSamples <= 2);
    assert.equal(hash(), before);
  } finally {
    if (!process.env.SCREENREC_SOURCE_FRAME_EVIDENCE) rmSync(dir, { recursive: true, force: true });
  }
});
