import assert from "node:assert/strict";
import { constants } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { mediaWorker, nativeResult } from "../../../apps/service/dist/worker.js";
import { root, run, hash } from "./source-evidence-fixture.mjs";

/** Synthetic journals around retained real media, plus the unchanged original capture journal. */
export async function captureFixtures(home, out) {
  const fixture = join(root, "fixtures/narrated-workbench");
  const native = mediaWorker();
  await mkdir(out, { recursive: true });
  await run(
    "swiftc",
    [
      "-parse-as-library",
      join(root, "packages/test-harness/editing/capture-video-fixture.swift"),
      "-o",
      join(out, "capture-video-fixture"),
    ],
    { timeout: 120000 },
  );
  const video = join(out, "offset-video.mov");
  await run(join(out, "capture-video-fixture"), [join(fixture, "video.mov"), video], {
    timeout: 120000,
  });
  const probe = nativeResult(await native("media.probe", { path: video }));
  await writeFile(join(out, "video-probe.json"), JSON.stringify(probe, null, 2) + "\n");
  const geometry = {
    outputWidth: 3120,
    outputHeight: 1970,
    contentScale: 1,
    scaleFactor: 2,
    contentRect: { x: 0, y: 0, width: 1560, height: 985 },
  };
  const samples = [250000, 300001, 550001, 1250000, 1500000, 1750000, 2000000, 2749999].map(
    (sourceUs, index) => ({
      sourceUs,
      globalX: 100 + index,
      globalY: 200 + index,
      x: 10 + index,
      y: 20 + index,
      buttons: index % 2,
      eligibility: index === 1 ? "outside" : "inside",
      geometryEpoch: 1,
    }),
  );
  const header = {
    schemaVersion: 1,
    sessionID: "synthetic-capture-evidence",
    source: { kind: "window", windowID: 7 },
    width: 3120,
    height: 1970,
    microphone: true,
    systemAudio: false,
  };
  const prefix = [
    { event: "header", data: header },
    { event: "origin", data: { hostUs: 1000000 } },
  ];
  const records = [
    ...prefix,
    { event: "geometry", data: { epoch: 1, hostUs: 1000000, sourceUs: 250000, geometry } },
    { event: "cursorSamples", data: { samples } },
    { event: "pausePlaced", data: { atSourceUs: 550001, elapsedPauseUs: 123456 } },
    { event: "pausePlaced", data: { atSourceUs: 1500000, elapsedPauseUs: 234567 } },
    { event: "geometry", data: { epoch: 2, hostUs: 1300001, sourceUs: 550001, geometry } },
    { event: "geometry", data: { epoch: 3, hostUs: 1400000, sourceUs: null, geometry } },
    { event: "audioSamples", data: { role: "narration", startUs: 250000, endUs: 1000000 } },
    { event: "audioSamples", data: { role: "narration", startUs: 1750000, endUs: 2750000 } },
    { event: "finished", data: {} },
    { event: "lifecycle", data: { state: "complete" } },
  ];
  const contexts = [];
  for (const [name, journal] of [
    ["synthetic", records],
    ["incomplete", records.slice(0, -2)],
    [
      "empty",
      [
        ...prefix,
        { event: "finished", data: {} },
        { event: "lifecycle", data: { state: "complete" } },
      ],
    ],
  ]) {
    const directory = join(home, `${name}-donor`);
    await mkdir(directory, { recursive: true });
    await copyFile(video, join(directory, "video.mov"), constants.COPYFILE_FICLONE);
    if (name !== "empty")
      await copyFile(
        join(fixture, "narration.mov"),
        join(directory, "narration.mov"),
        constants.COPYFILE_FICLONE,
      );
    let body = journal
      .map((record, i) => JSON.stringify({ ...record, sequence: i + 1 }) + "\n")
      .join("");
    if (name === "incomplete") body += "{";
    await writeFile(join(directory, "capture.journal.jsonl"), body);
    const output = join(out, `${name}-normalized.jsonl`);
    const receipt = nativeResult(await native("media.sourceEvidence", { directory, output }));
    const normalized = (await readFile(output, "utf8"))
      .trim()
      .split("\n")
      .filter(Boolean)
      .map(JSON.parse);
    assert.equal(receipt.incompleteTail, name === "incomplete");
    assert.equal(receipt.finished, name !== "incomplete");
    assert.equal(receipt.invalidAtSequence ?? null, null);
    assert.equal(receipt.cursorSamples, name !== "empty" ? samples.length : 0);
    assert.equal(receipt.pauseEvents, name !== "empty" ? 2 : 0);
    contexts.push({
      name,
      directory,
      journalSha256: hash(body),
      normalizedSha256: hash(await readFile(output)),
      normalized,
      receipt,
    });
  }
  const directory = join(home, "real-donor");
  await mkdir(directory, { recursive: true });
  for (const file of ["video.mov", "narration.mov", "capture.journal.jsonl"])
    await copyFile(join(fixture, file), join(directory, file), constants.COPYFILE_FICLONE);
  const output = join(out, "real-normalized.jsonl");
  const receipt = nativeResult(await native("media.sourceEvidence", { directory, output }));
  contexts.push({
    name: "real",
    directory,
    journalSha256: hash(await readFile(join(directory, "capture.journal.jsonl"))),
    normalizedSha256: hash(await readFile(output)),
    normalized: (await readFile(output, "utf8")).trim().split("\n").map(JSON.parse),
    receipt,
  });
  await writeFile(
    join(out, "fixture-receipts.json"),
    JSON.stringify(
      contexts.map(({ name, directory, journalSha256, normalizedSha256, receipt }) => ({
        name,
        directory,
        journalSha256,
        normalizedSha256,
        receipt,
      })),
      null,
      2,
    ) + "\n",
  );
  return { contexts, video, probe, samples };
}
