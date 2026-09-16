import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { join } from "node:path";
import { app, temporary, launchReady, socketPath } from "./harness.mjs";
import { callLocal } from "@screenrec/client";
import { createRevision, renderPlan } from "@screenrec/core/timeline";
const native = new URL("../../../helpers/mac/.build/debug/screenrec-native", import.meta.url)
  .pathname;
const evidence = process.env.SCREENREC_CAPTURE_RENDER_EVIDENCE;
function run(command, args, input) {
  const r = spawnSync(command, args, {
    input,
    encoding: "utf8",
    timeout: 30000,
    maxBuffer: 4 * 1024 * 1024,
  });
  assert.equal(r.error, undefined);
  assert.equal(r.status, 0, r.stderr);
  return r.stdout;
}
const hash = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");
// Optional native gate: records only the app-owned fixture window; neither audio role is enabled.
test(
  "actual paused silent window capture renders retained source timing",
  { timeout: 60000 },
  async () => {
    assert.equal(JSON.parse(run(app, ["--capture-preflight"])).screen, true);
    const home = temporary("/tmp/screenrec-render-capture-");
    const { instance } = await launchReady(home, { SCREENREC_FIXTURE_WINDOW: "1" });
    const [, id] = await instance.waitFor(/capture fixture window=(\d+)/);
    const call = async (operation, params = {}) => {
      const r = await callLocal(
        socketPath(home),
        { id: randomUUID(), operation, params },
        { timeoutMs: 30000 },
      );
      assert.equal(r.ok, true, JSON.stringify(r));
      return r.data;
    };
    const take = await call("capture.start", {
      requestId: randomUUID(),
      source: { kind: "window", windowId: Number(id) },
      microphone: false,
      systemAudio: false,
    });
    const ref = { recordingId: take.recordingId };
    await delay(1200);
    await call("capture.pause", ref);
    await delay(600);
    await call("capture.resume", ref);
    await delay(1200);
    const stopped = await call("capture.stop", ref);
    assert.equal(stopped.state, "complete");
    const { revision } = await call("revision.get", ref);
    const source = join(home, "recordings", take.recordingId, "source/video.mov");
    const before = hash(source);
    const end = stopped.sourceDurationUs;
    const spans = [
      { startUs: 10001, endUs: Math.floor(end / 3) },
      { startUs: Math.floor(end / 2) + 7, endUs: end - 10001 },
    ];
    const edited = createRevision(revision, spans, {
      id: "probe",
      operation: "cut",
      createdAt: "probe",
    });
    const output = join(home, "render.mp4");
    const plan = renderPlan(edited);
    const result = JSON.parse(
      run(
        native,
        [],
        JSON.stringify({
          id: "capture-render",
          operation: "media.renderVideo",
          params: { source, output, plan },
        }) + "\n",
      ),
    );

    assert.equal(result.ok, true, JSON.stringify(result));
    const metadata = JSON.parse(
      run("ffprobe", [
        "-v",
        "error",
        "-show_entries",
        "format=duration:stream=width,height,codec_type,nb_read_frames",
        "-count_frames",
        "-of",
        "json",
        output,
      ]),
    );
    run("ffmpeg", ["-v", "error", "-i", output, "-f", "null", "-"]);
    assert.equal(Math.round(Number(metadata.format.duration) * 1e6), plan.at(-1).playback.endUs);
    assert.equal(metadata.streams.length, 1);
    const video = metadata.streams[0];
    assert.equal(video.codec_type, "video");
    assert.ok(Number(video.nb_read_frames) > 0);
    assert.equal(Number(video.nb_read_frames), result.data.frameCount);
    assert.equal(video.width, result.data.width);
    assert.equal(video.height, result.data.height);
    assert.equal(hash(source), before);
    if (evidence)
      writeFileSync(
        evidence,
        JSON.stringify(
          { stopped, plan, result, metadata, sourceHash: before, sourceUnchanged: true },
          null,
          2,
        ) + "\n",
      );
  },
);
