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
import { CatalogError, type RevisionStore } from "./library.js";
import type { EvidenceIdentity } from "./evidence.js";
import type { SceneEvidenceIdentity } from "./scene-evidence.js";
import type { MaterializedFrame } from "./frame-materialization.js";
import type { SelectedCandidate, SelectionCoverage } from "./selection.js";
import { editedToSource, sourceToEdited } from "./timeline.js";

export type ScreenshotIndexIdentity = {
  recordingId: string;
  sourceId: string;
  revisionId: string;
  generation: string;
  sourceIdentity: EvidenceIdentity;
  sceneIdentity: SceneEvidenceIdentity;
  selectionPolicy: string;
  framePolicy: string;
  trailPolicy: string;
};
export type ScreenshotIndexMetadata = ScreenshotIndexIdentity & {
  durationUs: number;
  candidateCount: number;
  coverageCount: number;
  bytes: number;
};
export type ScreenshotIndexEntry = {
  candidate: SelectedCandidate;
  frame: MaterializedFrame;
  coverageCount: number;
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
type Coverage = { sequence: number; ordinal: number; content: string };
const key = (identity: ScreenshotIndexIdentity) => [identity.recordingId, identity.generation];
const where = "recordingId=? AND generation=?";
const integer = (n: number) => Number.isSafeInteger(n) && n >= 0;
function invalid(message: string): never {
  throw new CatalogError("INVALID_EVIDENCE", message);
}
function sourceIdentity({ recordingId, sourceId, generation }: EvidenceIdentity): EvidenceIdentity {
  return { recordingId, sourceId, generation };
}
function sceneIdentity(identity: SceneEvidenceIdentity): SceneEvidenceIdentity {
  return { ...sourceIdentity(identity), policy: identity.policy };
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
function metadata(row: Generation): ScreenshotIndexMetadata {
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
      (frame.sourceEvidence.recordingId !== identity.recordingId ||
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

/** Owns retained rows and PNGs; only the job queue can publish a finished generation. */
export class ScreenshotIndexStore extends ScreenshotIndexReader {
  private readonly home: string;
  constructor(
    private readonly store: RevisionStore,
    home: string,
  ) {
    super();
    this.home = realpathSync(home);
    store.catalog.exec(`CREATE TABLE IF NOT EXISTS screenshot_index_generations (
    recordingId TEXT NOT NULL,generation TEXT NOT NULL,identity TEXT NOT NULL,state TEXT NOT NULL,
    durationUs INTEGER NOT NULL,candidateCount INTEGER NOT NULL DEFAULT 0,coverageCount INTEGER NOT NULL DEFAULT 0,
    bytes INTEGER NOT NULL DEFAULT 0,throughUs INTEGER NOT NULL DEFAULT 0,device INTEGER,inode INTEGER,
    PRIMARY KEY(recordingId,generation)
  ) STRICT;
  CREATE TABLE IF NOT EXISTS screenshot_index_entries (
    recordingId TEXT NOT NULL,generation TEXT NOT NULL,ordinal INTEGER NOT NULL,candidate TEXT NOT NULL,frame TEXT NOT NULL,
    bytes INTEGER NOT NULL,device INTEGER NOT NULL,inode INTEGER NOT NULL,modified REAL NOT NULL,coverageCount INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY(recordingId,generation,ordinal)
  ) STRICT;
  CREATE TABLE IF NOT EXISTS screenshot_index_coverage (
    recordingId TEXT NOT NULL,generation TEXT NOT NULL,sequence INTEGER NOT NULL,ordinal INTEGER NOT NULL,content TEXT NOT NULL,
    PRIMARY KEY(recordingId,generation,sequence)
  ) STRICT;
  CREATE INDEX IF NOT EXISTS screenshot_index_coverage_candidate ON screenshot_index_coverage(recordingId,generation,ordinal,sequence);`);
  }
  private row(identity: ScreenshotIndexIdentity, state?: string): Generation {
    const row = this.store.catalog
      .prepare(`SELECT * FROM screenshot_index_generations WHERE ${where}`)
      .get(...key(identity)) as Generation | undefined;
    if (!row || !isDeepStrictEqual(JSON.parse(row.identity), pinnedIdentity(identity)))
      invalid("Index identity does not match retained generation");
    if (state && row.state !== state)
      invalid(
        state === "complete"
          ? "Index generation is not complete"
          : "Index generation is not writable",
      );
    return row;
  }
  private directory(identity: ScreenshotIndexIdentity, create = false): string {
    if (!/^[a-zA-Z0-9_-]+$/.test(identity.recordingId) || !identity.generation)
      invalid("Invalid index identity");
    if (!lstatSync(this.home).isDirectory()) invalid("Retained index home must not be a link");
    let path = this.home;
    for (const segment of [
      "recordings",
      identity.recordingId,
      "evidence",
      "index",
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
    }
    return path;
  }
  private checkedDirectory(identity: ScreenshotIndexIdentity, row: Generation): string {
    const path = this.directory(identity);
    const stat = lstatSync(path);
    if (stat.dev !== row.device || stat.ino !== row.inode)
      invalid("Retained index directory changed");
    return path;
  }
  begin(identity: ScreenshotIndexIdentity): void {
    const recording = this.store.get(identity.recordingId);
    const revision = this.store.revision(identity.recordingId, identity.revisionId);
    if (
      recording.sourceId !== identity.sourceId ||
      recording.state === "canceled" ||
      [identity.sourceIdentity, identity.sceneIdentity].some(
        (value) =>
          value.recordingId !== identity.recordingId ||
          value.sourceId !== identity.sourceId ||
          !value.generation,
      ) ||
      !identity.selectionPolicy ||
      !identity.framePolicy ||
      !identity.trailPolicy ||
      !identity.generation
    )
      invalid("Index identity does not match source");
    this.store.catalog
      .prepare(
        "INSERT INTO screenshot_index_generations(recordingId,generation,identity,state,durationUs) VALUES(?,?,?,'building',?)",
      )
      .run(...key(identity), boundedJson(pinnedIdentity(identity)), revision.durationUs);
    const path = this.directory(identity, true),
      stat = lstatSync(path);
    this.store.catalog
      .prepare(`UPDATE screenshot_index_generations SET device=?,inode=? WHERE ${where}`)
      .run(stat.dev, stat.ino, ...key(identity));
  }
  outputPath(identity: ScreenshotIndexIdentity, ordinal: number): string {
    const row = this.row(identity, "building");
    if (!integer(ordinal) || ordinal !== row.candidateCount)
      invalid("Candidate ordinal must be the next append");
    return join(this.checkedDirectory(identity, row), `${ordinal}.png`);
  }
  private entry(identity: ScreenshotIndexIdentity, ordinal: number): Entry {
    if (!integer(ordinal)) invalid("Invalid candidate ordinal");
    const entry = this.store.catalog
      .prepare(`SELECT * FROM screenshot_index_entries WHERE ${where} AND ordinal=?`)
      .get(...key(identity), ordinal) as Entry | undefined;
    if (!entry) invalid("Unknown selected image");
    return entry;
  }
  appendCandidate(
    identity: ScreenshotIndexIdentity,
    candidate: SelectedCandidate,
    frame: MaterializedFrame,
  ): void {
    const path = this.outputPath(identity, candidate.ordinal);
    const revision = this.store.revision(identity.recordingId, identity.revisionId);
    validateIndexEntry(identity, revision, candidate, frame, path);
    const { file, stat } = openRetainedImage(path, frame);
    file.close();
    this.store.transaction(() => {
      const row = this.row(identity, "building");
      if (row.candidateCount !== candidate.ordinal) invalid("Candidate append moved");
      this.store.catalog
        .prepare("INSERT INTO screenshot_index_entries VALUES(?,?,?,?,?,?,?,?,?,0)")
        .run(
          ...key(identity),
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
        .run(stat.size, ...key(identity));
    });
  }
  appendCoverage(identity: ScreenshotIndexIdentity, coverage: SelectionCoverage): void {
    this.store.transaction(() => {
      const row = this.row(identity, "building"),
        candidate = JSON.parse(
          this.entry(identity, coverage.ordinal).candidate,
        ) as SelectedCandidate;
      const { source, playback } = coverage;
      if (
        ![source.startUs, source.endUs, playback.startUs, playback.endUs].every(integer) ||
        playback.startUs !== row.throughUs ||
        playback.endUs <= playback.startUs ||
        playback.endUs > row.durationUs ||
        source.endUs - source.startUs !== playback.endUs - playback.startUs ||
        source.startUs < candidate.kept.startUs ||
        source.endUs > candidate.kept.endUs ||
        sourceToEdited(
          this.store.revision(identity.recordingId, identity.revisionId),
          source.startUs,
        ) !== playback.startUs
      )
        invalid("Index coverage must progress contiguously inside its retained span");
      const previous = this.store.catalog
        .prepare(
          `SELECT * FROM screenshot_index_coverage WHERE ${where} ORDER BY sequence DESC LIMIT 1`,
        )
        .get(...key(identity)) as Coverage | undefined;
      const before = previous ? (JSON.parse(previous.content) as SelectionCoverage) : undefined;
      if (
        previous &&
        before &&
        before.ordinal === coverage.ordinal &&
        before.equality === coverage.equality &&
        before.source.endUs === source.startUs &&
        before.playback.endUs === playback.startUs
      ) {
        this.store.catalog
          .prepare(`UPDATE screenshot_index_coverage SET content=? WHERE ${where} AND sequence=?`)
          .run(
            boundedJson({
              ...before,
              source: { startUs: before.source.startUs, endUs: source.endUs },
              playback: { startUs: before.playback.startUs, endUs: playback.endUs },
            }),
            ...key(identity),
            previous.sequence,
          );
      } else {
        this.store.catalog
          .prepare("INSERT INTO screenshot_index_coverage VALUES(?,?,?,?,?)")
          .run(...key(identity), row.coverageCount, coverage.ordinal, boundedJson(coverage));
        this.store.catalog
          .prepare(
            `UPDATE screenshot_index_generations SET coverageCount=coverageCount+1 WHERE ${where}`,
          )
          .run(...key(identity));
        this.store.catalog
          .prepare(
            `UPDATE screenshot_index_entries SET coverageCount=coverageCount+1 WHERE ${where} AND ordinal=?`,
          )
          .run(...key(identity), coverage.ordinal);
      }
      this.store.catalog
        .prepare(`UPDATE screenshot_index_generations SET throughUs=? WHERE ${where}`)
        .run(playback.endUs, ...key(identity));
    });
  }
  async finish(
    identity: ScreenshotIndexIdentity,
    signal?: AbortSignal,
  ): Promise<ScreenshotIndexMetadata> {
    const row = this.row(identity, "building");
    if (row.throughUs !== row.durationUs || row.candidateCount === 0)
      invalid("Index coverage is incomplete");
    signal?.throwIfAborted();
    this.store.catalog
      .prepare(`UPDATE screenshot_index_generations SET state='finishing' WHERE ${where}`)
      .run(...key(identity));
    for (let ordinal = 0; ordinal < row.candidateCount; ordinal += 100) {
      signal?.throwIfAborted();
      this.row(identity, "finishing");
      const directory = this.checkedDirectory(identity, row);
      const entries = this.store.catalog
        .prepare(
          `SELECT * FROM screenshot_index_entries WHERE ${where} AND ordinal>=? ORDER BY ordinal LIMIT 100`,
        )
        .all(...key(identity), ordinal) as Entry[];
      for (const entry of entries) {
        const file = openRetainedImage(
          join(directory, `${entry.ordinal}.png`),
          JSON.parse(entry.frame),
          entry,
        );
        file.file.close();
      }
      await setImmediate();
    }
    signal?.throwIfAborted();
    this.row(identity, "finishing");
    if (this.store.get(identity.recordingId).state === "canceled")
      invalid("Canceled recording cannot finish an index");
    this.store.catalog
      .prepare(`UPDATE screenshot_index_generations SET state='complete' WHERE ${where}`)
      .run(...key(identity));
    return metadata(this.row(identity, "complete"));
  }
  protected readMetadata(identity: ScreenshotIndexIdentity): ScreenshotIndexMetadata {
    return metadata(this.row(identity, "complete"));
  }
  protected entryRows(
    identity: ScreenshotIndexIdentity,
    query: EntryQuery,
  ): ScreenshotIndexEntry[] {
    const rows = this.store.catalog
      .prepare(
        `SELECT candidate,frame,coverageCount FROM screenshot_index_entries WHERE ${where} AND ordinal>? ${query.through === undefined ? "" : "AND ordinal<=?"} ORDER BY ordinal LIMIT ?`,
      )
      .all(
        ...key(identity),
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
  protected coverageRows(identity: ScreenshotIndexIdentity, query: CoverageQuery): IndexCoverage[] {
    const rows = this.store.catalog
      .prepare(
        `SELECT sequence,content FROM screenshot_index_coverage WHERE ${where} AND sequence>? ${query.through === undefined ? "" : "AND sequence<=?"} ${query.ordinal === undefined ? "" : "AND ordinal=?"} ORDER BY sequence LIMIT ?`,
      )
      .all(
        ...key(identity),
        query.after,
        ...(query.through === undefined ? [] : [query.through]),
        ...(query.ordinal === undefined ? [] : [query.ordinal]),
        query.limit,
      ) as Pick<Coverage, "sequence" | "content">[];
    return rows.map(({ sequence, content }) => ({ sequence, ...JSON.parse(content) }));
  }
  openRead(identity: ScreenshotIndexIdentity, ordinal: number) {
    const row = this.row(identity, "complete");
    this.readEntry(identity, ordinal);
    const entry = this.entry(identity, ordinal);
    const { file } = openRetainedImage(
      join(this.checkedDirectory(identity, row), `${ordinal}.png`),
      JSON.parse(entry.frame),
      entry,
    );
    return retainedFileRead(file, entry.bytes);
  }

  async remove(identity: ScreenshotIndexIdentity): Promise<void> {
    if (
      !this.store.catalog
        .prepare(`SELECT 1 FROM screenshot_index_generations WHERE ${where}`)
        .get(...key(identity))
    )
      return;
    const row = this.row(identity);
    this.store.catalog
      .prepare(`UPDATE screenshot_index_generations SET state='deleting' WHERE ${where}`)
      .run(...key(identity));
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
          .run(...key(identity));
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
      .run(...key(identity));
  }
  /** Called only after deletion has quiesced readers/producers and removed the owned tree. */
  async forgetRecording(recordingId: string, signal: AbortSignal): Promise<void> {
    if (!this.store.isDeleting(recordingId))
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
            `DELETE FROM ${table} WHERE rowid IN (SELECT rowid FROM ${table} WHERE recordingId=? LIMIT 100)`,
          )
          .run(recordingId);
        if (Number(result.changes) < 100) break;
        await setImmediate();
      }
    }
  }
  async reclaim(
    recordingId: string,
    keep: (identity: ScreenshotIndexIdentity) => boolean,
    signal?: AbortSignal,
  ): Promise<void> {
    let cursor = 0;
    let failureCount = 0;
    let firstFailure: unknown;
    while (true) {
      signal?.throwIfAborted();
      const rows = this.store.catalog
        .prepare(
          "SELECT rowid AS cursor,identity FROM screenshot_index_generations WHERE recordingId=? AND rowid>? ORDER BY rowid LIMIT 100",
        )
        .all(recordingId, cursor) as { cursor: number; identity: string }[];
      for (const row of rows) {
        signal?.throwIfAborted();
        const identity = JSON.parse(row.identity) as ScreenshotIndexIdentity;
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
