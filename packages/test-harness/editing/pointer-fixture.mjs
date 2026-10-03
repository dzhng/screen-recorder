import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export async function pointerFixture(home) {
  const donor = join(home, "donor");
  await mkdir(donor);
  await copyFile(
    new URL(
      "../../../specs/done/agent-editing/assets/06-pointer-writer/input/source.mov",
      import.meta.url,
    ),
    join(donor, "video.mov"),
  );
  const samples = Array.from({ length: 10 }, (_, i) => ({
    sourceUs: 100000 + i * 200000,
    x: 24 + i * 20,
    y: 48 + i * 4,
    globalX: 24 + i * 20,
    globalY: 48 + i * 4,
    buttons: 0,
    eligibility: "inside",
    geometryEpoch: 1,
  }));
  const records = [
    {
      event: "header",
      data: {
        schemaVersion: 1,
        sessionID: "authored-public-pointer",
        source: { kind: "window", windowID: 7 },
        width: 256,
        height: 160,
        microphone: false,
        systemAudio: false,
      },
    },
    { event: "origin", data: { hostUs: 1000000 } },
    {
      event: "geometry",
      data: {
        epoch: 1,
        hostUs: 1000000,
        sourceUs: 0,
        geometry: {
          outputWidth: 256,
          outputHeight: 160,
          contentScale: 1,
          scaleFactor: 1,
          contentRect: { x: 0, y: 0, width: 256, height: 160 },
        },
      },
    },
    { event: "cursorSamples", data: { samples } },
    { event: "finished", data: { state: "complete", durationUs: 2000000 } },
    { event: "lifecycle", data: { state: "complete" } },
  ];
  await writeFile(
    join(donor, "capture.journal.jsonl"),
    records.map((r, i) => JSON.stringify({ ...r, sequence: i + 1 }) + "\n").join(""),
  );
  return { donor, records };
}
