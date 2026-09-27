import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const generator = fileURLToPath(new URL("./fixtures.mjs", import.meta.url));
const expected = JSON.parse(await readFile(new URL("./expected.json", import.meta.url), "utf8"));
const ffmpeg = process.env.FFMPEG ?? "ffmpeg";
const ffprobe = process.env.FFPROBE ?? "ffprobe";
function run(command, args) {
  const result = spawnSync(command, args, { maxBuffer: 32 * 1024 * 1024 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr.toString());
  return result.stdout;
}
function decode(file, format = "rgb24") {
  return run(ffmpeg, [
    "-v",
    "error",
    "-i",
    file,
    "-map",
    "0:v:0",
    "-fps_mode",
    "passthrough",
    "-pix_fmt",
    format,
    "-f",
    "rawvideo",
    "pipe:1",
  ]);
}
function presentation(file) {
  return JSON.parse(
    run(ffprobe, [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_frames",
      "-show_entries",
      "frame=best_effort_timestamp_time,duration_time",
      "-of",
      "json",
      file,
    ]),
  ).frames;
}
function pixel(bytes, width, height, frame, x, y) {
  const at = ((frame * height + y) * width + x) * 3;
  return [...bytes.subarray(at, at + 3)];
}
function closeColor(actual, wanted) {
  actual.forEach((value, channel) =>
    assert.ok(Math.abs(value - wanted[channel]) <= 4, `${actual} differs from ${wanted}`),
  );
}

test("corpus generation repeats bytes, exposes independent timing, and refuses tampered members", async (t) => {
  const temp = await mkdtemp(join(tmpdir(), "screenrec-corpus-test-"));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const first = join(temp, "first"),
    second = join(temp, "second");
  run(process.execPath, [generator, "--out", first]);
  run(process.execPath, [generator, "--out", second]);
  const manifest = JSON.parse(await readFile(join(first, "manifest.json"), "utf8"));
  assert.deepEqual(manifest, JSON.parse(await readFile(join(second, "manifest.json"), "utf8")));
  for (const asset of manifest.assets)
    assert.deepEqual(
      await readFile(join(first, asset.path)),
      await readFile(join(second, asset.path)),
      asset.path,
    );
  run(process.execPath, [generator, "--out", first, "--verify"]);
  assert.deepEqual(JSON.parse(await readFile(join(first, "expected.json"), "utf8")), expected);

  await t.test(
    "actual frame presentation and decoded markers match hand-specified source membership",
    () => {
      for (const [id, oracle] of Object.entries(expected.clips)) {
        const file = join(first, `${id}.mov`);
        const frames = presentation(file);
        const bytes = decode(file);
        assert.equal(bytes.length, oracle.frames * oracle.width * oracle.height * 3);
        const stream = manifest.assets.find((asset) => asset.path === `${id}.mov`).probe.streams[0];
        assert.deepEqual(
          [stream.width, stream.height, stream.r_frame_rate],
          [oracle.width, oracle.height, oracle.fps],
        );
        for (const query of expected.sourceMembership.filter((item) => item.clip === id)) {
          const index = frames.findIndex(
            (frame) =>
              query.atUs >= Math.round(Number(frame.best_effort_timestamp_time) * 1e6) &&
              query.atUs <
                Math.round(
                  (Number(frame.best_effort_timestamp_time) + Number(frame.duration_time)) * 1e6,
                ),
          );
          assert.equal(index < 0 ? null : index, query.frame, `${id} at ${query.atUs}`);
          if (index >= 0) {
            closeColor(pixel(bytes, oracle.width, oracle.height, index, oracle.width - 10, 10), [
              32 + query.frame * 16,
              id === "a" ? 40 : 100,
              id === "a" ? 120 : 30,
            ]);
            closeColor(pixel(bytes, oracle.width, oracle.height, index, 4, 4), [255, 0, 0]);
            closeColor(
              pixel(bytes, oracle.width, oracle.height, index, oracle.width - 4, oracle.height - 4),
              [0, 255, 80],
            );
          }
        }
      }
    },
  );
  await t.test(
    "independent audio preserves exact impulses, sample count and distinct tones",
    async () => {
      for (const [id, oracle] of Object.entries(expected.clips)) {
        const data = await readFile(join(first, `${id}-audio.wav`));
        assert.equal(data.length, 44 + 96000 * 2);
        const impulses = [];
        let upwardCrossings = 0;
        for (let sample = 0; sample < 96000; sample++) {
          const value = data.readInt16LE(44 + sample * 2);
          if (value > 20000) impulses.push(sample);
          // First 0.2 seconds contains no impulses in either manually specified fixture.
          if (sample > 0 && sample < 9600 && data.readInt16LE(42 + sample * 2) < 0 && value >= 0)
            upwardCrossings++;
        }
        assert.deepEqual(impulses, oracle.impulseSamples);
        assert.ok(Math.abs((upwardCrossings + 1) * 5 - oracle.toneHz) <= 5);
        const muxed = run(ffmpeg, [
          "-v",
          "error",
          "-i",
          join(first, `${id}.mov`),
          "-map",
          "0:a:0",
          "-f",
          "s16le",
          "pipe:1",
        ]);
        assert.deepEqual(muxed, data.subarray(44));
      }
    },
  );
  await t.test(
    "orientation, transparent pixels, odd geometry and absent streams survive encoding",
    () => {
      const rotated = manifest.assets.find((asset) => asset.path === "orientation.mov").probe
        .streams[0];
      assert.equal(rotated.side_data_list[0].rotation, 90);
      const raw = decode(join(first, "orientation.mov"));
      assert.equal(raw.length, 96 * 160 * 3 * 8);
      // A +90 degree display matrix rotates the top-left red landmark to bottom-left.
      closeColor(pixel(raw, 96, 160, 0, 4, 155), [255, 0, 0]);
      for (const [name, width, height] of [
        ["still-alpha.png", 47, 31],
        ["odd-canvas.png", 161, 97],
      ]) {
        const rgba = decode(join(first, name), "rgba");
        assert.equal(rgba.length, width * height * 4);
        assert.equal(rgba[3], 0);
        assert.equal(rgba[10 * 4 + 3], 128);
        assert.equal(rgba[30 * 4 + 3], 255);
      }
      assert.deepEqual(
        manifest.assets
          .find((asset) => asset.path === "video-only.mov")
          .probe.streams.map((stream) => stream.codec_type),
        ["video"],
      );
      assert.deepEqual(
        manifest.assets
          .find((asset) => asset.path === "a-audio.wav")
          .probe.streams.map((stream) => stream.codec_type),
        ["audio"],
      );
    },
  );
  await t.test(
    "timestamp gap is observable without claiming decoder hold is acquired content",
    () => {
      const frames = presentation(join(first, "timestamp-gap.mov"));
      assert.deepEqual(
        frames.map((frame) => Math.round(Number(frame.best_effort_timestamp_time) * 1e6)),
        expected.gap.framePtsUs,
      );
      assert.equal(Number(frames[1].duration_time), 0.75);
      assert.deepEqual(expected.gap.unavailable, [{ startUs: 500000, endUs: 1000000 }]);
      const bytes = decode(join(first, "timestamp-gap.mov"));
      closeColor(pixel(bytes, 160, 96, 2, 150, 10), [96, 40, 120]);
    },
  );
  const target = join(first, "a-audio.wav");
  const original = await readFile(target);
  const damaged = Buffer.from(original);
  damaged[44] ^= 1;
  await writeFile(target, damaged);
  const rejected = spawnSync(process.execPath, [generator, "--out", first, "--verify"]);
  assert.equal(rejected.status, 1);
  assert.match(rejected.stderr.toString(), /Hash mismatch: a-audio.wav/);
  await writeFile(target, original);
  run(process.execPath, [generator, "--out", first, "--verify"]);
});
