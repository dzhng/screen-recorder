import { createReadStream } from "node:fs";
import { setImmediate } from "node:timers/promises";
import { type RevisionStore } from "./library.js";
import { CatalogError, type Catalog } from "./catalog.js";
import { SourceEvidenceReader, type RecordQuery, type EvidenceIndex } from "./evidence-read.js";

export type EvidenceOwner =
  | Readonly<{ kind: "recording"; recordingId: string }>
  | Readonly<{ kind: "acquisition"; acquisitionId: string }>;
export function evidenceOwnerKey(owner: EvidenceOwner): [EvidenceOwner["kind"], string] {
  return [owner.kind, owner.kind === "recording" ? owner.recordingId : owner.acquisitionId];
}
export function recordingEvidenceOwner(store: RevisionStore): (identity: EvidenceIdentity) => void {
  return ({ owner, sourceId }) => {
    if (owner.kind !== "recording") invalid("Recording evidence requires a recording owner");
    const recording = store.get(owner.recordingId);
    if (recording.state === "canceled" || recording.sourceId !== sourceId)
      invalid("Recording identity no longer accepts evidence");
  };
}
/** Recording-domain readers must reject evidence owned by an acquisition. */
export function evidenceRecordingId(identity: EvidenceIdentity): string {
  if (identity.owner.kind !== "recording") invalid("Evidence requires a recording owner");
  return identity.owner.recordingId;
}
export type EvidenceIdentity = Readonly<{
  owner: EvidenceOwner;
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
export type SourceGeometry = Record<string, unknown> & {
  epoch: number;
  hostUs: number;
  sourceUs?: number | null;
  geometry: Record<string, unknown>;
  sequence: number;
};
export type RecordRow = {
  sequence: number;
  event: string;
  sourceUs: number | null;
  content: string;
};
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
export function validateRecord(event: string, data: Record<string, unknown>): void {
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

/** Receipt shape is shared by native ingest and portable evidence inspection. */
export function validateSourceReceipt(value: unknown, sourceId: string): SourceEvidenceReceipt {
  const receipt = object(value);
  const header = object(receipt.header);
  if (header.sessionID !== sourceId) invalid("Evidence identity does not match its recording");
  if (
    typeof receipt.file !== "string" ||
    !receipt.file ||
    receipt.journal !== "capture.journal.jsonl" ||
    ![
      receipt.cursorSamples,
      receipt.geometryRecords,
      receipt.displaySpaces,
      receipt.pauseEvents,
      receipt.audioIntervals,
      receipt.lastSequence,
    ].every(integer) ||
    !integer(receipt.bytes) ||
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
  return receipt as SourceEvidenceReceipt;
}

/** Indexes native-normalized evidence; the artifact queue alone decides whether to publish it. */
export class SourceEvidenceStore extends SourceEvidenceReader {
  constructor(
    private readonly store: Catalog,
    private readonly validateOwner: (identity: EvidenceIdentity) => void,
  ) {
    super();
    store.catalog.exec(`
      CREATE TABLE IF NOT EXISTS source_evidence_generations (
        ownerKind TEXT NOT NULL,ownerId TEXT NOT NULL,sourceId TEXT NOT NULL,generation TEXT NOT NULL,receipt TEXT,
        PRIMARY KEY(ownerKind,ownerId,sourceId,generation)
      ) STRICT;
      CREATE TABLE IF NOT EXISTS source_evidence_records (
        ownerKind TEXT NOT NULL,ownerId TEXT NOT NULL,sourceId TEXT NOT NULL,generation TEXT NOT NULL,
        sequence INTEGER NOT NULL,event TEXT NOT NULL,sourceUs INTEGER,content TEXT NOT NULL,
        PRIMARY KEY(ownerKind,ownerId,sourceId,generation,sequence)
      ) STRICT;
      CREATE INDEX IF NOT EXISTS source_evidence_time ON source_evidence_records
        (ownerKind,ownerId,sourceId,generation,sourceUs,sequence) WHERE event='cursorSample';
      CREATE INDEX IF NOT EXISTS source_evidence_pauses ON source_evidence_records
        (ownerKind,ownerId,sourceId,generation,sourceUs,sequence) WHERE event='pause';
      CREATE INDEX IF NOT EXISTS source_evidence_geometry ON source_evidence_records
        (ownerKind,ownerId,sourceId,generation,sourceUs,sequence) WHERE event='geometry';
      CREATE INDEX IF NOT EXISTS source_evidence_audio ON source_evidence_records
        (ownerKind,ownerId,sourceId,generation,json_extract(content,'$.role'),sourceUs,sequence) WHERE event='audioAcquired';
    `);
  }
  async ingest(
    input: EvidenceIdentity & {
      file: string;
      receipt: SourceEvidenceReceipt;
      signal?: AbortSignal;
    },
  ): Promise<SourceEvidenceMetadata> {
    const { owner, sourceId, generation, receipt, signal } = input;
    const [ownerKind, ownerId] = evidenceOwnerKey(owner);
    signal?.throwIfAborted();
    this.validateOwner(input);
    if (!generation) invalid("Evidence generation is required");
    validateSourceReceipt(receipt, sourceId);
    if (receipt.file !== input.file) invalid("Invalid evidence receipt");
    this.store.transaction(() => {
      if (
        this.store.catalog
          .prepare(
            "SELECT 1 FROM source_evidence_generations WHERE ownerKind=? AND ownerId=? AND sourceId=? AND generation=?",
          )
          .get(ownerKind, ownerId, sourceId, generation)
      )
        invalid("Evidence generation already exists");
      this.store.catalog
        .prepare("INSERT INTO source_evidence_generations VALUES(?,?,?,?,NULL)")
        .run(ownerKind, ownerId, sourceId, generation);
    });
    const insert = this.store.catalog.prepare(
      "INSERT INTO source_evidence_records VALUES(?,?,?,?,?,?,?,?)",
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
            ownerKind,
            ownerId,
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
        this.validateOwner(input);
        this.store.catalog
          .prepare(
            "UPDATE source_evidence_generations SET receipt=? WHERE ownerKind=? AND ownerId=? AND sourceId=? AND generation=?",
          )
          .run(JSON.stringify(receipt), ownerKind, ownerId, sourceId, generation);
      });
      return { owner, sourceId, generation, receipt };
    } catch (error) {
      this.removeUnpublished(input);
      throw error;
    }
  }
  /** Caller has fenced admission and stopped every source evidence producer. */
  async purge(owner: EvidenceOwner, signal: AbortSignal): Promise<void> {
    for (;;) {
      signal.throwIfAborted();
      const row = this.store.catalog
        .prepare(`SELECT sourceId,generation FROM source_evidence_generations
        WHERE ownerKind=? AND ownerId=? ORDER BY sourceId,generation LIMIT 1`)
        .get(...evidenceOwnerKey(owner)) as { sourceId: string; generation: string } | undefined;
      if (!row) return;
      await this.reclaim({ owner, ...row }, signal);
      await setImmediate(undefined, { signal });
    }
  }

  /** Reclaim a dead generation without holding the event loop for its entire index. */
  async reclaim(identity: EvidenceIdentity, signal: AbortSignal): Promise<void> {
    const { owner, sourceId, generation } = identity;
    const [ownerKind, ownerId] = evidenceOwnerKey(owner);
    for (;;) {
      signal.throwIfAborted();
      const deleted = this.store.catalog
        .prepare(`DELETE FROM source_evidence_records
        WHERE ownerKind=? AND ownerId=? AND sourceId=? AND generation=? AND sequence IN
        (SELECT sequence FROM source_evidence_records WHERE ownerKind=? AND ownerId=? AND sourceId=? AND generation=? LIMIT 256)`)
        .run(ownerKind, ownerId, sourceId, generation, ownerKind, ownerId, sourceId, generation);
      if (Number(deleted.changes) === 0) break;
      await setImmediate(undefined, { signal });
    }
    signal.throwIfAborted();
    this.store.catalog
      .prepare(
        "DELETE FROM source_evidence_generations WHERE ownerKind=? AND ownerId=? AND sourceId=? AND generation=?",
      )
      .run(ownerKind, ownerId, sourceId, generation);
  }

  protected requireComplete({ owner, sourceId, generation }: EvidenceIdentity): void {
    const [ownerKind, ownerId] = evidenceOwnerKey(owner);
    if (
      !this.store.catalog
        .prepare(
          "SELECT 1 FROM source_evidence_generations WHERE ownerKind=? AND ownerId=? AND sourceId=? AND generation=? AND receipt IS NOT NULL",
        )
        .get(ownerKind, ownerId, sourceId, generation)
    )
      throw new CatalogError("NOT_READY", "Evidence generation is not indexed");
  }

  protected records(identity: EvidenceIdentity, query: RecordQuery): RecordRow[] {
    const indexes: Record<EvidenceIndex, { condition: string; keys: string[] }> = {
      cursor: { condition: "event='cursorSample'", keys: ["sourceUs", "sequence"] },
      cursorSequence: { condition: "event='cursorSample'", keys: ["sequence"] },
      geometry: {
        condition: "event='geometry' AND sourceUs IS NOT NULL",
        keys: ["sourceUs", "sequence"],
      },
      unplaced: { condition: "event='geometry' AND sourceUs IS NULL", keys: ["sequence"] },
      pauses: { condition: "event='pause'", keys: ["sourceUs", "sequence"] },
      narration: {
        condition: "event='audioAcquired' AND json_extract(content,'$.role')='narration'",
        keys: ["sourceUs", "sequence"],
      },
      system: {
        condition: "event='audioAcquired' AND json_extract(content,'$.role')='system'",
        keys: ["sourceUs", "sequence"],
      },
    };
    const index = indexes[query.index];
    const clauses = ["ownerKind=? AND ownerId=? AND sourceId=? AND generation=?", index.condition];
    const args: (string | number)[] = [
      ...evidenceOwnerKey(identity.owner),
      identity.sourceId,
      identity.generation,
    ];
    for (const [bound, operator] of [
      [query.lower, ">"],
      [query.upper, "<"],
    ] as const) {
      if (!bound) continue;
      const columns = index.keys.length === 1 ? index.keys[0] : `(${index.keys.join(",")})`;
      const placeholders =
        index.keys.length === 1 ? "?" : `(${index.keys.map(() => "?").join(",")})`;
      clauses.push(`${columns}${operator}${bound.inclusive ? "=" : ""}${placeholders}`);
      args.push(...bound.key);
    }
    args.push(query.limit);
    return this.store.catalog
      .prepare(`SELECT sequence,event,sourceUs,content FROM source_evidence_records ${query.index === "unplaced" ? "INDEXED BY source_evidence_geometry" : ""}
      WHERE ${clauses.join(" AND ")} ORDER BY ${index.keys.map((k) => `${k} ${query.reverse ? "DESC" : "ASC"}`).join(",")} LIMIT ?`)
      .all(...args) as RecordRow[];
  }

  /** Caller must only remove a generation its artifact queue has not published. */
  removeUnpublished({ owner, sourceId, generation }: EvidenceIdentity): void {
    const [ownerKind, ownerId] = evidenceOwnerKey(owner);
    this.store.transaction(() => {
      this.store.catalog
        .prepare(
          "DELETE FROM source_evidence_records WHERE ownerKind=? AND ownerId=? AND sourceId=? AND generation=?",
        )
        .run(ownerKind, ownerId, sourceId, generation);
      this.store.catalog
        .prepare(
          "DELETE FROM source_evidence_generations WHERE ownerKind=? AND ownerId=? AND sourceId=? AND generation=?",
        )
        .run(ownerKind, ownerId, sourceId, generation);
    });
  }
}

/** Consumers see only query capabilities; ingestion and lifetime stay with this store. */
export type SourceTrailRead = Pick<
  SourceEvidenceStore,
  | "page"
  | "latestCursor"
  | "timedGeometryAt"
  | "nextTimedGeometry"
  | "unplacedGeometry"
  | "pauseBoundaries"
  | "geometryChanges"
>;
export type SourceSelectionRead = Pick<
  SourceTrailRead,
  "page" | "pauseBoundaries" | "geometryChanges"
>;
export type SourceAudioRead = Pick<SourceEvidenceStore, "hasAudio" | "audio">;
