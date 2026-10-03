import {
  signedTimeValueSchema,
  timeValueSchema,
  selectionRangeSchema,
  fromTime,
  compare,
  round,
  type SelectionRange,
  type SignedTimeValue,
  type TimeValue,
} from "@screenrec/composition";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { copyImportedFile, fileIdentity, hashFile, type IdentifiedFile } from "./files.js";
import { ResourceReferences } from "./references.js";
import { constants, openSync, fstatSync, closeSync } from "node:fs";
import { lstat, mkdir, open, opendir, rm } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { setImmediate } from "node:timers/promises";
import { z } from "zod";
import type { CaptureStore } from "./capture-store.js";
import { CatalogError, type Catalog } from "./catalog.js";
import { ownerIdentity, type JobOwner } from "./jobs.js";
import type { PageQuery } from "./ordered-pages.js";
import type { SpeechEnginePins, SpeechModelRequest } from "./models.js";
import type { TimeRange } from "./presentation-time.js";
import { wordKind, wordKindPolicy, type WordKind } from "./word-kind.js";

export const transcriptPolicy = "transcript-v1";

/** What the native `speech.transcribe` operation receives. */
export type SpeechTranscriptionRequest = {
  models: SpeechModelRequest;
  track: {
    source: string;
    streamId?: string;
    sourceOffsetUs: SignedTimeValue;
    available: SelectionRange[];
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
    source: SelectionRange;
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

const engineLabel = z.string().min(1).max(256);
export const transcriptEngineSchema = z.strictObject({
  runtime: engineLabel,
  runtimeVersion: engineLabel,
  runtimeRevision: engineLabel,
  decoder: engineLabel,
  model: engineLabel,
  modelRevision: engineLabel,
  modelDigest: engineLabel,
  encoderPrecision: engineLabel,
  computeUnits: engineLabel,
  policy: z.literal(transcriptPolicy),
  kindPolicy: z.literal(wordKindPolicy),
});
const portableInteger = z.int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const portableTranscriptSchema = z
  .strictObject({
    owner: z.strictObject({
      kind: z.literal("asset"),
      assetId: z.string().regex(/^[a-f0-9]{64}$/),
    }),
    sourceId: z.string().regex(/^[a-f0-9]{64}$/),
    generation: z
      .uuid()
      .refine((value) => value === value.toLowerCase(), "Transcript generation must be canonical"),
    source: z
      .strictObject({
        kind: z.literal("asset"),
        streamId: engineLabel,
        acquisitionId: z.uuid().optional(),
        supportDigest: engineLabel,
        durationUs: timeValueSchema,
      })
      .transform(({ acquisitionId, ...source }) => ({
        ...source,
        ...(acquisitionId === undefined ? {} : { acquisitionId }),
      })),
    engine: transcriptEngineSchema,
    track: z.strictObject({
      streamId: engineLabel,
      sourceOffsetUs: signedTimeValueSchema,
    }),
    segmentCount: portableInteger.max(10000),
    wordCount: portableInteger,
    gapCount: portableInteger,
    maxWordUs: portableInteger,
    raw: z.strictObject({
      bytes: portableInteger.max(268435456),
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
    }),
  })
  .refine(
    (value) =>
      value.owner.assetId === value.sourceId && value.source.streamId === value.track.streamId,
    "Transcript source differs from its owner and track",
  );
export type PortableTranscript = z.infer<typeof portableTranscriptSchema>;
export function transcriptGenerationResource(
  identity: Pick<TranscriptIdentity, "owner" | "generation">,
): string {
  return JSON.stringify([...ownerIdentity(identity.owner), identity.generation]);
}
export function portableTranscript(metadata: TranscriptMetadata): PortableTranscript {
  const { source: _source, ...track } = metadata.track;
  return portableTranscriptSchema.parse({ ...metadata, track });
}
export type TranscriptOwner = Extract<JobOwner, { kind: "recording" | "asset" }>;
export type TranscriptIdentity = Readonly<{
  owner: TranscriptOwner;
  sourceId: string;
  generation: string;
}>;
export type TranscriptSource = Readonly<
  | { kind: "recording"; sourceGeneration: string; durationUs: number }
  | {
      kind: "asset";
      streamId: string;
      acquisitionId?: string;
      supportDigest: string;
      durationUs: TimeValue;
    }
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
  if (
    owner.kind !== "recording" ||
    source.kind !== "recording" ||
    typeof track.sourceOffsetUs !== "number"
  )
    throw new CatalogError("INVALID_EVIDENCE", "Recording transcript requires a recording source");
  return {
    ...details,
    recordingId: owner.recordingId,
    sourceGeneration: source.sourceGeneration,
    narration: { source: track.source, sourceOffsetUs: track.sourceOffsetUs },
  };
}
export function recordingTranscriptOwner(store: CaptureStore) {
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
        source: selectionRangeSchema,
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
  source: selectionRangeSchema,
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
  state: string;
};

/** Retained transcript rows and raw engine files; the job queue alone decides what is published. */
export class TranscriptStore implements TranscriptRecords {
  private readonly references: ResourceReferences;
  constructor(
    private readonly store: Catalog,
    private readonly home: string,
    private readonly validateOwner: (
      identity: TranscriptIdentity,
      source: TranscriptSource,
    ) => void,
  ) {
    this.references = new ResourceReferences(store);
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
        startUs INTEGER NOT NULL,endUs INTEGER NOT NULL,source TEXT NOT NULL,state TEXT NOT NULL,reason TEXT,
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

  /** Exclusive startup recovery reaches unpublished assets and pre-index raw directories. */
  async recoverPendingAssets(signal: AbortSignal): Promise<void> {
    let failure: unknown;
    const root = join(this.home, "transcripts", "assets");
    let entries;
    try {
      entries = await opendir(root, { bufferSize: 16 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    if (entries)
      for await (const entry of entries) {
        signal.throwIfAborted();
        const owner = { kind: "asset" as const, assetId: entry.name };
        try {
          await this.reclaim(
            owner,
            (generation) =>
              this.store.catalog
                .prepare(`SELECT state FROM transcript_generations WHERE ${where}`)
                .get(...ownerIdentity(owner), generation)?.state === "complete",
            signal,
          );
        } catch (error) {
          signal.throwIfAborted();
          failure ??= error;
        }
      }
    let cursor = 0;
    for (;;) {
      signal.throwIfAborted();
      const rows = this.store.catalog
        .prepare(
          "SELECT rowid AS cursor,ownerId,generation,state FROM transcript_generations WHERE ownerKind='asset' AND rowid>? ORDER BY rowid LIMIT 100",
        )
        .all(cursor) as { cursor: number; ownerId: string; generation: string; state: string }[];
      for (const row of rows) {
        if (row.state !== "complete")
          try {
            await this.remove(
              { owner: { kind: "asset", assetId: row.ownerId }, generation: row.generation },
              signal,
            );
          } catch (error) {
            signal.throwIfAborted();
            failure ??= error;
          }
        cursor = row.cursor;
      }
      if (rows.length < 100) {
        if (failure) throw failure;
        return;
      }
      await setImmediate(undefined, { signal });
    }
  }
  retainedGeneration(
    identity: Pick<TranscriptIdentity, "owner" | "generation">,
  ): TranscriptMetadata {
    const row = this.store.catalog
      .prepare(`SELECT * FROM transcript_generations WHERE ${where}`)
      .get(...ownerIdentity(identity.owner), identity.generation) as GenerationRow | undefined;
    if (!row || row.state !== "complete")
      throw new CatalogError("NOT_FOUND", "Retained transcript generation is unavailable", {
        generation: identity.generation,
      });
    return metadata(row);
  }

  portableGenerations(assetId: string, limit = 25000): PortableTranscript[] {
    const rows = this.store.catalog
      .prepare(
        "SELECT * FROM transcript_generations WHERE ownerKind='asset' AND ownerId=? ORDER BY generation LIMIT ?",
      )
      .all(assetId, limit + 1) as GenerationRow[];
    if (rows.length > limit)
      throw new CatalogError("LIMIT_EXCEEDED", "Transcript inventory exceeds its limit");
    return rows.map((row) => {
      if (row.state !== "complete")
        throw new CatalogError("PROCESSING_BUSY", "Transcript generation is incomplete", {}, true);
      return portableTranscript(metadata(row));
    });
  }
  portableFile(value: PortableTranscript): IdentifiedFile {
    const path = join(
      this.home,
      "transcripts",
      "assets",
      value.owner.assetId,
      value.generation,
      "raw.jsonl",
    );
    const fd = openSync(path, constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW);
    try {
      const stat = fstatSync(fd, { bigint: true });
      if (!stat.isFile() || stat.size !== BigInt(value.raw.bytes))
        throw new CatalogError("INVALID_STORAGE", "Transcript raw file differs from metadata");
      return { path, bytes: value.raw.bytes, identity: fileIdentity(stat) };
    } finally {
      closeSync(fd);
    }
  }
  portableReceipt(value: PortableTranscript): SpeechTranscriptionReceipt {
    const counts = new Map(
      (
        this.store.catalog
          .prepare(
            `SELECT segment,COUNT(*) AS count FROM transcript_words WHERE ${where} GROUP BY segment`,
          )
          .all(...ownerIdentity(value.owner), value.generation) as {
          segment: number;
          count: number;
        }[]
      ).map((row) => [row.segment, row.count]),
    );
    const segments = this.store.catalog
      .prepare(
        `SELECT ordinal,source,state,reason FROM transcript_segments WHERE ${where} ORDER BY ordinal LIMIT 10001`,
      )
      .all(...ownerIdentity(value.owner), value.generation) as {
      ordinal: number;
      source: string;
      state: "transcribed" | "skipped";
      reason: "too_short" | null;
    }[];
    if (segments.length !== value.segmentCount)
      throw new CatalogError(
        "INVALID_STORAGE",
        "Transcript segment inventory differs from metadata",
      );
    return {
      output: { file: "raw.jsonl", ...value.raw },
      engine: {
        runtime: value.engine.runtime,
        runtimeVersion: value.engine.runtimeVersion,
        decoder: value.engine.decoder,
        encoderPrecision: value.engine.encoderPrecision,
        computeUnits: value.engine.computeUnits,
      },
      wordCount: value.wordCount,
      segments: segments.map((segment) => ({
        ordinal: segment.ordinal,
        source: selectionRangeSchema.parse(JSON.parse(segment.source)),
        state: segment.state,
        ...(segment.reason === null ? {} : { reason: segment.reason }),
        wordCount: counts.get(segment.ordinal) ?? 0,
      })),
    };
  }
  async stagePortable(
    value: unknown,
    receiptValue: unknown,
    raw: IdentifiedFile,
    track: SpeechTranscriptionRequest["track"],
    signal: AbortSignal,
  ) {
    const parsedMetadata = portableTranscriptSchema.safeParse(value),
      parsedReceipt = receiptSchema.safeParse(receiptValue);
    if (!parsedMetadata.success || !parsedReceipt.success)
      throw new CatalogError("INVALID_PACKAGE", "Invalid portable transcript metadata or receipt");
    const expected = parsedMetadata.data,
      receipt = parsedReceipt.data;
    if (
      !isDeepStrictEqual(
        { bytes: receipt.output.bytes, sha256: receipt.output.sha256 },
        expected.raw,
      ) ||
      receipt.output.file !== "raw.jsonl"
    )
      throw new CatalogError("INVALID_PACKAGE", "Transcript raw receipt differs from inventory");
    const prior = this.store.catalog
      .prepare(`SELECT * FROM transcript_generations WHERE ${where}`)
      .get(...ownerIdentity(expected.owner), expected.generation) as GenerationRow | undefined;
    if (prior) {
      if (prior.state !== "complete")
        throw new CatalogError(
          "PROCESSING_BUSY",
          "Transcript generation is already being staged",
          {},
          true,
        );
      const existing = metadata(prior);
      if (
        !isDeepStrictEqual(portableTranscript(existing), expected) ||
        !isDeepStrictEqual(this.portableReceipt(expected), receipt)
      )
        throw new CatalogError(
          "INVALID_PACKAGE",
          "Transcript metadata conflicts with retained generation",
        );
      const file = await open(
        this.portableFile(expected).path,
        constants.O_RDONLY | constants.O_NOFOLLOW,
      );
      try {
        if ((await hashFile(file, expected.raw.bytes, signal)).sha256 !== expected.raw.sha256)
          throw new CatalogError(
            "INVALID_PACKAGE",
            "Transcript raw bytes conflict with retained generation",
          );
      } finally {
        await file.close();
      }
      return {
        metadata: existing,
        close: async () => {},
        publish: () => {
          signal.throwIfAborted();
          this.validateOwner(existing, existing.source);
        },
      };
    }
    let owned = false;
    const close = async () => {
      const row = this.store.catalog
        .prepare(`SELECT state FROM transcript_generations WHERE ${where}`)
        .get(...ownerIdentity(expected.owner), expected.generation);
      if (owned && row?.state !== "complete") await this.remove(expected);
    };
    try {
      const output = await this.reserve(expected);
      owned = true;
      const copied = await copyImportedFile(raw.path, output, signal, raw, 268435456);
      if (copied.bytes !== expected.raw.bytes || copied.sha256 !== expected.raw.sha256)
        throw new CatalogError("INVALID_PACKAGE", "Transcript raw bytes differ from inventory");
      const {
        encoderPrecision: _precision,
        computeUnits: _units,
        policy: _policy,
        kindPolicy: _kind,
        ...pins
      } = expected.engine;
      const indexed = await this.index({
        identity: expected,
        source: expected.source,
        request: { track, output },
        receipt: { ...receipt, output: { ...receipt.output, file: output } },
        pins,
        signal,
      });
      if (!isDeepStrictEqual(portableTranscript(indexed), expected))
        throw new CatalogError(
          "INVALID_PACKAGE",
          "Indexed transcript differs from retained metadata",
        );
      for (let path = resolve(output); ; path = dirname(path)) {
        const file = await open(path, constants.O_RDONLY);
        try {
          await file.sync();
        } finally {
          await file.close();
        }
        if (path === resolve(this.home)) break;
      }
      return {
        metadata: indexed,
        close,
        publish: () => {
          signal.throwIfAborted();
          this.publish(indexed);
        },
      };
    } catch (error) {
      await close();
      if (error instanceof CatalogError && error.code === "INVALID_RESPONSE")
        throw new CatalogError("INVALID_PACKAGE", error.message, error.details);
      throw error;
    }
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
    this.validateOwner(input.identity, input.source);
    const result = await this.index(input);
    input.signal.throwIfAborted();
    this.store.transaction(() => this.publish(result));
    return result;
  }
  private publish(value: TranscriptMetadata): void {
    this.validateOwner(value, value.source);
    this.store.catalog
      .prepare(`UPDATE transcript_generations SET state='complete' WHERE ${where}`)
      .run(...ownerIdentity(value.owner), value.generation);
  }
  private async index(input: {
    identity: TranscriptIdentity;
    source: TranscriptSource;
    request: Pick<SpeechTranscriptionRequest, "track" | "output">;
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
      !timeValueSchema.safeParse(source.durationUs).success ||
      (source.kind === "asset" &&
        (sourceId !== ownerId || source.streamId !== request.track.streamId))
    )
      throw new CatalogError(
        "INVALID_EVIDENCE",
        "Transcript source does not match its owner or selection",
      );
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
      readUs: TimeValue = 0;
    for (const [ordinal, segment] of receipt.segments.entries()) {
      if (segment.ordinal !== ordinal)
        invalid("Transcription segment ordinals must be unique and ordered");
      while (
        interval < available.length &&
        compare(fromTime(available[interval]!.endUs), fromTime(segment.source.startUs)) <= 0
      )
        interval++;
      const acquired = available[interval];
      if (
        compare(fromTime(segment.source.startUs), fromTime(readUs)) < 0 ||
        compare(fromTime(segment.source.endUs), fromTime(segment.source.startUs)) <= 0 ||
        !acquired ||
        compare(fromTime(segment.source.startUs), fromTime(acquired.startUs)) < 0 ||
        compare(fromTime(segment.source.endUs), fromTime(acquired.endUs)) > 0 ||
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
      "INSERT INTO transcript_segments VALUES(?,?,?,?,?,?,?,?,?)",
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
            round(fromTime(segment.source.startUs)),
            round(fromTime(segment.source.endUs)),
            JSON.stringify(segment.source),
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
        !isDeepStrictEqual(line.data.source, segment.source) ||
        line.data.state !== segment.state ||
        line.data.reason !== segment.reason ||
        line.data.words.length !== segment.wordCount
      )
        invalid("Raw transcript segment differs from its receipt");
      segments.push(segment);
      const observed = {
        startUs: round(fromTime(segment.source.startUs)),
        endUs: round(fromTime(segment.source.endUs)),
      };
      for (const word of line.data.words) {
        const { source } = word;
        if (source.endUs < source.startUs) invalid("Transcript word range is reversed");
        if (source.startUs < observed.startUs || source.endUs > observed.endUs)
          invalid("Transcript word lies outside its segment");
        const instant = source.startUs === source.endUs;
        // A zero-width word at the interval end keeps its microsecond inside the interval.
        const startUs = instant ? Math.min(source.startUs, observed.endUs - 1) : source.startUs;
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
      receipt.segments.map(({ source, state }) => ({
        startUs: round(fromTime(source.startUs)),
        endUs: round(fromTime(source.endUs)),
        state,
      })),
      round(fromTime(durationUs)),
    );
    signal.throwIfAborted();
    return this.store.transaction(() => {
      const insertGap = this.store.catalog.prepare(
        "INSERT INTO transcript_gaps VALUES(?,?,?,?,?,?)",
      );
      for (const gap of gaps)
        insertGap.run(ownerKind, ownerId, generation, gap.startUs, gap.endUs, gap.reason);
      this.store.catalog
        .prepare(
          `UPDATE transcript_generations SET wordCount=?,gapCount=?,maxWordUs=?,rawSha256=?,bytes=? WHERE ${where}`,
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
      if (
        keep(generation) ||
        this.references.has(
          "transcript-generation",
          transcriptGenerationResource({ owner, generation }),
        )
      )
        return;
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
    if (segment.state === "skipped" && segment.startUs < segment.endUs)
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
