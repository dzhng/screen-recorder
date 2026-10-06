import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { hash, root, run } from "./source-evidence-fixture.mjs";

// Unequal corner landmarks make flips, source-domain crops and cover alignment observable.
function picture(width, height, presenter) {
  const bytes = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const light = presenter
        ? x >= 4 &&
          x < width - 4 &&
          y >= 4 &&
          y < height - 4 &&
          !(x >= width / 2 && y < height / 3) &&
          !(x < 8 && y >= height - 12)
        : (x >= 4 && x < 12 && y >= 4 && y < height - 4) ||
          (x >= 4 && x < width - 4 && y >= height - 12 && y < height - 4) ||
          (x >= width - 16 && x < width - 8 && y >= 4 && y < 12);
      const at = (y * width + x) * 3;
      bytes.fill(light ? 255 : 0, at, at + 3);
    }
  return bytes;
}
export const narrationSample = (frame, channel) =>
  (((frame * (channel ? 13 : 7)) % 127) - 63) / 4096;
function narration() {
  const frames = 48000,
    bytes = Buffer.alloc(44 + frames * 8);
  bytes.write("RIFF");
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write("WAVEfmt ", 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(3, 20);
  bytes.writeUInt16LE(2, 22);
  bytes.writeUInt32LE(48000, 24);
  bytes.writeUInt32LE(384000, 28);
  bytes.writeUInt16LE(8, 32);
  bytes.writeUInt16LE(32, 34);
  bytes.write("data", 36);
  bytes.writeUInt32LE(frames * 8, 40);
  for (let frame = 0; frame < frames; frame++)
    for (let channel = 0; channel < 2; channel++)
      bytes.writeFloatLE(narrationSample(frame, channel), 44 + frame * 8 + channel * 4);
  return bytes;
}
export async function prepareLayersFixture(home, out) {
  const directory = join(home, "authored-sources");
  await mkdir(directory, { recursive: true });
  const referenceTool = join(home, "frame-reference"),
    pixelTool = join(home, "frame-pixels");
  for (const [source, target] of [
    ["FrameColorReference.swift", referenceTool],
    ["FrameImagePixels.swift", pixelTool],
  ])
    await run(
      "swiftc",
      ["-parse-as-library", join(root, "packages/test-harness/editing", source), "-o", target],
      { timeout: 120000 },
    );
  async function referenceSource(name, path, width, height, raw) {
    const refs = join(out, `${name}-reference`);
    await mkdir(refs, { recursive: true });
    const request = join(home, `${name}-reference.json`);
    await writeFile(request, JSON.stringify({ movie: path, output: refs, timesUs: [0] }));
    const { stdout } = await run(referenceTool, [request], { timeout: 60000 });
    const reference = JSON.parse(stdout)[0],
      rgbaPath = join(refs, "source.rgba");
    assert.equal(reference.status, "available", reference.error);
    const normalized = JSON.parse((await run(pixelTool, [reference.file, rgbaPath])).stdout);
    assert.deepEqual([normalized.width, normalized.height], [width, height]);
    assert.equal(reference.sourceProfile, "kCGColorSpaceCoreMedia709");
    await writeFile(join(refs, "receipt.json"), JSON.stringify({ reference, normalized }, null, 2));
    const rgba = await readFile(rgbaPath);
    for (let pixel = 0; pixel < width * height; pixel++) {
      assert.equal(rgba[pixel * 4 + 3], 255);
      for (let channel = 0; channel < 3; channel++)
        assert.ok(
          Math.abs(rgba[pixel * 4 + channel] - raw[pixel * 3 + channel]) <= 2,
          "Encoded source lost the independently authored black/white landmark",
        );
    }
    return {
      path,
      width,
      height,
      sha256: hash(await readFile(path)),
      reference,
      normalized,
      rgba,
      encodedProfile: "corevideo709",
    };
  }
  const media = {};
  for (const [name, width, height, presenter] of [
    ["screen", 64, 48, false],
    ["presenter", 24, 40, true],
    ["plate", 16, 16, false],
  ]) {
    const raw =
        name === "plate"
          ? Buffer.alloc(width * height * 3, 255)
          : picture(width, height, presenter),
      input = join(directory, `${name}.rgb`),
      path = join(directory, `${name}.mov`);
    await writeFile(input, Buffer.concat(Array.from({ length: 10 }, () => raw)));
    await run(
      "ffmpeg",
      [
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
        "-pix_fmt",
        "yuv420p",
        "-color_primaries",
        "bt709",
        "-color_trc",
        "bt709",
        "-colorspace",
        "bt709",
        path,
      ],
      { timeout: 60000 },
    );
    media[name] = await referenceSource(name, path, width, height, raw);
  }

  const orientationTool = join(home, "orientation-fixture"),
    rotated = join(directory, "rotated.mov");
  await run(
    "swiftc",
    [
      "-parse-as-library",
      join(root, "packages/test-harness/editing/layers-orientation.swift"),
      "-o",
      orientationTool,
    ],
    { timeout: 120000 },
  );
  await run(orientationTool, [media.screen.path, rotated]);
  const raw = picture(64, 48, false),
    turned = Buffer.alloc(raw.length);
  for (let y = 0; y < 48; y++)
    for (let x = 0; x < 64; x++)
      raw.copy(turned, (x * 48 + 47 - y) * 3, (y * 64 + x) * 3, (y * 64 + x + 1) * 3);
  media.rotated = await referenceSource("rotated", rotated, 48, 64, turned);
  const path = join(directory, "narration.wav"),
    bytes = narration();
  await writeFile(path, bytes);
  media.narration = { path, sha256: hash(bytes), pcm: bytes.subarray(44) };
  return { media, pixelTool, referenceTool };
}
