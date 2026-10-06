import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../../", import.meta.url));
const args = process.argv.slice(2);
assert.equal(args[0], "--rendered");
assert.equal(args[2], "--out");
const rendered = resolve(args[1]),
  out = resolve(args[3]);
await mkdir(out, { recursive: true });
assert.deepEqual(await readdir(out), []);
const scratch = await mkdtemp(join(tmpdir(), "sr-profile-"));
const run = (command, args) => {
  const r = spawnSync(command, args, { timeout: 60000, maxBuffer: 32 * 1024 * 1024 });
  assert.ifError(r.error);
  assert.equal(r.status, 0, r.stderr.toString());
  return r.stdout;
};
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const cases = [
  "av-replacement",
  "audio-replacement",
  "nonzero-preview",
  "held-frame",
  "subframe-source",
  "vfr-held-tail",
  "empty-edit",
  "empty-edit-preview",
];
try {
  const code = join(root, "packages/test-harness/editing/RenderReproduction.swift");
  const timing = join(root, "helpers/mac/Sources/YapMedia/SampleTiming.swift");
  const binary = join(scratch, "reference");
  run("swiftc", ["-parse-as-library", timing, code, "-o", binary]);
  const results = [];
  for (const name of cases) {
    const directory = join(out, name);
    await mkdir(directory);
    const request = JSON.parse(
      await readFile(
        join(root, "specs/done/agent-editing/assets/06-platform-temporal", name, "request.json"),
      ),
    );
    Object.assign(request, {
      output: directory,
      outputProfile: "rec709",
      platformRate: true,
      audio: [],
    });
    for (const picture of request.pictures)
      picture.file = join(
        root,
        "specs/done/agent-editing/assets",
        basename(picture.file) === "timestamp-gap.mov" ? "00-corpus" : "06-platform-temporal",
        basename(picture.file),
      );
    const path = join(directory, "request.json");
    await writeFile(path, JSON.stringify(request, null, 2));
    const receipt = run(binary, ["bounded", path]);
    await writeFile(join(directory, "receipt.json"), receipt);
    const pixels = [join(directory, "bounded.mov"), join(rendered, name, "video.mp4")].map((file) =>
      run("ffmpeg", [
        "-v",
        "error",
        "-i",
        file,
        "-map",
        "0:v:0",
        "-fps_mode",
        "passthrough",
        "-pix_fmt",
        "rgb24",
        "-f",
        "rawvideo",
        "pipe:1",
      ]),
    );
    assert.deepEqual(pixels[1], pixels[0], `${name} differs from the matched Rec.709 reproduction`);
    results.push({ name, decodedPixelSHA256: digest(pixels[0]), decodedBytes: pixels[0].length });
  }
  await writeFile(
    join(out, "report.json"),
    JSON.stringify(
      {
        reproductionSourceSHA256: digest(await readFile(code)),
        sampleTimingSHA256: digest(await readFile(timing)),
        results,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ out, matchedCases: results.length, passed: true }));
} finally {
  await rm(scratch, { recursive: true, force: true });
}
