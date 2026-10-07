import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { hash, run } from "./source-evidence-fixture.mjs";
import { prepareLayersFixture } from "./layers-fixture.mjs";

// Each frame has a different translated bar and binary code; unequal fixed corners reveal flips.
function picture(frame) {
  const bytes = Buffer.alloc(64 * 48 * 3);
  for (let y = 0; y < 48; y++)
    for (let x = 0; x < 64; x++) {
      const bit = Math.floor((x - 12) / 10);
      const white =
        (x >= 4 && x < 8 && y >= 4 && y < 40) ||
        (x >= 4 && x < 20 && y >= 36 && y < 40) ||
        (x >= 48 && x < 60 && y >= 4 && y < 8) ||
        (x >= 8 + frame * 4 && x < 12 + frame * 4 && y >= 24 && y < 34) ||
        (y >= 10 && y < 18 && bit >= 0 && bit < 4 && (x - 12) % 10 < 6 && (frame + 1) & (1 << bit));
      const at = (y * 64 + x) * 3;
      bytes.fill(white ? 255 : 0, at, at + 3);
    }
  return bytes;
}
export async function prepareMotionFixture(home, out) {
  const fixture = await prepareLayersFixture(home, out),
    width = 64,
    height = 48;
  const rawFrames = Array.from({ length: 10 }, (_, frame) => picture(frame));
  const input = join(home, "motion.rgb"),
    path = join(home, "motion.mov");
  await writeFile(input, Buffer.concat(rawFrames));
  await run("ffmpeg", [
    "-v",
    "error",
    "-nostdin",
    "-f",
    "rawvideo",
    "-pixel_format",
    "rgb24",
    "-video_size",
    `${width}x${height}`,
    "-framerate",
    "10",
    "-i",
    input,
    "-vf",
    "format=yuv420p,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709",
    "-c:v",
    "libx264",
    "-qp",
    "1",
    "-g",
    "1",
    "-pix_fmt",
    "yuv420p",
    "-color_primaries",
    "bt709",
    "-color_trc",
    "bt709",
    "-colorspace",
    "bt709",
    path,
  ]);
  const directory = join(out, "motion-source-reference");
  await mkdir(directory);
  const request = join(home, "motion-reference.json");
  await writeFile(
    request,
    JSON.stringify({
      movie: path,
      output: directory,
      timesUs: rawFrames.map((_, index) => index * 100000),
    }),
  );
  const references = JSON.parse((await run(fixture.referenceTool, [request])).stdout);
  const frames = [];
  for (const reference of references) {
    assert.equal(reference.status, "available", reference.error);
    const rgbaPath = reference.file + ".rgba";
    const normalized = JSON.parse(
      (await run(fixture.pixelTool, [reference.file, rgbaPath])).stdout,
    );
    assert.deepEqual([normalized.width, normalized.height], [width, height]);
    assert.equal(reference.sourceProfile, "kCGColorSpaceCoreMedia709");
    const rgba = await readFile(rgbaPath),
      raw = rawFrames[reference.index];
    for (let pixel = 0; pixel < width * height; pixel++) {
      assert.equal(rgba[pixel * 4 + 3], 255);
      for (let channel = 0; channel < 3; channel++)
        assert.ok(
          Math.abs(rgba[pixel * 4 + channel] - raw[pixel * 3 + channel]) <= 2,
          "Encoded motion landmark differs from authored source frame",
        );
    }
    frames.push({ width, height, rgba, encodedProfile: "corevideo709", reference });
  }
  assert.equal(new Set(frames.map((frame) => hash(frame.rgba))).size, 10);
  await writeFile(join(directory, "receipts.json"), JSON.stringify(references, null, 2));
  return { ...fixture, motion: { path, sha256: hash(await readFile(path)), frames } };
}
