import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile, copyFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { replaySceneAudioDelivery } from "./scene-audio-delivery-replay.mjs";

const reportPath = new URL(
  "../../../specs/video-editing-feedback/assets/30-delivered-scenes/native/av/report.json",
  import.meta.url,
);

test("replays the retained combined scene/audio delivery", async () => {
  assert.deepEqual(await replaySceneAudioDelivery(reportPath), {
    kind: "delivered-av-scene-audio-report",
    sceneRows: [250000, 500000, 750000],
    audioFrames: 48000,
    crossPlaneAssociation: "refused",
  });
});

test("refuses changed combined export bytes", async () => {
  const directory = await mkdtemp("/tmp/yap-scene-audio-replay-");
  try {
    const report = JSON.parse(await readFile(reportPath, "utf8"));
    await copyFile(
      new URL(
        "../../../specs/video-editing-feedback/assets/30-delivered-scenes/native/av/combined.mp4",
        import.meta.url,
      ),
      join(directory, "combined.mp4"),
    );
    const bytes = await readFile(join(directory, "combined.mp4"));
    bytes[bytes.length - 1] ^= 1;
    await writeFile(join(directory, "combined.mp4"), bytes);
    await writeFile(
      join(directory, "delivered.wav"),
      await readFile(
        new URL(
          "../../../specs/video-editing-feedback/assets/30-delivered-scenes/native/av/delivered.wav",
          import.meta.url,
        ),
      ),
    );
    await writeFile(join(directory, "report.json"), JSON.stringify(report));
    await assert.rejects(
      () => replaySceneAudioDelivery(join(directory, "report.json")),
      /combined\.mp4 bytes changed/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
