import { createHash } from "node:crypto";
import { createOriginalRevision, createRevision } from "../../../../packages/core/dist/timeline.js";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");

export function archiveContents(video = "generated source") {
  const r0 = createOriginalRevision(100, "fixture");
  const r1 = createRevision(r0, [{ startUs: 10, endUs: 80 }], {
    id: "r1",
    operation: "trim",
    createdAt: "fixture",
  });
  const files = {
    "source/video.mov": video,
    "source/capture.journal.jsonl": "{}\n",
    "revisions/r0.json": JSON.stringify(r0),
    "revisions/r1.json": JSON.stringify(r1),
  };
  for (const name of ["source", "scenes", "index", "coverage", "events"])
    files[`evidence/${name}.jsonl`] = "{}\n";
  files["evidence/image.png"] = "generated image placeholder";
  const role = (path) =>
    path.startsWith("revisions/")
      ? "revision"
      : path.includes("video.mov")
        ? "video"
        : path.includes("journal")
          ? "journal"
          : path.split("/")[1].split(".")[0];
  const manifest = {
    schemaVersion: 1,
    snapshot: {
      recordingId: "take",
      sourceId: "source",
      revisionId: "r0",
      sourceDurationUs: 100,
      historyThroughOrdinal: 1,
      capture: { state: "complete", createdAt: "fixture", interruptionReason: null },
    },
    acquisition: {
      recordingId: "take",
      sourceId: "source",
      sourceGeneration: "source-1",
      narration: "not_requested",
      system: "not_acquired",
    },
    inventory: Object.entries(files).map(([path, value]) => ({
      path,
      role: role(path),
      bytes: Buffer.byteLength(value),
      sha256: sha(value),
      ...(role(path) === "video" ? { durationUs: 100 } : {}),
    })),
    history: [
      { id: "r0", path: "revisions/r0.json" },
      { id: "r1", path: "revisions/r1.json" },
    ],
    evidence: [],
    transcript: "unavailable:no_narration",
  };
  for (const kind of ["source", "scenes", "index", "events"])
    manifest.evidence.push({
      artifact: {
        reference: { kind, recordingId: "take", sourceId: "source", revisionId: "r0" },
        generation: kind === "source" ? "source-1" : 1,
        policy: "fixture-policy",
        options: {},
        timeDomain: ["source", "scenes"].includes(kind) ? "source" : "playback",
      },
      files: manifest.inventory
        .filter((row) =>
          kind === "index" ? ["index", "coverage", "image"].includes(row.role) : row.role === kind,
        )
        .map((row) => row.path),
    });
  files["manifest.json"] = JSON.stringify(manifest);
  return files;
}
