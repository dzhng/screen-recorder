import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";

const run = promisify(execFile);
const entry = new URL("./corpus-controls.mjs", import.meta.url).pathname;
const root = resolve(new URL("../../../", import.meta.url).pathname);
const controls = join(root, "specs/done/video-editing-feedback/assets/01-corpus-controls");
const reference = join(root, "specs/done/agent-editing/assets/00-corpus");

test("independent control verifier certifies canonical media and authored controls", async () => {
  const ffmpeg = (await run("which", ["ffmpeg"])).stdout.trim();
  const ffprobe = (await run("which", ["ffprobe"])).stdout.trim();
  const { stdout } = await run(process.execPath, [
    entry,
    "verify",
    "--controls",
    controls,
    "--reference-root",
    reference,
    "--ffmpeg",
    ffmpeg,
    "--ffprobe",
    ffprobe,
  ]);
  const report = JSON.parse(stdout);
  assert.equal(report.ok, true);
  assert.deepEqual(report.controls, [
    "rational-24fps-boundaries",
    "offset-and-drift",
    "unrelated-audio",
    "rotated-asymmetric-picture",
    "flat-and-transparent-patches",
    "clipping-edge-bars",
    "wrong-supplied-text",
    "blank-detection",
    "transition-gap",
  ]);
  assert.equal(report.mediaBytes, 594411);
});

test("control verifier refuses a changed authored oracle", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "yap-corpus-controls-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const manifest = JSON.parse(await readFile(join(controls, "manifest.json"), "utf8"));
  manifest.controls.find((control) => control.id === "wrong-supplied-text").expected = "matched";
  await writeFile(join(directory, "manifest.json"), JSON.stringify(manifest));
  const ffmpeg = (await run("which", ["ffmpeg"])).stdout.trim();
  const ffprobe = (await run("which", ["ffprobe"])).stdout.trim();
  await assert.rejects(
    run(process.execPath, [
      entry,
      "verify",
      "--controls",
      directory,
      "--reference-root",
      reference,
      "--ffmpeg",
      ffmpeg,
      "--ffprobe",
      ffprobe,
    ]),
    (error) => {
      assert.equal(JSON.parse(error.stdout).error.code, "CONTROL_CHANGED");
      return true;
    },
  );
});
