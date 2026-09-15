import { DatabaseSync } from "node:sqlite";
import {
  createOriginalRevision,
  createRevision,
  cutSpans,
  trimSpans,
  type TimelineRevision,
  type TimeRange,
} from "./timeline.js";
export type Recording = Readonly<{
  recordingId: string;
  creationSequence: number;
  createdAt: string;
  sourceDurationUs: number | null;
  currentRevisionId: string | null;
}>;
export class CatalogError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details: Record<string, unknown> = {},
    readonly retryable = false,
  ) {
    super(message);
  }
}
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
export type HistoryCursor = Readonly<{
  recordingId: string;
  afterOrdinal: number;
  throughOrdinal: number;
}>;
export class RevisionStore {
  private readonly db: DatabaseSync;
  constructor(
    path: string,
    private readonly providers: { now: () => string; newId: () => string },
    busyTimeoutMs = 1000,
  ) {
    if (!Number.isSafeInteger(busyTimeoutMs) || busyTimeoutMs < 0 || busyTimeoutMs > 10000)
      throw new RangeError("SQLite timeout must be 0–10000 milliseconds");
    this.db = new DatabaseSync(path, { timeout: busyTimeoutMs });
    this.db.exec(`
   CREATE TABLE IF NOT EXISTS recordings (
    creationSequence INTEGER PRIMARY KEY AUTOINCREMENT,recordingId TEXT UNIQUE NOT NULL,createdAt TEXT NOT NULL,
    sourceDurationUs INTEGER,currentRevisionId TEXT
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
  close(): void {
    if (this.db.isOpen) this.db.close();
  }
  private transaction<T>(run: () => T): T {
    let began = false;
    try {
      this.db.exec("BEGIN IMMEDIATE");
      began = true;
      const result = run();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      if (began) this.db.exec("ROLLBACK");
      if (error && typeof error === "object" && "errcode" in error && error.errcode === 5)
        throw new CatalogError("STORAGE_BUSY", "Catalog is locked; retry the request", {}, true);
      throw error;
    }
  }
  allocate(): Recording {
    return this.transaction(() => {
      const recordingId = this.providers.newId();
      this.db
        .prepare("INSERT INTO recordings(recordingId,createdAt) VALUES (?,?)")
        .run(recordingId, this.providers.now());
      return this.get(recordingId);
    });
  }
  get(recordingId: string): Recording {
    const row = this.db.prepare("SELECT * FROM recordings WHERE recordingId=?").get(recordingId);
    if (!row) throw new CatalogError("NOT_FOUND", "Recording does not exist", { recordingId });
    return row as Recording;
  }
  latest(): Recording | null {
    return (
      (this.db.prepare("SELECT * FROM recordings ORDER BY creationSequence DESC LIMIT 1").get() as
        | Recording
        | undefined) ?? null
    );
  }
  private insertRevision(recordingId: string, revision: TimelineRevision): void {
    this.db
      .prepare("INSERT INTO revisions(recordingId,id,ordinal,content) VALUES (?,?,?,?)")
      .run(recordingId, revision.id, revision.ordinal, JSON.stringify(revision));
    this.db
      .prepare("UPDATE recordings SET currentRevisionId=? WHERE recordingId=?")
      .run(revision.id, recordingId);
  }
  registerSource(recordingId: string, sourceDurationUs: number): Recording {
    return this.transaction(() => {
      const recording = this.get(recordingId);
      if (recording.sourceDurationUs !== null) {
        if (recording.sourceDurationUs !== sourceDurationUs)
          throw new CatalogError("INVALID_STATE", "Source duration is immutable");
        return recording;
      }
      const original = createOriginalRevision(sourceDurationUs, this.providers.now());
      this.insertRevision(recordingId, original);
      this.db
        .prepare("UPDATE recordings SET sourceDurationUs=? WHERE recordingId=?")
        .run(sourceDurationUs, recordingId);
      return this.get(recordingId);
    });
  }
  revision(recordingId: string, revisionId?: string): TimelineRevision {
    const id = revisionId ?? this.get(recordingId).currentRevisionId;
    if (id === null) throw new CatalogError("NOT_READY", "Source duration is not finalized");
    const row = this.db
      .prepare("SELECT content FROM revisions WHERE recordingId=? AND id=?")
      .get(recordingId, id);
    if (!row)
      throw new CatalogError("NOT_FOUND", "Revision does not exist", {
        recordingId,
        revisionId: id,
      });
    return JSON.parse(row.content as string) as TimelineRevision;
  }
  edit(recordingId: string, request: EditRequest): TimelineRevision {
    return this.transaction(() => {
      const fingerprint = argumentsKey(request);
      const replay = this.db
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
        const target = this.db
          .prepare(
            "SELECT position,targetId FROM undo_stack WHERE recordingId=? ORDER BY position DESC LIMIT 1",
          )
          .get(recordingId);
        if (!target) throw new CatalogError("NOTHING_TO_UNDO", "No active edit remains to undo");
        spans = this.revision(recordingId, target.targetId as string).spans;
        this.db
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
          this.db
            .prepare(
              "INSERT INTO undo_stack(recordingId,position,targetId) SELECT ?,COALESCE(MAX(position),0)+1,? FROM undo_stack WHERE recordingId=?",
            )
            .run(recordingId, current.id, recordingId);
        this.insertRevision(recordingId, result);
      }
      this.db
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
    this.get(recordingId);
    const afterOrdinal = cursor?.afterOrdinal ?? -1;
    const throughOrdinal =
      cursor?.throughOrdinal ??
      (this.db
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
    const rows = this.db
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
