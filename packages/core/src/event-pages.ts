import { setImmediate } from "node:timers/promises";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import type { EvidenceIdentity } from "./evidence.js";
import type { SourceEvidenceReader } from "./evidence-read.js";
import {
  sceneBoundaries,
  type SceneEvidenceIdentity,
  type SceneEvidenceRead,
} from "./scene-evidence.js";
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
  const cuts = new Map(
    [...projectedCuts(expected.revision)].map((cut) => [cut.event.atSourceUs, cut]),
  );
  return {
    metadata: z.custom<TimelineEventMetadata>((value) => isDeepStrictEqual(value, expected)),
    orders: { events: 1 },
    key: (row) => [row.ordinal],
    decode(value) {
      const row = rowSchema.parse(value);
      const projected = { atUs: row.atUs, event: row.event };
      if (row.event.kind === "cut") {
        if (!isDeepStrictEqual(cuts.get(row.event.atSourceUs), projected))
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
const sourcePosition = z.strictObject({
  after: z.tuple([integer, integer]).nullable(),
  done: z.boolean(),
});
export const timelineEventCursorSchema = z.strictObject({
  pauses: sourcePosition,
  geometry: sourcePosition,
  scenes: z.strictObject({
    afterChunkStartUs: integer.nullable(),
    boundaryOffset: integer,
    done: z.boolean(),
  }),
  cut: integer,
  interruption: z.boolean(),
  ordinal: integer,
});
export type TimelineEventCursor = z.infer<typeof timelineEventCursorSchema>;
type ProjectedEvent = Omit<TimelineEventRow, "ordinal">;
type Head = ProjectedEvent & { sequence: number; consume(): Promise<void> };

/** Stateless checkpoints bound both returned rows and work consumed while skipping removed evidence. */
export class TimelineEventRead {
  private readonly project: ReturnType<typeof eventProjector>;
  private readonly cuts: readonly ProjectedEvent[];
  private readonly input: TimelineEventInput;
  constructor(input: TimelineEventInput) {
    this.input = { ...input, ...structuredClone(eventMetadata(input)) };
    if (
      input.sourceIdentity.recordingId !== input.sceneIdentity.recordingId ||
      input.sourceIdentity.sourceId !== input.sceneIdentity.sourceId
    )
      invalid("Event inputs name different sources");
    this.project = eventProjector(this.input.revision);
    this.cuts = [...projectedCuts(this.input.revision)];
  }
  async page(
    {
      cursor,
      limit = 100,
    }: { cursor?: TimelineEventCursor | undefined; limit?: number | undefined } = {},
    signal?: AbortSignal,
  ): Promise<{ rows: TimelineEventRow[]; nextCursor: TimelineEventCursor | null }> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500)
      throw new CatalogError("INVALID_RANGE", "Event pages require 1 to 500 rows");
    signal?.throwIfAborted();
    const state: TimelineEventCursor = cursor
      ? timelineEventCursorSchema.parse(cursor)
      : {
          pauses: { after: null, done: false },
          geometry: { after: null, done: false },
          scenes: { afterChunkStartUs: null, boundaryOffset: 0, done: false },
          cut: 0,
          interruption: false,
          ordinal: 0,
        };
    if (state.cut > this.cuts.length || state.ordinal > Number.MAX_SAFE_INTEGER - limit)
      throw new CatalogError("INVALID_RANGE", "Invalid event continuation");
    let consumed = 0;
    const advance = async () => {
      consumed++;
      if (consumed % 256 === 0) await setImmediate(undefined, { signal });
      signal?.throwIfAborted();
    };
    const budget = 1024;
    const sourceHead = (index: "pauses" | "geometry") => {
      let records: ReturnType<SourceEvidenceReader["eventRecords"]> = [],
        offset = 0;
      return async (): Promise<Head | null> => {
        const position = state[index];
        while (!position.done && consumed < budget) {
          if (offset === records.length) {
            records = this.input.source.eventRecords(
              this.input.sourceIdentity,
              index,
              position.after,
              256,
            );
            offset = 0;
            if (!records.length) {
              position.done = true;
              return null;
            }
          }
          const record = records[offset]!,
            data = JSON.parse(record.content);
          const event: SourceEvent =
            index === "pauses"
              ? { kind: "pause", atSourceUs: data.atSourceUs, elapsedPauseUs: data.elapsedPauseUs }
              : { kind: "geometry", atSourceUs: record.sourceUs! };
          const consume = async () => {
            position.after = [record.sourceUs!, record.sequence];
            offset++;
            await advance();
          };
          const projected = this.project(event);
          if (projected) return { ...projected, sequence: record.sequence, consume };
          await consume();
        }
        return null;
      };
    };
    let chunks: ReturnType<SceneEvidenceRead["page"]>["chunks"] = [],
      chunkOffset = 0;
    const sceneHead = async (): Promise<Head | null> => {
      const position = state.scenes;
      while (!position.done && consumed < budget) {
        if (chunkOffset === chunks.length) {
          const page = this.input.scenes.page({
            identity: this.input.sceneIdentity,
            ...(position.afterChunkStartUs === null
              ? {}
              : { afterStartUs: position.afterChunkStartUs }),
            limit: 100,
          });
          if (page.metadata.durationUs !== this.input.revision.sourceDurationUs)
            invalid("Scene duration differs from pinned source");
          chunks = page.chunks;
          chunkOffset = 0;
          if (!chunks.length) {
            position.done = true;
            return null;
          }
        }
        const chunk = chunks[chunkOffset]!,
          boundaries = sceneBoundaries(chunk);
        if (position.boundaryOffset > boundaries.length)
          throw new CatalogError("INVALID_RANGE", "Scene event continuation is outside its chunk");
        if (position.boundaryOffset === boundaries.length) {
          position.afterChunkStartUs = chunk.range.startUs;
          position.boundaryOffset = 0;
          chunkOffset++;
          await advance();
          continue;
        }
        const event = boundaries[position.boundaryOffset]!;
        const consume = async () => {
          position.boundaryOffset++;
          await advance();
        };
        const projected = this.project(event);
        if (projected) return { ...projected, sequence: Number.MAX_SAFE_INTEGER, consume };
        await consume();
      }
      return null;
    };
    const cutHead = async (): Promise<Head | null> => {
      const cut = this.cuts[state.cut];
      return cut
        ? {
            ...cut,
            sequence: Number.MAX_SAFE_INTEGER,
            consume: async () => {
              state.cut++;
              await advance();
            },
          }
        : null;
    };
    const interruptionHead = async (): Promise<Head | null> => {
      if (state.interruption) return null;
      const projected = this.input.interrupted
        ? this.project({ kind: "interruption", atSourceUs: this.input.revision.sourceDurationUs })
        : null;
      if (!projected) {
        state.interruption = true;
        return null;
      }
      return {
        ...projected,
        sequence: Number.MAX_SAFE_INTEGER,
        consume: async () => {
          state.interruption = true;
          await advance();
        },
      };
    };
    const readers = [
      sourceHead("pauses"),
      sourceHead("geometry"),
      sceneHead,
      interruptionHead,
      cutHead,
    ];
    const heads: (Head | null | undefined)[] = Array.from({ length: readers.length });
    const rows: TimelineEventRow[] = [];
    while (consumed < budget && rows.length < limit) {
      for (let i = 0; i < readers.length; i++) {
        if (heads[i] === undefined) heads[i] = await readers[i]!();
        if (consumed >= budget) return { rows, nextCursor: state };
      }
      let selected = -1;
      for (let i = 0; i < heads.length; i++) {
        const head = heads[i];
        if (!head) continue;
        const prior = selected < 0 ? null : heads[selected]!;
        if (
          !prior ||
          head.atUs < prior.atUs ||
          (head.atUs === prior.atUs &&
            (head.event.atSourceUs < prior.event.atSourceUs ||
              (head.event.atSourceUs === prior.event.atSourceUs && head.sequence < prior.sequence)))
        )
          selected = i;
      }
      if (selected < 0) return { rows, nextCursor: null };
      const head = heads[selected]!;
      rows.push({ ordinal: state.ordinal++, atUs: head.atUs, event: head.event });
      await head.consume();
      heads[selected] = undefined;
    }
    return { rows, nextCursor: state };
  }
}
async function* timelineEventRows(
  input: TimelineEventInput,
  signal?: AbortSignal,
): AsyncGenerator<TimelineEventRow> {
  const reader = new TimelineEventRead(input);
  let cursor: TimelineEventCursor | undefined;
  for (;;) {
    const page = await reader.page({ cursor, limit: 500 }, signal);
    yield* page.rows;
    if (!page.nextCursor) return;
    cursor = page.nextCursor;
    await setImmediate(undefined, { signal });
  }
}
function eventMetadata(input: TimelineEventMetadata): TimelineEventMetadata {
  const { sourceIdentity, sceneIdentity, revision, interrupted } = input;
  return {
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
}
export function writeTimelineEventPages(
  input: TimelineEventInput,
  directory: string,
  signal?: AbortSignal,
): Promise<void> {
  const metadata = eventMetadata(input);
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
    this.pages = new OrderedPages(root, codec(eventMetadata(expected)));
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
      await setImmediate(undefined, { signal });
    }
    if (!(await expected.next()).done) invalid("Event pages omit pinned source evidence");
    signal?.throwIfAborted();
  } finally {
    await expected.return(undefined);
  }
}
