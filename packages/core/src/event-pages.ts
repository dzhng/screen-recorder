import { setImmediate } from "node:timers/promises";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import type { EvidenceIdentity } from "./evidence.js";
import type { SourceEvidenceReader } from "./evidence-read.js";
import type { SceneEvidenceIdentity, SceneEvidenceRead } from "./scene-evidence.js";
import type { FileAccess } from "./files.js";
import { CatalogError } from "./library.js";
import { OrderedPages, writeOrderedPages, type OrderedPageCodec } from "./ordered-pages.js";
import {
  eventProjector,
  projectedCuts,
  type TimelineRevision,
  type SourceEvent,
  type CutEvent,
} from "./timeline.js";

export const timelineEventPolicy = "timeline-v1";

export type TimelineEventMetadata = {
  sourceIdentity: EvidenceIdentity;
  sceneIdentity: SceneEvidenceIdentity;
  revision: TimelineRevision;
  interrupted: boolean;
};
export type TimelineEventRow = { ordinal: number; atUs: number; event: SourceEvent | CutEvent };
export type TimelineEventInput = TimelineEventMetadata & {
  source: SourceEvidenceReader;
  scenes: SceneEvidenceRead;
};
const integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const point = { atSourceUs: integer };
const rowSchema = z.strictObject({
  ordinal: integer,
  atUs: integer,
  event: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("pause"), ...point, elapsedPauseUs: integer }),
    z.strictObject({ kind: z.literal("geometry"), ...point }),
    z.strictObject({ kind: z.literal("scene"), ...point }),
    z.strictObject({ kind: z.literal("interruption"), ...point }),
    z.strictObject({
      kind: z.literal("cut"),
      ...point,
      removedSourceSpans: z.array(z.strictObject({ startUs: integer, endUs: integer })).length(1),
    }),
  ]),
});
function invalid(message: string): never {
  throw new CatalogError("INVALID_EVIDENCE", message);
}
function codec(
  expected: TimelineEventMetadata,
): OrderedPageCodec<TimelineEventRow, TimelineEventMetadata> {
  const project = eventProjector(expected.revision);
  const cuts = [...projectedCuts(expected.revision)];
  return {
    metadata: z.custom<TimelineEventMetadata>((value) => isDeepStrictEqual(value, expected)),
    orders: { events: 1 },
    key: (row) => [row.ordinal],
    decode(value) {
      const row = rowSchema.parse(value);
      const projected = { atUs: row.atUs, event: row.event };
      if (row.event.kind === "cut") {
        if (!cuts.some((cut) => isDeepStrictEqual(cut, projected)))
          invalid("Noncanonical cut event");
      } else {
        if (
          row.event.kind === "interruption" &&
          (!expected.interrupted || row.event.atSourceUs !== expected.revision.sourceDurationUs)
        )
          invalid("Noncanonical interruption");
        if (!isDeepStrictEqual(project(row.event), projected))
          invalid("Event differs from pinned projection");
      }
      return row;
    },
  };
}
type OrderedSourceEvent = { event: SourceEvent; sequence: number };
function* sourceEvents(
  input: TimelineEventInput,
  index: "pauses" | "geometry",
): Generator<OrderedSourceEvent> {
  for (const batch of input.source.exportRecords(input.sourceIdentity, index))
    for (const row of batch) {
      const data = JSON.parse(row.content);
      yield {
        sequence: row.sequence,
        event:
          index === "pauses"
            ? { kind: "pause", atSourceUs: data.atSourceUs, elapsedPauseUs: data.elapsedPauseUs }
            : { kind: "geometry", atSourceUs: row.sourceUs! },
      };
    }
}
async function* sceneEvents(
  input: TimelineEventInput,
  signal?: AbortSignal,
): AsyncGenerator<OrderedSourceEvent> {
  let afterStartUs: number | undefined;
  for (;;) {
    const page = input.scenes.page({
      identity: input.sceneIdentity,
      ...(afterStartUs === undefined ? {} : { afterStartUs }),
      limit: 100,
    });
    if (page.metadata.durationUs !== input.revision.sourceDurationUs)
      invalid("Scene duration differs from pinned source");
    for (const chunk of page.chunks)
      for (const event of chunk.boundaries) yield { event, sequence: Number.MAX_SAFE_INTEGER };
    if (page.nextStartUs === null) return;
    afterStartUs = page.nextStartUs;
    await setImmediate(undefined, { signal });
  }
}
/** Merge a fixed number of ordered streams without collecting their complete contents. */
async function* merge<T>(
  streams: (Iterable<T> | AsyncIterable<T>)[],
  compare: (a: T, b: T) => number,
): AsyncGenerator<T> {
  const iterators = streams.map((stream) =>
    (async function* () {
      yield* stream;
    })(),
  );
  const heads = await Promise.all(iterators.map((iterator) => iterator.next()));
  try {
    for (;;) {
      let selected = -1;
      let chosen: IteratorYieldResult<T> | null = null;
      for (let i = 0; i < heads.length; i++) {
        const candidate = heads[i]!;
        if (!candidate.done && (!chosen || compare(candidate.value, chosen.value) < 0)) {
          selected = i;
          chosen = candidate;
        }
      }
      if (!chosen) return;
      yield chosen.value;
      heads[selected] = await iterators[selected]!.next();
    }
  } finally {
    for (const iterator of iterators) await iterator.return(undefined);
  }
}
async function* timelineEventRows(
  input: TimelineEventInput,
  signal?: AbortSignal,
): AsyncGenerator<TimelineEventRow> {
  if (
    input.sourceIdentity.recordingId !== input.sceneIdentity.recordingId ||
    input.sourceIdentity.sourceId !== input.sceneIdentity.sourceId
  )
    invalid("Event inputs name different sources");
  const project = eventProjector(input.revision);
  async function* projected() {
    let consumed = 0;
    const interruption: OrderedSourceEvent[] = input.interrupted
      ? [
          {
            event: { kind: "interruption", atSourceUs: input.revision.sourceDurationUs },
            sequence: Number.MAX_SAFE_INTEGER,
          },
        ]
      : [];
    for await (const { event } of merge(
      [
        sourceEvents(input, "pauses"),
        sourceEvents(input, "geometry"),
        sceneEvents(input, signal),
        interruption,
      ],
      (a, b) => a.event.atSourceUs - b.event.atSourceUs || a.sequence - b.sequence,
    )) {
      if (++consumed % 256 === 0) await setImmediate(undefined, { signal });
      signal?.throwIfAborted();
      const row = project(event);
      if (row) yield row;
    }
  }
  let ordinal = 0;
  for await (const row of merge<{ atUs: number; event: SourceEvent | CutEvent }>(
    [projected(), projectedCuts(input.revision)],
    (a, b) => a.atUs - b.atUs || a.event.atSourceUs - b.event.atSourceUs,
  ))
    yield { ordinal: ordinal++, ...row };
}
export function writeTimelineEventPages(
  input: TimelineEventInput,
  directory: string,
  signal?: AbortSignal,
): Promise<void> {
  const { sourceIdentity, sceneIdentity, revision, interrupted } = input;
  const metadata = {
    sourceIdentity: {
      recordingId: sourceIdentity.recordingId,
      sourceId: sourceIdentity.sourceId,
      generation: sourceIdentity.generation,
    },
    sceneIdentity: {
      recordingId: sceneIdentity.recordingId,
      sourceId: sceneIdentity.sourceId,
      generation: sceneIdentity.generation,
      policy: sceneIdentity.policy,
    },
    revision,
    interrupted,
  };
  async function* batches() {
    let batch: TimelineEventRow[] = [];
    for await (const row of timelineEventRows(input, signal)) {
      batch.push(row);
      if (batch.length === 256) {
        yield batch;
        batch = [];
      }
    }
    if (batch.length) yield batch;
  }
  return writeOrderedPages(directory, metadata, codec(metadata), batches, signal);
}
/** Equal-time groups may cross pages. Continue by ordinal, retaining atUs to coalesce them. */
export class FileTimelineEvents {
  private readonly pages: OrderedPages<TimelineEventRow, TimelineEventMetadata>;
  constructor(root: string | FileAccess, expected: TimelineEventMetadata) {
    this.pages = new OrderedPages(root, codec(expected));
  }
  page({ afterOrdinal, limit = 100 }: { afterOrdinal?: number; limit?: number } = {}) {
    if (
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 1000 ||
      (afterOrdinal !== undefined && (!Number.isSafeInteger(afterOrdinal) || afterOrdinal < 0))
    )
      invalid("Invalid event continuation");
    const rows = this.pages.read({
      index: "events",
      limit: limit + 1,
      ...(afterOrdinal === undefined ? {} : { lower: { key: [afterOrdinal], inclusive: false } }),
    });
    let previous = afterOrdinal ?? -1;
    for (const row of rows) {
      if (row.ordinal !== previous + 1) invalid("Noncontiguous event ordinals");
      previous = row.ordinal;
    }
    const more = rows.length > limit;
    if (more) rows.pop();
    return { rows, nextOrdinal: more ? rows.at(-1)!.ordinal : null };
  }
}

/** Full bounded semantic admission compares every portable event with pinned evidence. */
export async function validateTimelineEventPages(
  reader: FileTimelineEvents,
  input: TimelineEventInput,
  signal?: AbortSignal,
): Promise<void> {
  signal?.throwIfAborted();
  const expected = timelineEventRows(input, signal);
  try {
    let afterOrdinal: number | undefined;
    for (;;) {
      const page = reader.page(afterOrdinal === undefined ? {} : { afterOrdinal });
      for (const row of page.rows) {
        const next = await expected.next();
        if (next.done || !isDeepStrictEqual(row, next.value))
          invalid("Event pages differ from pinned source evidence");
      }
      if (page.nextOrdinal === null) break;
      afterOrdinal = page.nextOrdinal;
    }
    if (!(await expected.next()).done) invalid("Event pages omit pinned source evidence");
    signal?.throwIfAborted();
  } finally {
    await expected.return(undefined);
  }
}
