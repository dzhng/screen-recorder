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
    let after = cursor ? { sourceUs: cursor.afterSourceUs, ordinal: cursor.afterOrdinal } : null;
    const records: (TranscriptWordRecord | TranscriptGapRecord)[] = [];
    let more = false;
    spans: for (const span of spans) {
      // A later row starts after the last one, so it cannot fall in a span that ended by then.
      if (after && span.endUs <= after.sourceUs) continue;
      const words = this.spanWords(span, after);
      const gaps = this.spanGaps(span, after);
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

  /** Words that intersect a retained source span; a word covering it may start up to maxWordUs earlier. */
  private *spanWords(span: TimeRange, after: { sourceUs: number; ordinal: number | null } | null) {
    const window: PageBound = {
      key: [Math.max(0, span.startUs - this.metadata.maxWordUs), 0],
      inclusive: true,
    };
    const resume: PageBound | null = after
      ? after.ordinal === null
        ? { key: [after.sourceUs + 1, 0], inclusive: true }
        : { key: [after.sourceUs, after.ordinal], inclusive: false }
      : null;
    let lower = resume && comparePageKeys(resume.key, window.key) > 0 ? resume : window;
    for (;;) {
      const words = this.records.wordRecords(recordingTranscriptIdentity(this.metadata), {
        lower,
        upper: { key: [span.endUs, 0], inclusive: false },
        limit: batch,
      });
      for (const word of words) if (word.endUs > span.startUs) yield word;
      if (words.length < batch) return;
      const last = words.at(-1)!;
      lower = { key: [last.startUs, last.ordinal], inclusive: false };
    }
  }

  /** Gaps are disjoint, so only the one starting at or before the span can already cover it. */
  private *spanGaps(span: TimeRange, after: { sourceUs: number } | null) {
    const prior = this.records.gapRecords(recordingTranscriptIdentity(this.metadata), {
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
      const gaps = this.records.gapRecords(recordingTranscriptIdentity(this.metadata), {
        lower,
        upper: { key: [span.endUs], inclusive: false },
        limit: batch,
      });
      yield* gaps;
      if (gaps.length < batch) return;
      lower = { key: [gaps.at(-1)!.startUs], inclusive: false };
    }
  }

  /** Literal, case-folded match over consecutive source words; a word removed by the revision never matches. */
  search(input: { text: string; cursor?: unknown; limit?: number | undefined }) {
    const count = limit(input.limit, 100, 500);
    if (typeof input.text !== "string" || input.text.length < 1 || input.text.length > 200)
      throw new CatalogError("INVALID_PARAMS", "Search text must be 1 to 200 characters");
    const terms = input.text.split(/\s+/).map(foldWord).filter(Boolean);
    if (!terms.length) throw new CatalogError("INVALID_PARAMS", "Search text contains no words");
    const cursor = this.continuation(
      input.cursor === undefined ? undefined : parse(searchCursorSchema, input.cursor),
    );
    if (cursor && cursor.text !== input.text)
      throw new CatalogError("ARTIFACT_CHANGED", "Transcript continuation searched other text");
    let lower: PageBound | undefined = cursor
      ? { key: [cursor.afterSourceUs, cursor.afterOrdinal], inclusive: false }
      : undefined;
    const entries: TranscriptSearchEntry[] = [];
    let examined = 0;
    let last: TranscriptWordRecord | null = null;
    for (;;) {
      // Fetch enough lookahead that a phrase starting in this batch is complete.
      const words = this.records.wordRecords(recordingTranscriptIdentity(this.metadata), {
        ...(lower ? { lower } : {}),
        limit: batch + terms.length - 1,
      });
      const starts = words.length < batch + terms.length - 1 ? words.length : batch;
      for (let index = 0; index < starts; index++) {
        if (entries.length === count || examined === searchBudget)
          return this.searchPage(entries, input.text, last);
        examined++;
        last = words[index]!;
        const phrase = words.slice(index, index + terms.length);
        if (
          phrase.length !== terms.length ||
          phrase.some((word, offset) => foldWord(word.text) !== terms[offset])
        )
          continue;
        const projected = projectWords(
          this.revision,
          phrase.map((word) => ({ ...word, id: wordId(word.ordinal) })),
        );
        if (projected.length !== phrase.length) continue;
        // Ends need not grow with starts, so the phrase ends where its latest word does.
        const sourceRange = {
          startUs: phrase[0]!.startUs,
          endUs: Math.max(...phrase.map((word) => word.endUs)),
        };
        const { partial, fragments } = projectSourceRanges(this.revision, [sourceRange])[0]!;
        entries.push({
          wordIds: projected.map((word) => word.id),
          sourceRange,
          partial,
          fragments,
        });
      }
      if (starts < batch) return this.searchPage(entries, input.text, null);
      lower = { key: [last!.startUs, last!.ordinal], inclusive: false };
    }
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
