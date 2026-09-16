import { createReadStream } from "node:fs";
import { setImmediate } from "node:timers/promises";
import { CatalogError, type RevisionStore } from "./library.js";
import type { TimeRange } from "./timeline.js";

export type EvidenceIdentity = Readonly<{
  recordingId: string;
  sourceId: string;
  generation: string;
}>;
export type SourceEvidenceReceipt = Readonly<{
  file: string;
  journal: string;
  header?: Record<string, unknown> | null;
  originHostUs?: number | null;
  cursorSamples: number;
  geometryRecords: number;
  displaySpaces: number;
  pauseEvents: number;
  audioIntervals: number;
  openPauseHostUs?: number | null;
  firstCursorSourceUs?: number | null;
  lastCursorSourceUs?: number | null;
  lastSequence: number;
  incompleteTail: boolean;
  invalidAtSequence?: number | null;
  finished: boolean;
  bytes: number;
}>;
export type SourceEvidenceMetadata = EvidenceIdentity & { receipt: SourceEvidenceReceipt };
export type RawCursorSample = Record<string, unknown> & {
  sourceUs: number;
  x?: number | null;
  y?: number | null;
  globalX: number;
  globalY: number;
  buttons: number;
  eligibility: string;
  geometryEpoch: number;
};
type RecordRow = { sequence: number; event: string; sourceUs: number | null; content: string };
const maxBytes = 268_435_456;
function invalid(message: string): never {
  throw new CatalogError("INVALID_EVIDENCE", message);
}
function integer(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    invalid("Expected evidence object");
  return value as Record<string, unknown>;
}
function finite(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value);
}
function validateRecord(event: string, data: Record<string, unknown>): void {
  if (event === "cursorSample") {
    if (
      !integer(data.sourceUs) ||
      !integer(data.buttons) ||
      !integer(data.geometryEpoch) ||
      !finite(data.globalX) ||
      !finite(data.globalY) ||
      !["inside", "outside", "unknownGeometry"].includes(data.eligibility as string) ||
      (data.x != null && !finite(data.x)) ||
      (data.y != null && !finite(data.y)) ||
      (data.x == null) !== (data.y == null)
    )
      invalid("Invalid normalized cursor sample");
  } else if (event === "geometry") {
    if (
      !integer(data.epoch) ||
      !integer(data.hostUs) ||
      (data.sourceUs != null && !integer(data.sourceUs))
    )
      invalid("Invalid geometry timing");
    const geometry = object(data.geometry);
    if (
      !integer(geometry.outputWidth) ||
      !integer(geometry.outputHeight) ||
      !finite(geometry.contentScale) ||
      !finite(geometry.scaleFactor)
    )
      invalid("Invalid geometry dimensions");
    for (const key of ["contentRect", "screenRect", "boundingRect", "requestedSourceRect"]) {
      if (key !== "contentRect" && geometry[key] == null) continue;
      const rect = object(geometry[key]);
      if (![rect.x, rect.y, rect.width, rect.height].every(finite))
        invalid("Invalid geometry rectangle");
    }
  } else if (event === "displaySpace") {
    if (!integer(data.hostUs) || !finite(data.zeroOriginHeight)) invalid("Invalid display space");
  } else if (event === "pause") {
    if (!integer(data.atSourceUs) || !integer(data.elapsedPauseUs)) invalid("Invalid pause timing");
  } else if (event === "audioAcquired") {
    if (
      !["narration", "system"].includes(data.role as string) ||
      !integer(data.startUs) ||
      !integer(data.endUs) ||
      data.endUs <= data.startUs
    )
      invalid("Invalid audio acquisition timing");
  } else invalid("Unknown normalized evidence event");
}

/** Indexes native-normalized evidence; the artifact queue alone decides whether to publish it. */
export class SourceEvidenceStore {
  constructor(private readonly store: RevisionStore) {
    if (
      store.catalog
        .prepare(
          "SELECT 1 FROM sqlite_master WHERE type='table' AND name='cursor_evidence_generations'",
        )
        .get()
    )
      throw new CatalogError(
        "UNSUPPORTED_CATALOG",
        "This library has an unsupported source evidence format",
      );
    store.catalog.exec(`
      CREATE TABLE IF NOT EXISTS source_evidence_generations (
        recordingId TEXT NOT NULL,sourceId TEXT NOT NULL,generation TEXT NOT NULL,receipt TEXT,
        PRIMARY KEY(recordingId,sourceId,generation)
      ) STRICT;
      CREATE TABLE IF NOT EXISTS source_evidence_records (
        recordingId TEXT NOT NULL,sourceId TEXT NOT NULL,generation TEXT NOT NULL,
        sequence INTEGER NOT NULL,event TEXT NOT NULL,sourceUs INTEGER,content TEXT NOT NULL,
        PRIMARY KEY(recordingId,sourceId,generation,sequence)
      ) STRICT;
      CREATE INDEX IF NOT EXISTS source_evidence_time ON source_evidence_records
        (recordingId,sourceId,generation,sourceUs,sequence) WHERE event='cursorSample';
      CREATE INDEX IF NOT EXISTS source_evidence_pauses ON source_evidence_records
        (recordingId,sourceId,generation,sourceUs,sequence) WHERE event='pause';
      CREATE INDEX IF NOT EXISTS source_evidence_audio ON source_evidence_records
        (recordingId,sourceId,generation,json_extract(content,'$.role'),sourceUs,sequence) WHERE event='audioAcquired';
    `);
  }
  async ingest(
    input: EvidenceIdentity & {
      file: string;
      receipt: SourceEvidenceReceipt;
      signal?: AbortSignal;
    },
  ): Promise<SourceEvidenceMetadata> {
    const { recordingId, sourceId, generation, receipt, signal } = input;
    signal?.throwIfAborted();
    const recording = this.store.get(recordingId);
    if (recording.state === "canceled") invalid("Canceled recording cannot accept evidence");
    if (!generation || recording.sourceId !== sourceId || receipt.header?.sessionID !== sourceId)
      invalid("Evidence identity does not match its recording");
    if (
      receipt.file !== input.file ||
      receipt.journal !== "capture.journal.jsonl" ||
      ![
        receipt.cursorSamples,
        receipt.geometryRecords,
        receipt.displaySpaces,
        receipt.pauseEvents,
        receipt.audioIntervals,
        receipt.lastSequence,
        receipt.bytes,
      ].every(integer) ||
      receipt.bytes > maxBytes ||
      typeof receipt.incompleteTail !== "boolean" ||
      typeof receipt.finished !== "boolean" ||
      [
        receipt.originHostUs,
        receipt.openPauseHostUs,
        receipt.firstCursorSourceUs,
        receipt.lastCursorSourceUs,
        receipt.invalidAtSequence,
      ].some((v) => v != null && !integer(v)) ||
      Buffer.byteLength(JSON.stringify(receipt)) > 32768
    )
      invalid("Invalid evidence receipt");
    this.store.transaction(() => {
      if (
        this.store.catalog
          .prepare(
            "SELECT 1 FROM source_evidence_generations WHERE recordingId=? AND sourceId=? AND generation=?",
          )
          .get(recordingId, sourceId, generation)
      )
        invalid("Evidence generation already exists");
      this.store.catalog
        .prepare("INSERT INTO source_evidence_generations VALUES(?,?,?,NULL)")
        .run(recordingId, sourceId, generation);
    });
    const insert = this.store.catalog.prepare(
      "INSERT INTO source_evidence_records VALUES(?,?,?,?,?,?,?)",
    );
    let batch: RecordRow[] = [];
    let bytes = 0,
      sequence = 0,
      cursors = 0,
      geometries = 0,
      displays = 0,
      pauses = 0,
      audio = 0;
    const audioEnds = new Map<string, number>();
    let first: number | null = null,
      last: number | null = null;
    const flush = async () => {
      signal?.throwIfAborted();
      this.store.transaction(() => {
        for (const row of batch)
          insert.run(
            recordingId,
            sourceId,
            generation,
            row.sequence,
            row.event,
            row.sourceUs,
            row.content,
          );
      });
      batch = [];
      await setImmediate();
      signal?.throwIfAborted();
    };
    try {
      let pending = Buffer.alloc(0);
      for await (const chunk of createReadStream(input.file, { highWaterMark: 65536, signal })) {
        bytes += chunk.length;
        if (bytes > maxBytes || bytes > receipt.bytes) invalid("Evidence exceeds its byte receipt");
        pending = Buffer.concat([pending, chunk]);
        let newline: number;
        while ((newline = pending.indexOf(10)) >= 0) {
          if (newline > 65536) invalid("Evidence record exceeds read budget");
          const line = pending.subarray(0, newline);
          let record: Record<string, unknown>;
          try {
            record = object(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(line)));
          } catch {
            invalid("Malformed normalized evidence JSON");
          }
          pending = pending.subarray(newline + 1);
          const event = record.event as string,
            data = object(record.data);
          validateRecord(event, data);
          if (event === "cursorSample") {
            cursors++;
            first ??= data.sourceUs as number;
            last = data.sourceUs as number;
          } else if (event === "geometry") geometries++;
          else if (event === "displaySpace") displays++;
          else if (event === "pause") pauses++;
          else {
            audio++;
            const role = data.role as string;
            const previous = audioEnds.get(role);
            if (previous !== undefined && (data.startUs as number) <= previous + 1)
              invalid("Audio acquisition intervals must be ordered and coalesced per role");
            audioEnds.set(role, data.endUs as number);
          }
          batch.push({
            sequence: ++sequence,
            event,
            sourceUs:
              (data.sourceUs as number) ??
              (data.atSourceUs as number) ??
              (data.startUs as number) ??
              null,
            content: JSON.stringify(data),
          });
          if (batch.length === 256) await flush();
        }
        if (pending.length > 65536) invalid("Evidence record exceeds read budget");
      }
      if (
        pending.length ||
        bytes !== receipt.bytes ||
        cursors !== receipt.cursorSamples ||
        geometries !== receipt.geometryRecords ||
        displays !== receipt.displaySpaces ||
        pauses !== receipt.pauseEvents ||
        audio !== receipt.audioIntervals ||
        first !== (receipt.firstCursorSourceUs ?? null) ||
        last !== (receipt.lastCursorSourceUs ?? null)
      )
        invalid("Evidence file does not match its receipt");
      await flush();
      this.store.transaction(() => {
        const current = this.store.get(recordingId);
        if (current.sourceId !== sourceId || current.state === "canceled")
          invalid("Recording no longer accepts evidence");
        this.store.catalog
          .prepare(
            "UPDATE source_evidence_generations SET receipt=? WHERE recordingId=? AND sourceId=? AND generation=?",
          )
          .run(JSON.stringify(receipt), recordingId, sourceId, generation);
      });
      return { recordingId, sourceId, generation, receipt };
    } catch (error) {
      this.removeUnpublished(input);
      throw error;
    }
  }
  page(input: EvidenceIdentity & { range: TimeRange; afterSequence?: number; limit?: number }): {
    samples: (RawCursorSample & { sequence: number })[];
    nextSequence: number | null;
  } {
    const { recordingId, sourceId, generation, range, afterSequence } = input;
    const limit = input.limit ?? 1000;
    if (
      !integer(range.startUs) ||
      !integer(range.endUs) ||
      range.endUs <= range.startUs ||
      !integer(limit) ||
      limit < 1 ||
      limit > 5000 ||
      (afterSequence != null && (!integer(afterSequence) || afterSequence < 1))
    )
      invalid("Invalid cursor page range or limit");
    this.requireComplete(input);
    let afterUs = range.startUs,
      after = 0;
    if (afterSequence != null) {
      const anchor = this.store.catalog
        .prepare(
          "SELECT sourceUs FROM source_evidence_records WHERE recordingId=? AND sourceId=? AND generation=? AND sequence=? AND event='cursorSample'",
        )
        .get(recordingId, sourceId, generation, afterSequence) as { sourceUs: number } | undefined;
      if (!anchor || anchor.sourceUs < range.startUs || anchor.sourceUs >= range.endUs)
        invalid("Cursor continuation is outside this range");
      afterUs = anchor.sourceUs;
      after = afterSequence;
    }
    const rows = this.store.catalog
      .prepare(`SELECT sequence,content FROM source_evidence_records
      WHERE recordingId=? AND sourceId=? AND generation=? AND event='cursorSample'
      AND sourceUs>=? AND sourceUs<? AND (sourceUs,sequence)>(?,?) ORDER BY sourceUs,sequence LIMIT ?`)
      .all(recordingId, sourceId, generation, afterUs, range.endUs, afterUs, after, limit + 1) as {
      sequence: number;
      content: string;
    }[];
    const more = rows.length > limit;
    if (more) rows.pop();
    return {
      samples: rows.map((row) => ({ ...JSON.parse(row.content), sequence: row.sequence })),
      nextSequence: more ? rows.at(-1)!.sequence : null,
    };
  }
  /** Reclaim a dead generation without holding the event loop for its entire index. */
  async reclaim(identity: EvidenceIdentity, signal: AbortSignal): Promise<void> {
    const { recordingId, sourceId, generation } = identity;
    for (;;) {
      signal.throwIfAborted();
      const deleted = this.store.catalog
        .prepare(`DELETE FROM source_evidence_records
        WHERE recordingId=? AND sourceId=? AND generation=? AND sequence IN
        (SELECT sequence FROM source_evidence_records WHERE recordingId=? AND sourceId=? AND generation=? LIMIT 256)`)
        .run(recordingId, sourceId, generation, recordingId, sourceId, generation);
      if (Number(deleted.changes) === 0) break;
      await setImmediate(undefined, { signal });
    }
    signal.throwIfAborted();
    this.store.catalog
      .prepare(
        "DELETE FROM source_evidence_generations WHERE recordingId=? AND sourceId=? AND generation=?",
      )
      .run(recordingId, sourceId, generation);
  }

  private requireComplete({ recordingId, sourceId, generation }: EvidenceIdentity): void {
    if (
      !this.store.catalog
        .prepare(
          "SELECT 1 FROM source_evidence_generations WHERE recordingId=? AND sourceId=? AND generation=? AND receipt IS NOT NULL",
        )
        .get(recordingId, sourceId, generation)
    )
      throw new CatalogError("NOT_READY", "Evidence generation is not indexed");
  }

  private timingRange(range: TimeRange): void {
    if (!integer(range.startUs) || !integer(range.endUs) || range.endUs < range.startUs)
      throw new CatalogError("INVALID_RANGE", "Invalid source timing range");
  }

  /** Pause markers at either retained boundary survive; marker time creates no media duration. */
  pauses(
    identity: EvidenceIdentity,
    range: TimeRange,
  ): { atSourceUs: number; elapsedPauseUs: number }[] {
    this.timingRange(range);
    this.requireComplete(identity);
    const rows = this.store.catalog
      .prepare(`SELECT content FROM source_evidence_records
      WHERE recordingId=? AND sourceId=? AND generation=? AND event='pause'
      AND sourceUs>=? AND sourceUs<=? ORDER BY sourceUs,sequence LIMIT 1001`)
      .all(
        identity.recordingId,
        identity.sourceId,
        identity.generation,
        range.startUs,
        range.endUs,
      ) as { content: string }[];
    if (rows.length > 1000)
      throw new CatalogError("LIMIT_EXCEEDED", "Too many pause boundaries in this range");
    return rows.map((row) => JSON.parse(row.content));
  }

  /** A gap in a requested clip is distinct from a role never acquired anywhere in this take. */
  hasAudio(identity: EvidenceIdentity, role: "narration" | "system"): boolean {
    this.requireComplete(identity);
    return Boolean(
      this.store.catalog
        .prepare(`SELECT 1 FROM source_evidence_records
      WHERE recordingId=? AND sourceId=? AND generation=? AND event='audioAcquired'
      AND json_extract(content,'$.role')=? LIMIT 1`)
        .get(identity.recordingId, identity.sourceId, identity.generation, role),
    );
  }

  /** Coalesced per-role intervals are disjoint, so only one interval before the range can overlap it. */
  audio(identity: EvidenceIdentity, role: "narration" | "system", range: TimeRange): TimeRange[] {
    this.timingRange(range);
    this.requireComplete(identity);
    if (range.startUs === range.endUs) return [];
    const args = [identity.recordingId, identity.sourceId, identity.generation, role] as const;
    const prefix = `SELECT content FROM source_evidence_records
      WHERE recordingId=? AND sourceId=? AND generation=? AND event='audioAcquired'
      AND json_extract(content,'$.role')=?`;
    const prior = this.store.catalog
      .prepare(prefix + " AND sourceUs<=? ORDER BY sourceUs DESC,sequence DESC LIMIT 1")
      .get(...args, range.startUs) as { content: string } | undefined;
    const rows = this.store.catalog
      .prepare(prefix + " AND sourceUs>? AND sourceUs<? ORDER BY sourceUs,sequence LIMIT 1001")
      .all(...args, range.startUs, range.endUs) as { content: string }[];
    const intervals = [...(prior ? [prior] : []), ...rows]
      .map((row) => {
        const interval = JSON.parse(row.content) as TimeRange;
        return {
          startUs: Math.max(interval.startUs, range.startUs),
          endUs: Math.min(interval.endUs, range.endUs),
        };
      })
      .filter((interval) => interval.startUs < interval.endUs);
    if (intervals.length > 1000)
      throw new CatalogError(
        "LIMIT_EXCEEDED",
        "Too many audio acquisition intervals in this range",
      );
    return intervals;
  }

  /** Caller must only remove a generation its artifact queue has not published. */
  removeUnpublished({ recordingId, sourceId, generation }: EvidenceIdentity): void {
    this.store.transaction(() => {
      this.store.catalog
        .prepare(
          "DELETE FROM source_evidence_records WHERE recordingId=? AND sourceId=? AND generation=?",
        )
        .run(recordingId, sourceId, generation);
      this.store.catalog
        .prepare(
          "DELETE FROM source_evidence_generations WHERE recordingId=? AND sourceId=? AND generation=?",
        )
        .run(recordingId, sourceId, generation);
    });
  }
}
