import { ownerIdentity, type JobOwner } from "./jobs.js";
import { evidenceRecordingId } from "./evidence.js";
import { retainedFileRead } from "./files.js";
import { openRetainedImage } from "./retained-image.js";
import {
  ScreenshotIndexReader,
  type EntryQuery,
  type CoverageQuery,
  type IndexCoverage,
} from "./screenshot-index-read.js";
import { createHash } from "node:crypto";
import { lstatSync, mkdirSync, realpathSync, rmdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { setImmediate } from "node:timers/promises";
import { isDeepStrictEqual } from "node:util";
import { type RevisionStore } from "./library.js";
import { CatalogError, type Catalog } from "./catalog.js";
import type { EvidenceIdentity } from "./evidence.js";
import type { RecordingSceneEvidenceIdentity } from "./scene-evidence.js";
import type { MaterializedFrame } from "./frame-materialization.js";
import type { SelectedCandidate, SelectionCoverage } from "./selection.js";
import { editedToSource, sourceToEdited } from "./timeline.js";

export type ScreenshotIndexIdentity = {
  recordingId: string;
  sourceId: string;
  revisionId: string;
  generation: string;
  sourceIdentity: EvidenceIdentity;
  sceneIdentity: RecordingSceneEvidenceIdentity;
  selectionPolicy: string;
  framePolicy: string;
  trailPolicy: string;
};
export type IndexRecords = {
  identity: { generation: string };
  candidate: { ordinal: number };
  frame: Pick<MaterializedFrame, "file" | "bytes" | "mediaType" | "width" | "height">;
  coverage: { ordinal: number | null };
};
export type RecordingIndexRecords = {
  identity: ScreenshotIndexIdentity;
  candidate: SelectedCandidate;
  frame: MaterializedFrame;
  coverage: SelectionCoverage;
};
export type ScreenshotIndexMetadata<D extends IndexRecords = RecordingIndexRecords> =
  D["identity"] & {
    durationUs: number;
    candidateCount: number;
    coverageCount: number;
    bytes: number;
  };
export type ScreenshotIndexEntry<D extends IndexRecords = RecordingIndexRecords> = {
  candidate: D["candidate"];
  frame: D["frame"];
  coverageCount: number;
};
export type IndexOwner = Extract<JobOwner, { kind: "recording" | "asset" | "project" }>;
export type IndexDomain<D extends IndexRecords> = {
  owner(identity: D["identity"]): IndexOwner;
  pin(identity: D["identity"]): D["identity"];
  begin(identity: D["identity"]): number;
  candidate(
    identity: D["identity"],
    candidate: D["candidate"],
    frame: D["frame"],
    path: string,
  ): void;
  coverage(
    identity: D["identity"],
    candidate: D["candidate"] | null,
    coverage: D["coverage"],
  ): { startUs: number; endUs: number };
  merge(before: D["coverage"], next: D["coverage"]): D["coverage"] | null;
  finish(identity: D["identity"], candidateCount: number): void;
  isDeleting(owner: IndexOwner): boolean;
};
type Generation = {
  identity: string;
  state: string;
  durationUs: number;
  candidateCount: number;
  coverageCount: number;
  bytes: number;
  throughUs: number;
  device: number | null;
  inode: number | null;
};
type Entry = {
  ordinal: number;
  candidate: string;
  frame: string;
  bytes: number;
  device: number;
  inode: number;
  modified: number;
  coverageCount: number;
};
type Coverage = { sequence: number; ordinal: number | null; content: string };
const where = "ownerKind=? AND ownerId=? AND generation=?";
const integer = (n: number) => Number.isSafeInteger(n) && n >= 0;
function invalid(message: string): never {
  throw new CatalogError("INVALID_EVIDENCE", message);
}
function sourceIdentity({ owner, sourceId, generation }: EvidenceIdentity): EvidenceIdentity {
  return { owner, sourceId, generation };
}
function sceneIdentity(identity: RecordingSceneEvidenceIdentity): RecordingSceneEvidenceIdentity {
  const { recordingId, sourceId, generation, policy } = identity;
  return { recordingId, sourceId, generation, policy };
}
function pinnedIdentity(identity: ScreenshotIndexIdentity): ScreenshotIndexIdentity {
  const {
    recordingId,
    sourceId,
    revisionId,
    generation,
    selectionPolicy,
    framePolicy,
    trailPolicy,
  } = identity;
  return {
    recordingId,
    sourceId,
    revisionId,
    generation,
    sourceIdentity: sourceIdentity(identity.sourceIdentity),
    sceneIdentity: sceneIdentity(identity.sceneIdentity),
    selectionPolicy,
    framePolicy,
    trailPolicy,
  };
}
function metadata<D extends IndexRecords>(row: Generation): ScreenshotIndexMetadata<D> {
  return {
    ...JSON.parse(row.identity),
    durationUs: row.durationUs,
    candidateCount: row.candidateCount,
    coverageCount: row.coverageCount,
    bytes: row.bytes,
  };
}
function boundedJson(value: unknown): string {
  const text = JSON.stringify(value);
  if (Buffer.byteLength(text) > 262144) invalid("Index row exceeds storage budget");
  return text;
}
function missing(error: unknown) {
  return (error as NodeJS.ErrnoException).code === "ENOENT";
}

export function validateIndexEntry(
  identity: ScreenshotIndexIdentity,
  revision: import("./timeline.js").TimelineRevision,
  candidate: SelectedCandidate,
  frame: MaterializedFrame,
  path: string,
): void {
  const mapped = editedToSource(revision, candidate.requestedPlaybackUs);
  if (
    !mapped ||
    !isDeepStrictEqual(candidate.kept, mapped.span.source) ||
    candidate.requestedSourceUs !== mapped.sourceUs ||
    !isDeepStrictEqual(
      sourceIdentity(candidate.sourceIdentity),
      sourceIdentity(identity.sourceIdentity),
    ) ||
    !isDeepStrictEqual(
      sceneIdentity(candidate.sceneIdentity),
      sceneIdentity(identity.sceneIdentity),
    ) ||
    (frame.sourceEvidence !== null &&
      (evidenceRecordingId(frame.sourceEvidence) !== identity.recordingId ||
        frame.sourceEvidence.sourceId !== identity.sourceId ||
        frame.sourceEvidence.generation !== identity.sourceIdentity.generation)) ||
    (frame.annotation !== null &&
      (frame.annotation.policy !== identity.trailPolicy ||
        frame.annotation.scene.policy !== identity.sceneIdentity.policy)) ||
    frame.file !== path ||
    frame.recordingId !== identity.recordingId ||
    frame.sourceId !== identity.sourceId ||
    frame.revisionId !== identity.revisionId ||
    frame.requestedSourceUs !== candidate.requestedSourceUs ||
    frame.requestedPlaybackUs !== candidate.requestedPlaybackUs ||
    !isDeepStrictEqual(frame.kept, candidate.kept) ||
    !integer(frame.actualSourceUs) ||
    frame.actualSourceUs < candidate.kept.startUs ||
    frame.actualSourceUs >= candidate.kept.endUs ||
    frame.actualPlaybackUs !== sourceToEdited(revision, frame.actualSourceUs) ||
    frame.distanceUs !== Math.abs(frame.actualSourceUs - frame.requestedSourceUs)
  )
    invalid("Selected image receipt does not match its candidate");
}

export function recordingIndexDomain(store: RevisionStore): IndexDomain<RecordingIndexRecords> {
  return {
    owner: (identity) => ({ kind: "recording", recordingId: identity.recordingId }),
    pin: pinnedIdentity,
    begin(identity) {
      const recording = store.get(identity.recordingId);
      const revision = store.revision(identity.recordingId, identity.revisionId);
      if (
        recording.sourceId !== identity.sourceId ||
        recording.state === "canceled" ||
        evidenceRecordingId(identity.sourceIdentity) !== identity.recordingId ||
        identity.sceneIdentity.recordingId !== identity.recordingId ||
        [identity.sourceIdentity, identity.sceneIdentity].some(
          (value) => value.sourceId !== identity.sourceId || !value.generation,
        ) ||
        !identity.selectionPolicy ||
        !identity.framePolicy ||
        !identity.trailPolicy ||
        !identity.generation
      )
        invalid("Index identity does not match source");
      return revision.durationUs;
    },
    candidate(identity, candidate, frame, path) {
      validateIndexEntry(
        identity,
        store.revision(identity.recordingId, identity.revisionId),
        candidate,
        frame,
        path,
      );
    },
    coverage(identity, candidate, coverage) {
      if (!candidate) invalid("Recording coverage requires a retained candidate");
      const { source, playback } = coverage;
      if (
        ![source.startUs, source.endUs, playback.startUs, playback.endUs].every(integer) ||
        playback.endUs <= playback.startUs ||
        source.endUs - source.startUs !== playback.endUs - playback.startUs ||
        source.startUs < candidate.kept.startUs ||
        source.endUs > candidate.kept.endUs ||
        sourceToEdited(
          store.revision(identity.recordingId, identity.revisionId),
          source.startUs,
        ) !== playback.startUs
      )
        invalid("Index coverage must progress contiguously inside its retained span");
      return playback;
    },
    merge(before, next) {
      if (
        before.ordinal !== next.ordinal ||
        before.equality !== next.equality ||
        before.source.endUs !== next.source.startUs ||
        before.playback.endUs !== next.playback.startUs
      )
        return null;
      return {
        ...before,
        source: { startUs: before.source.startUs, endUs: next.source.endUs },
        playback: { startUs: before.playback.startUs, endUs: next.playback.endUs },
      };
    },
    finish(identity, candidateCount) {
      if (candidateCount === 0) invalid("Index coverage is incomplete");
      if (store.get(identity.recordingId).state === "canceled")
        invalid("Canceled recording cannot finish an index");
    },
    isDeleting: (owner) => owner.kind === "recording" && store.isDeleting(owner.recordingId),
  };
}

/** Owns retained rows and PNGs; only the job queue can publish a finished generation. */
export class ScreenshotIndexStore<
  D extends IndexRecords = RecordingIndexRecords,
> extends ScreenshotIndexReader<D> {
  private readonly home: string;
  private readonly device: number;
  constructor(
    private readonly store: Catalog,
    home: string,
    private readonly domain: IndexDomain<D>,
  ) {
    super();
    this.home = realpathSync(home);
    this.device = lstatSync(this.home).dev;
    store.catalog.exec(`CREATE TABLE IF NOT EXISTS screenshot_index_generations (
    ownerKind TEXT NOT NULL,ownerId TEXT NOT NULL,generation TEXT NOT NULL,identity TEXT NOT NULL,state TEXT NOT NULL,
    durationUs INTEGER NOT NULL,candidateCount INTEGER NOT NULL DEFAULT 0,coverageCount INTEGER NOT NULL DEFAULT 0,
    bytes INTEGER NOT NULL DEFAULT 0,throughUs INTEGER NOT NULL DEFAULT 0,device INTEGER,inode INTEGER,
    PRIMARY KEY(ownerKind,ownerId,generation)
  ) STRICT;
  CREATE TABLE IF NOT EXISTS screenshot_index_entries (
    ownerKind TEXT NOT NULL,ownerId TEXT NOT NULL,generation TEXT NOT NULL,ordinal INTEGER NOT NULL,candidate TEXT NOT NULL,frame TEXT NOT NULL,
    bytes INTEGER NOT NULL,device INTEGER NOT NULL,inode INTEGER NOT NULL,modified REAL NOT NULL,coverageCount INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY(ownerKind,ownerId,generation,ordinal)
  ) STRICT;
  CREATE TABLE IF NOT EXISTS screenshot_index_coverage (
    ownerKind TEXT NOT NULL,ownerId TEXT NOT NULL,generation TEXT NOT NULL,sequence INTEGER NOT NULL,ordinal INTEGER,content TEXT NOT NULL,
    PRIMARY KEY(ownerKind,ownerId,generation,sequence)
  ) STRICT;
  CREATE INDEX IF NOT EXISTS screenshot_index_coverage_candidate ON screenshot_index_coverage(ownerKind,ownerId,generation,ordinal,sequence);`);
  }
  private key(identity: D["identity"]) {
    return [...ownerIdentity(this.domain.owner(identity)), identity.generation];
  }
  private row(identity: D["identity"], state?: string): Generation {
    const row = this.store.catalog
      .prepare(`SELECT * FROM screenshot_index_generations WHERE ${where}`)
      .get(...this.key(identity)) as Generation | undefined;
    if (!row || !isDeepStrictEqual(JSON.parse(row.identity), this.domain.pin(identity)))
      invalid("Index identity does not match retained generation");
    if (state && row.state !== state)
      invalid(
        state === "complete"
          ? "Index generation is not complete"
          : "Index generation is not writable",
      );
    return row;
  }
  private directory(identity: D["identity"], create = false): string {
    const owner = this.domain.owner(identity),
      [kind, id] = ownerIdentity(owner);
    if (!/^[a-zA-Z0-9_-]+$/.test(id) || !identity.generation) invalid("Invalid index identity");
    const home = lstatSync(this.home);
    if (!home.isDirectory() || home.dev !== this.device) invalid("Retained index home changed");
    let path = this.home;
    for (const segment of [
      ...(kind === "recording"
        ? ["recordings", id, "evidence", "index"]
        : ["evidence", "index", kind, id]),
      createHash("sha256").update(identity.generation).digest("hex"),
    ]) {
      path = join(path, segment);
      if (create) {
        try {
          mkdirSync(path);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        }
      }
      const stat = lstatSync(path);
      if (!stat.isDirectory()) invalid("Retained index directory must not be a link");
      if (stat.dev !== this.device) invalid("Retained index must stay on the library filesystem");
    }
    return path;
  }
  private checkedDirectory(identity: D["identity"], row: Generation): string {
    const path = this.directory(identity);
    const stat = lstatSync(path);
    if (stat.ino !== row.inode) invalid("Retained index directory changed");
    return path;
  }

  private openImage(directory: string, row: Generation, entry: Entry) {
    if (entry.device !== row.device) invalid("Retained image belongs to another filesystem");
    // Device numbers can change across boots. Persisted numbers establish that the image
    // and its generation shared a filesystem; current reads must stay on the library's.
    return openRetainedImage(join(directory, `${entry.ordinal}.png`), JSON.parse(entry.frame), {
      device: this.device,
      inode: entry.inode,
      modified: entry.modified,
    });
  }
  begin(identity: D["identity"]): void {
    const durationUs = this.domain.begin(identity);
    this.store.catalog
      .prepare(
        "INSERT INTO screenshot_index_generations(ownerKind,ownerId,generation,identity,state,durationUs) VALUES(?,?,?,?,'building',?)",
      )
      .run(...this.key(identity), boundedJson(this.domain.pin(identity)), durationUs);
    const path = this.directory(identity, true),
      stat = lstatSync(path);
    this.store.catalog
      .prepare(`UPDATE screenshot_index_generations SET device=?,inode=? WHERE ${where}`)
      .run(stat.dev, stat.ino, ...this.key(identity));
  }
  outputPath(identity: D["identity"], ordinal: number): string {
    const row = this.row(identity, "building");
    if (!integer(ordinal) || ordinal !== row.candidateCount)
      invalid("Candidate ordinal must be the next append");
    return join(this.checkedDirectory(identity, row), `${ordinal}.png`);
  }
  private entry(identity: D["identity"], ordinal: number): Entry {
    if (!integer(ordinal)) invalid("Invalid candidate ordinal");
    const entry = this.store.catalog
      .prepare(`SELECT * FROM screenshot_index_entries WHERE ${where} AND ordinal=?`)
      .get(...this.key(identity), ordinal) as Entry | undefined;
    if (!entry) invalid("Unknown selected image");
    return entry;
  }
  appendCandidate(identity: D["identity"], candidate: D["candidate"], frame: D["frame"]): void {
    const path = this.outputPath(identity, candidate.ordinal);
    this.domain.candidate(identity, candidate, frame, path);
    const { file, stat } = openRetainedImage(path, frame);
    file.close();
    this.store.transaction(() => {
      const row = this.row(identity, "building");
      if (row.candidateCount !== candidate.ordinal) invalid("Candidate append moved");
      this.store.catalog
        .prepare("INSERT INTO screenshot_index_entries VALUES(?,?,?,?,?,?,?,?,?,?,0)")
        .run(
          ...this.key(identity),
          candidate.ordinal,
          boundedJson(candidate),
          boundedJson(frame),
          stat.size,
          stat.dev,
          stat.ino,
          stat.mtimeMs,
        );
      this.store.catalog
        .prepare(
          `UPDATE screenshot_index_generations SET candidateCount=candidateCount+1,bytes=bytes+? WHERE ${where}`,
        )
        .run(stat.size, ...this.key(identity));
    });
  }
  appendCoverage(identity: D["identity"], coverage: D["coverage"]): void {
    this.store.transaction(() => {
      const row = this.row(identity, "building");
      const candidate =
        coverage.ordinal === null
          ? null
          : (JSON.parse(this.entry(identity, coverage.ordinal).candidate) as D["candidate"]);
      const extent = this.domain.coverage(identity, candidate, coverage);
      if (
        !integer(extent.startUs) ||
        !integer(extent.endUs) ||
        extent.startUs !== row.throughUs ||
        extent.endUs <= extent.startUs ||
        extent.endUs > row.durationUs
      )
        invalid("Index coverage must progress contiguously inside its retained span");
      const previous = this.store.catalog
        .prepare(
          `SELECT * FROM screenshot_index_coverage WHERE ${where} ORDER BY sequence DESC LIMIT 1`,
        )
        .get(...this.key(identity)) as Coverage | undefined;
      const before = previous ? (JSON.parse(previous.content) as D["coverage"]) : undefined;
      const merged = before ? this.domain.merge(before, coverage) : null;
      if (previous && merged) {
        this.store.catalog
          .prepare(`UPDATE screenshot_index_coverage SET content=? WHERE ${where} AND sequence=?`)
          .run(boundedJson(merged), ...this.key(identity), previous.sequence);
      } else {
        this.store.catalog
          .prepare("INSERT INTO screenshot_index_coverage VALUES(?,?,?,?,?,?)")
          .run(...this.key(identity), row.coverageCount, coverage.ordinal, boundedJson(coverage));
        this.store.catalog
          .prepare(
            `UPDATE screenshot_index_generations SET coverageCount=coverageCount+1 WHERE ${where}`,
          )
          .run(...this.key(identity));
        this.store.catalog
          .prepare(
            `UPDATE screenshot_index_entries SET coverageCount=coverageCount+1 WHERE ${where} AND ordinal=?`,
          )
          .run(...this.key(identity), coverage.ordinal);
      }
      this.store.catalog
        .prepare(`UPDATE screenshot_index_generations SET throughUs=? WHERE ${where}`)
        .run(extent.endUs, ...this.key(identity));
    });
  }
  async finish(identity: D["identity"], signal?: AbortSignal): Promise<ScreenshotIndexMetadata<D>> {
    const row = this.row(identity, "building");
    if (row.throughUs !== row.durationUs) invalid("Index coverage is incomplete");
    signal?.throwIfAborted();
    this.store.catalog
      .prepare(`UPDATE screenshot_index_generations SET state='finishing' WHERE ${where}`)
      .run(...this.key(identity));
    for (let ordinal = 0; ordinal < row.candidateCount; ordinal += 100) {
      signal?.throwIfAborted();
      this.row(identity, "finishing");
      const directory = this.checkedDirectory(identity, row);
      const entries = this.store.catalog
        .prepare(
          `SELECT * FROM screenshot_index_entries WHERE ${where} AND ordinal>=? ORDER BY ordinal LIMIT 100`,
        )
        .all(...this.key(identity), ordinal) as Entry[];
      for (const entry of entries) {
        const file = this.openImage(directory, row, entry);
        file.file.close();
      }
      await setImmediate();
    }
    signal?.throwIfAborted();
    this.row(identity, "finishing");
    this.domain.finish(identity, row.candidateCount);
    this.store.catalog
      .prepare(`UPDATE screenshot_index_generations SET state='complete' WHERE ${where}`)
      .run(...this.key(identity));
    return metadata<D>(this.row(identity, "complete"));
  }
  protected readMetadata(identity: D["identity"]): ScreenshotIndexMetadata<D> {
    return metadata<D>(this.row(identity, "complete"));
  }
  protected entryRows(identity: D["identity"], query: EntryQuery): ScreenshotIndexEntry<D>[] {
    const rows = this.store.catalog
      .prepare(
        `SELECT candidate,frame,coverageCount FROM screenshot_index_entries WHERE ${where} AND ordinal>? ${query.through === undefined ? "" : "AND ordinal<=?"} ORDER BY ordinal LIMIT ?`,
      )
      .all(
        ...this.key(identity),
        query.after,
        ...(query.through === undefined ? [] : [query.through]),
        query.limit,
      ) as Pick<Entry, "candidate" | "frame" | "coverageCount">[];
    return rows.map(({ candidate, frame, coverageCount }) => ({
      candidate: JSON.parse(candidate),
      frame: JSON.parse(frame),
      coverageCount,
    }));
  }
  protected coverageRows(identity: D["identity"], query: CoverageQuery): IndexCoverage<D>[] {
    const rows = this.store.catalog
      .prepare(
        `SELECT sequence,content FROM screenshot_index_coverage WHERE ${where} AND sequence>? ${query.through === undefined ? "" : "AND sequence<=?"} ${query.ordinal === undefined ? "" : "AND ordinal=?"} ORDER BY sequence LIMIT ?`,
      )
      .all(
        ...this.key(identity),
        query.after,
        ...(query.through === undefined ? [] : [query.through]),
        ...(query.ordinal === undefined ? [] : [query.ordinal]),
        query.limit,
      ) as Pick<Coverage, "sequence" | "content">[];
    return rows.map(({ sequence, content }) => ({ sequence, ...JSON.parse(content) }));
  }
  openRead(identity: D["identity"], ordinal: number) {
    const row = this.row(identity, "complete");
    this.readEntry(identity, ordinal);
    const entry = this.entry(identity, ordinal);
    const { file } = this.openImage(this.checkedDirectory(identity, row), row, entry);
    return retainedFileRead(file, entry.bytes);
  }

  async remove(identity: D["identity"]): Promise<void> {
    if (
      !this.store.catalog
        .prepare(`SELECT 1 FROM screenshot_index_generations WHERE ${where}`)
        .get(...this.key(identity))
    )
      return;
    const row = this.row(identity);
    this.store.catalog
      .prepare(`UPDATE screenshot_index_generations SET state='deleting' WHERE ${where}`)
      .run(...this.key(identity));
    let directory: string | undefined;
    try {
      directory =
        row.device === null ? this.directory(identity) : this.checkedDirectory(identity, row);
    } catch (error) {
      if (!missing(error)) throw error;
    }
    // Include the next, possibly rendered but not appended image left by cancellation.
    for (let ordinal = 0; ordinal <= row.candidateCount; ordinal++) {
      if (directory) {
        try {
          unlinkSync(join(directory, `${ordinal}.png`));
        } catch (error) {
          if (!missing(error)) throw error;
        }
      }
      if (ordinal % 100 === 99) {
        await setImmediate();
        if (directory) this.checkedDirectory(identity, row);
      }
    }
    for (const table of ["screenshot_index_entries", "screenshot_index_coverage"]) {
      while (true) {
        const result = this.store.catalog
          .prepare(
            `DELETE FROM ${table} WHERE rowid IN (SELECT rowid FROM ${table} WHERE ${where} LIMIT 100)`,
          )
          .run(...this.key(identity));
        if (Number(result.changes) < 100) break;
        await setImmediate();
      }
    }
    if (directory) {
      try {
        rmdirSync(directory);
      } catch (error) {
        if (!missing(error)) throw error;
      }
    }
    this.store.catalog
      .prepare(`DELETE FROM screenshot_index_generations WHERE ${where}`)
      .run(...this.key(identity));
  }
  /** Called only after deletion has quiesced readers/producers and removed the owned tree. */
  async forgetOwner(owner: IndexOwner, signal: AbortSignal): Promise<void> {
    if (!this.domain.isDeleting(owner))
      throw new CatalogError("INVALID_STATE", "Recording deletion has not been requested");
    for (const table of [
      "screenshot_index_entries",
      "screenshot_index_coverage",
      "screenshot_index_generations",
    ]) {
      for (;;) {
        signal.throwIfAborted();
        const result = this.store.catalog
          .prepare(
            `DELETE FROM ${table} WHERE rowid IN (SELECT rowid FROM ${table} WHERE ownerKind=? AND ownerId=? LIMIT 100)`,
          )
          .run(...ownerIdentity(owner));
        if (Number(result.changes) < 100) break;
        await setImmediate();
      }
    }
  }
  async reclaim(
    owner: IndexOwner,
    keep: (identity: D["identity"]) => boolean,
    signal?: AbortSignal,
  ): Promise<void> {
    let cursor = 0;
    let failureCount = 0;
    let firstFailure: unknown;
    while (true) {
      signal?.throwIfAborted();
      const rows = this.store.catalog
        .prepare(
          "SELECT rowid AS cursor,identity FROM screenshot_index_generations WHERE ownerKind=? AND ownerId=? AND rowid>? ORDER BY rowid LIMIT 100",
        )
        .all(...ownerIdentity(owner), cursor) as { cursor: number; identity: string }[];
      for (const row of rows) {
        signal?.throwIfAborted();
        const identity = JSON.parse(row.identity) as D["identity"];
        try {
          if (!keep(identity)) await this.remove(identity);
        } catch (error) {
          failureCount++;
          firstFailure ??= error;
        }
        cursor = row.cursor;
      }
      if (rows.length < 100) {
        if (failureCount)
          throw new AggregateError(
            [firstFailure],
            `${failureCount} retained index generations could not be reclaimed`,
          );
        return;
      }
      await setImmediate();
    }
  }
}
