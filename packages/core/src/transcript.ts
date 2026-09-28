import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, open, opendir, rm } from "node:fs/promises";
import { basename, join } from "node:path";
import { setImmediate } from "node:timers/promises";
import { z } from "zod";
import { type RevisionStore } from "./library.js";
import { CatalogError, type Catalog } from "./catalog.js";
import { ownerIdentity, type JobOwner } from "./jobs.js";
import type { PageQuery } from "./ordered-pages.js";
import type { SpeechEnginePins, SpeechModelRequest } from "./speech-models.js";
import type { TimeRange } from "./timeline.js";
import { wordKind, wordKindPolicy, type WordKind } from "./word-kind.js";

export const transcriptPolicy = "transcript-v1";

/** What the native `speech.transcribe` operation receives. */
export type SpeechTranscriptionRequest = {
  models: SpeechModelRequest;
  track: {
    source: string;
    streamId?: string;
    sourceOffsetUs: number;
    available: TimeRange[];
  };
  output: string;
};
/** What the native operation answers after publishing `output`; parsed tolerantly of added fields. */
export type SpeechTranscriptionReceipt = {
  output: { file: string; bytes: number; sha256: string };
  engine: {
    runtime: string;
    runtimeVersion: string;
    decoder: string;
    encoderPrecision: string;
    computeUnits: string;
  };
  segments: {
    ordinal: number;
    source: TimeRange;
    state: "transcribed" | "skipped";
    reason?: "too_short" | undefined;
    wordCount: number;
  }[];
  wordCount: number;
};
export type SpeechTranscriber = (
  request: SpeechTranscriptionRequest,
  signal: AbortSignal,
) => Promise<SpeechTranscriptionReceipt>;
export type TranscriptEngine = SpeechEnginePins & {
  modelDigest: string;
  encoderPrecision: string;
  computeUnits: string;
  policy: typeof transcriptPolicy;
  kindPolicy: typeof wordKindPolicy;
};

export type TranscriptOwner = Extract<JobOwner, { kind: "recording" | "asset" }>;
export type TranscriptIdentity = Readonly<{
  owner: TranscriptOwner;
  sourceId: string;
  generation: string;
}>;
export type TranscriptSource = Readonly<
  { durationUs: number } & (
    | { kind: "recording"; sourceGeneration: string }
    | { kind: "asset"; streamId: string; acquisitionId?: string; supportDigest: string }
  )
>;
type TranscriptDetails = {
  engine: TranscriptEngine;
  segmentCount: number;
  wordCount: number;
  gapCount: number;
  /** Longest stored word, bounding the lookback for words covering a source point. */
  maxWordUs: number;
  raw: { bytes: number; sha256: string };
};
export type TranscriptMetadata = TranscriptIdentity &
  TranscriptDetails & {
    source: TranscriptSource;
    track: Pick<SpeechTranscriptionRequest["track"], "source" | "streamId" | "sourceOffsetUs">;
  };
export type RecordingTranscriptIdentity = Readonly<{
  recordingId: string;
  sourceId: string;
  generation: string;
}>;
/** The actual recording/package contract, which has no asset-source variant. */
export type RecordingTranscriptMetadata = RecordingTranscriptIdentity &
  TranscriptDetails & {
    sourceGeneration: string;
    narration: { source: string; sourceOffsetUs: number };
  };
export function recordingTranscriptIdentity(
  value: RecordingTranscriptIdentity,
): TranscriptIdentity {
  return {
    owner: { kind: "recording", recordingId: value.recordingId },
    sourceId: value.sourceId,
    generation: value.generation,
  };
}
export function recordingTranscript(metadata: TranscriptMetadata): RecordingTranscriptMetadata {
  const { owner, source, track, ...details } = metadata;
  if (owner.kind !== "recording" || source.kind !== "recording")
    throw new CatalogError("INVALID_EVIDENCE", "Recording transcript requires a recording source");
  return {
    ...details,
    recordingId: owner.recordingId,
    sourceGeneration: source.sourceGeneration,
    narration: { source: track.source, sourceOffsetUs: track.sourceOffsetUs },
  };
}
export function recordingTranscriptOwner(store: RevisionStore) {
  return (identity: TranscriptIdentity, source: TranscriptSource): void => {
    if (identity.owner.kind !== "recording" || source.kind !== "recording")
      throw new CatalogError("INVALID_EVIDENCE", "Recording transcript requires a recording owner");
    const recording = store.get(identity.owner.recordingId);
    if (
      !store.isAvailable(recording.recordingId) ||
      recording.sourceId !== identity.sourceId ||
      recording.sourceDurationUs === null ||
      recording.sourceDurationUs !== source.durationUs
    )
      throw new CatalogError("UNAVAILABLE", "Recording no longer accepts this transcript source");
  };
}
export type GapReason = "not_acquired" | "too_short";
export type TranscriptWordRecord = {
  ordinal: number;
  text: string;
  kind: WordKind;
  startUs: number;
  endUs: number;
  /** The engine emitted a zero-width word; it is stored as one microsecond so ranges stay half-open. */
  instant: boolean;
  confidence: number | null;
  segment: number;
};
export type TranscriptGapRecord = { startUs: number; endUs: number; reason: GapReason };
/** One readable source interval as the engine saw it. */
export type TranscriptSegmentRecord = {
  ordinal: number;
  startUs: number;
  endUs: number;
  state: "transcribed" | "skipped";
  reason: "too_short" | null;
};
/** Words are ordered by [startUs, ordinal] (the same order as ordinal); gaps by [startUs]; segments by [ordinal]. */
export type TranscriptRecordQuery = Omit<PageQuery, "index">;
export type TranscriptRecords = {
  wordRecords(identity: TranscriptIdentity, query: TranscriptRecordQuery): TranscriptWordRecord[];
  gapRecords(identity: TranscriptIdentity, query: TranscriptRecordQuery): TranscriptGapRecord[];
};

const maxBytes = 268_435_456;
const lineBytes = 67_108_864;
const time = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const range = z.object({ startUs: time, endUs: time });
const label = z.string().min(1).max(128);
const receiptSchema = z.object({
  output: z.object({
    file: z.string(),
    bytes: time.max(maxBytes),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  }),
  engine: z.object({
    runtime: label,
    runtimeVersion: label,
    decoder: label,
    encoderPrecision: label,
    computeUnits: label,
  }),
  segments: z
    .array(
      z.object({
        ordinal: time,
        source: range,
        state: z.enum(["transcribed", "skipped"]),
        reason: z.literal("too_short").optional(),
        wordCount: time,
      }),
    )
    .max(10_000),
  wordCount: time,
});
const lineSchema = z.object({
  ordinal: time,
  source: range,
  state: z.enum(["transcribed", "skipped"]),
  reason: z.literal("too_short").optional(),
  words: z.array(
    z.object({
      text: z.string().min(1).max(1024),
      source: range,
      confidence: z.number().min(0).max(1).nullable().optional(),
    }),
  ),
});
function invalid(message: string): never {
  throw new CatalogError("INVALID_RESPONSE", message, {}, true);
}
function component(value: string): string {
  if (!value || basename(value) !== value || value === "." || value === "..")
    throw new CatalogError("INVALID_JOB", "Transcript identity is not a path component");
  return value;
}
const where = "ownerKind=? AND ownerId=? AND generation=?";
type GenerationRow = {
  ownerKind: TranscriptOwner["kind"];
  ownerId: string;
  sourceId: string;
  generation: string;
  source: string;
  engine: string;
  track: string;
  segmentCount: number;
  wordCount: number;
  gapCount: number;
  maxWordUs: number;
  rawSha256: string;
  bytes: number;
};

/** Retained transcript rows and raw engine files; the job queue alone decides what is published. */
export class TranscriptStore implements TranscriptRecords {
  hasGenerations(owner: TranscriptOwner): boolean {
    return Boolean(
      this.store.catalog
        .prepare("SELECT 1 FROM transcript_generations WHERE ownerKind=? AND ownerId=? LIMIT 1")
        .get(...ownerIdentity(owner)),
    );
  }
  constructor(
    private readonly store: Catalog,
    private readonly home: string,
    private readonly validateOwner: (
      identity: TranscriptIdentity,
      source: TranscriptSource,
    ) => void,
  ) {
    store.catalog.exec(`
      CREATE TABLE IF NOT EXISTS transcript_generations (
        ownerKind TEXT NOT NULL,ownerId TEXT NOT NULL,sourceId TEXT NOT NULL,generation TEXT NOT NULL,
        source TEXT NOT NULL,engine TEXT NOT NULL,track TEXT NOT NULL,
        segmentCount INTEGER NOT NULL,wordCount INTEGER NOT NULL DEFAULT 0,gapCount INTEGER NOT NULL DEFAULT 0,
        maxWordUs INTEGER NOT NULL DEFAULT 0,rawSha256 TEXT,bytes INTEGER,state TEXT NOT NULL,
        PRIMARY KEY(ownerKind,ownerId,generation)
      ) STRICT;
      CREATE TABLE IF NOT EXISTS transcript_segments (
        ownerKind TEXT NOT NULL,ownerId TEXT NOT NULL,generation TEXT NOT NULL,ordinal INTEGER NOT NULL,
        startUs INTEGER NOT NULL,endUs INTEGER NOT NULL,state TEXT NOT NULL,reason TEXT,
        PRIMARY KEY(ownerKind,ownerId,generation,ordinal)
      ) STRICT;
      CREATE TABLE IF NOT EXISTS transcript_words (
        ownerKind TEXT NOT NULL,ownerId TEXT NOT NULL,generation TEXT NOT NULL,ordinal INTEGER NOT NULL,
        startUs INTEGER NOT NULL,endUs INTEGER NOT NULL,instant INTEGER NOT NULL,text TEXT NOT NULL,
        kind TEXT NOT NULL,confidence REAL,segment INTEGER NOT NULL,
        PRIMARY KEY(ownerKind,ownerId,generation,ordinal)
      ) STRICT;
      CREATE INDEX IF NOT EXISTS transcript_words_time
        ON transcript_words(ownerKind,ownerId,generation,startUs,ordinal);
      CREATE TABLE IF NOT EXISTS transcript_gaps (
        ownerKind TEXT NOT NULL,ownerId TEXT NOT NULL,generation TEXT NOT NULL,startUs INTEGER NOT NULL,
        endUs INTEGER NOT NULL,reason TEXT NOT NULL,
        PRIMARY KEY(ownerKind,ownerId,generation,startUs)
      ) STRICT;
    `);
  }

  /** Owned parent directories must be real directories so removal never follows a link out. */
  private async parent(owner: TranscriptOwner, create = false): Promise<string | null> {
    let path = this.home;
    const names =
      owner.kind === "recording"
        ? ["recordings", component(owner.recordingId), "evidence", "transcript"]
        : ["transcripts", "assets", component(owner.assetId)];
    for (const name of names) {
      path = join(path, name);
      if (create)
        await mkdir(path).catch((error: NodeJS.ErrnoException) => {
          if (error.code !== "EEXIST") throw error;
        });
      try {
        const entry = await lstat(path);
        if (!entry.isDirectory())
          throw new CatalogError("INVALID_EVIDENCE", "Transcript parent is not a directory");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
    }
    return path;
  }

  /** Creates the attempt's empty generation directory and names the file native must publish. */
  async reserve(identity: TranscriptIdentity): Promise<string> {
    const directory = join(
      (await this.parent(identity.owner, true))!,
      component(identity.generation),
    );
    await mkdir(directory);
    return join(directory, "raw.jsonl");
  }

  async ingest(input: {
    identity: TranscriptIdentity;
    source: TranscriptSource;
    request: SpeechTranscriptionRequest;
    receipt: SpeechTranscriptionReceipt;
    pins: SpeechEnginePins & { modelDigest: string };
    signal: AbortSignal;
  }): Promise<TranscriptMetadata> {
    const { identity, request, pins, signal } = input;
    const { owner, sourceId, generation } = identity;
    const [ownerKind, ownerId] = ownerIdentity(owner);
    const source = input.source;
    signal.throwIfAborted();
    if (
      source.kind !== owner.kind ||
      !Number.isSafeInteger(source.durationUs) ||
      source.durationUs < 0 ||
      (source.kind === "asset" &&
        (sourceId !== ownerId || source.streamId !== request.track.streamId))
    )
      throw new CatalogError(
        "INVALID_EVIDENCE",
        "Transcript source does not match its owner or selection",
      );
    this.validateOwner(identity, source);
    const parsed = receiptSchema.safeParse(input.receipt);
    if (!parsed.success) invalid("Transcription receipt is malformed");
    const receipt = parsed.data;
    const available = request.track.available;
    if (
      receipt.output.file !== request.output ||
      receipt.engine.runtime !== pins.runtime ||
      receipt.engine.runtimeVersion !== pins.runtimeVersion ||
      receipt.engine.decoder !== pins.decoder
    )
      invalid("Transcription receipt names another output or engine");
    // Native narrows each acquired interval to the media the selected source actually holds, so a
    // segment is any ordered, nonempty part of one acquired interval; time between segments was not read.
    let words = 0,
      interval = 0,
      readUs = 0;
    for (const [ordinal, segment] of receipt.segments.entries()) {
      if (segment.ordinal !== ordinal)
        invalid("Transcription segment ordinals must be unique and ordered");
      while (interval < available.length && available[interval]!.endUs <= segment.source.startUs)
        interval++;
      const acquired = available[interval];
      if (
        segment.source.startUs < readUs ||
        segment.source.endUs <= segment.source.startUs ||
        !acquired ||
        segment.source.startUs < acquired.startUs ||
        segment.source.endUs > acquired.endUs ||
        (segment.state === "skipped") !== (segment.reason === "too_short") ||
        (segment.state === "skipped" && segment.wordCount !== 0)
      )
        invalid("Transcription segment does not lie in an acquired source interval");
      readUs = segment.source.endUs;
      words += segment.wordCount;
    }
    if (words !== receipt.wordCount) invalid("Transcription word count does not match segments");
    const durationUs = source.durationUs;
    const engine: TranscriptEngine = {
      ...pins,
      encoderPrecision: receipt.engine.encoderPrecision,
      computeUnits: receipt.engine.computeUnits,
      policy: transcriptPolicy,
      kindPolicy: wordKindPolicy,
    };
    const track = {
      source: request.track.source,
      ...(request.track.streamId === undefined ? {} : { streamId: request.track.streamId }),
      sourceOffsetUs: request.track.sourceOffsetUs,
    };
    this.store.catalog
      .prepare(
        `INSERT INTO transcript_generations(ownerKind,ownerId,sourceId,generation,source,engine,track,segmentCount,state)
         VALUES(?,?,?,?,?,?,?,?,'ingesting')`,
      )
      .run(
        ownerKind,
        ownerId,
        sourceId,
        component(generation),
        JSON.stringify(source),
        JSON.stringify(engine),
        JSON.stringify(track),
        receipt.segments.length,
      );
    const insertSegment = this.store.catalog.prepare(
      "INSERT INTO transcript_segments VALUES(?,?,?,?,?,?,?,?)",
    );
    const insertWord = this.store.catalog.prepare(
      "INSERT INTO transcript_words VALUES(?,?,?,?,?,?,?,?,?,?,?)",
    );
    let segments: SpeechTranscriptionReceipt["segments"] = [];
    let batch: TranscriptWordRecord[] = [];
    const flush = async () => {
      signal.throwIfAborted();
      this.store.transaction(() => {
        for (const segment of segments)
          insertSegment.run(
            ownerKind,
            ownerId,
            generation,
            segment.ordinal,
            segment.source.startUs,
            segment.source.endUs,
            segment.state,
            segment.reason ?? null,
          );
        for (const word of batch)
          insertWord.run(
            ownerKind,
            ownerId,
            generation,
            word.ordinal,
            word.startUs,
            word.endUs,
            Number(word.instant),
            word.text,
            word.kind,
            word.confidence,
            word.segment,
          );
      });
      segments = [];
      batch = [];
      await setImmediate(undefined, { signal });
    };

    let lines = 0,
      ordinal = 0,
      maxWordUs = 0,
      previousStartUs = 0,
      previousEndUs = 0;
    const consume = async (bytes: Buffer) => {
      let value: unknown;
      try {
        value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
      } catch {
        invalid("Raw transcript line is not JSON");
      }
      const line = lineSchema.safeParse(value);
      if (!line.success) invalid("Raw transcript line is malformed");
      const segment = receipt.segments[lines++];
      if (
        !segment ||
        line.data.ordinal !== segment.ordinal ||
        line.data.source.startUs !== segment.source.startUs ||
        line.data.source.endUs !== segment.source.endUs ||
        line.data.state !== segment.state ||
        line.data.reason !== segment.reason ||
        line.data.words.length !== segment.wordCount
      )
        invalid("Raw transcript segment differs from its receipt");
      segments.push(segment);
      for (const word of line.data.words) {
        const { source } = word;
        if (source.endUs < source.startUs) invalid("Transcript word range is reversed");
        if (source.startUs < segment.source.startUs || source.endUs > segment.source.endUs)
          invalid("Transcript word lies outside its segment");
        const instant = source.startUs === source.endUs;
        // A zero-width word at the interval end keeps its microsecond inside the interval.
        const startUs = instant
          ? Math.min(source.startUs, segment.source.endUs - 1)
          : source.startUs;
        const endUs = instant ? startUs + 1 : source.endUs;
        if (startUs < previousStartUs) invalid("Transcript words must be ordered by start");
        // A word's span is what a cut removes and what an excerpt plays, so two words may not
        // claim the same time: a word whose span covered the next one would take that word with
        // it when it was cut, and the transcript would then say it was never spoken.
        if (startUs < previousEndUs) invalid("Transcript words must not overlap");
        previousStartUs = startUs;
        previousEndUs = endUs;
        maxWordUs = Math.max(maxWordUs, endUs - startUs);
        batch.push({
          ordinal: ordinal++,
          text: word.text,
          kind: wordKind(word.text),
          startUs,
          endUs,
          instant,
          confidence: word.confidence ?? null,
          segment: segment.ordinal,
        });
        if (batch.length === 256) await flush();
      }
      if (segments.length === 256) await flush();
    };

    const handle = await open(request.output, constants.O_RDONLY | constants.O_NOFOLLOW);
    const hash = createHash("sha256");
    let bytes = 0;
    try {
      if (!(await handle.stat()).isFile()) invalid("Raw transcript is not a regular file");
      // A long interval is one large line; collect its chunks instead of re-copying a growing buffer.
      let parts: Buffer[] = [],
        partBytes = 0;
      for await (const chunk of handle.createReadStream({ highWaterMark: 65_536, signal })) {
        bytes += chunk.length;
        if (bytes > receipt.output.bytes) invalid("Raw transcript exceeds its byte receipt");
        hash.update(chunk);
        let start = 0,
          newline: number;
        while ((newline = chunk.indexOf(10, start)) >= 0) {
          await consume(Buffer.concat([...parts, chunk.subarray(start, newline)]));
          parts = [];
          partBytes = 0;
          start = newline + 1;
        }
        if (start < chunk.length) {
          parts.push(chunk.subarray(start));
          partBytes += chunk.length - start;
        }
        if (partBytes > lineBytes) invalid("Raw transcript line exceeds its read budget");
      }
      await flush();
      if (
        partBytes ||
        lines !== receipt.segments.length ||
        bytes !== receipt.output.bytes ||
        hash.digest("hex") !== receipt.output.sha256
      )
        invalid("Raw transcript does not match its receipt");
    } finally {
      await handle.close();
    }

    const gaps = transcriptGaps(
      receipt.segments.map(({ source, state }) => ({ ...source, state })),
      durationUs,
    );
    signal.throwIfAborted();
    return this.store.transaction(() => {
      const insertGap = this.store.catalog.prepare(
        "INSERT INTO transcript_gaps VALUES(?,?,?,?,?,?)",
      );
      for (const gap of gaps)
        insertGap.run(ownerKind, ownerId, generation, gap.startUs, gap.endUs, gap.reason);
      this.validateOwner(identity, source);
      this.store.catalog
        .prepare(
          `UPDATE transcript_generations SET wordCount=?,gapCount=?,maxWordUs=?,rawSha256=?,bytes=?,state='complete' WHERE ${where}`,
        )
        .run(
          ordinal,
          gaps.length,
          maxWordUs,
          receipt.output.sha256,
          bytes,
          ownerKind,
          ownerId,
          generation,
        );
      return metadata(
        this.store.catalog
          .prepare(`SELECT * FROM transcript_generations WHERE ${where}`)
          .get(ownerKind, ownerId, generation) as GenerationRow,
      );
    });
  }

  wordRecords(identity: TranscriptIdentity, query: TranscriptRecordQuery): TranscriptWordRecord[] {
    const rows = this.records("transcript_words", ["startUs", "ordinal"], identity, query) as (Omit<
      TranscriptWordRecord,
      "instant"
    > & { instant: number })[];
    return rows.map(({ instant, ...word }) => ({ ...word, instant: instant === 1 }));
  }

  gapRecords(identity: TranscriptIdentity, query: TranscriptRecordQuery): TranscriptGapRecord[] {
    return this.records("transcript_gaps", ["startUs"], identity, query) as TranscriptGapRecord[];
  }

  segmentRecords(
    identity: TranscriptIdentity,
    query: TranscriptRecordQuery,
  ): TranscriptSegmentRecord[] {
    return this.records(
      "transcript_segments",
      ["ordinal"],
      identity,
      query,
    ) as TranscriptSegmentRecord[];
  }

  private records(
    table: "transcript_words" | "transcript_gaps" | "transcript_segments",
    keys: readonly string[],
    identity: TranscriptIdentity,
    query: TranscriptRecordQuery,
  ): unknown[] {
    const columns = {
      transcript_words: "ordinal,text,kind,startUs,endUs,instant,confidence,segment",
      transcript_gaps: "startUs,endUs,reason",
      transcript_segments: "ordinal,startUs,endUs,state,reason",
    }[table];
    const clauses = [where];
    const args: (string | number)[] = [...ownerIdentity(identity.owner), identity.generation];
    const tuple = keys.length === 1 ? keys[0]! : `(${keys.join(",")})`;
    for (const [bound, operator] of [
      [query.lower, ">"],
      [query.upper, "<"],
    ] as const) {
      if (!bound) continue;
      clauses.push(
        `${tuple}${operator}${bound.inclusive ? "=" : ""}${keys.length === 1 ? "?" : `(${keys.map(() => "?").join(",")})`}`,
      );
      args.push(...bound.key);
    }
    return this.store.catalog
      .prepare(
        `SELECT ${columns} FROM ${table} WHERE ${clauses.join(" AND ")}
         ORDER BY ${keys.map((key) => `${key} ${query.reverse ? "DESC" : "ASC"}`).join(",")} LIMIT ?`,
      )
      .all(...args, query.limit);
  }

  /** Removes one unretained generation's files and rows, yielding between bounded batches. */
  async remove(identity: Pick<TranscriptIdentity, "owner" | "generation">, signal?: AbortSignal) {
    const { owner, generation } = identity;
    const [ownerKind, ownerId] = ownerIdentity(owner);
    const parent = await this.parent(owner);
    if (parent) await rm(join(parent, component(generation)), { recursive: true, force: true });
    for (const table of ["transcript_words", "transcript_segments", "transcript_gaps"]) {
      for (;;) {
        signal?.throwIfAborted();
        const removed = this.store.catalog
          .prepare(
            `DELETE FROM ${table} WHERE rowid IN (SELECT rowid FROM ${table} WHERE ${where} LIMIT 256)`,
          )
          .run(ownerKind, ownerId, generation);
        if (Number(removed.changes) < 256) break;
        await setImmediate(undefined, signal ? { signal } : {});
      }
    }
    this.store.catalog
      .prepare(`DELETE FROM transcript_generations WHERE ${where}`)
      .run(ownerKind, ownerId, generation);
  }

  /**
   * Reclaims every generation `keep` does not hold, whether it left only files (native wrote before
   * ingestion began) or only rows (a crash removed its directory first). Continues past failures.
   */
  async reclaim(
    owner: TranscriptOwner,
    keep: (generation: string) => boolean,
    signal: AbortSignal,
  ): Promise<void> {
    let firstError: unknown;
    let failed = false;
    const visit = async (generation: string) => {
      signal.throwIfAborted();
      if (keep(generation)) return;
      try {
        await this.remove({ owner, generation }, signal);
      } catch (error) {
        signal.throwIfAborted();
        if (!failed) firstError = error;
        failed = true;
      }
    };
    const parent = await this.parent(owner);
    if (parent)
      for await (const entry of await opendir(parent, { bufferSize: 16 })) await visit(entry.name);
    let after = "";
    for (;;) {
      signal.throwIfAborted();
      const row = this.store.catalog
        .prepare(
          "SELECT generation FROM transcript_generations WHERE ownerKind=? AND ownerId=? AND generation>? ORDER BY generation LIMIT 1",
        )
        .get(...ownerIdentity(owner), after) as { generation: string } | undefined;
      if (!row) break;
      after = row.generation;
      await visit(row.generation);
    }
    if (failed) throw firstError;
  }

  /** The caller has fenced this owner and stopped every transcript producer. */
  async purge(owner: TranscriptOwner, signal: AbortSignal): Promise<void> {
    await this.reclaim(owner, () => false, signal);
  }
}

/** Gaps are exactly the source never acquired between segments plus each skipped segment. */
export function transcriptGaps(
  segments: readonly (TimeRange & Pick<TranscriptSegmentRecord, "state">)[],
  durationUs: number,
): TranscriptGapRecord[] {
  const gaps: TranscriptGapRecord[] = [];
  let atUs = 0;
  for (const segment of segments) {
    if (atUs < segment.startUs)
      gaps.push({ startUs: atUs, endUs: segment.startUs, reason: "not_acquired" });
    if (segment.state === "skipped")
      gaps.push({ startUs: segment.startUs, endUs: segment.endUs, reason: "too_short" });
    atUs = segment.endUs;
  }
  if (atUs < durationUs) gaps.push({ startUs: atUs, endUs: durationUs, reason: "not_acquired" });
  return gaps;
}

function metadata(row: GenerationRow): TranscriptMetadata {
  return {
    owner:
      row.ownerKind === "recording"
        ? { kind: "recording", recordingId: row.ownerId }
        : { kind: "asset", assetId: row.ownerId },
    sourceId: row.sourceId,
    generation: row.generation,
    source: JSON.parse(row.source) as TranscriptSource,
    engine: JSON.parse(row.engine) as TranscriptEngine,
    track: JSON.parse(row.track) as TranscriptMetadata["track"],
    segmentCount: row.segmentCount,
    wordCount: row.wordCount,
    gapCount: row.gapCount,
    maxWordUs: row.maxWordUs,
    raw: { bytes: row.bytes, sha256: row.rawSha256 },
  };
}
