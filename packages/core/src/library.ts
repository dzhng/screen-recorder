import { Catalog, CatalogError } from "./catalog.js";
import {
  createOriginalRevision,
  createRevision,
  cutSpans,
  trimSpans,
  type TimelineRevision,
  type TimeRange,
} from "./timeline.js";
export type RecordingState =
  | "preparing"
  | "recording"
  | "paused"
  | "finalizing"
  | "complete"
  | "interrupted"
  | "canceled";
export type Recording = Readonly<{
  recordingId: string;
  sourceId: string;
  creationSequence: number;
  createdAt: string;
  state: RecordingState;
  lifecycleSequence: number;
  interruptionReason: string | null;
  sourceDurationUs: number | null;
  currentRevisionId: string | null;
}>;
/** A capture session reports its device transitions here; core never derives them itself. */
export type LifecycleEvent = Readonly<{ sourceId: string; sequence: number }> &
  Readonly<
    | { state: "recording" | "paused" | "finalizing" | "canceled" }
    | { state: "complete"; sourceDurationUs: number }
    | { state: "interrupted"; reason: string; sourceDurationUs: number | null }
  >;
const nextStates: Readonly<Record<RecordingState, readonly RecordingState[]>> = {
  preparing: ["recording", "interrupted", "canceled"],
  recording: ["recording", "paused", "finalizing", "interrupted", "canceled"],
  paused: ["paused", "recording", "finalizing", "interrupted", "canceled"],
  finalizing: ["finalizing", "complete", "interrupted", "canceled"],
  complete: ["complete"],
  interrupted: ["interrupted"],
  canceled: ["canceled"],
};
const recordingColumns =
  "recordingId,sourceId,creationSequence,createdAt,state,lifecycleSequence,interruptionReason,sourceDurationUs,currentRevisionId";
export type EditRequest = { requestId: string; expectedRevisionId: string } & (
  | { operation: "cut"; ranges: readonly TimeRange[] }
  | { operation: "trim"; range: TimeRange }
  | { operation: "undo" }
  | { operation: "restore"; targetRevisionId: string }
);
function argumentsKey(request: EditRequest): string {
  const range = (value: TimeRange) => [value.startUs, value.endUs];
  return JSON.stringify([
    request.expectedRevisionId,
    request.operation === "cut"
      ? request.ranges.map(range)
      : request.operation === "trim"
        ? range(request.range)
        : request.operation === "restore"
          ? request.targetRevisionId
          : null,
  ]);
}
/** A settled take can no longer leave its state, so a missing source is final rather than pending. */
export function isSettled(state: RecordingState): boolean {
  return nextStates[state].every((next) => next === state);
}
const unsettledStates = (Object.keys(nextStates) as RecordingState[]).filter(
  (state) => !isSettled(state),
);
function settledWithoutVideo(recording: Recording): CatalogError {
  return isSettled(recording.state)
    ? new CatalogError("UNAVAILABLE", "This take has no usable video", {
        state: recording.state,
        interruptionReason: recording.interruptionReason,
      })
    : new CatalogError("NOT_READY", "Source duration is not finalized", { state: recording.state });
}
export type RecordingCursor = Readonly<{ beforeSequence: number }>;
/** What a caller asks a take to be allocated for, canonically, so a replay can be recognized. */
export type AllocationRequest = Readonly<{ requestId: string; arguments: string }>;
/** A take's identity, and whether this request had already been given it. */
export type Allocation = Readonly<{ recording: Recording; replay: boolean }>;
export type HistoryCursor = Readonly<{
  recordingId: string;
  afterOrdinal: number;
  throughOrdinal: number;
}>;
export class RevisionStore extends Catalog {
  constructor(
    path: string,
    private readonly providers: { now: () => string; newId: () => string },
    busyTimeoutMs = 1000,
  ) {
    super(path, busyTimeoutMs);
    this.catalog.exec(`
   CREATE TABLE IF NOT EXISTS recordings (
    creationSequence INTEGER PRIMARY KEY AUTOINCREMENT,recordingId TEXT UNIQUE NOT NULL,sourceId TEXT UNIQUE NOT NULL,
    allocationRequestId TEXT UNIQUE,allocationArguments TEXT,createdAt TEXT NOT NULL,state TEXT NOT NULL,lifecycleSequence INTEGER NOT NULL,
    interruptionReason TEXT,sourceDurationUs INTEGER,currentRevisionId TEXT
   ) STRICT;
   CREATE TABLE IF NOT EXISTS recording_deletions (
    recordingId TEXT PRIMARY KEY REFERENCES recordings(recordingId)
   ) STRICT;
   CREATE TABLE IF NOT EXISTS revisions (
    recordingId TEXT NOT NULL REFERENCES recordings(recordingId),id TEXT NOT NULL,ordinal INTEGER NOT NULL,content TEXT NOT NULL,
    PRIMARY KEY(recordingId,id),UNIQUE(recordingId,ordinal)
   ) STRICT;
   CREATE TABLE IF NOT EXISTS edit_requests (
    recordingId TEXT NOT NULL REFERENCES recordings(recordingId),operation TEXT NOT NULL,requestId TEXT NOT NULL,
    arguments TEXT NOT NULL,result TEXT NOT NULL,PRIMARY KEY(recordingId,operation,requestId)
   ) STRICT;
   CREATE TABLE IF NOT EXISTS undo_stack (
    recordingId TEXT NOT NULL REFERENCES recordings(recordingId),position INTEGER NOT NULL,targetId TEXT NOT NULL,
    PRIMARY KEY(recordingId,position),FOREIGN KEY(recordingId,targetId) REFERENCES revisions(recordingId,id)
   ) STRICT;
  `);
  }
  /**
   * Reserves the recording and capture-source identity a native start needs, before it runs, and
   * says whether this is that request's first allocation or a replay of one already stored. The
   * receipt is durable and carries the canonical arguments it was allocated for, so a request ID
   * replayed after a lost answer names the same take across a relaunch, and the same ID reused for
   * a different take is refused instead of being answered with the first one.
   */
  allocate(request?: AllocationRequest): Allocation {
    return this.transaction(() => {
      if (request) {
        const stored = this.catalog
          .prepare(
            `SELECT ${recordingColumns},allocationArguments FROM recordings WHERE allocationRequestId=?`,
          )
          .get(request.requestId) as (Recording & { allocationArguments: string }) | undefined;
        if (stored) {
          const { allocationArguments, ...recording } = stored;
          if (allocationArguments !== request.arguments)
            throw new CatalogError(
              "REQUEST_CONFLICT",
              "Request ID was already used with different arguments",
            );
          return { recording: this.get(recording.recordingId), replay: true };
        }
      }
      const recordingId = this.providers.newId();
      this.catalog
        .prepare(
          "INSERT INTO recordings(recordingId,sourceId,allocationRequestId,allocationArguments,createdAt,state,lifecycleSequence) VALUES (?,?,?,?,?,'preparing',0)",
        )
        .run(
          recordingId,
          this.providers.newId(),
          request?.requestId ?? null,
          request?.arguments ?? null,
          this.providers.now(),
        );
      return { recording: this.get(recordingId), replay: false };
    });
  }
  get(recordingId: string): Recording {
    const row = this.catalog
      .prepare(
        `SELECT ${recordingColumns} FROM recordings WHERE recordingId=? AND recordingId NOT IN (SELECT recordingId FROM recording_deletions)`,
      )
      .get(recordingId);
    if (!row) throw new CatalogError("NOT_FOUND", "Recording does not exist", { recordingId });
    return row as Recording;
  }
  /** Durable intent fences public access before asynchronous producer shutdown begins. */
  markDeleting(recordingId: string): Recording | null {
    return this.transaction(() => {
      this.catalog
        .prepare(`INSERT OR IGNORE INTO recording_deletions(recordingId)
        SELECT recordingId FROM recordings WHERE recordingId=?`)
        .run(recordingId);
      return this.deleting(recordingId);
    });
  }
  /** Deletion and storage accounting may inspect a marked recording's retained identity. */
  deleting(recordingId: string): Recording | null {
    return (
      (this.catalog
        .prepare(`SELECT ${recordingColumns} FROM recordings
      WHERE recordingId=? AND recordingId IN (SELECT recordingId FROM recording_deletions)`)
        .get(recordingId) as Recording | undefined) ?? null
    );
  }
  deletionsPage(afterId = "", limit = 50): { recordings: Recording[]; nextAfterId: string | null } {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 200)
      throw new CatalogError("INVALID_PARAMS", "Deletion page size must be 1–200");
    const rows = this.catalog
      .prepare(`SELECT ${recordingColumns} FROM recording_deletions JOIN recordings USING(recordingId)
      WHERE recordingId>?
      ORDER BY recordingId LIMIT ?`)
      .all(afterId, limit + 1) as Recording[];
    return {
      recordings: rows.slice(0, limit),
      nextAfterId: rows.length > limit ? rows[limit - 1]!.recordingId : null,
    };
  }
  /** Finalize only after each resource owner has reclaimed its rows and files. Foreign keys keep
   * an omitted owner from silently losing the recording identity needed to finish cleanup. */
  finishDeletion(recordingId: string): void {
    this.transaction(() => {
      if (!this.deleting(recordingId)) {
        if (this.catalog.prepare("SELECT 1 FROM recordings WHERE recordingId=?").get(recordingId))
          throw new CatalogError("INVALID_STATE", "Recording deletion has not been requested");
        return;
      }
      for (const table of [
        "undo_stack",
        "edit_requests",
        "revisions",
        "recording_deletions",
        "recordings",
      ])
        this.catalog.prepare(`DELETE FROM ${table} WHERE recordingId=?`).run(recordingId);
    });
  }
  /** Native closure ends capture priority even if later deletion cleanup fails. */
  settleDeletingCapture(recordingId: string): Recording {
    return this.transaction(() => {
      const recording = this.deleting(recordingId);
      if (!recording)
        throw new CatalogError("INVALID_STATE", "Recording deletion has not been requested");
      if (isSettled(recording.state)) return recording;
      this.catalog
        .prepare(
          "UPDATE recordings SET state='canceled',interruptionReason=NULL WHERE recordingId=?",
        )
        .run(recordingId);
      return { ...recording, state: "canceled", interruptionReason: null };
    });
  }
  /** Whether work for this take may still start or publish: it was neither discarded nor marked for deletion. */
  isAvailable(recordingId: string): boolean {
    return Boolean(
      this.catalog
        .prepare(
          "SELECT 1 FROM recordings WHERE recordingId=? AND state!='canceled' AND recordingId NOT IN (SELECT recordingId FROM recording_deletions)",
        )
        .get(recordingId),
    );
  }
  isDeleting(recordingId: string): boolean {
    return Boolean(
      this.catalog
        .prepare("SELECT 1 FROM recording_deletions WHERE recordingId=?")
        .get(recordingId),
    );
  }
  /**
   * Visits every take the catalog still holds, discarded and deleting ones included. A failed visit
   * does not stop the rest; the first failure is rethrown once every take was visited.
   */
  async forEachRecording(
    signal: AbortSignal,
    visit: (recording: Pick<Recording, "recordingId" | "sourceId">) => Promise<void>,
  ): Promise<void> {
    let after = "";
    let failed = false;
    let firstError: unknown;
    for (;;) {
      signal.throwIfAborted();
      const recording = this.catalog
        .prepare(
          "SELECT recordingId,sourceId FROM recordings WHERE recordingId>? ORDER BY recordingId LIMIT 1",
        )
        .get(after) as Pick<Recording, "recordingId" | "sourceId"> | undefined;
      if (!recording) break;
      after = recording.recordingId;
      try {
        await visit(recording);
      } catch (error) {
        signal.throwIfAborted();
        if (!failed) firstError = error;
        failed = true;
      }
    }
    if (failed) throw firstError;
  }
  /** Creation sequences never move: later takes cannot enter an existing traversal. */
  list(
    cursor: RecordingCursor | null = null,
    limit = 20,
  ): { recordings: readonly Recording[]; nextCursor: RecordingCursor | null } {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
      throw new CatalogError("INVALID_PARAMS", "Recording page size must be 1–100");
    if (cursor && (!Number.isSafeInteger(cursor.beforeSequence) || cursor.beforeSequence < 1))
      throw new CatalogError("INVALID_PARAMS", "Invalid recording page cursor");
    const rows = this.catalog
      .prepare(
        `SELECT ${recordingColumns} FROM recordings
       WHERE state!='canceled' AND recordingId NOT IN (SELECT recordingId FROM recording_deletions) AND creationSequence < ?
       ORDER BY creationSequence DESC LIMIT ?`,
      )
      .all(cursor?.beforeSequence ?? Number.MAX_SAFE_INTEGER, limit + 1) as Recording[];
    const recordings = rows.slice(0, limit);
    return {
      recordings,
      nextCursor:
        rows.length > limit
          ? { beforeSequence: recordings[recordings.length - 1]!.creationSequence }
          : null,
    };
  }
  /**
   * Every take that can still change state, oldest first. A relaunched service reconciles these
   * against their own durable media; nothing else may be left describing a capture that ended.
   */
  unsettled(): Recording[] {
    return this.catalog
      .prepare(
        `SELECT ${recordingColumns} FROM recordings WHERE state IN (${unsettledStates
          .map(() => "?")
          .join(",")}) ORDER BY creationSequence`,
      )
      .all(...unsettledStates) as Recording[];
  }
  latest(): Recording | null {
    return (
      (this.catalog
        .prepare(
          `SELECT ${recordingColumns} FROM recordings WHERE state!='canceled' AND recordingId NOT IN (SELECT recordingId FROM recording_deletions) ORDER BY creationSequence DESC LIMIT 1`,
        )
        .get() as Recording | undefined) ?? null
    );
  }
  /**
   * Applies one reported capture transition. Re-delivery of an already applied sequence keeps the
   * stored state, and an event from a superseded session or a settled take is refused outright.
   */
  ingestLifecycle(recordingId: string, event: LifecycleEvent): Recording {
    if (!Number.isSafeInteger(event.sequence) || event.sequence < 1)
      throw new RangeError("A lifecycle sequence must be a positive safe integer");
    return this.transaction(() => {
      const recording = this.get(recordingId);
      if (event.sourceId !== recording.sourceId)
        throw new CatalogError("INVALID_STATE", "Event belongs to another capture session", {
          sourceId: recording.sourceId,
          reportedSourceId: event.sourceId,
        });
      if (event.sequence <= recording.lifecycleSequence) return recording;
      if (!nextStates[recording.state].includes(event.state))
        throw new CatalogError(
          "INVALID_STATE",
          `A ${recording.state} recording cannot become ${event.state}`,
          { state: recording.state, reportedState: event.state },
        );
      if (event.state === "complete" || event.state === "interrupted")
        this.attachSource(recording, event.sourceDurationUs);
      this.catalog
        .prepare(
          "UPDATE recordings SET state=?,lifecycleSequence=?,interruptionReason=? WHERE recordingId=?",
        )
        .run(
          event.state,
          event.sequence,
          event.state === "interrupted" ? event.reason : null,
          recordingId,
        );
      return this.get(recordingId);
    });
  }
  private insertRevision(recordingId: string, revision: TimelineRevision): void {
    this.catalog
      .prepare("INSERT INTO revisions(recordingId,id,ordinal,content) VALUES (?,?,?,?)")
      .run(recordingId, revision.id, revision.ordinal, JSON.stringify(revision));
    this.catalog
      .prepare("UPDATE recordings SET currentRevisionId=? WHERE recordingId=?")
      .run(revision.id, recordingId);
  }
  /**
   * A null duration is a validated report that no video survived, so it and an attached duration
   * refuse each other in both directions rather than one silently replacing the other.
   */
  private attachSource(recording: Recording, sourceDurationUs: number | null): void {
    if (recording.state === "canceled")
      throw new CatalogError("INVALID_STATE", "A canceled take keeps no source", {
        state: recording.state,
      });
    if (recording.sourceDurationUs !== null) {
      if (recording.sourceDurationUs !== sourceDurationUs)
        throw new CatalogError("INVALID_STATE", "Source duration is immutable", {
          sourceDurationUs: recording.sourceDurationUs,
        });
      return;
    }
    if (sourceDurationUs === null) return;
    if (isSettled(recording.state))
      throw new CatalogError("INVALID_STATE", "This take already reported no usable video", {
        state: recording.state,
        interruptionReason: recording.interruptionReason,
      });
    const original = createOriginalRevision(sourceDurationUs, this.providers.now());
    this.insertRevision(recording.recordingId, original);
    this.catalog
      .prepare("UPDATE recordings SET sourceDurationUs=? WHERE recordingId=?")
      .run(sourceDurationUs, recording.recordingId);
  }
  /** Attaches the validated source duration once, creating the original revision with it. */
  registerSource(recordingId: string, sourceDurationUs: number): Recording {
    return this.transaction(() => {
      this.attachSource(this.get(recordingId), sourceDurationUs);
      return this.get(recordingId);
    });
  }
  /** A discarded take keeps its row for replay and refusal, but none of its timeline is readable. */
  private readable(recordingId: string): Recording {
    const recording = this.get(recordingId);
    if (recording.state === "canceled")
      throw new CatalogError("UNAVAILABLE", "This take was discarded", { state: recording.state });
    return recording;
  }
  revision(recordingId: string, revisionId?: string): TimelineRevision {
    const recording = this.readable(recordingId);
    const id = revisionId ?? recording.currentRevisionId;
    if (id === null) throw settledWithoutVideo(recording);
    const row = this.catalog
      .prepare("SELECT content FROM revisions WHERE recordingId=? AND id=?")
      .get(recordingId, id);
    if (!row)
      throw new CatalogError("NOT_FOUND", "Revision does not exist", {
        recordingId,
        revisionId: id,
      });
    return JSON.parse(row.content as string) as TimelineRevision;
  }
  /** Snapshot revision and all history known at admission, even for a historical export. */
  pinPackageSnapshot(recordingId: string, revisionId?: string) {
    return this.transaction(() => {
      const recording = this.readable(recordingId);
      if (
        !["complete", "interrupted"].includes(recording.state) ||
        recording.sourceDurationUs === null
      )
        throw settledWithoutVideo(recording);
      const revision = this.revision(recordingId, revisionId);
      const throughOrdinal = this.catalog
        .prepare("SELECT MAX(ordinal) AS ordinal FROM revisions WHERE recordingId=?")
        .get(recordingId)!.ordinal as number;
      return {
        snapshot: {
          recordingId,
          sourceId: recording.sourceId,
          revisionId: revision.id,
          sourceDurationUs: recording.sourceDurationUs,
          historyThroughOrdinal: throughOrdinal,
          capture: {
            state: recording.state as "complete" | "interrupted",
            createdAt: recording.createdAt,
            interruptionReason: recording.interruptionReason,
          },
        },
        historyCursor: { recordingId, afterOrdinal: -1, throughOrdinal },
      };
    });
  }
  edit(recordingId: string, request: EditRequest): TimelineRevision {
    return this.transaction(() => {
      this.readable(recordingId);
      const fingerprint = argumentsKey(request);
      const replay = this.catalog
        .prepare(
          "SELECT arguments,result FROM edit_requests WHERE recordingId=? AND operation=? AND requestId=?",
        )
        .get(recordingId, request.operation, request.requestId);
      if (replay) {
        if (replay.arguments !== fingerprint)
          throw new CatalogError(
            "REQUEST_CONFLICT",
            "Request ID was already used with different arguments",
          );
        return JSON.parse(replay.result as string) as TimelineRevision;
      }
      const current = this.revision(recordingId);
      if (current.id !== request.expectedRevisionId)
        throw new CatalogError("STALE_REVISION", "Current revision has changed", {
          currentRevisionId: current.id,
        });
      let spans: readonly TimeRange[];
      if (request.operation === "cut") spans = cutSpans(current, request.ranges);
      else if (request.operation === "trim") spans = trimSpans(current, request.range);
      else if (request.operation === "restore")
        spans = this.revision(recordingId, request.targetRevisionId).spans;
      else {
        const target = this.catalog
          .prepare(
            "SELECT position,targetId FROM undo_stack WHERE recordingId=? ORDER BY position DESC LIMIT 1",
          )
          .get(recordingId);
        if (!target) throw new CatalogError("NOTHING_TO_UNDO", "No active edit remains to undo");
        spans = this.revision(recordingId, target.targetId as string).spans;
        this.catalog
          .prepare("DELETE FROM undo_stack WHERE recordingId=? AND position=?")
          .run(recordingId, target.position!);
      }
      const result =
        spans === current.spans
          ? current
          : createRevision(current, spans, {
              id: this.providers.newId(),
              createdAt: this.providers.now(),
              operation: request.operation,
            });
      if (result !== current) {
        if (request.operation !== "undo")
          this.catalog
            .prepare(
              "INSERT INTO undo_stack(recordingId,position,targetId) SELECT ?,COALESCE(MAX(position),0)+1,? FROM undo_stack WHERE recordingId=?",
            )
            .run(recordingId, current.id, recordingId);
        this.insertRevision(recordingId, result);
      }
      this.catalog
        .prepare(
          "INSERT INTO edit_requests(recordingId,operation,requestId,arguments,result) VALUES (?,?,?,?,?)",
        )
        .run(
          recordingId,
          request.operation,
          request.requestId,
          fingerprint,
          JSON.stringify(result),
        );
      return result;
    });
  }

  history(
    recordingId: string,
    cursor: HistoryCursor | null = null,
    limit = 100,
  ): { revisions: TimelineRevision[]; nextCursor: HistoryCursor | null } {
    this.readable(recordingId);
    const afterOrdinal = cursor?.afterOrdinal ?? -1;
    const throughOrdinal =
      cursor?.throughOrdinal ??
      (this.catalog
        .prepare("SELECT MAX(ordinal) AS ordinal FROM revisions WHERE recordingId=?")
        .get(recordingId)!.ordinal as number | null) ??
      -1;
    if (
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 500 ||
      !Number.isSafeInteger(afterOrdinal) ||
      afterOrdinal < -1 ||
      !Number.isSafeInteger(throughOrdinal) ||
      throughOrdinal < afterOrdinal ||
      (cursor !== null && cursor.recordingId !== recordingId)
    )
      throw new CatalogError("INVALID_RANGE", "Invalid history page");
    const rows = this.catalog
      .prepare(
        "SELECT content FROM revisions WHERE recordingId=? AND ordinal>? AND ordinal<=? ORDER BY ordinal LIMIT ?",
      )
      .all(recordingId, afterOrdinal, throughOrdinal, limit + 1);
    const revisions = rows
      .slice(0, limit)
      .map((row) => JSON.parse(row.content as string) as TimelineRevision);
    return {
      revisions,
      nextCursor:
        rows.length > limit
          ? { recordingId, afterOrdinal: revisions.at(-1)!.ordinal, throughOrdinal }
          : null,
    };
  }
}
