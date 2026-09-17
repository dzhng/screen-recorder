import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, mkdir, writeFile, readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { FileSourceEvidence } from "@screenrec/core/evidence-pages";
import { FileSceneEvidence } from "@screenrec/core/scene-pages";
import { projectEvents } from "@screenrec/core/timeline";
import { selectionPolicy } from "@screenrec/core/selection";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function files(root, prefix = "") {
  const result = [];
  for (const name of (await readdir(join(root, prefix))).sort()) {
    const path = join(prefix, name);
    if ((await stat(join(root, path))).isDirectory()) result.push(...(await files(root, path)));
    else result.push(path);
  }
  return result;
}
export async function archiveFixture(original, destination) {
  const old = JSON.parse(await readFile(join(original, "context.json"), "utf8"));
  await mkdir(destination);
  await mkdir(join(destination, "source"));
  for (const name of ["video.mov", "system.mov", "capture.journal.jsonl"])
    await cp(join(original, "source", name), join(destination, "source", name));
  await mkdir(join(destination, "evidence"));
  for (const [from, to] of [
    ["source-pages", "source"],
    ["scene-pages", "scenes"],
    ["index-pages", "index"],
  ])
    await cp(join(original, from), join(destination, "evidence", to), { recursive: true });
  const source = {
    ...old.source,
    receipt: { ...old.source.receipt, file: "evidence/source/normalized.jsonl" },
  };
  await cp(join(original, "source/normalized.jsonl"), join(destination, source.receipt.file));
  await writeFile(join(destination, "evidence/source/metadata.json"), JSON.stringify(source));
  const sourceReader = new FileSourceEvidence(join(destination, "evidence/source"), source);
  assert.equal(source.receipt.header.microphone, false);
  assert.equal(sourceReader.hasAudio(source, "narration"), false);
  assert.equal(sourceReader.hasAudio(source, "system"), true);
  const revision = old.history.find((value) => value.id === old.snapshot.revisionId);
  const range = { startUs: 0, endUs: old.snapshot.sourceDurationUs };
  const events = [
    ...sourceReader.pauses(source, range).map((event) => ({ kind: "pause", ...event })),
    ...sourceReader
      .geometryChanges(source, range)
      .map((event) => ({ kind: "geometry", atSourceUs: event.sourceUs })),
    ...new FileSceneEvidence(join(destination, "evidence/scenes"), old.scenes)
      .page({ identity: old.scenes })
      .chunks.flatMap((chunk) => chunk.boundaries),
    { kind: "interruption", atSourceUs: old.snapshot.sourceDurationUs },
  ];
  await writeFile(
    join(destination, "evidence/events.json"),
    JSON.stringify(projectEvents(revision, events)),
  );
  await mkdir(join(destination, "revisions"));
  for (const value of old.history)
    await writeFile(join(destination, "revisions", `${value.id}.json`), JSON.stringify(value));
  const indexPages = JSON.parse(
    await readFile(join(destination, "evidence/index/pages.json"), "utf8"),
  );
  const coverageFiles = new Set(
    [...indexPages.indexes.coverage, ...indexPages.indexes.candidateCoverage].map(
      (page) => `evidence/index/${page.file}`,
    ),
  );
  const role = (path) =>
    path === "source/video.mov"
      ? "video"
      : path === "source/system.mov"
        ? "system"
        : path === "source/capture.journal.jsonl"
          ? "journal"
          : path.startsWith("revisions/")
            ? "revision"
            : path.startsWith("evidence/source/")
              ? "source"
              : path.startsWith("evidence/scenes/")
                ? "scenes"
                : path === "evidence/events.json"
                  ? "events"
                  : path.startsWith("evidence/index/images/")
                    ? "image"
                    : coverageFiles.has(path)
                      ? "coverage"
                      : "index";
  const inventory = await Promise.all(
    (await files(destination)).map(async (path) => {
      const content = await readFile(join(destination, path));
      return {
        path,
        role: role(path),
        bytes: content.length,
        sha256: sha(content),
        ...(["video", "system"].includes(role(path))
          ? { durationUs: old.snapshot.sourceDurationUs }
          : {}),
      };
    }),
  );
  const manifest = {
    schemaVersion: 1,
    snapshot: old.snapshot,
    acquisition: {
      recordingId: old.snapshot.recordingId,
      sourceId: old.snapshot.sourceId,
      sourceGeneration: source.generation,
      narration: "not_requested",
      system: "acquired",
    },
    inventory,
    history: old.history.map((value) => ({ id: value.id, path: `revisions/${value.id}.json` })),
    transcript: "unavailable:no_narration",
    evidence: [],
  };
  for (const [kind, generation, policy] of [
    ["source", source.generation, "native-source-v1"],
    ["scenes", old.scenes.generation, old.scenes.policy],
    ["index", old.index.generation, selectionPolicy.id],
    ["events", 1, "timeline-v1"],
  ])
    manifest.evidence.push({
      artifact: {
        reference: {
          kind,
          recordingId: old.snapshot.recordingId,
          sourceId: old.snapshot.sourceId,
          revisionId: ["source", "scenes"].includes(kind) ? "r0" : old.snapshot.revisionId,
        },
        generation,
        policy,
        options: {},
        timeDomain: ["source", "scenes"].includes(kind) ? "source" : "playback",
      },
      files: inventory
        .filter((entry) =>
          kind === "index"
            ? ["index", "coverage", "image"].includes(entry.role)
            : entry.role === kind,
        )
        .map((entry) => entry.path),
    });
  await writeFile(join(destination, "manifest.json"), JSON.stringify(manifest));
  return old.requests;
}
