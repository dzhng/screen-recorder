import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { mkdir, open, writeFile, type FileHandle } from "node:fs/promises";
import { join } from "node:path";
import { setImmediate } from "node:timers/promises";
import { isDeepStrictEqual } from "node:util";
import { type RevisionStore } from "@screenrec/core/library";
import { CatalogError } from "@screenrec/core/catalog";
import type { DirectoryIdentity } from "@screenrec/core/cache";
import type { SourceEvidenceMetadata, SourceEvidenceStore } from "@screenrec/core/evidence";
import { evidenceIndexes } from "@screenrec/core/evidence-read";
import { sourcePolicy } from "@screenrec/core/processing";
import {
  FileSourceEvidence,
  readSourceMetadata,
  writeSourceEvidencePages,
} from "@screenrec/core/evidence-pages";
import type { SceneEvidenceMetadata, SceneEvidenceStore } from "@screenrec/core/scene-evidence";
import type { SceneProcessing } from "@screenrec/core/scene-processing";
import { FileSceneEvidence, writeSceneEvidencePages } from "@screenrec/core/scene-pages";
import type { IndexProcessing } from "@screenrec/core/index-processing";
import type {
  ScreenshotIndexMetadata,
  ScreenshotIndexStore,
  ScreenshotIndexEntry,
} from "@screenrec/core/screenshot-index";
import { FileScreenshotIndex, writeScreenshotIndexPages } from "@screenrec/core/index-pages";
import {
  FileTimelineEvents,
  writeTimelineEventPages,
  validateTimelineEventPages,
  timelineEventPolicy,
} from "@screenrec/core/event-pages";
import { readOrderedPageManifest } from "@screenrec/core/ordered-pages";
import {
  transcriptPolicy,
  type TranscriptMetadata,
  type TranscriptStore,
} from "@screenrec/core/transcript";
import type { TranscriptProcessing } from "@screenrec/core/transcript-processing";
import { TranscriptRead } from "@screenrec/core/transcript-read";
import {
  portableNarration,
  portableRawTranscript,
  validateTranscriptPages,
  writeEditedTranscriptPages,
  writeTranscriptPages,
} from "@screenrec/core/transcript-pages";
import { archiveLimits } from "@screenrec/core/package-archive";
import {
  validateManifest,
  packageDocumentPaths,
  type PackageManifest,
  type PackageSnapshot,
} from "@screenrec/core/package-manifest";
import { fileIdentity, O_NOFOLLOW_ANY, type FileIdentity } from "@screenrec/core/files";
import { nativeResult, type MediaWorker } from "./worker.js";
import { publicationDeadlineMs } from "./publication.js";
import { writeArchive } from "./archive-write.js";
import { writePackageGuide } from "./package-guide.js";

export type PackageOwners = {
  scenes: SceneProcessing;
  index: IndexProcessing;
  transcript: Pick<TranscriptProcessing, "status" | "prepare">;
  source: SourceEvidenceStore;
  sceneEvidence: SceneEvidenceStore;
  indexEvidence: ScreenshotIndexStore;
  transcriptEvidence: TranscriptStore;
};
export type PackageEvidence = {
  scenes: SceneEvidenceMetadata | null;
  index: ScreenshotIndexMetadata | null;
  /** Selected only when the pinned source acquired narration. */
  transcript: TranscriptMetadata | null;
};
export type AssemblyReservation = {
  parent: DirectoryIdentity;
  bytes?: number;
  input: { name: string; identity: DirectoryIdentity | null };
  zip: { name: string; identity: DirectoryIdentity | null };
};
type Workspace = { directory: string; handle: FileHandle; identity: DirectoryIdentity };
type Member = PackageManifest["inventory"][number];
function invalid(message: string): never {
  throw new CatalogError("INVALID_PACKAGE", message);
}
function same(actual: unknown, expected: unknown) {
  if (!isDeepStrictEqual(actual, expected)) invalid("Portable evidence differs from pinned input");
}
export async function checkWorkspace(workspace: Workspace): Promise<void> {
  const current = await open(
    workspace.directory,
    constants.O_RDONLY | constants.O_DIRECTORY | O_NOFOLLOW_ANY,
  );
  try {
    const stat = await current.stat({ bigint: true });
    if (String(stat.dev) !== workspace.identity.dev || String(stat.ino) !== workspace.identity.ino)
      throw new CatalogError("INVALID_STORAGE", "Assembly workspace locator changed");
  } finally {
    await current.close();
  }
}
function frames(entries: ScreenshotIndexEntry[]) {
  return entries.map(({ frame, ...entry }) => {
    const { file: _file, ...metadata } = frame;
    return { ...entry, frame: metadata };
  });
}

/** The export intent owns selection and workspace lifetime. This function owns only complete bytes. */
export async function assemblePackage(
  selected: {
    snapshot: PackageSnapshot;
    source: SourceEvidenceMetadata;
    scenes: SceneEvidenceMetadata;
    index: ScreenshotIndexMetadata;
    transcript: TranscriptMetadata | null;
  },
  owners: PackageOwners & { store: RevisionStore; worker: MediaWorker },
  parent: Workspace,
  input: Workspace,
  zip: Workspace,
  signal: AbortSignal,
) {
  const { snapshot, source, scenes, index, transcript } = selected;
  const revision = owners.store.revision(snapshot.recordingId, snapshot.revisionId);
  const sourceIdentity = {
    owner: source.owner,
    sourceId: source.sourceId,
    generation: source.generation,
  };
  const sceneIdentity = {
    recordingId: scenes.recordingId,
    sourceId: scenes.sourceId,
    generation: scenes.generation,
    policy: scenes.policy,
  };
  const narration = owners.source.hasAudio(sourceIdentity, "narration");
  const system = owners.source.hasAudio(sourceIdentity, "system");
  await checkWorkspace(input);
  await mkdir(join(input.directory, "evidence"));
  const root = (kind: string) => join(input.directory, "evidence", kind);
  await writeSourceEvidencePages(owners.source, sourceIdentity, root("source"), signal);
  await writeSceneEvidencePages(owners.sceneEvidence, sceneIdentity, root("scenes"), signal);
  await writeScreenshotIndexPages(owners.indexEvidence, index, revision, root("index"), signal);
  const eventMetadata = {
    sourceIdentity,
    sceneIdentity,
    revision,
    interrupted: snapshot.capture.state === "interrupted",
  };
  const eventInput = { ...eventMetadata, source: owners.source, scenes: owners.sceneEvidence };
  await writeTimelineEventPages(eventInput, root("events"), signal);
  if (transcript) {
    await writeTranscriptPages(
      owners.transcriptEvidence,
      transcript,
      root("source-transcript"),
      signal,
    );
    await writeEditedTranscriptPages(
      new TranscriptRead(owners.transcriptEvidence, transcript, revision),
      {
        recordingId: transcript.recordingId,
        sourceId: transcript.sourceId,
        revisionId: revision.id,
        generation: transcript.generation,
        policy: transcriptPolicy,
      },
      root("edited-transcript"),
      signal,
    );
  }

  // Re-read every semantic page against the selected live generation before certifying completeness.
  const sourceRead = new FileSourceEvidence(root("source"), sourceIdentity);
  for (const order of evidenceIndexes) {
    const expected = owners.source.exportRecords(sourceIdentity, order);
    for (const batch of sourceRead.exportRecords(sourceIdentity, order)) {
      signal.throwIfAborted();
      const next = expected.next();
      if (next.done) invalid("Portable source has unexpected rows");
      same(
        batch,
        next.value.map((row) => ({ ...row })),
      );
      await setImmediate();
    }
    if (!expected.next().done) invalid("Portable source evidence ended early");
  }
  const sceneRead = new FileSceneEvidence(root("scenes"), sceneIdentity);
  let sceneAfter: number | undefined;
  for (;;) {
    signal.throwIfAborted();
    const query = {
      identity: sceneIdentity,
      ...(sceneAfter === undefined ? {} : { afterStartUs: sceneAfter }),
      limit: 100,
    };
    const page = sceneRead.page(query);
    same(page, owners.sceneEvidence.page(query));
    if (page.nextStartUs === null) break;
    sceneAfter = page.nextStartUs;
    await setImmediate();
  }
  const indexRead = new FileScreenshotIndex(root("index"), index, revision);
  let afterOrdinal: number | undefined;
  for (;;) {
    signal.throwIfAborted();
    const query = {
      identity: index,
      ...(afterOrdinal === undefined ? {} : { afterOrdinal }),
      limit: 50,
    };
    const page = indexRead.page(query),
      expected = owners.indexEvidence.page(query);
    same(page.metadata, expected.metadata);
    same(frames(page.entries), frames(expected.entries));
    same(page.nextOrdinal, expected.nextOrdinal);
    for (const entry of page.entries) {
      signal.throwIfAborted();
      indexRead.openRead(index, entry.candidate.ordinal).release();
      await setImmediate();
    }
    if (page.nextOrdinal === null) break;
    afterOrdinal = page.nextOrdinal;
    await setImmediate();
  }
  for (let candidate = -1; candidate < index.candidateCount; candidate++) {
    let afterSequence: number | undefined;
    for (;;) {
      signal.throwIfAborted();
      const query = {
        identity: index,
        ...(candidate < 0 ? {} : { candidateOrdinal: candidate }),
        ...(afterSequence === undefined ? {} : { afterSequence }),
        limit: 100,
      };
      const page = indexRead.coveragePage(query);
      same(page, owners.indexEvidence.coveragePage(query));
      if (page.nextSequence === null) break;
      afterSequence = page.nextSequence;
      await setImmediate();
    }
    await setImmediate();
  }
  await validateTimelineEventPages(
    new FileTimelineEvents(root("events"), eventMetadata),
    eventInput,
    signal,
  );
  await checkWorkspace(input);

  const selections = [
    { source: "source/video.mov", target: "source/video.mov" },
    { source: "source/capture.journal.jsonl", target: "source/capture.journal.jsonl" },
    {
      source: `evidence/source/${source.generation}/observations.jsonl`,
      target: "evidence/source/normalized.jsonl",
    },
    ...(system ? [{ source: "source/system.mov", target: "source/system.mov" }] : []),
    ...(narration ? [{ source: "source/narration.mov", target: portableNarration }] : []),
    ...(transcript
      ? [
          {
            source: `evidence/transcript/${transcript.generation}/raw.jsonl`,
            target: `evidence/source-transcript/${portableRawTranscript}`,
          },
        ]
      : []),
  ];
  const borrowed: FileHandle[] = [];
  try {
    const members = [];
    for (const selection of selections) {
      signal.throwIfAborted();
      const handle = await open(
        join(parent.directory, selection.source),
        constants.O_RDONLY | constants.O_NONBLOCK | O_NOFOLLOW_ANY,
      );
      borrowed.push(handle);
      const stat = await handle.stat({ bigint: true });
      if (!stat.isFile() || stat.nlink !== 1n || stat.size > BigInt(archiveLimits.memberBytes))
        invalid("Source member is not a bounded regular file");
      if (
        selection.target === "evidence/source/normalized.jsonl" &&
        stat.size !== BigInt(source.receipt.bytes)
      )
        invalid("Normalized source differs from its pinned generation byte receipt");
      members.push({ ...selection, bytes: Number(stat.size), identity: fileIdentity(stat) });
    }
    const bytes = members.reduce((sum, member) => sum + member.bytes, 0);
    if (bytes > archiveLimits.expandedBytes) invalid("Source members exceed package budget");
    nativeResult(
      await owners.worker(
        "archive.copy",
        {
          identity: input.identity,
          inputIdentity: parent.identity,
          members,
          limits: archiveLimits,
        },
        {
          descriptors: [input.handle.fd, parent.handle.fd],
          signal,
          timeoutMs: publicationDeadlineMs(bytes),
        },
      ),
    );
  } finally {
    await Promise.all(borrowed.map((file) => file.close()));
  }
  await checkWorkspace(input);
  if (transcript) {
    const portable = await validateTranscriptPages(
      {
        source: root("source-transcript"),
        edited: root("edited-transcript"),
        identity: transcript,
        revision,
        narration: owners.source.audio(sourceIdentity, "narration", {
          startUs: 0,
          endUs: snapshot.sourceDurationUs,
        }),
      },
      signal,
    );
    same(portable.metadata, {
      ...transcript,
      narration: { ...transcript.narration, source: portableNarration },
    });
    // The original revision cuts nothing, so its projection compares every word and gap.
    const original = owners.store.revision(snapshot.recordingId, "r0");
    const expected = new TranscriptRead(owners.transcriptEvidence, transcript, original),
      actual = new TranscriptRead(portable, portable.metadata, original);
    let cursor: unknown;
    do {
      signal.throwIfAborted();
      const query = { limit: 1000, ...(cursor ? { cursor } : {}) };
      const page = actual.page(query);
      same(page, expected.page(query));
      cursor = page.nextCursor;
      await setImmediate();
    } while (cursor);
  }
  const portableSource = {
    ...source,
    receipt: { ...source.receipt, file: "evidence/source/normalized.jsonl" },
  };
  await writeFile(join(root("source"), "metadata.json"), JSON.stringify(portableSource), {
    flag: "wx",
    signal,
  });
  same(readSourceMetadata(root("source"), sourceIdentity), portableSource);
  await mkdir(join(input.directory, "revisions"));
  const history: PackageManifest["history"] = [],
    revisionContents = new Map<string, string>();
  let cursor: Parameters<RevisionStore["history"]>[1] = {
    recordingId: snapshot.recordingId,
    afterOrdinal: -1,
    throughOrdinal: snapshot.historyThroughOrdinal,
  };
  let revisionBytes = 0;
  do {
    const page = owners.store.history(snapshot.recordingId, cursor, 100);
    for (const value of page.revisions) {
      signal.throwIfAborted();
      const path = `revisions/${value.id}.json`,
        body = JSON.stringify(value);
      revisionBytes += Buffer.byteLength(body);
      if (revisionBytes > archiveLimits.revisionBytes || history.length >= archiveLimits.history)
        invalid("Pinned history exceeds package limits");
      await writeFile(join(input.directory, path), body, { flag: "wx", signal });
      history.push({ id: value.id, path });
      revisionContents.set(path, body);
    }
    cursor = page.nextCursor;
  } while (cursor);

  await writePackageGuide(input.directory, snapshot, transcript, owners.transcriptEvidence, signal);
  const names = new Map<string, Member["role"]>();
  const add = (path: string, role: Member["role"]) => {
    if (names.has(path) || names.size >= archiveLimits.entries - 1)
      invalid("Package inventory exceeds its bound or repeats a file");
    names.set(path, role);
  };
  for (const path of Object.values(packageDocumentPaths)) add(path, "document");
  add("source/video.mov", "video");
  add("source/capture.journal.jsonl", "journal");
  if (system) add("source/system.mov", "system");
  if (narration) add(portableNarration, "narration");
  for (const item of history) add(item.path, "revision");
  add("evidence/source/normalized.jsonl", "source");
  add("evidence/source/metadata.json", "source");
  if (transcript) add(`evidence/source-transcript/${portableRawTranscript}`, "source-transcript");
  const kinds = ["source", "scenes", "index", "events"] as const,
    transcriptKinds = ["source-transcript", "edited-transcript"] as const;
  for (const kind of [...kinds, ...(transcript ? transcriptKinds : [])]) {
    const pages = readOrderedPageManifest(root(kind));
    add(`evidence/${kind}/pages.json`, kind);
    for (const [order, descriptors] of Object.entries(pages.indexes))
      for (const descriptor of descriptors)
        add(
          `evidence/${kind}/${descriptor.file}`,
          kind === "index" && ["coverage", "candidateCoverage"].includes(order) ? "coverage" : kind,
        );
  }
  for (let ordinal = 0; ordinal < index.candidateCount; ordinal++)
    add(`evidence/index/images/${ordinal}.png`, "image");
  const plan: { path: string; bytes: number; sha256: string; identity: FileIdentity }[] = [];
  let expanded = 0;
  const inspect = async (path: string) => {
    signal.throwIfAborted();
    const file = await open(
      join(input.directory, path),
      constants.O_RDONLY | constants.O_NONBLOCK | O_NOFOLLOW_ANY,
    );
    try {
      const before = await file.stat({ bigint: true });
      if (
        !before.isFile() ||
        before.nlink !== 1n ||
        before.size > BigInt(archiveLimits.memberBytes)
      )
        invalid("Assembly member is not a bounded regular file");
      const bytes = Number(before.size);
      expanded += bytes;
      if (expanded > archiveLimits.expandedBytes) invalid("Assembly exceeds package byte budget");
      const hash = createHash("sha256"),
        buffer = Buffer.alloc(65536);
      for (let at = 0; at < bytes;) {
        signal.throwIfAborted();
        const read = await file.read(buffer, 0, Math.min(buffer.length, bytes - at), at);
        if (!read.bytesRead) invalid("Assembly member truncated while hashing");
        hash.update(buffer.subarray(0, read.bytesRead));
        at += read.bytesRead;
      }
      same(fileIdentity(await file.stat({ bigint: true })), fileIdentity(before));
      const result = { path, bytes, sha256: hash.digest("hex"), identity: fileIdentity(before) };
      plan.push(result);
      return result;
    } finally {
      await file.close();
    }
  };
  const inventory: Member[] = [];
  for (const [path, role] of names) {
    const { identity: _identity, ...member } = await inspect(path);
    if (path === "evidence/source/normalized.jsonl" && member.bytes !== source.receipt.bytes)
      invalid("Normalized source differs from its pinned generation byte receipt");
    inventory.push({
      ...member,
      role,
      ...(["video", "system", "narration"].includes(role)
        ? { durationUs: snapshot.sourceDurationUs }
        : {}),
    });
  }
  const sourceTime: readonly string[] = ["source", "scenes", "source-transcript"];
  const manifest: PackageManifest = {
    schemaVersion: 1,
    snapshot,
    history,
    inventory,
    transcript: transcript ? "ready" : "unavailable:no_narration",
    acquisition: {
      recordingId: snapshot.recordingId,
      sourceId: snapshot.sourceId,
      sourceGeneration: source.generation,
      narration: narration
        ? "acquired"
        : source.receipt.header?.microphone
          ? "not_acquired"
          : "not_requested",
      system: system
        ? "acquired"
        : source.receipt.header?.systemAudio
          ? "not_acquired"
          : "not_requested",
    },
    evidence: (
      [
        ["source", source.generation, sourcePolicy],
        ["scenes", scenes.generation, scenes.policy],
        ["index", index.generation, index.selectionPolicy],
        ["events", snapshot.revisionId, timelineEventPolicy],
        ...(transcript
          ? transcriptKinds.map((kind) => [kind, transcript.generation, transcriptPolicy] as const)
          : []),
      ] as const
    ).map(([kind, generation, policy]) => ({
      artifact: {
        reference: {
          kind,
          recordingId: snapshot.recordingId,
          sourceId: snapshot.sourceId,
          revisionId: sourceTime.includes(kind) ? "r0" : snapshot.revisionId,
        },
        generation,
        policy,
        options: {},
        timeDomain: sourceTime.includes(kind) ? ("source" as const) : ("playback" as const),
      },
      files: inventory
        .filter((entry) =>
          kind === "index"
            ? ["index", "coverage", "image"].includes(entry.role)
            : entry.role === kind,
        )
        .map((entry) => entry.path),
    })),
  };
  const body = JSON.stringify(manifest);
  validateManifest(body, revisionContents, archiveLimits);
  await writeFile(join(input.directory, "manifest.json"), body, { flag: "wx", signal });
  await inspect("manifest.json");
  const planBody = JSON.stringify(plan);
  if (Buffer.byteLength(planBody) > archiveLimits.receiptBytes)
    invalid("ZIP member plan exceeds metadata limit");
  await writeFile(join(input.directory, "zip-plan.json"), planBody, { flag: "wx", signal });
  await checkWorkspace(input);
  await checkWorkspace(zip);
  const planFile = await open(
    join(input.directory, "zip-plan.json"),
    constants.O_RDONLY | O_NOFOLLOW_ANY,
  );
  try {
    return await writeArchive(
      { handle: input.handle, plan: planFile, bytes: expanded },
      zip,
      owners.worker,
      { signal },
    );
  } finally {
    await planFile.close();
  }
}
