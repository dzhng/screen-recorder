import { z } from "zod";
import { CatalogError } from "./catalog.js";
import { comparePageKeys, type PageBound } from "./ordered-pages.js";
import {
  projectSourceRanges,
  projectWords,
  TimelineError,
  trimSpans,
  type RenderSpan,
  type TimeRange,
  type TimelineRevision,
} from "./timeline.js";
import { recordingTranscriptIdentity } from "./transcript.js";
import type {
  TranscriptIdentity,
  TranscriptMetadata,
  GapReason,
  TranscriptGapRecord,
  RecordingTranscriptMetadata,
  TranscriptRecords,
  TranscriptWordRecord,
} from "./transcript.js";
import { foldWord, type WordKind } from "./word-kind.js";

const time = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const reference = {
  recordingId: z.string().min(1),
  revisionId: z.string().min(1),
  generation: z.string().min(1),
  afterSourceUs: time,
  /** The last returned word, or null when the last row was a gap. */
  afterOrdinal: time.nullable(),
};
const pageCursorSchema = z.strictObject({
  ...reference,
  range: z.strictObject({ startUs: time, endUs: time }).nullable(),
});
const searchCursorSchema = z.strictObject({
  ...reference,
  text: z.string(),
  afterOrdinal: time,
});
export type TranscriptPageCursor = z.infer<typeof pageCursorSchema>;
export type TranscriptSearchCursor = z.infer<typeof searchCursorSchema>;

export type TranscriptWordRow = {
  type: "word";
  id: string;
  ordinal: number;
  text: string;
  kind: WordKind;
  sourceRange: TimeRange;
  instant?: true;
  confidence: number | null;
  segment: number;
  partial: boolean;
  fragments: RenderSpan[];
};
export type TranscriptGapRow = {
  type: "gap";
  sourceRange: TimeRange;
  reason: GapReason;
  partial: boolean;
  fragments: RenderSpan[];
};
export type TranscriptRow = TranscriptWordRow | TranscriptGapRow;
export type TranscriptSearchEntry = {
  wordIds: string[];
  sourceRange: TimeRange;
  partial: boolean;
  fragments: RenderSpan[];
};

/** Literal search examines at most this many start words per call, then returns a continuation. */
const searchBudget = 10_000;
const batch = 256;

function limit(value: number | undefined, fallback: number, maximum: number): number {
  const result = value ?? fallback;
  if (!Number.isSafeInteger(result) || result < 1 || result > maximum)
    throw new CatalogError("INVALID_PARAMS", `Limit must be 1 to ${maximum}`);
  return result;
}
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new CatalogError("INVALID_PARAMS", "Invalid transcript continuation");
  return parsed.data;
}
const wordId = (ordinal: number) => `w${ordinal}`;
/** The identity every transcript continuation carries, before its reader validates the rest. */
export function transcriptContinuation(value: unknown) {
  return parse(
    z.object({ recordingId: reference.recordingId, revisionId: reference.revisionId }),
    value,
  );
}

/**
 * Pages and searches one published transcript generation as projected through one revision. Storage
 * adapters only answer bounded ordered record queries, so the SQLite library and portable packages
 * share these semantics.
 */
export class TranscriptRead {
  constructor(
    private readonly records: TranscriptRecords,
    private readonly metadata: RecordingTranscriptMetadata,
    private readonly revision: TimelineRevision,
  ) {}

  private traversal() {
    return new TranscriptTraversal(this.records, recordingTranscriptIdentity(this.metadata));
  }

  private reference() {
    return {
      recordingId: this.metadata.recordingId,
      revisionId: this.revision.id,
      generation: this.metadata.generation,
    };
  }

  private continuation<T extends { recordingId: string; revisionId: string; generation: string }>(
    cursor: T | undefined,
  ): T | undefined {
    const expected = this.reference();
    if (
      cursor &&
      (cursor.recordingId !== expected.recordingId ||
        cursor.revisionId !== expected.revisionId ||
        cursor.generation !== expected.generation)
    )
      throw new CatalogError(
        "ARTIFACT_CHANGED",
        "Transcript continuation belongs to another revision or generation",
        expected,
      );
    return cursor;
  }

  /** Words and gaps in source order, restricted to those retained inside an optional playback range. */
  page(input: { range?: TimeRange | undefined; cursor?: unknown; limit?: number | undefined }) {
    const count = limit(input.limit, 250, 1000);
    const cursor = this.continuation(
      input.cursor === undefined ? undefined : parse(pageCursorSchema, input.cursor),
    );
    const range = input.range ?? cursor?.range ?? null;
    if (
      cursor &&
      (cursor.range?.startUs !== range?.startUs || cursor.range?.endUs !== range?.endUs)
    )
      throw new CatalogError("ARTIFACT_CHANGED", "Transcript continuation used another range");
    let spans: readonly TimeRange[];
    try {
      spans = range ? trimSpans(this.revision, range) : this.revision.spans;
    } catch (error) {
      if (error instanceof TimelineError) throw new CatalogError("INVALID_RANGE", error.message);
      throw error;
    }
    const { records, more, after } = this.traversal().page(
      spans,
      count,
      cursor ? { sourceUs: cursor.afterSourceUs, ordinal: cursor.afterOrdinal } : null,
    );
    const rows: TranscriptRow[] = projectSourceRanges(this.revision, records).map((row) =>
      "ordinal" in row
        ? {
            type: "word",
            id: wordId(row.ordinal),
            ordinal: row.ordinal,
            text: row.text,
            kind: row.kind,
            sourceRange: { startUs: row.startUs, endUs: row.endUs },
            ...(row.instant ? { instant: true as const } : {}),
            confidence: row.confidence,
            segment: row.segment,
            partial: row.partial,
            fragments: row.fragments,
          }
        : {
            type: "gap",
            sourceRange: { startUs: row.startUs, endUs: row.endUs },
            reason: row.reason,
            partial: row.partial,
            fragments: row.fragments,
          },
    );
    return {
      rows,
      nextCursor:
        more && after
          ? ({
              ...this.reference(),
              range,
              afterSourceUs: after.sourceUs,
              afterOrdinal: after.ordinal,
            } satisfies TranscriptPageCursor)
          : null,
    };
  }

  /** Literal, case-folded match over consecutive source words; a word removed by the revision never matches. */
  search(input: { text: string; cursor?: unknown; limit?: number | undefined }) {
    const count = limit(input.limit, 100, 500);
    const terms = transcriptSearchTerms(input.text);
    const cursor = this.continuation(
      input.cursor === undefined ? undefined : parse(searchCursorSchema, input.cursor),
    );
    if (cursor && cursor.text !== input.text)
      throw new CatalogError("ARTIFACT_CHANGED", "Transcript continuation searched other text");
    const result = this.traversal().search(
      terms,
      count,
      cursor ? { startUs: cursor.afterSourceUs, ordinal: cursor.afterOrdinal } : null,
      (phrase) => {
        const projected = projectWords(
          this.revision,
          phrase.map((word) => ({ ...word, id: wordId(word.ordinal) })),
        );
        if (projected.length !== phrase.length) return null;
        // Ends need not grow with starts, so the phrase ends where its latest word does.
        const sourceRange = {
          startUs: phrase[0]!.startUs,
          endUs: Math.max(...phrase.map((word) => word.endUs)),
        };
        const { partial, fragments } = projectSourceRanges(this.revision, [sourceRange])[0]!;
        return {
          wordIds: projected.map((word) => word.id),
          sourceRange,
          partial,
          fragments,
        };
      },
    );
    return this.searchPage(result.entries, input.text, result.last);
  }

  private searchPage(
    entries: TranscriptSearchEntry[],
    text: string,
    last: TranscriptWordRecord | null,
  ) {
    return {
      entries,
      nextCursor: last
        ? ({
            ...this.reference(),
            text,
            afterSourceUs: last.startUs,
            afterOrdinal: last.ordinal,
          } satisfies TranscriptSearchCursor)
        : null,
    };
  }
}

type SourceRecord = TranscriptWordRecord | TranscriptGapRecord;
type AfterRecord = { sourceUs: number; ordinal: number | null } | null;

/** Bounded ordered traversal shared by source, recording and portable-package readers. */
class TranscriptTraversal {
  constructor(
    private readonly records: TranscriptRecords,
    private readonly identity: TranscriptIdentity,
  ) {}

  page(spans: readonly TimeRange[], count: number, after: AfterRecord) {
    const records: SourceRecord[] = [];
    let more = false;
    spans: for (const span of spans) {
      // A later row starts after the last one, so it cannot fall in a span that ended by then.
      if (after && span.endUs <= after.sourceUs) continue;
      const words = this.spanWords(span, after, Math.min(batch, count + 1));
      const gaps = this.spanGaps(span, after, Math.min(batch, count + 1));
      let word = words.next();
      let gap = gaps.next();
      while (!word.done || !gap.done) {
        if (records.length === count) {
          more = true;
          break spans;
        }
        const takeGap = word.done || (!gap.done && gap.value.startUs < word.value.startUs);
        const row = takeGap ? gap.value! : word.value!;
        records.push(row);
        after = { sourceUs: row.startUs, ordinal: "ordinal" in row ? row.ordinal : null };
        if (takeGap) gap = gaps.next();
        else word = words.next();
      }
    }
    return { records, more, after };
  }

  /** Admission guarantees disjoint words, so at most one predecessor can cover the window start. */
  private *spanWords(
    span: TimeRange,
    after: { sourceUs: number; ordinal: number | null } | null,
    fetch: number,
  ) {
    const prior = this.records.wordRecords(this.identity, {
      upper: { key: [span.startUs, 0], inclusive: false },
      reverse: true,
      limit: 1,
    })[0];
    if (
      prior &&
      prior.endUs > span.startUs &&
      (!after ||
        prior.startUs > after.sourceUs ||
        (prior.startUs === after.sourceUs &&
          after.ordinal !== null &&
          prior.ordinal > after.ordinal))
    )
      yield prior;
    const window: PageBound = { key: [span.startUs, 0], inclusive: true };
    const resume: PageBound | null = after
      ? after.ordinal === null
        ? { key: [after.sourceUs + 1, 0], inclusive: true }
        : { key: [after.sourceUs, after.ordinal], inclusive: false }
      : null;
    let lower = resume && comparePageKeys(resume.key, window.key) >= 0 ? resume : window;
    for (;;) {
      const words = this.records.wordRecords(this.identity, {
        lower,
        upper: { key: [span.endUs, 0], inclusive: false },
        limit: fetch,
      });
      for (const word of words) if (word.endUs > span.startUs) yield word;
      if (words.length < fetch) return;
      const last = words.at(-1)!;
      lower = { key: [last.startUs, last.ordinal], inclusive: false };
    }
  }

  /** Gaps are disjoint, so only the one starting at or before the span can already cover it. */
  private *spanGaps(span: TimeRange, after: { sourceUs: number } | null, fetch: number) {
    const prior = this.records.gapRecords(this.identity, {
      upper: { key: [span.startUs], inclusive: true },
      reverse: true,
      limit: 1,
    })[0];
    if (prior && prior.endUs > span.startUs && (!after || prior.startUs > after.sourceUs))
      yield prior;
    let lower: PageBound = {
      key: [Math.max(span.startUs, after?.sourceUs ?? 0)],
      inclusive: false,
    };
    for (;;) {
      const gaps = this.records.gapRecords(this.identity, {
        lower,
        upper: { key: [span.endUs], inclusive: false },
        limit: fetch,
      });
      yield* gaps;
      if (gaps.length < fetch) return;
      lower = { key: [gaps.at(-1)!.startUs], inclusive: false };
    }
  }

  search<T>(
    terms: string[],
    count: number,
    after: { startUs: number; ordinal: number } | null,
    project: (phrase: TranscriptWordRecord[]) => T | null,
  ) {
    let lower: PageBound | undefined = after
      ? { key: [after.startUs, after.ordinal], inclusive: false }
      : undefined;
    const entries: T[] = [];
    let examined = 0;
    let last: TranscriptWordRecord | null = null;
    for (;;) {
      // Fetch enough lookahead that a phrase starting in this batch is complete.
      const words = this.records.wordRecords(this.identity, {
        ...(lower ? { lower } : {}),
        limit: batch + terms.length - 1,
      });
      const starts = words.length < batch + terms.length - 1 ? words.length : batch;
      for (let index = 0; index < starts; index++) {
        if (entries.length === count || examined === searchBudget) return { entries, last };
        examined++;
        last = words[index]!;
        const phrase = words.slice(index, index + terms.length);
        if (
          phrase.length !== terms.length ||
          phrase.some((word, offset) => foldWord(word.text) !== terms[offset])
        )
          continue;
        const entry = project(phrase);
        if (entry) entries.push(entry);
      }
      if (starts < batch) return { entries, last: null };
      lower = { key: [last!.startUs, last!.ordinal], inclusive: false };
    }
  }
}

const sourceReference = {
  assetId: z.string().min(1),
  streamId: z.string().min(1),
  acquisitionId: z.string().min(1).nullable(),
  generation: z.string().min(1),
  supportDigest: z.string().min(1),
  afterSourceUs: time,
  afterOrdinal: time.nullable(),
};
const sourcePageCursor = z.strictObject({
  ...sourceReference,
  range: z.strictObject({ startUs: time, endUs: time }).nullable(),
});
const sourceSearchCursor = z.strictObject({
  ...sourceReference,
  text: z.string(),
  afterOrdinal: time,
});
export type SourceTranscriptPageCursor = z.infer<typeof sourcePageCursor>;
export type SourceTranscriptSearchCursor = z.infer<typeof sourceSearchCursor>;
export type SourceTranscriptRow =
  | Omit<TranscriptWordRow, "fragments">
  | Omit<TranscriptGapRow, "fragments">;
export type SourceTranscriptSearchEntry = Omit<TranscriptSearchEntry, "fragments" | "partial">;

/** Reads immutable source-clock evidence without inventing an editing revision. */
export class SourceTranscriptRead {
  private readonly reference;
  private readonly traversal: TranscriptTraversal;

  constructor(
    records: TranscriptRecords,
    private readonly metadata: TranscriptMetadata,
  ) {
    if (metadata.owner.kind !== "asset" || metadata.source.kind !== "asset")
      throw new CatalogError("INVALID_EVIDENCE", "Source transcript requires an asset source");
    this.reference = {
      assetId: metadata.owner.assetId,
      streamId: metadata.source.streamId,
      acquisitionId: metadata.source.acquisitionId ?? null,
      generation: metadata.generation,
      supportDigest: metadata.source.supportDigest,
    };
    this.traversal = new TranscriptTraversal(records, metadata);
  }

  private continuation<T extends typeof this.reference>(cursor: T | undefined): T | undefined {
    if (
      cursor &&
      Object.entries(this.reference).some(([key, value]) => cursor[key as keyof T] !== value)
    )
      throw new CatalogError(
        "ARTIFACT_CHANGED",
        "Transcript continuation belongs to another source or generation",
        this.reference,
      );
    return cursor;
  }

  /** Range filters overlapping rows; sourceRange stays original and partial reports window clipping. */
  page(input: { range?: TimeRange | undefined; cursor?: unknown; limit?: number | undefined }) {
    const count = limit(input.limit, 250, 1000);
    const cursor = this.continuation(
      input.cursor === undefined ? undefined : parse(sourcePageCursor, input.cursor),
    );
    const range = input.range ?? cursor?.range ?? null;
    if (
      cursor &&
      (cursor.range?.startUs !== range?.startUs || cursor.range?.endUs !== range?.endUs)
    )
      throw new CatalogError("ARTIFACT_CHANGED", "Transcript continuation used another range");
    if (
      range &&
      (!Number.isSafeInteger(range.startUs) ||
        !Number.isSafeInteger(range.endUs) ||
        range.startUs < 0 ||
        range.endUs <= range.startUs ||
        range.endUs > this.metadata.source.durationUs)
    )
      throw new CatalogError("INVALID_RANGE", "Range must be inside the source duration");
    const span = range ?? { startUs: 0, endUs: this.metadata.source.durationUs };
    const { records, more, after } = this.traversal.page(
      [span],
      count,
      cursor ? { sourceUs: cursor.afterSourceUs, ordinal: cursor.afterOrdinal } : null,
    );
    const rows: SourceTranscriptRow[] = records.map((row) => {
      const common = {
        sourceRange: { startUs: row.startUs, endUs: row.endUs },
        partial: row.startUs < span.startUs || row.endUs > span.endUs,
      };
      return "ordinal" in row
        ? {
            type: "word",
            id: wordId(row.ordinal),
            ordinal: row.ordinal,
            text: row.text,
            kind: row.kind,
            confidence: row.confidence,
            segment: row.segment,
            ...(row.instant ? { instant: true as const } : {}),
            ...common,
          }
        : { type: "gap", reason: row.reason, ...common };
    });
    return {
      rows,
      nextCursor:
        more && after
          ? ({
              ...this.reference,
              range,
              afterSourceUs: after.sourceUs,
              afterOrdinal: after.ordinal,
            } satisfies SourceTranscriptPageCursor)
          : null,
    };
  }

  search(input: { text: string; cursor?: unknown; limit?: number | undefined }) {
    const count = limit(input.limit, 100, 500);
    const terms = transcriptSearchTerms(input.text);
    const cursor = this.continuation(
      input.cursor === undefined ? undefined : parse(sourceSearchCursor, input.cursor),
    );
    if (cursor && cursor.text !== input.text)
      throw new CatalogError("ARTIFACT_CHANGED", "Transcript continuation searched other text");
    const { entries, last } = this.traversal.search(
      terms,
      count,
      cursor ? { startUs: cursor.afterSourceUs, ordinal: cursor.afterOrdinal } : null,
      (phrase): SourceTranscriptSearchEntry | null => {
        if (phrase.some((word) => word.segment !== phrase[0]!.segment)) return null;
        return {
          wordIds: phrase.map((word) => wordId(word.ordinal)),
          sourceRange: {
            startUs: phrase[0]!.startUs,
            endUs: Math.max(...phrase.map((word) => word.endUs)),
          },
        };
      },
    );
    return {
      entries,
      nextCursor: last
        ? ({
            ...this.reference,
            text: input.text,
            afterSourceUs: last.startUs,
            afterOrdinal: last.ordinal,
          } satisfies SourceTranscriptSearchCursor)
        : null,
    };
  }
}

export function transcriptSearchTerms(text: string) {
  if (typeof text !== "string" || text.length < 1 || text.length > 200)
    throw new CatalogError("INVALID_PARAMS", "Search text must be 1 to 200 characters");
  const terms = text.split(/\s+/).map(foldWord).filter(Boolean);
  if (!terms.length) throw new CatalogError("INVALID_PARAMS", "Search text contains no words");
  return terms;
}
