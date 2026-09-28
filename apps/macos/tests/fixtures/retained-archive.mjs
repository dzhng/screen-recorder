import assert from "node:assert/strict";
import { hash } from "node:crypto";
import { cp, mkdir, writeFile, readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { FileSourceEvidence } from "@screenrec/core/evidence-pages";
import { FileSceneEvidence } from "@screenrec/core/scene-pages";
import {
  timelineEventPolicy,
  writeTimelineEventPages,
  FileTimelineEvents,
  validateTimelineEventPages,
} from "@screenrec/core/event-pages";
import { selectionPolicy } from "@screenrec/core/selection";
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
  const metadata = {
    sourceIdentity: {
      owner: source.owner,
      sourceId: source.sourceId,
      generation: source.generation,
    },
    sceneIdentity: {
      recordingId: old.scenes.recordingId,
      sourceId: old.scenes.sourceId,
      generation: old.scenes.generation,
      policy: old.scenes.policy,
    },
    revision,
    interrupted: old.snapshot.capture.state === "interrupted",
  };
  const eventInput = {
    ...metadata,
    source: sourceReader,
    scenes: new FileSceneEvidence(join(destination, "evidence/scenes"), old.scenes),
  };
  await writeTimelineEventPages(eventInput, join(destination, "evidence/events"));
  const eventReader = new FileTimelineEvents(join(destination, "evidence/events"), metadata);
  await validateTimelineEventPages(eventReader, eventInput);
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
                : path.startsWith("evidence/events/")
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
        sha256: hash("sha256", content),
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
    ["events", 1, timelineEventPolicy],
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
