import { CatalogError } from "./catalog.js";
import {
  createOriginalRevision,
  createRevision,
  cutSpans,
  trimSpans,
  type TimelineRevision,
} from "./timeline.js";
import { type TimeRange } from "./presentation-time.js";
import { CaptureStore, isSettled, type Recording } from "./capture-store.js";
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
function settledWithoutVideo(recording: Recording): CatalogError {
  return isSettled(recording.state)
    ? new CatalogError("UNAVAILABLE", "This take has no usable video", {
        state: recording.state,
        interruptionReason: recording.interruptionReason,
      })
    : new CatalogError("NOT_READY", "Source duration is not finalized", { state: recording.state });
}
export type HistoryCursor = Readonly<{
  recordingId: string;
  afterOrdinal: number;
  throughOrdinal: number;
}>;
export class RevisionStore extends CaptureStore {
  constructor(
    path: string,
    providers: { now: () => string; newId: () => string },
    busyTimeoutMs = 1000,
  ) {
    super(path, providers, busyTimeoutMs);
    this.catalog.exec(`
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
  private insertRevision(recordingId: string, revision: TimelineRevision): void {
    this.catalog
      .prepare("INSERT INTO revisions(recordingId,id,ordinal,content) VALUES (?,?,?,?)")
      .run(recordingId, revision.id, revision.ordinal, JSON.stringify(revision));
    this.catalog
      .prepare("UPDATE recordings SET currentRevisionId=? WHERE recordingId=?")
      .run(revision.id, recordingId);
  }
  /** Source attachment and its first editing revision commit or roll back together. */
  protected override storeSource(recordingId: string, sourceDurationUs: number): void {
    const original = createOriginalRevision(sourceDurationUs, this.providers.now());
    this.insertRevision(recordingId, original);
    super.storeSource(recordingId, sourceDurationUs);
  }
  protected override removeRecording(recordingId: string): void {
    for (const table of ["undo_stack", "edit_requests", "revisions"])
      this.catalog.prepare(`DELETE FROM ${table} WHERE recordingId=?`).run(recordingId);
    super.removeRecording(recordingId);
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
