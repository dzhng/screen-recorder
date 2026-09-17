import { z } from "zod";
import { CatalogError } from "./library.js";
import type { ArtifactState } from "./jobs.js";
import { parseRevisionHistory } from "./timeline.js";

const text = z.string().min(1);
const integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const generation = z.union([text, integer]);
export const packageArtifactKinds = [
  "source",
  "scenes",
  "index",
  "events",
  "source-transcript",
  "edited-transcript",
] as const;
const kind = z.enum(packageArtifactKinds);
const snapshotSchema = z.strictObject({
  recordingId: text,
  sourceId: text,
  revisionId: text,
  sourceDurationUs: integer.positive(),
  historyThroughOrdinal: integer,
  capture: z.strictObject({
    state: z.enum(["complete", "interrupted"]),
    createdAt: text,
    interruptionReason: text.nullable(),
  }),
});
export type PackageSnapshot = z.infer<typeof snapshotSchema>;
const referenceSchema = z.strictObject({
  kind,
  recordingId: text,
  sourceId: text,
  revisionId: text,
});
const readySchema = z.strictObject({
  reference: referenceSchema,
  generation,
  policy: text,
  options: z.record(text, z.union([z.number().finite(), z.boolean()])),
  timeDomain: z.enum(["source", "playback"]),
});
export type PackageArtifact = z.infer<typeof readySchema>;
const errorSchema = z.strictObject({ code: text, message: text, retryable: z.boolean() });
const waitingStates = [
  "not_requested",
  "queued",
  "processing",
] as const satisfies readonly ArtifactState[];
const prerequisiteSchema = z.union([
  z.strictObject({
    state: z.enum(waitingStates),
    reference: referenceSchema,
    jobId: text.nullable(),
  }),
  z.strictObject({
    state: z.enum(["failed", "unavailable"]),
    reference: referenceSchema,
    jobId: text.nullable(),
    error: errorSchema,
  }),
  z.strictObject({
    state: z.literal("ready"),
    artifact: readySchema,
    expectedGeneration: generation.optional(),
  }),
]);
export type PackagePrerequisite = z.infer<typeof prerequisiteSchema>;
const acquisitionSchema = z.strictObject({
  recordingId: text,
  sourceId: text,
  sourceGeneration: generation,
  narration: z.enum(["not_requested", "not_acquired", "acquired"]),
  system: z.enum(["not_requested", "not_acquired", "acquired"]),
});
export type PackageAcquisition = z.infer<typeof acquisitionSchema>;
export type PackageReadiness =
  | {
      state: "waiting";
      dependencies: { reference: z.infer<typeof referenceSchema>; jobId: string | null }[];
    }
  | {
      state: "blocked";
      failures: {
        reference: z.infer<typeof referenceSchema>;
        error: z.infer<typeof errorSchema>;
      }[];
    }
  | {
      state: "ready";
      artifacts: PackageArtifact[];
      transcript: "ready" | "unavailable:no_narration";
    };

function invalid(message: string): never {
  throw new CatalogError("INVALID_PACKAGE", message);
}
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) invalid(result.error.issues[0]?.message ?? "Malformed package metadata");
  return result.data;
}
function reference(snapshot: PackageSnapshot, artifact: (typeof packageArtifactKinds)[number]) {
  return {
    kind: artifact,
    recordingId: snapshot.recordingId,
    sourceId: snapshot.sourceId,
    revisionId: ["source", "scenes", "source-transcript"].includes(artifact)
      ? "r0"
      : snapshot.revisionId,
  };
}
function checkReference(
  actual: z.infer<typeof referenceSchema>,
  expected: z.infer<typeof referenceSchema>,
) {
  if (
    Object.keys(expected).some(
      (key) => actual[key as keyof typeof actual] !== expected[key as keyof typeof expected],
    )
  )
    invalid("Artifact does not belong to the pinned source and revision");
}

/** This plans reported readiness only. It does not recognize speech, validate payload bytes or reserve a worker. */
export function planPackage(
  snapshotValue: PackageSnapshot,
  acquisitionValue: PackageAcquisition | null,
  prerequisites: readonly PackagePrerequisite[],
): PackageReadiness {
  const snapshot = parse(snapshotSchema, snapshotValue),
    acquisition = acquisitionValue === null ? null : parse(acquisitionSchema, acquisitionValue);
  if (
    acquisition &&
    (acquisition.recordingId !== snapshot.recordingId || acquisition.sourceId !== snapshot.sourceId)
  )
    invalid("Acquisition evidence belongs to another source");
  const provided = new Map<string, PackagePrerequisite>();
  for (const value of prerequisites) {
    const item = parse(prerequisiteSchema, value);
    const ref = item.state === "ready" ? item.artifact.reference : item.reference;
    checkReference(ref, reference(snapshot, ref.kind));
    if (
      item.state === "ready" &&
      item.artifact.timeDomain !==
        (["source", "scenes", "source-transcript"].includes(ref.kind) ? "source" : "playback")
    )
      invalid("Artifact time domain does not match its role");
    if (provided.has(ref.kind)) invalid("Duplicate artifact prerequisite");
    if (
      item.state === "ready" &&
      item.expectedGeneration !== undefined &&
      item.expectedGeneration !== item.artifact.generation
    )
      invalid("Published generation differs from the pinned prerequisite");
    provided.set(ref.kind, item);
  }
  if (!acquisition) {
    const failures = [...provided.values()].flatMap((item) =>
      (item.state === "failed" || item.state === "unavailable") &&
      !item.reference.kind.endsWith("transcript")
        ? [{ reference: item.reference, error: item.error }]
        : [],
    );
    if (failures.length) return { state: "blocked", failures };
    const source = provided.get("source"),
      expected = reference(snapshot, "source");
    if (source?.state === "ready")
      invalid("Ready source evidence must supply acquisition metadata");
    return {
      state: "waiting",
      dependencies: [{ reference: expected, jobId: source?.jobId ?? null }],
    };
  }
  const dependencies: Extract<PackageReadiness, { state: "waiting" }>["dependencies"] = [];
  const failures: Extract<PackageReadiness, { state: "blocked" }>["failures"] = [];
  const artifacts: PackageArtifact[] = [];
  const noNarration = acquisition.narration !== "acquired";
  for (const artifactKind of packageArtifactKinds) {
    const expected = reference(snapshot, artifactKind),
      item = provided.get(artifactKind);
    if (noNarration && artifactKind.endsWith("transcript")) {
      if (item) invalid("Absent narration cannot carry a transcript prerequisite");
      continue;
    }
    if (!item || waitingStates.some((state) => state === item.state)) {
      dependencies.push({
        reference: expected,
        jobId: item && "jobId" in item ? item.jobId : null,
      });
    } else if (item.state === "failed" || item.state === "unavailable") {
      failures.push({ reference: expected, error: item.error });
    } else if (item.state === "ready") {
      if (artifactKind === "source" && item.artifact.generation !== acquisition.sourceGeneration)
        invalid("Acquisition evidence is not from the pinned source generation");
      artifacts.push(item.artifact);
    }
  }
  if (failures.length) return { state: "blocked", failures };
  if (dependencies.length) return { state: "waiting", dependencies };
  return {
    state: "ready",
    artifacts,
    transcript: noNarration ? "unavailable:no_narration" : "ready",
  };
}

const role = z.enum([
  "video",
  "narration",
  "system",
  "journal",
  "revision",
  "source",
  "scenes",
  "index",
  "coverage",
  "image",
  "events",
  "source-transcript",
  "edited-transcript",
]);
const inventorySchema = z.strictObject({
  path: text,
  bytes: integer,
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  role,
  durationUs: integer.optional(),
});
const manifestSchema = z.strictObject({
  schemaVersion: z.literal(1),
  snapshot: snapshotSchema,
  acquisition: acquisitionSchema,
  inventory: z.array(inventorySchema),
  history: z.array(z.strictObject({ id: text, path: text })),
  evidence: z.array(z.strictObject({ artifact: readySchema, files: z.array(text).min(1) })),
  transcript: z.enum(["ready", "unavailable:no_narration"]),
});
export type PackageManifest = z.infer<typeof manifestSchema>;
export type PackageLimits = {
  manifestBytes: number;
  entries: number;
  history: number;
  pathBytes: number;
  revisionBytes: number;
};

/** Metadata/reference validation only; archive contents, byte hashes and payload validators belong to opening/publication. */
export function validateManifest(
  json: string,
  revisionContents: ReadonlyMap<string, string>,
  limits: PackageLimits,
): PackageManifest {
  for (const value of [
    limits.manifestBytes,
    limits.entries,
    limits.history,
    limits.pathBytes,
    limits.revisionBytes,
  ])
    if (!Number.isSafeInteger(value) || value < 1)
      throw new RangeError("Package limits must be positive finite integers");
  if (Buffer.byteLength(json) > limits.manifestBytes) invalid("Manifest byte limit exceeded");
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    invalid("Manifest is not JSON");
  }
  const manifest = parse(manifestSchema, value);
  if (manifest.inventory.length > limits.entries || manifest.history.length > limits.history)
    invalid("Manifest inventory/history limit exceeded");
  const byPath = new Map<string, z.infer<typeof inventorySchema>>(),
    names = new Set<string>(),
    directories = new Set<string>();
  const expectedRoot = (entry: z.infer<typeof inventorySchema>) =>
    ["video", "narration", "system", "journal"].includes(entry.role)
      ? "source"
      : entry.role === "revision"
        ? "revisions"
        : "evidence";
  for (const entry of manifest.inventory) {
    const components = entry.path.split("/");
    // ASCII names avoid normalization/case-fold aliases across package-reader filesystems.
    if (
      Buffer.byteLength(entry.path) > limits.pathBytes ||
      !/^[A-Za-z0-9_./-]+$/.test(entry.path) ||
      components.length < 2 ||
      components.some((part) => !part || part === "." || part === "..") ||
      components[0] !== expectedRoot(entry)
    )
      invalid("Invalid package member path");
    const folded = entry.path.toLowerCase();
    if (names.has(folded)) invalid("Duplicate or case-colliding package member");
    if (directories.has(folded)) invalid("File/directory member collision");
    const parts = folded.split("/");
    for (let count = 1; count < parts.length; count++) {
      const parent = parts.slice(0, count).join("/");
      if (names.has(parent)) invalid("File/directory member collision");
      directories.add(parent);
    }
    names.add(folded);
    byPath.set(entry.path, entry);
    const media = ["video", "narration", "system"].includes(entry.role);
    if (media && entry.durationUs === undefined) invalid("Source track duration is required");
    if (!media && entry.durationUs !== undefined)
      invalid("Only source tracks carry inventory durations");
  }
  const sourceNames = {
    video: "video.mov",
    narration: "narration.mov",
    system: "system.mov",
    journal: "capture.journal.jsonl",
  };
  for (const entry of manifest.inventory) {
    if (
      entry.role in sourceNames &&
      entry.path !== `source/${sourceNames[entry.role as keyof typeof sourceNames]}`
    )
      invalid("Unexpected source member name");
  }
  const singleton = (name: z.infer<typeof role>, expected: number) => {
    if (manifest.inventory.filter((entry) => entry.role === name).length !== expected)
      invalid(`Expected ${expected} ${name} member(s)`);
  };
  singleton("video", 1);
  singleton("journal", 1);
  if (
    manifest.inventory.find((entry) => entry.role === "video")!.durationUs !==
    manifest.snapshot.sourceDurationUs
  )
    invalid("Video duration does not match the snapshot");
  for (const track of ["narration", "system"] as const)
    singleton(track, manifest.acquisition[track] === "acquired" ? 1 : 0);
  if (revisionContents.size !== manifest.history.length)
    invalid("Revision content inventory mismatch");
  let revisionBytes = 0;
  const contents = manifest.history.map(({ path }) => {
    const json = revisionContents.get(path);
    if (json === undefined) invalid("Missing revision contents");
    revisionBytes += Buffer.byteLength(json);
    if (revisionBytes > limits.revisionBytes) invalid("Revision content byte limit exceeded");
    try {
      return JSON.parse(json) as unknown;
    } catch {
      invalid("Invalid revision JSON");
    }
  });
  let revisions;
  try {
    revisions = parseRevisionHistory(contents, limits.history);
  } catch {
    invalid("Invalid revision contents");
  }
  if (
    revisions.length !== manifest.history.length ||
    revisions.length !== manifest.snapshot.historyThroughOrdinal + 1 ||
    !revisions.some((revision) => revision.id === manifest.snapshot.revisionId) ||
    revisions[0]!.sourceDurationUs !== manifest.snapshot.sourceDurationUs
  )
    invalid("History does not match the pinned snapshot");
  const used = new Set<string>();
  const consume = (path: string, allowed: readonly string[]) => {
    const member = byPath.get(path);
    if (!member || !allowed.includes(member.role) || used.has(path))
      invalid("Missing, reused or wrong-role member reference");
    used.add(path);
  };
  for (const [i, item] of manifest.history.entries()) {
    if (item.id !== revisions[i]!.id)
      invalid("Revision reference does not match supplied contents");
    consume(item.path, ["revision"]);
  }
  const plan = planPackage(
    manifest.snapshot,
    manifest.acquisition,
    manifest.evidence.map(({ artifact }) => ({ state: "ready" as const, artifact })),
  );
  if (plan.state !== "ready" || plan.transcript !== manifest.transcript)
    invalid("Manifest is not complete");
  // No transcript payload validator exists, so a readiness envelope cannot certify narrated packages.
  if (manifest.transcript === "ready")
    throw new CatalogError(
      "UNSUPPORTED_ARTIFACT",
      "Narrated manifest validation requires the accepted transcript owner",
    );
  for (const evidence of manifest.evidence) {
    const artifactKind = evidence.artifact.reference.kind;
    const allowed = artifactKind === "index" ? ["index", "coverage", "image"] : [artifactKind];
    for (const path of evidence.files) consume(path, allowed);
    if (artifactKind === "index") {
      for (const required of ["index", "coverage", "image"])
        if (!evidence.files.some((path) => byPath.get(path)!.role === required))
          invalid("Index inventory is incomplete");
    }
  }
  for (const entry of manifest.inventory) {
    if (["video", "narration", "system", "journal"].includes(entry.role)) used.add(entry.path);
    if (!used.has(entry.path)) invalid("Unreferenced package member");
  }
  return manifest;
}
