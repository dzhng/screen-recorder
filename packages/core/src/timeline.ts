import { z } from "zod";
export type TimeRange = Readonly<{ startUs: number; endUs: number }>;
export type TimelineRevision = Readonly<{
  id: string;
  parentId: string | null;
  ordinal: number;
  operation: string;
  createdAt: string;
  sourceDurationUs: number;
  durationUs: number;
  spans: readonly TimeRange[];
}>;
export class TimelineError extends Error {
  readonly code = "INVALID_RANGE";
}
function validTime(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}
function validateRange(range: TimeRange, durationUs: number): void {
  if (
    !validTime(range.startUs) ||
    !validTime(range.endUs) ||
    range.startUs >= range.endUs ||
    range.endUs > durationUs
  )
    throw new TimelineError("Expected a positive half-open range within the timeline");
}
function freezeSpans(spans: readonly TimeRange[]): readonly TimeRange[] {
  const merged: { startUs: number; endUs: number }[] = [];
  for (const span of spans) {
    const last = merged.at(-1);
    if (last?.endUs === span.startUs) last.endUs = span.endUs;
    else merged.push({ ...span });
  }
  return Object.freeze(merged.map((span) => Object.freeze(span)));
}
export function createOriginalRevision(
  sourceDurationUs: number,
  createdAt: string,
): TimelineRevision {
  validateRange({ startUs: 0, endUs: sourceDurationUs }, sourceDurationUs);
  return Object.freeze({
    id: "r0",
    parentId: null,
    ordinal: 0,
    operation: "original",
    createdAt,
    sourceDurationUs,
    durationUs: sourceDurationUs,
    spans: freezeSpans([{ startUs: 0, endUs: sourceDurationUs }]),
  });
}
export function createRevision(
  parent: TimelineRevision,
  spans: readonly TimeRange[],
  metadata: { id: string; createdAt: string; operation: string },
): TimelineRevision {
  if (!metadata.id || metadata.id === parent.id || metadata.id === "r0")
    throw new Error("A revision requires a fresh ID");
  if (!spans.length) throw new TimelineError("Cannot remove the entire recording");
  let previousEnd = 0;
  let durationUs = 0;
  for (const span of spans) {
    validateRange(span, parent.sourceDurationUs);
    if (span.startUs < previousEnd)
      throw new TimelineError("Source spans must be ordered and non-overlapping");
    previousEnd = span.endUs;
    durationUs += span.endUs - span.startUs;
  }
  return Object.freeze({
    ...metadata,
    parentId: parent.id,
    ordinal: parent.ordinal + 1,
    sourceDurationUs: parent.sourceDurationUs,
    durationUs,
    spans: freezeSpans(spans),
  });
}
export type RenderSpan = Readonly<{ source: TimeRange; playback: TimeRange }>;
export function renderPlan(revision: TimelineRevision): readonly RenderSpan[] {
  let atUs = 0;
  return revision.spans.map((source) => {
    const playback = { startUs: atUs, endUs: atUs + (source.endUs - source.startUs) };
    atUs = playback.endUs;
    return { source, playback };
  });
}
function keepPlayback(
  revision: TimelineRevision,
  ranges: readonly TimeRange[],
): readonly TimeRange[] {
  const kept: TimeRange[] = [];
  for (const { source, playback } of renderPlan(revision))
    for (const range of ranges) {
      const startUs = Math.max(playback.startUs, range.startUs);
      const endUs = Math.min(playback.endUs, range.endUs);
      if (startUs < endUs)
        kept.push({
          startUs: source.startUs + (startUs - playback.startUs),
          endUs: source.startUs + (endUs - playback.startUs),
        });
    }
  return freezeSpans(kept);
}
export function cutSpans(
  revision: TimelineRevision,
  ranges: readonly TimeRange[],
): readonly TimeRange[] {
  if (!ranges.length || ranges.length > 1000)
    throw new TimelineError("Expected 1 to 1000 cut ranges");
  ranges.forEach((range) => validateRange(range, revision.durationUs));
  const union: { startUs: number; endUs: number }[] = [];
  for (const range of [...ranges].sort((a, b) => a.startUs - b.startUs)) {
    const last = union.at(-1);
    if (last && range.startUs <= last.endUs) last.endUs = Math.max(last.endUs, range.endUs);
    else union.push({ ...range });
  }
  const retained: TimeRange[] = [];
  let atUs = 0;
  for (const range of union) {
    if (atUs < range.startUs) retained.push({ startUs: atUs, endUs: range.startUs });
    atUs = range.endUs;
  }
  if (atUs < revision.durationUs) retained.push({ startUs: atUs, endUs: revision.durationUs });
  if (!retained.length) throw new TimelineError("Cannot remove the entire recording");
  return keepPlayback(revision, retained);
}
export function trimSpans(revision: TimelineRevision, range: TimeRange): readonly TimeRange[] {
  validateRange(range, revision.durationUs);
  if (range.startUs === 0 && range.endUs === revision.durationUs) return revision.spans;
  return keepPlayback(revision, [range]);
}
export function editedToSource(
  revision: TimelineRevision,
  atUs: number,
): { sourceUs: number; span: RenderSpan } | null {
  if (!validTime(atUs) || atUs >= revision.durationUs) return null;
  const span = renderPlan(revision).find(
    ({ playback }) => atUs >= playback.startUs && atUs < playback.endUs,
  )!;
  return { sourceUs: span.source.startUs + (atUs - span.playback.startUs), span };
}
export function sourceToEdited(revision: TimelineRevision, sourceUs: number): number | null {
  if (!validTime(sourceUs)) return null;
  const span = renderPlan(revision).find(
    ({ source }) => sourceUs >= source.startUs && sourceUs < source.endUs,
  );
  return span ? span.playback.startUs + (sourceUs - span.source.startUs) : null;
}
export type SourceWord = TimeRange & Readonly<{ id: string; text: string }>;
export function projectWords<T extends SourceWord>(
  revision: TimelineRevision,
  words: readonly T[],
): (T & { partial: boolean; fragments: RenderSpan[] })[] {
  const plan = renderPlan(revision);
  return words.flatMap((word) => {
    validateRange(word, revision.sourceDurationUs);
    const fragments: RenderSpan[] = [];
    for (const span of plan) {
      const startUs = Math.max(word.startUs, span.source.startUs);
      const endUs = Math.min(word.endUs, span.source.endUs);
      if (startUs < endUs)
        fragments.push({
          source: { startUs, endUs },
          playback: {
            startUs: span.playback.startUs + (startUs - span.source.startUs),
            endUs: span.playback.startUs + (endUs - span.source.startUs),
          },
        });
    }
    if (!fragments.length) return [];
    const retainedUs = fragments.reduce(
      (sum, fragment) => sum + (fragment.source.endUs - fragment.source.startUs),
      0,
    );
    return [{ ...word, partial: retainedUs !== word.endUs - word.startUs, fragments }];
  });
}
export type SourceEvent = Readonly<
  | { kind: "pause"; atSourceUs: number; elapsedPauseUs: number }
  | { kind: "interruption" | "geometry" | "scene"; atSourceUs: number }
>;
export type CutEvent = Readonly<{
  kind: "cut";
  atSourceUs: number;
  removedSourceSpans: readonly TimeRange[];
}>;
export type EventGroup = { atUs: number; events: (SourceEvent | CutEvent)[] };
/** Shared point and cut projection for grouped reads and bounded portable streams. */
export function eventProjector(revision: TimelineRevision) {
  const plan = renderPlan(revision);
  return (event: SourceEvent): { atUs: number; event: SourceEvent } | null => {
    if (!validTime(event.atSourceUs) || event.atSourceUs > revision.sourceDurationUs)
      throw new TimelineError("Invalid event time");
    if (event.kind === "pause" && !validTime(event.elapsedPauseUs))
      throw new TimelineError("Invalid elapsed pause");
    // Markers touch both edges; frame/sample lookup remains strictly half-open.
    const span = plan.find(
      ({ source }) => event.atSourceUs >= source.startUs && event.atSourceUs <= source.endUs,
    );
    return span
      ? { atUs: span.playback.startUs + (event.atSourceUs - span.source.startUs), event }
      : null;
  };
}
export function* projectedCuts(
  revision: TimelineRevision,
): Generator<{ atUs: number; event: CutEvent }> {
  const plan = renderPlan(revision);
  let previousEnd = 0;
  for (const span of plan) {
    if (previousEnd < span.source.startUs)
      yield {
        atUs: span.playback.startUs,
        event: {
          kind: "cut",
          atSourceUs: previousEnd,
          removedSourceSpans: [{ startUs: previousEnd, endUs: span.source.startUs }],
        },
      };
    previousEnd = span.source.endUs;
  }
  if (previousEnd < revision.sourceDurationUs)
    yield {
      atUs: revision.durationUs,
      event: {
        kind: "cut",
        atSourceUs: previousEnd,
        removedSourceSpans: [{ startUs: previousEnd, endUs: revision.sourceDurationUs }],
      },
    };
}
export function projectEvents(
  revision: TimelineRevision,
  events: readonly SourceEvent[],
): EventGroup[] {
  const project = eventProjector(revision);
  const projected: { atUs: number; event: SourceEvent | CutEvent }[] = [];
  for (const event of events) {
    const row = project(event);
    if (row) projected.push(row);
  }
  for (const cut of projectedCuts(revision)) projected.push(cut);
  projected.sort((a, b) => a.atUs - b.atUs || a.event.atSourceUs - b.event.atSourceUs);
  const groups: EventGroup[] = [];
  for (const { atUs, event } of projected) {
    const last = groups.at(-1);
    if (last?.atUs === atUs) last.events.push(event);
    else groups.push({ atUs, events: [event] });
  }
  return groups;
}
export function trailBounds(
  revision: TimelineRevision,
  atUs: number,
  boundaries: readonly SourceEvent[],
  trailUs = 2_000_000,
): RenderSpan & { cutoffReason: "requested" | "source_start" | "cut" | SourceEvent["kind"] } {
  if (!validTime(trailUs) || trailUs > 10_000_000)
    throw new TimelineError("Trail must be between zero and ten seconds");
  const frame = editedToSource(revision, atUs);
  if (!frame) throw new TimelineError("Frame time is outside the timeline");
  let startUs = Math.max(0, atUs - trailUs);
  let cutoffReason: "requested" | "source_start" | "cut" | SourceEvent["kind"] =
    atUs < trailUs ? "source_start" : "requested";
  if (frame.span.playback.startUs > startUs || (frame.span.source.startUs > 0 && atUs < trailUs)) {
    startUs = frame.span.playback.startUs;
    cutoffReason = "cut";
  }
  for (const group of projectEvents(revision, boundaries)) {
    if (group.atUs > atUs || group.atUs <= startUs) continue;
    startUs = group.atUs;
    cutoffReason = group.events.at(-1)!.kind;
  }
  return {
    source: { startUs: frame.sourceUs - (atUs - startUs), endUs: frame.sourceUs },
    playback: { startUs, endUs: atUs },
    cutoffReason,
  };
}

/** Portable revision history uses the same constructors and normalization as live edits. */
export function parseRevisionHistory(value: unknown, maximum: number): readonly TimelineRevision[] {
  if (!Number.isSafeInteger(maximum) || maximum < 1) throw new RangeError("Invalid history limit");
  const time = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
  const text = z.string().min(1);
  const schema = z.strictObject({
    id: text,
    parentId: text.nullable(),
    ordinal: time,
    operation: text,
    createdAt: text,
    sourceDurationUs: time,
    durationUs: time,
    spans: z.array(z.strictObject({ startUs: time, endUs: time })).min(1),
  });
  const rows = z.array(schema).min(1).max(maximum).parse(value);
  const ids = new Set<string>();
  for (const [index, row] of rows.entries()) {
    const expected =
      index === 0
        ? createOriginalRevision(row.sourceDurationUs, row.createdAt)
        : createRevision(rows[index - 1]!, row.spans, row);
    if (ids.has(row.id) || JSON.stringify(row) !== JSON.stringify(expected))
      throw new TimelineError("Revision history is not a canonical ordered edit history");
    ids.add(row.id);
  }
  return rows;
}
