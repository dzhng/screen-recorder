import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, open, opendir, rm } from "node:fs/promises";
import { basename, join } from "node:path";
import { setImmediate } from "node:timers/promises";
import { z } from "zod";
import { CatalogError, type RevisionStore } from "./library.js";
import type { AudioTrackPlan } from "./audio.js";
import type { PageQuery } from "./ordered-pages.js";
import type { SpeechEnginePins, SpeechModelRequest } from "./speech-models.js";
import type { TimeRange } from "./timeline.js";
import { wordKind, wordKindPolicy, type WordKind } from "./word-kind.js";

export const transcriptPolicy = "transcript-v1";

/** What the native `speech.transcribe` operation receives. */
export type SpeechTranscriptionRequest = {
  models: SpeechModelRequest;
  track: AudioTrackPlan;
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

export type TranscriptIdentity = Readonly<{
  recordingId: string;
  sourceId: string;
  generation: string;
}>;
export type TranscriptMetadata = TranscriptIdentity & {
  sourceGeneration: string;
  engine: TranscriptEngine;
  narration: { source: string; sourceOffsetUs: number };
  segmentCount: number;
  wordCount: number;
  gapCount: number;
  /** Longest stored word, which bounds how far before a span a word covering it can start. */
  maxWordUs: number;
  raw: { bytes: number; sha256: string };
};
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
/** Words are ordered by [startUs, ordinal] (the same order as ordinal); gaps by [startUs]. */
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
const where = "recordingId=? AND generation=?";
type GenerationRow = {
  recordingId: string;
  sourceId: string;
  generation: string;
  sourceGeneration: string;
  engine: string;
  narration: string;
  segmentCount: number;
  wordCount: number;
  gapCount: number;
  maxWordUs: number;
  rawSha256: string;
  bytes: number;
};

/** Retained transcript rows and raw engine files; the job queue alone decides what is published. */
export class TranscriptStore implements TranscriptRecords {
  constructor(
    private readonly store: RevisionStore,
    private readonly home: string,
  ) {
    store.catalog.exec(`
      CREATE TABLE IF NOT EXISTS transcript_generations (
        recordingId TEXT NOT NULL,sourceId TEXT NOT NULL,generation TEXT NOT NULL,
        sourceGeneration TEXT NOT NULL,engine TEXT NOT NULL,narration TEXT NOT NULL,
        segmentCount INTEGER NOT NULL,wordCount INTEGER NOT NULL DEFAULT 0,gapCount INTEGER NOT NULL DEFAULT 0,
        maxWordUs INTEGER NOT NULL DEFAULT 0,rawSha256 TEXT,bytes INTEGER,state TEXT NOT NULL,
        PRIMARY KEY(recordingId,generation)
      ) STRICT;
      CREATE TABLE IF NOT EXISTS transcript_segments (
        recordingId TEXT NOT NULL,generation TEXT NOT NULL,ordinal INTEGER NOT NULL,
        startUs INTEGER NOT NULL,endUs INTEGER NOT NULL,state TEXT NOT NULL,reason TEXT,
        PRIMARY KEY(recordingId,generation,ordinal)
      ) STRICT;
      CREATE TABLE IF NOT EXISTS transcript_words (
        recordingId TEXT NOT NULL,generation TEXT NOT NULL,ordinal INTEGER NOT NULL,
        startUs INTEGER NOT NULL,endUs INTEGER NOT NULL,instant INTEGER NOT NULL,text TEXT NOT NULL,
        kind TEXT NOT NULL,confidence REAL,segment INTEGER NOT NULL,
        PRIMARY KEY(recordingId,generation,ordinal)
      ) STRICT;
      CREATE INDEX IF NOT EXISTS transcript_words_time
        ON transcript_words(recordingId,generation,startUs,ordinal);
      CREATE TABLE IF NOT EXISTS transcript_gaps (
        recordingId TEXT NOT NULL,generation TEXT NOT NULL,startUs INTEGER NOT NULL,
        endUs INTEGER NOT NULL,reason TEXT NOT NULL,
        PRIMARY KEY(recordingId,generation,startUs)
      ) STRICT;
    `);
  }

  /** Owned parent directories must be real directories so removal never follows a link out. */
  private async parent(recordingId: string, create = false): Promise<string | null> {
    let path = this.home;
    for (const name of ["recordings", component(recordingId), "evidence", "transcript"]) {
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
      (await this.parent(identity.recordingId, true))!,
      component(identity.generation),
    );
    await mkdir(directory);
    return join(directory, "raw.jsonl");
  }

  async ingest(input: {
    identity: TranscriptIdentity;
    sourceGeneration: string;
    request: SpeechTranscriptionRequest;
    receipt: SpeechTranscriptionReceipt;
    pins: SpeechEnginePins & { modelDigest: string };
    signal: AbortSignal;
  }): Promise<TranscriptMetadata> {
    const { identity, request, pins, signal } = input;
    const { recordingId, sourceId, generation } = identity;
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
    // Native narrows each acquired interval to the media the narration movie actually holds, so a
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
        invalid("Transcription segment does not lie in an acquired narration interval");
      readUs = segment.source.endUs;
      words += segment.wordCount;
    }
    if (words !== receipt.wordCount) invalid("Transcription word count does not match segments");
    const recording = this.store.get(recordingId);
    const durationUs = recording.sourceDurationUs;
    if (recording.state === "canceled" || recording.sourceId !== sourceId || durationUs === null)
      throw new CatalogError("UNAVAILABLE", "Recording no longer accepts a transcript");
    const engine: TranscriptEngine = {
      ...pins,
      encoderPrecision: receipt.engine.encoderPrecision,
      computeUnits: receipt.engine.computeUnits,
      policy: transcriptPolicy,
      kindPolicy: wordKindPolicy,
    };
    const narration = {
      source: request.track.source,
      sourceOffsetUs: request.track.sourceOffsetUs,
    };
    this.store.catalog
      .prepare(
        `INSERT INTO transcript_generations(recordingId,sourceId,generation,sourceGeneration,engine,narration,segmentCount,state)
         VALUES(?,?,?,?,?,?,?,'ingesting')`,
      )
      .run(
        recordingId,
        sourceId,
        component(generation),
        input.sourceGeneration,
        JSON.stringify(engine),
        JSON.stringify(narration),
        receipt.segments.length,
      );
    const insertSegment = this.store.catalog.prepare(
      "INSERT INTO transcript_segments VALUES(?,?,?,?,?,?,?)",
    );
    const insertWord = this.store.catalog.prepare(
      "INSERT INTO transcript_words VALUES(?,?,?,?,?,?,?,?,?,?)",
    );
    let segments: SpeechTranscriptionReceipt["segments"] = [];
    let batch: TranscriptWordRecord[] = [];
    const flush = async () => {
      signal.throwIfAborted();
      this.store.transaction(() => {
        for (const segment of segments)
          insertSegment.run(
            recordingId,
            generation,
            segment.ordinal,
            segment.source.startUs,
            segment.source.endUs,
            segment.state,
            segment.reason ?? null,
          );
        for (const word of batch)
          insertWord.run(
            recordingId,
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
      previousStartUs = 0;
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
        previousStartUs = startUs;
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

    const gaps: TranscriptGapRecord[] = [];
    let atUs = 0;
    for (const segment of receipt.segments) {
      if (atUs < segment.source.startUs)
        gaps.push({ startUs: atUs, endUs: segment.source.startUs, reason: "not_acquired" });
      if (segment.state === "skipped") gaps.push({ ...segment.source, reason: "too_short" });
      atUs = segment.source.endUs;
    }
    if (atUs < durationUs) gaps.push({ startUs: atUs, endUs: durationUs, reason: "not_acquired" });
    signal.throwIfAborted();
    return this.store.transaction(() => {
      const insertGap = this.store.catalog.prepare("INSERT INTO transcript_gaps VALUES(?,?,?,?,?)");
      for (const gap of gaps)
        insertGap.run(recordingId, generation, gap.startUs, gap.endUs, gap.reason);
      if (!this.store.isAvailable(recordingId))
        throw new CatalogError("UNAVAILABLE", "Recording no longer accepts a transcript");
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
          recordingId,
          generation,
        );
      return metadata(
        this.store.catalog
          .prepare(`SELECT * FROM transcript_generations WHERE ${where}`)
          .get(recordingId, generation) as GenerationRow,
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

  private records(
    table: "transcript_words" | "transcript_gaps",
    keys: readonly string[],
    identity: TranscriptIdentity,
    query: TranscriptRecordQuery,
  ): unknown[] {
    const columns =
      table === "transcript_words"
        ? "ordinal,text,kind,startUs,endUs,instant,confidence,segment"
        : "startUs,endUs,reason";
    const clauses = [where];
    const args: (string | number)[] = [identity.recordingId, identity.generation];
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
  async remove(
    identity: Pick<TranscriptIdentity, "recordingId" | "generation">,
    signal?: AbortSignal,
  ) {
    const { recordingId, generation } = identity;
    const parent = await this.parent(recordingId);
    if (parent) await rm(join(parent, component(generation)), { recursive: true, force: true });
    for (const table of ["transcript_words", "transcript_segments", "transcript_gaps"]) {
      for (;;) {
        signal?.throwIfAborted();
        const removed = this.store.catalog
          .prepare(
            `DELETE FROM ${table} WHERE rowid IN (SELECT rowid FROM ${table} WHERE ${where} LIMIT 256)`,
          )
          .run(recordingId, generation);
        if (Number(removed.changes) < 256) break;
        await setImmediate(undefined, signal ? { signal } : {});
      }
    }
    this.store.catalog
      .prepare(`DELETE FROM transcript_generations WHERE ${where}`)
      .run(recordingId, generation);
  }

  /**
   * Reclaims every generation `keep` does not hold, whether it left only files (native wrote before
   * ingestion began) or only rows (a crash removed its directory first). Continues past failures.
   */
  async reclaim(
    recordingId: string,
    keep: (generation: string) => boolean,
    signal: AbortSignal,
  ): Promise<void> {
    let firstError: unknown;
    let failed = false;
    const visit = async (generation: string) => {
      signal.throwIfAborted();
      if (keep(generation)) return;
      try {
        await this.remove({ recordingId, generation }, signal);
      } catch (error) {
        signal.throwIfAborted();
        if (!failed) firstError = error;
        failed = true;
      }
    };
    const parent = await this.parent(recordingId);
    if (parent)
      for await (const entry of await opendir(parent, { bufferSize: 16 })) await visit(entry.name);
    let after = "";
    for (;;) {
      signal.throwIfAborted();
      const row = this.store.catalog
        .prepare(
          "SELECT generation FROM transcript_generations WHERE recordingId=? AND generation>? ORDER BY generation LIMIT 1",
        )
        .get(recordingId, after) as { generation: string } | undefined;
      if (!row) break;
      after = row.generation;
      await visit(row.generation);
    }
    if (failed) throw firstError;
  }

  /** Deletion's hook: the caller has fenced the recording and stopped every transcript producer. */
  async purgeRecording(recordingId: string, signal: AbortSignal): Promise<void> {
    if (!this.store.isDeleting(recordingId))
      throw new CatalogError("INVALID_STATE", "Recording deletion has not been requested");
    await this.reclaim(recordingId, () => false, signal);
  }
}

function metadata(row: GenerationRow): TranscriptMetadata {
  return {
    recordingId: row.recordingId,
    sourceId: row.sourceId,
    generation: row.generation,
    sourceGeneration: row.sourceGeneration,
    engine: JSON.parse(row.engine) as TranscriptEngine,
    narration: JSON.parse(row.narration) as TranscriptMetadata["narration"],
    segmentCount: row.segmentCount,
    wordCount: row.wordCount,
    gapCount: row.gapCount,
    maxWordUs: row.maxWordUs,
    raw: { bytes: row.bytes, sha256: row.rawSha256 },
  };
}
