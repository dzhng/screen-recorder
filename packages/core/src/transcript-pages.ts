import { createHash } from "node:crypto";
import { fstatSync, readSync } from "node:fs";
import { setImmediate } from "node:timers/promises";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { fileAccess, type FileAccess } from "./files.js";
import { CatalogError } from "./catalog.js";
import { OrderedPages, writeOrderedPages, type OrderedPageCodec } from "./ordered-pages.js";
import type { TimeRange, TimelineRevision } from "./timeline.js";
import {
  transcriptGaps,
  recordingTranscriptIdentity,
  type RecordingTranscriptIdentity,
  transcriptPolicy,
  transcriptEngineSchema,
  type TranscriptGapRecord,
  type TranscriptIdentity,
  type RecordingTranscriptMetadata,
  type TranscriptRecordQuery,
  type TranscriptRecords,
  type TranscriptSegmentRecord,
  type TranscriptStore,
  type TranscriptWordRecord,
} from "./transcript.js";
import { TranscriptRead, type TranscriptRow } from "./transcript-read.js";
import { wordKind, wordKindPolicy } from "./word-kind.js";

/** The narration member relative to the package root, which portable metadata names instead of a library path. */
export const portableNarration = "source/narration.mov";
/** The retained engine output beside the source-transcript pages. */
export const portableRawTranscript = "raw.jsonl";

const integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const text = z.string().min(1).max(256);
const sourceRange = z.strictObject({ startUs: integer, endUs: integer });
const metadataSchema = z.strictObject({
  recordingId: text,
  sourceId: text,
  generation: text,
  sourceGeneration: text,
  engine: transcriptEngineSchema,
  narration: z.strictObject({ source: z.literal(portableNarration), sourceOffsetUs: integer }),
  segmentCount: integer,
  wordCount: integer,
  gapCount: integer,
  maxWordUs: integer,
  raw: z.strictObject({ bytes: integer, sha256: z.string().regex(/^[a-f0-9]{64}$/) }),
});
const schemas = {
  words: z.strictObject({
    id: z.string().regex(/^w\d+$/),
    ordinal: integer,
    text: z.string().min(1).max(1024),
    kind: z.enum(["speech", "filler", "vocalization"]),
    sourceRange,
    instant: z.literal(true).optional(),
    confidence: z.number().min(0).max(1).nullable(),
    segment: integer,
  }),
  gaps: z.strictObject({ sourceRange, reason: z.enum(["not_acquired", "too_short"]) }),
  segments: z.strictObject({
    ordinal: integer,
    sourceRange,
    state: z.enum(["transcribed", "skipped"]),
    reason: z.literal("too_short").nullable(),
  }),
};
type Index = keyof typeof schemas;
/** Page rows label source time explicitly, as the package contract requires. */
type Row = z.infer<(typeof schemas)[Index]>;
type WordRow = z.infer<typeof schemas.words>;

const codec: OrderedPageCodec<Row, RecordingTranscriptMetadata> = {
  metadata: metadataSchema,
  orders: { words: 2, gaps: 1, segments: 1 },
  decode(value, { index }) {
    const row = schemas[index as Index].parse(value);
    const { startUs, endUs } = row.sourceRange;
    const canonical =
      endUs > startUs &&
      ("id" in row
        ? row.id === `w${row.ordinal}` &&
          row.kind === wordKind(row.text) &&
          (!row.instant || endUs === startUs + 1)
        : "state" in row
          ? (row.state === "skipped") === (row.reason === "too_short")
          : true);
    if (!canonical) throw new CatalogError("INVALID_EVIDENCE", "Transcript row is not canonical");
    return row;
  },
  key: (row, index) =>
    index === "words"
      ? [row.sourceRange.startUs, (row as WordRow).ordinal]
      : index === "gaps"
        ? [row.sourceRange.startUs]
        : [(row as z.infer<typeof schemas.segments>).ordinal],
};

function wordRow({
  ordinal,
  text,
  kind,
  startUs,
  endUs,
  instant,
  confidence,
  segment,
}: TranscriptWordRecord): WordRow {
  return {
    id: `w${ordinal}`,
    ordinal,
    text,
    kind,
    sourceRange: { startUs, endUs },
    ...(instant ? { instant } : {}),
    confidence,
    segment,
  };
}

type SourceTranscriptRecords = Pick<
  TranscriptStore,
  "wordRecords" | "gapRecords" | "segmentRecords"
>;

/** Writes one published generation in source time; the raw engine output is copied beside it. */
export function writeTranscriptPages(
  records: SourceTranscriptRecords,
  metadata: RecordingTranscriptMetadata,
  directory: string,
  signal?: AbortSignal,
): Promise<void> {
  const rows = (index: string, query: TranscriptRecordQuery): Row[] =>
    index === "words"
      ? records.wordRecords(recordingTranscriptIdentity(metadata), query).map(wordRow)
      : index === "gaps"
        ? records
            .gapRecords(recordingTranscriptIdentity(metadata), query)
            .map(({ startUs, endUs, reason }) => ({ sourceRange: { startUs, endUs }, reason }))
        : records
            .segmentRecords(recordingTranscriptIdentity(metadata), query)
            .map(({ startUs, endUs, ...segment }) => ({
              ...segment,
              sourceRange: { startUs, endUs },
            }));
  return writeOrderedPages(
    directory,
    { ...metadata, narration: { ...metadata.narration, source: portableNarration } },
    codec,
    function* (index) {
      let lower: TranscriptRecordQuery["lower"];
      for (;;) {
        const page = rows(index, { ...(lower ? { lower } : {}), limit: 256 });
        if (page.length) yield page;
        if (page.length < 256) return;
        lower = { key: codec.key(page.at(-1)!, index), inclusive: false };
      }
    },
    signal,
  );
}

/** One portable generation as the ordered records `TranscriptRead` consumes. */
export class FileTranscript implements TranscriptRecords {
  private readonly pages: OrderedPages<Row, RecordingTranscriptMetadata>;
  readonly root: FileAccess;
  constructor(root: string | FileAccess) {
    this.root = fileAccess(root);
    this.pages = new OrderedPages(this.root, codec);
    const metadata = this.pages.metadata;
    if (
      this.pages.rowCount("words") !== metadata.wordCount ||
      this.pages.rowCount("gaps") !== metadata.gapCount ||
      this.pages.rowCount("segments") !== metadata.segmentCount
    )
      throw new CatalogError("INVALID_EVIDENCE", "Transcript page counts differ from metadata");
  }
  get metadata(): RecordingTranscriptMetadata {
    return structuredClone(this.pages.metadata);
  }
  private rows(identity: TranscriptIdentity, index: Index, query: TranscriptRecordQuery) {
    const { recordingId, sourceId, generation } = this.pages.metadata;
    if (
      identity.owner.kind !== "recording" ||
      identity.owner.recordingId !== recordingId ||
      identity.sourceId !== sourceId ||
      identity.generation !== generation
    )
      throw new CatalogError("NOT_READY", "Transcript generation is not in this package");
    return this.pages.read({ index, ...query });
  }
  wordRecords(identity: TranscriptIdentity, query: TranscriptRecordQuery): TranscriptWordRecord[] {
    return (this.rows(identity, "words", query) as WordRow[]).map(
      ({ id: _id, sourceRange, instant, ...word }) => ({
        ...word,
        ...sourceRange,
        instant: instant === true,
      }),
    );
  }
  gapRecords(identity: TranscriptIdentity, query: TranscriptRecordQuery): TranscriptGapRecord[] {
    return (this.rows(identity, "gaps", query) as z.infer<typeof schemas.gaps>[]).map(
      ({ sourceRange, reason }) => ({ ...sourceRange, reason }),
    );
  }
  segmentRecords(
    identity: TranscriptIdentity,
    query: TranscriptRecordQuery,
  ): TranscriptSegmentRecord[] {
    return (this.rows(identity, "segments", query) as z.infer<typeof schemas.segments>[]).map(
      ({ sourceRange, ...segment }) => ({ ...segment, ...sourceRange }),
    );
  }
}

const editedMetadataSchema = z.strictObject({
  recordingId: text,
  sourceId: text,
  revisionId: text,
  generation: text,
  policy: z.literal(transcriptPolicy),
});
/** A projected row of the pinned revision, numbered in reading order. */
export type EditedTranscriptRow = TranscriptRow & { position: number };
const editedCodec: OrderedPageCodec<EditedTranscriptRow, z.infer<typeof editedMetadataSchema>> = {
  metadata: editedMetadataSchema,
  orders: { rows: 1 },
  // Admission compares every row with the projection of the source pages, which is stricter than a schema.
  decode: (value) =>
    z.looseObject({ position: integer }).parse(value) as unknown as EditedTranscriptRow,
  key: (row) => [row.position],
};
function* projectedRows(read: TranscriptRead): Generator<EditedTranscriptRow[]> {
  let cursor: unknown,
    position = 0;
  for (;;) {
    const page = read.page({ limit: 1000, ...(cursor ? { cursor } : {}) });
    yield page.rows.map((row) => ({ position: position++, ...row }));
    if (!page.nextCursor) return;
    cursor = page.nextCursor;
  }
}

/** The pinned revision's projection, so the package carries the edited transcript in playback time. */
export function writeEditedTranscriptPages(
  read: TranscriptRead,
  metadata: z.infer<typeof editedMetadataSchema>,
  directory: string,
  signal?: AbortSignal,
): Promise<void> {
  return writeOrderedPages(directory, metadata, editedCodec, () => projectedRows(read), signal);
}

function invalid(message: string): never {
  throw new CatalogError("INVALID_PACKAGE", message);
}

/**
 * Full admission of portable transcript payloads: canonical source rows that agree with the
 * package's own narration acquisition, the hashed raw engine output, and an edited transcript that
 * is exactly the pinned revision's projection of those rows.
 */
export async function validateTranscriptPages(
  input: {
    source: string | FileAccess;
    edited: string | FileAccess;
    identity: RecordingTranscriptIdentity;
    revision: TimelineRevision;
    /** Acquired narration intervals from the same package's source evidence. */
    narration: readonly TimeRange[];
  },
  signal?: AbortSignal,
): Promise<FileTranscript> {
  try {
    return await validate(input, signal);
  } catch (error) {
    if (error instanceof CatalogError && error.code === "INVALID_EVIDENCE")
      invalid(`Portable transcript is invalid: ${error.message}`);
    throw error;
  }
}

async function validate(
  { source, edited, identity, revision, narration }: Parameters<typeof validateTranscriptPages>[0],
  signal?: AbortSignal,
): Promise<FileTranscript> {
  const transcript = new FileTranscript(source);
  const metadata = transcript.metadata;
  if (
    metadata.recordingId !== identity.recordingId ||
    metadata.sourceId !== identity.sourceId ||
    metadata.generation !== identity.generation
  )
    invalid("Portable transcript belongs to another generation");
  const pause = () => setImmediate(undefined, signal ? { signal } : {});

  async function* all<T>(
    read: (query: TranscriptRecordQuery) => T[],
    key: (row: T) => number[],
  ): AsyncGenerator<T> {
    let lower: TranscriptRecordQuery["lower"];
    for (;;) {
      const rows = read({ ...(lower ? { lower } : {}), limit: 1024 });
      yield* rows;
      if (rows.length < 1024) return;
      lower = { key: key(rows.at(-1)!), inclusive: false };
      await pause();
    }
  }

  // A segment is an ordered, nonempty part of one acquired interval, as ingestion admits it.
  const segments: TranscriptSegmentRecord[] = [];
  let interval = 0;
  for await (const segment of all(
    (query) => transcript.segmentRecords(recordingTranscriptIdentity(identity), query),
    (row) => [row.ordinal],
  )) {
    while (interval < narration.length && narration[interval]!.endUs <= segment.startUs) interval++;
    const acquired = narration[interval];
    if (
      segment.ordinal !== segments.length ||
      segment.startUs < (segments.at(-1)?.endUs ?? 0) ||
      !acquired ||
      segment.startUs < acquired.startUs ||
      segment.endUs > acquired.endUs
    )
      invalid("Transcript segment lies outside acquired narration");
    segments.push(segment);
  }
  const gaps = transcriptGaps(segments, revision.sourceDurationUs);
  let gap = 0;
  for await (const actual of all(
    (query) => transcript.gapRecords(recordingTranscriptIdentity(identity), query),
    (row) => [row.startUs],
  ))
    if (!isDeepStrictEqual(actual, gaps[gap++]))
      invalid("Transcript gaps differ from the source segments");
  if (gap !== gaps.length) invalid("Transcript gaps differ from the source segments");

  let ordinal = 0,
    maxWordUs = 0,
    previousEndUs = 0;
  for await (const word of all(
    (query) => transcript.wordRecords(recordingTranscriptIdentity(identity), query),
    (row) => [row.startUs, row.ordinal],
  )) {
    const segment = segments[word.segment];
    if (word.ordinal !== ordinal++) invalid("Transcript word ordinals are not contiguous");
    if (
      segment?.state !== "transcribed" ||
      word.startUs < segment.startUs ||
      word.endUs > segment.endUs
    )
      invalid("Transcript word lies outside its segment");
    if (word.startUs < previousEndUs) invalid("Transcript words must not overlap");
    previousEndUs = word.endUs;
    maxWordUs = Math.max(maxWordUs, word.endUs - word.startUs);
  }
  if (maxWordUs !== metadata.maxWordUs) invalid("Transcript word bound differs from metadata");

  const raw = transcript.root.open(portableRawTranscript);
  try {
    if (!fstatSync(raw.fd).isFile()) invalid("Raw transcript is not a regular file");
    const hash = createHash("sha256"),
      buffer = Buffer.alloc(1_048_576);
    let bytes = 0,
      read: number;
    while (
      bytes <= metadata.raw.bytes &&
      (read = readSync(raw.fd, buffer, 0, buffer.length, bytes)) > 0
    ) {
      hash.update(buffer.subarray(0, read));
      bytes += read;
      await pause();
    }
    if (bytes !== metadata.raw.bytes || hash.digest("hex") !== metadata.raw.sha256)
      invalid("Raw transcript differs from its hash");
  } finally {
    raw.close();
  }

  const pages = new OrderedPages(edited, editedCodec);
  if (
    !isDeepStrictEqual(pages.metadata, {
      recordingId: identity.recordingId,
      sourceId: identity.sourceId,
      revisionId: revision.id,
      generation: identity.generation,
      policy: transcriptPolicy,
    })
  )
    invalid("Edited transcript belongs to another revision or generation");
  let position = 0;
  for (const expected of projectedRows(new TranscriptRead(transcript, metadata, revision))) {
    const rows = pages.read({
      index: "rows",
      lower: { key: [position], inclusive: true },
      limit: expected.length || 1,
    });
    if (!isDeepStrictEqual(rows, expected))
      invalid("Edited transcript differs from the pinned projection");
    position += expected.length;
    await pause();
  }
  if (pages.rowCount("rows") !== position)
    invalid("Edited transcript differs from the pinned projection");
  return transcript;
}
