import assert from "node:assert/strict";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  createCompiler,
  validateComposition,
  resolveOutputSettings,
} from "../../composition/dist/index.js";
import {
  projectAudioRenderer,
  projectMovieRenderer,
} from "../../../apps/service/dist/project-render.js";
import { mediaWorker } from "../../../apps/service/dist/worker.js";
const { values } = parseArgs({ options: { out: { type: "string" } } });
assert(values.out && process.env.SCREENREC_NATIVE);
const out = resolve(values.out);
await mkdir(out, { recursive: false });
const report = { passed: false, requests: [], checks: {} };
const native = mediaWorker();
const worker = async (op, params, options) => {
  if (op.startsWith("media."))
    report.requests.push({
      op,
      keys: Object.keys(params),
      bytes: Buffer.byteLength(JSON.stringify(params)),
      planBytes: params.planFile ? (await readFile(params.planFile)).length : null,
    });
  return native(op, params, options);
};
let lastAudio;
for (const count of [1, 8000]) {
  const model = validateComposition(
    {
      canvas: {
        width: 16,
        height: 16,
        fps: { numerator: 30, denominator: 1 },
        background: "#000000ff",
      },
      tracks: [{ id: "audio", kind: "audio", order: 0 }],
      groups: [],
      syncGroups: [],
      clips: [
        {
          id: "silence",
          trackId: "audio",
          source: { kind: "silence" },
          placement: { kind: "project", range: { startUs: 0, endUs: 33334 } },
        },
      ],
      processing: [
        {
          target: { kind: "output" },
          steps: Array.from({ length: count }, (_, i) => ({
            id: "gain-" + "g".repeat(100) + i,
            enabled: true,
            processor: { type: "gain", gain: 1 },
          })),
        },
      ],
    },
    [],
  );
  const compiler = createCompiler(model, "r");
  const tap = { target: { kind: "output" }, point: { kind: "processed" } };
  const audio = compiler.audioWindow({
    range: { startUs: 0, endUs: 33334 },
    rendition: { sampleRate: 48000, channels: 2 },
    tap,
  });
  lastAudio = audio;
  await projectAudioRenderer(worker, out + "/workspace").render(
    { window: audio, assets: [], output: out + "/" + count + ".wav" },
    new AbortController().signal,
  );
  const window = compiler.window({
    range: { startUs: 0, endUs: 33334 },
    rendition: { sampleRate: 48000, channels: 2 },
    tap,
  });
  await projectMovieRenderer(worker, out + "/workspace").render(
    {
      window,
      model,
      assets: [],
      fonts: [],
      output: out + "/" + count + ".mp4",
      settings: resolveOutputSettings(),
    },
    new AbortController().signal,
  );
  assert.deepEqual(await readdir(out + "/workspace"), []);
}
assert.deepEqual(await readFile(out + "/1.wav"), await readFile(out + "/8000.wav"));
report.checks.audioExact = true;
function decoded(file, kind) {
  const args =
    kind === "video"
      ? ["-map", "0:v:0", "-f", "rawvideo", "-pix_fmt", "rgba"]
      : ["-map", "0:a:0", "-f", "f32le", "-c:a", "pcm_f32le"];
  const r = spawnSync("ffmpeg", ["-v", "error", "-nostdin", "-i", file, ...args, "pipe:1"]);
  assert.equal(r.status, 0, r.stderr.toString());
  return r.stdout;
}
for (const kind of ["audio", "video"])
  assert.deepEqual(decoded(out + "/1.mp4", kind), decoded(out + "/8000.mp4", kind));
report.checks.movieDecodedExact = true;
for (const mode of ["cancel", "invalid"]) {
  const controller = new AbortController();
  let reached = false;
  const interrupted = async (op, params, options) => {
    if (op === "media.mixCompositionAudio") {
      assert.equal(typeof params.planFile, "string");
      reached = true;
      if (mode === "cancel") controller.abort();
      else await writeFile(params.planFile, "{");
    }
    return native(op, params, options);
  };
  await assert.rejects(
    projectAudioRenderer(interrupted, out + "/workspace").render(
      { window: lastAudio, assets: [], output: out + "/" + mode + ".wav" },
      controller.signal,
    ),
    (error) => error.code === (mode === "cancel" ? "CANCELED" : "INVALID_REQUEST"),
  );
  assert(reached);
  assert.deepEqual(await readdir(out + "/workspace"), []);
  report.checks[mode + "Cleanup"] = true;
}
report.checks.workspaceEmpty = true;
report.passed = true;
report.nativeSHA256 = createHash("sha256")
  .update(await readFile(process.env.SCREENREC_NATIVE))
  .digest("hex");
await writeFile(out + "/report.json", JSON.stringify(report, null, 2));
