import { test, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RevisionStore } from "./library.js";
import { createOriginalRevision, createRevision } from "./timeline.js";
import {
  planPackage,
  validateManifest,
  packageArtifactKinds,
  type PackageManifest,
  type PackagePrerequisite,
  type PackageArtifact,
} from "./package-manifest.js";

const limits = {
  manifestBytes: 100_000,
  revisionBytes: 100_000,
  entries: 100,
  history: 10,
  pathBytes: 200,
};
function fixture() {
  const r0 = createOriginalRevision(100, "fixture"),
    r1 = createRevision(r0, [{ startUs: 10, endUs: 80 }], {
      id: "r1",
      operation: "trim",
      createdAt: "fixture",
    });
  const manifest: PackageManifest = {
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
    inventory: [],
    history: [
      { id: "r0", path: "revisions/r0.json" },
      { id: "r1", path: "revisions/r1.json" },
    ],
    evidence: [],
    transcript: "unavailable:no_narration",
  };
  for (const [path, role, durationUs] of [
    ["source/video.mov", "video", 100],
    ["source/capture.journal.jsonl", "journal"],
    ["revisions/r0.json", "revision"],
    ["revisions/r1.json", "revision"],
    ["evidence/source.jsonl", "source"],
    ["evidence/scenes.jsonl", "scenes"],
    ["evidence/index.jsonl", "index"],
    ["evidence/coverage.jsonl", "coverage"],
    ["evidence/image.png", "image"],
    ["evidence/events.jsonl", "events"],
  ] as const)
    manifest.inventory.push({
      path,
      role,
      bytes: 1,
      sha256: "a".repeat(64),
      ...(durationUs === undefined ? {} : { durationUs }),
    });
  const artifact = (kind: (typeof packageArtifactKinds)[number]): PackageArtifact => ({
    reference: { kind, recordingId: "take", sourceId: "source", revisionId: "r0" },
    generation: kind === "source" ? "source-1" : 1,
    policy: "fixture-policy",
    options: {},
    timeDomain: ["source", "scenes", "source-transcript"].includes(kind) ? "source" : "playback",
  });
  for (const kind of ["source", "scenes", "index", "events"] as const)
    manifest.evidence.push({
      artifact: artifact(kind),
      files: manifest.inventory
        .filter((entry) =>
          kind === "index"
            ? ["index", "coverage", "image"].includes(entry.role)
            : entry.role === kind,
        )
        .map((entry) => entry.path),
    });
  const revisions = new Map([
    ["revisions/r0.json", JSON.stringify(r0)],
    ["revisions/r1.json", JSON.stringify(r1)],
  ]);
  const prerequisites = (): PackagePrerequisite[] =>
    manifest.evidence.map(({ artifact }) => ({ state: "ready", artifact }));
  const validate = () => validateManifest(JSON.stringify(manifest), revisions, limits);
  return { manifest, revisions, artifact, prerequisites, validate };
}

test("no-narration metadata validates with pinned historical revision and later known history", () => {
  const f = fixture();
  const valid = f.validate();
  expect(valid.snapshot.revisionId).toBe("r0");
  expect(valid.history.map((row) => row.id)).toEqual(["r0", "r1"]);
  expect(planPackage(f.manifest.snapshot, f.manifest.acquisition, f.prerequisites())).toEqual({
    state: "ready",
    artifacts: f.manifest.evidence.map(({ artifact }) => artifact),
    transcript: "unavailable:no_narration",
  });
});

test("root reading documents are inventoried without becoming inspection evidence", () => {
  const f = fixture();
  for (const path of ["README.md", "transcript.txt"])
    f.manifest.inventory.push({ path, role: "document", bytes: 12, sha256: "b".repeat(64) });
  expect(
    f
      .validate()
      .inventory.filter((entry) => entry.role === "document")
      .map((entry) => entry.path),
  ).toEqual(["README.md", "transcript.txt"]);
  f.manifest.inventory.at(-1)!.path = "evidence/transcript.txt";
  expect(f.validate).toThrow("Invalid package member path");
  f.manifest.inventory.at(-1)!.path = "other.txt";
  expect(f.validate).toThrow("Invalid package member path");
});

test("missing and processing dependencies stay outside a publishable plan; failures win over waiting", () => {
  const f = fixture(),
    snapshot = f.manifest.snapshot,
    acquisition = { ...f.manifest.acquisition, narration: "acquired" as const };
  const waiting = planPackage(snapshot, acquisition, f.prerequisites());
  expect(waiting).toEqual({
    state: "waiting",
    dependencies: ["source-transcript", "edited-transcript"].map((kind) => ({
      reference: f.artifact(kind as "source-transcript").reference,
      jobId: null,
    })),
  });
  for (const state of ["not_requested", "queued", "processing"] as const) {
    const result = planPackage(snapshot, acquisition, [
      ...f.prerequisites(),
      { state, reference: f.artifact("source-transcript").reference, jobId: "speech-job" },
    ]);
    expect(result).toMatchObject({
      state: "waiting",
      dependencies: [{ jobId: "speech-job" }, { jobId: null }],
    });
  }
  for (const state of ["failed", "unavailable"] as const) {
    const error = { code: "MODEL_MISSING", message: "Prepare the selected model", retryable: true };
    expect(
      planPackage(snapshot, acquisition, [
        ...f.prerequisites(),
        { state, reference: f.artifact("source-transcript").reference, jobId: "speech-job", error },
      ]),
    ).toEqual({
      state: "blocked",
      failures: [{ reference: f.artifact("source-transcript").reference, error }],
    });
  }
});

test("unknown acquisition waits for source evidence without declaring no narration", () => {
  const f = fixture();
  expect(planPackage(f.manifest.snapshot, null, [])).toEqual({
    state: "waiting",
    dependencies: [{ reference: f.artifact("source").reference, jobId: null }],
  });
  expect(() => planPackage(f.manifest.snapshot, null, f.prerequisites())).toThrow(/acquisition/);
});

test("ready narration names the transcript payload members its page validator admits", () => {
  const narrated = (members: Record<string, string[]>) => {
    const f = fixture();
    f.manifest.acquisition.narration = "acquired";
    f.manifest.inventory.push({
      path: "source/narration.mov",
      role: "narration",
      bytes: 1,
      sha256: "b".repeat(64),
      durationUs: 100,
    });
    for (const kind of ["source-transcript", "edited-transcript"] as const) {
      const files = members[kind]!.map((name) => `evidence/${kind}/${name}`);
      for (const path of files)
        f.manifest.inventory.push({ path, role: kind, bytes: 1, sha256: "c".repeat(64) });
      f.manifest.evidence.push({
        artifact: { ...f.artifact(kind), generation: "transcript-1" },
        files,
      });
    }
    f.manifest.transcript = "ready";
    return f;
  };
  const f = narrated({
    "source-transcript": ["pages.json", "1.json", "raw.jsonl"],
    "edited-transcript": ["pages.json", "2.json"],
  });
  expect(planPackage(f.manifest.snapshot, f.manifest.acquisition, f.prerequisites())).toMatchObject(
    { state: "ready", transcript: "ready" },
  );
  expect(f.validate().transcript).toBe("ready");
  const withoutRaw = narrated({
    "source-transcript": ["pages.json"],
    "edited-transcript": ["pages.json"],
  });
  expect(withoutRaw.validate).toThrow(/Transcript inventory is incomplete/);
  const otherGeneration = narrated({
    "source-transcript": ["pages.json", "raw.jsonl"],
    "edited-transcript": ["pages.json"],
  });
  otherGeneration.manifest.evidence.at(-1)!.artifact.generation = "transcript-2";
  expect(otherGeneration.validate).toThrow(/does not project/);
  const noNarrationFile = narrated({
    "source-transcript": ["pages.json", "raw.jsonl"],
    "edited-transcript": ["pages.json"],
  });
  noNarrationFile.manifest.inventory = noNarrationFile.manifest.inventory.filter(
    (entry) => entry.role !== "narration",
  );
  expect(noNarrationFile.validate).toThrow(/narration member/);
});

test("cross-source, revision, acquisition generation and stale publication never become ready", () => {
  for (const mutate of [
    (f: ReturnType<typeof fixture>) => {
      f.manifest.evidence[0]!.artifact.reference.sourceId = "other";
    },
    (f: ReturnType<typeof fixture>) => {
      f.manifest.evidence[2]!.artifact.reference.revisionId = "r1";
    },
    (f: ReturnType<typeof fixture>) => {
      f.manifest.acquisition.sourceGeneration = "other";
    },
  ]) {
    const f = fixture();
    mutate(f);
    expect(f.validate).toThrow();
  }
  const f = fixture();
  expect(() =>
    planPackage(f.manifest.snapshot, f.manifest.acquisition, [
      { state: "ready", artifact: f.artifact("source"), expectedGeneration: "stale" },
    ]),
  ).toThrow(/generation/);
  expect(() =>
    planPackage(f.manifest.snapshot, f.manifest.acquisition, [
      ...f.prerequisites(),
      { state: "ready", artifact: f.artifact("source-transcript") },
    ]),
  ).toThrow(/Absent narration/);
});

test("manifest references, forbidden fields, paths and schema versions fail explicitly", () => {
  const mutations = [
    (f: ReturnType<typeof fixture>) => {
      (f.manifest as unknown as { schemaVersion: number }).schemaVersion = 2;
    },
    (f: ReturnType<typeof fixture>) => {
      Object.assign(f.manifest.evidence[0]!.artifact, { file: "/private/library/file" });
    },
    (f: ReturnType<typeof fixture>) => {
      f.manifest.evidence[2]!.files.pop();
    },
    (f: ReturnType<typeof fixture>) => {
      f.manifest.evidence[0]!.files = ["evidence/missing.jsonl"];
    },
    (f: ReturnType<typeof fixture>) => {
      f.manifest.inventory[0]!.durationUs = 101;
    },
    (f: ReturnType<typeof fixture>) => {
      f.manifest.inventory[0]!.sha256 = "wrong";
    },
    (f: ReturnType<typeof fixture>) => {
      f.manifest.history[1]!.id = "wrong";
    },
  ];
  for (const mutate of mutations) {
    const f = fixture();
    mutate(f);
    expect(f.validate).toThrow();
  }
  for (const path of [
    "/source/video.mov",
    "source/../video.mov",
    "source/./video.mov",
    "source//video.mov",
    "source\\video.mov",
    "C:/source/video.mov",
    "source/vidéo.mov",
    "models/weights.bin",
    "source/x\0.mov",
  ]) {
    const f = fixture();
    f.manifest.inventory[0]!.path = path;
    expect(f.validate).toThrow();
  }
  for (const path of ["source/VIDEO.mov", "source/video.mov/child"]) {
    const f = fixture();
    f.manifest.inventory.push({ ...f.manifest.inventory[0]!, path });
    expect(f.validate).toThrow();
  }
});

test("history content is validated by timeline constructors and every supplied path is accounted for", () => {
  for (const mutate of [
    (value: Record<string, unknown>) => {
      value.durationUs = 1000;
    },
    (value: Record<string, unknown>) => {
      value.parentId = "unknown";
    },
    (value: Record<string, unknown>) => {
      value.ordinal = 7;
    },
    (value: Record<string, unknown>) => {
      value.spans = [{ startUs: 10, endUs: 101 }];
    },
  ]) {
    const f = fixture(),
      value = JSON.parse(f.revisions.get("revisions/r1.json")!);
    mutate(value);
    f.revisions.set("revisions/r1.json", JSON.stringify(value));
    expect(f.validate).toThrow();
  }
  const f = fixture();
  f.revisions.delete("revisions/r1.json");
  expect(f.validate).toThrow();
});

test("finite byte, inventory, history and path limits reject just-over-limit input", () => {
  const f = fixture(),
    json = JSON.stringify(f.manifest);
  for (const restricted of [
    { manifestBytes: Buffer.byteLength(json) - 1 },
    { entries: f.manifest.inventory.length - 1 },
    { history: 1 },
    { pathBytes: 2 },
    { revisionBytes: 1 },
    { entries: Infinity },
  ])
    expect(() => validateManifest(json, f.revisions, { ...limits, ...restricted })).toThrow();
  expect(() => validateManifest(json, f.revisions, {} as typeof limits)).toThrow();
});

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const close of cleanups.splice(0).reverse()) close();
});
test("real catalog snapshot pins all admission-time history independently of selected old revision", () => {
  const root = mkdtempSync(join(tmpdir(), "screenrec-package-"));
  cleanups.push(() => rmSync(root, { recursive: true, force: true }));
  let sequence = 0;
  const store = new RevisionStore(join(root, "library.sqlite"), {
    now: () => "fixture",
    newId: () => `id-${++sequence}`,
  });
  cleanups.push(() => store.close());
  const take = store.allocate().recording;
  expect(() => store.pinPackageSnapshot(take.recordingId)).toThrow();
  store.ingestLifecycle(take.recordingId, {
    sourceId: take.sourceId,
    sequence: 1,
    state: "interrupted",
    reason: "fixture",
    sourceDurationUs: 100,
  });
  const first = store.edit(take.recordingId, {
    operation: "cut",
    requestId: "first",
    expectedRevisionId: "r0",
    ranges: [{ startUs: 10, endUs: 20 }],
  });
  const pinned = store.pinPackageSnapshot(take.recordingId, "r0");
  store.edit(take.recordingId, {
    operation: "cut",
    requestId: "next",
    expectedRevisionId: first.id,
    ranges: [{ startUs: 10, endUs: 20 }],
  });
  const page = store.history(take.recordingId, pinned.historyCursor, 1);
  const rest = store.history(take.recordingId, page.nextCursor, 1);
  expect(pinned.snapshot).toMatchObject({
    revisionId: "r0",
    historyThroughOrdinal: 1,
    capture: { state: "interrupted", interruptionReason: "fixture" },
  });
  expect([...page.revisions, ...rest.revisions].map((revision) => revision.id)).toEqual([
    "r0",
    first.id,
  ]);
  expect(rest.nextCursor).toBeNull();
  if (process.env.SCREENREC_PACKAGE_MANIFEST_EVIDENCE) {
    const example = fixture();
    const acquired = { ...example.manifest.acquisition, narration: "acquired" as const };
    writeFileSync(
      process.env.SCREENREC_PACKAGE_MANIFEST_EVIDENCE,
      JSON.stringify(
        {
          scope:
            "Generated metadata/readiness only; no ZIP, payload/hash validation, accepted speech or public export",
          pinned: pinned.snapshot,
          history: [...page.revisions, ...rest.revisions].map(({ id }) => id),
          structuralManifest: example.validate(),
          noNarration: planPackage(
            example.manifest.snapshot,
            example.manifest.acquisition,
            example.prerequisites(),
          ),
          pendingNarration: planPackage(
            example.manifest.snapshot,
            acquired,
            example.prerequisites(),
          ),
          narratedCompleteManifestSupported: false,
        },
        null,
        2,
      ) + "\n",
      { flag: "wx" },
    );
  }
  store.markDeleting(take.recordingId);
  expect(() => store.pinPackageSnapshot(take.recordingId)).toThrow(
    expect.objectContaining({ code: "NOT_FOUND" }),
  );
});

test("unknown acquisition does not hide an already failed unconditional dependency", () => {
  const f = fixture(),
    error = { code: "SCENE_FAILED", message: "Retry scene analysis", retryable: true };
  expect(
    planPackage(f.manifest.snapshot, null, [
      { state: "queued", reference: f.artifact("source").reference, jobId: "source-job" },
      { state: "failed", reference: f.artifact("scenes").reference, jobId: "scene-job", error },
    ]),
  ).toEqual({ state: "blocked", failures: [{ reference: f.artifact("scenes").reference, error }] });
});

test("an inventoried file cannot occupy a required root directory", () => {
  const f = fixture();
  f.manifest.snapshot.historyThroughOrdinal = 0;
  f.manifest.history = [{ id: "r0", path: "revisions" }];
  f.manifest.inventory = f.manifest.inventory.filter((entry) => entry.path !== "revisions/r1.json");
  f.manifest.inventory.find((entry) => entry.role === "revision")!.path = "revisions";
  const r0 = f.revisions.get("revisions/r0.json")!;
  f.revisions.clear();
  f.revisions.set("revisions", r0);
  expect(f.validate).toThrow(/member path/);
});
