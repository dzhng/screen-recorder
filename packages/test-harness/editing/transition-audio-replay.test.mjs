import assert from "node:assert/strict";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { replayTransitionAudio } from "./transition-audio-replay.mjs";

const evidence = new URL(
  "../../../specs/done/video-editing-feedback/assets/27-29-transitions/crossfade/",
  import.meta.url,
).pathname;

test("replays retained native delivered audio crossfade evidence", async () => {
  const result = await replayTransitionAudio({
    reportPath: join(evidence, "report.json"),
    audioPath: join(evidence, "crossfade.wav"),
  });
  assert.equal(result.kind, "delivered-audio-transition");
  assert.equal(result.implementationId, "native-composition-audio-v10");
  assert.deepEqual(result.sampleFrames, [4800, 24000, 43200]);
  assert.equal(result.audioSha256, "6a469e107deea5b9c1571400b2d6570416389c10d33e3831627fa0381aa04fed");
});

test("refuses changed retained audio transition evidence", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "yap-transition-audio-replay-"));
  try {
    const reportPath = join(scratch, "report.json");
    const audioPath = join(scratch, "crossfade.wav");
    await copyFile(join(evidence, "report.json"), reportPath);
    await copyFile(join(evidence, "crossfade.wav"), audioPath);
    const report = JSON.parse(await readFile(reportPath, "utf8"));
    report.audio.samples["500000"].expected[0] += 1 / 32768;
    await writeFile(reportPath, JSON.stringify(report));
    await assert.rejects(
      () => replayTransitionAudio({ reportPath, audioPath }),
      /audio sample 500000 oracle changed/,
    );
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});
